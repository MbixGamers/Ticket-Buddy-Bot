const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { client, ticketsDB } = require("../init.js");
const {
  configEmbed,
  sanitizeInput,
  logMessage,
  getChannel,
  getUserPreference,
  getUser,
  logError,
} = require("./mainUtils.js");
const { autoCloseTicket } = require("./ticketAutoClose.js");
const { autoDeleteTicket } = require("./ticketAutoDelete.js");
const { sendFeedback } = require("./ticketFeedback.js");

async function alertTicket(interaction, user, time = null) {
  const closeButton = new ButtonBuilder()
    .setCustomId("closeTicket")
    .setLabel(config.closeButton.label)
    .setEmoji(config.closeButton.emoji)
    .setStyle(ButtonStyle[config.closeButton.style]);

  const ticketAlertRow = new ActionRowBuilder().addComponents(closeButton);

  const logDefaultValues = {
    color: "#FF2400",
    title: "Ticket Logs | Ticket Alert",
    timestamp: true,
    thumbnail: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    footer: {
      text: `${interaction.user.tag}`,
      iconURL: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    },
  };

  const logAlertEmbed = await configEmbed("logAlertEmbed", logDefaultValues);
  const ticketType = await ticketsDB.get(
    `${interaction.channel.id}.ticketType`,
  );
  const ticketCreator = await getUser(
    await ticketsDB.get(`${interaction.channel.id}.userID`),
  );

  logAlertEmbed.addFields([
    {
      name: config.logAlertEmbed.field_staff || "• Alert Sent By",
      value: `> <@!${interaction.user.id}>\n> ${sanitizeInput(interaction.user.tag)}`,
    },
    {
      name: config.logAlertEmbed.field_user || "• Alert Sent To",
      value: `> <@!${user.id}>\n> ${sanitizeInput(user.tag)}`,
    },
    {
      name: config.logAlertEmbed.field_creator || "• Ticket Creator",
      value: `> <@!${ticketCreator.id}>\n> ${sanitizeInput(ticketCreator.tag)}`,
    },
    {
      name: config.logAlertEmbed.field_ticket || "• Ticket",
      value: `> #${sanitizeInput(interaction.channel.name)}\n> ${ticketType}`,
    },
  ]);

  const defaultValues = {
    color: "#2FF200",
    title: "Ticket Close Notification",
    description:
      "This ticket will be closed soon if no response has been received.",
    timestamp: true,
  };

  const alertEmbed = await configEmbed("alertEmbed", defaultValues);

  const collectorTimeInSeconds = time || config.alertReply.time || 120;
  const now = new Date();
  const future = new Date(now.getTime() + collectorTimeInSeconds * 1000);
  const inTime = Math.floor(future.getTime() / 1000);
  if (alertEmbed.data && alertEmbed.data.description) {
    alertEmbed.setDescription(
      alertEmbed.data.description.replace(/\{time\}/g, `<t:${inTime}:R>`),
    );
  }

  logAlertEmbed.addFields({
    name: config.logAlertEmbed.field_time || "• Time",
    value: `> ${collectorTimeInSeconds} seconds`,
  });

  await interaction
    .editReply({
      embeds: [alertEmbed],
      components: [ticketAlertRow],
    })
    .then(async () => {
      await interaction.followUp(`<@${user.id}>`);
    })
    .catch((error) => {
      console.error(`[Slash Command: Alert] Error: ${error}`);
    });

  if (time) {
    const channelID = interaction.channel.id;
    const alertDueTime = Date.now() + time * 1000;
    await ticketsDB.set(`${channelID}.alertDueTime`, alertDueTime);
  }

  if (config.alertReply.enabled) {
    const channelID = interaction.channel.id;
    const filter = (m) => m.author.id === user.id;
    let userResponded = false;
    
    const collector = interaction.channel.createMessageCollector({
      filter,
      max: 1,
      time: collectorTimeInSeconds * 1000,
    });

    collector.on("collect", async () => {
      userResponded = true;
      collector.stop();
      await interaction.deleteReply().catch(() => {});
      await ticketsDB.set(`${channelID}.lastMessageSent`, Date.now());
      await ticketsDB.delete(`${channelID}.alertDueTime`).catch(() => {});
      await ticketsDB.delete(`${channelID}.deleteTimer`).catch(() => {});
      const replyDefaultValues = {
        color: "#2FF200",
        title: "Alert Reply Notification",
        description: "✅ **User responded!** Auto close stopped.\n\nThe ticket has been reset and the alert system is ready to be used again when needed.",
        timestamp: true,
      };
      const alertReplyEmbed = await configEmbed(
        "alertReplyEmbed",
        replyDefaultValues,
      );
      await interaction.channel.send({ embeds: [alertReplyEmbed] });
    });

    collector.on("end", async () => {
      if (userResponded) return;
      
      let autoAction = config?.alertReply?.autoAction || "none";
      const ticketExists = await ticketsDB.get(channelID);
      if (ticketExists) {
        switch (autoAction) {
          case "close":
            const autoCloseDefaultValues = {
              color: "#FF0000",
              title: "Auto Close Notice",
              description: "❌ No response received. Ticket is being automatically closed.",
              timestamp: true,
            };
            const autoCloseEmbed = await configEmbed(
              "autoCloseEmbed",
              autoCloseDefaultValues,
            );
            try {
              const channel = await client.channels.fetch(channelID);
              if (channel) {
                await channel.send({ embeds: [autoCloseEmbed] });
              }
            } catch (e) {
              // Channel might have been deleted
            }
            await autoCloseTicket(channelID);
            break;
          case "delete":
            const autoDeleteDefaultValues = {
              color: "#FF0000",
              title: "Auto Delete Notice",
              description: "❌ No response received. Ticket is being automatically closed and feedback requested.",
              timestamp: true,
            };
            const autoDeleteEmbed = await configEmbed(
              "autoDeleteEmbed",
              autoDeleteDefaultValues,
            );
            try {
              const channel = await client.channels.fetch(channelID);
              if (channel) {
                await channel.send({ embeds: [autoDeleteEmbed] });
              }
            } catch (e) {
              // Channel might have been deleted
            }
            // Just close the ticket instead of deleting to respect user request
            await autoCloseTicket(channelID);
            break;
          case "none":
            break;
          default:
            break;
        }
      }
    });
  }

  let logChannelId = config.logs.ticketAlert || config.logs.default;
  let logsChannel = await getChannel(logChannelId);
  if (config.toggleLogs.ticketAlert && logsChannel && typeof logsChannel.send === "function") {
    try {
      await logsChannel.send({ embeds: [logAlertEmbed] });
    } catch (error) {
      error.errorContext = `[Logging Error]: please make sure to at least configure your default log channel`;
      client.emit("error", error);
    }
  }

  await logMessage(
    `${interaction.user.tag} sent an alert to ${user.tag} in the ticket #${interaction.channel.name}`,
  );

  if (config.alertDMEmbed.enabled) {
    const defaultDMValues = {
      color: "#FF0000",
      title: "Ticket Close Notification",
      description:
        "Your ticket **#{ticketName}** in **{server}** will be closed soon if no response has been received.",
    };

    const alertDMEmbed = await configEmbed("alertDMEmbed", defaultDMValues);

    if (alertDMEmbed.data && alertDMEmbed.data.description) {
      alertDMEmbed.setDescription(
        alertDMEmbed.data.description
          .replace(/\{ticketName\}/g, `${interaction.channel.name}`)
          .replace(/\{server\}/g, `${interaction.guild.name}`),
      );
    }

    const userPreference = await getUserPreference(user.id, "alert");
    if (userPreference) {
      try {
        await user.send({ embeds: [alertDMEmbed] });
      } catch (error) {
        error.errorContext = `[Alert Slash Command Error]: failed to DM ${user.tag} because their DMs were closed.`;
        await logError("ERROR", error);
        const defaultErrorValues = {
          color: "#FF0000",
          title: "DMs Disabled",
          description:
            "The bot could not DM **{user} ({user.tag})** because their DMs were closed.\nPlease enable `Allow Direct Messages` in this server to receive further information from the bot!\n\nFor help, please read [this article](https://support.discord.com/hc/en-us/articles/217916488-Blocking-Privacy-Settings).",
          timestamp: true,
          thumbnail: `${user.displayAvatarURL({ extension: "png", size: 1024 })}`,
          footer: {
            text: `${user.tag}`,
            iconURL: `${user.displayAvatarURL({ extension: "png", size: 1024 })}`,
          },
        };

        const dmErrorEmbed = await configEmbed(
          "dmErrorEmbed",
          defaultErrorValues,
        );

        if (dmErrorEmbed.data && dmErrorEmbed.data.description) {
          dmErrorEmbed.setDescription(
            dmErrorEmbed.data.description
              .replace(/\{user\}/g, user)
              .replace(/\{user\.tag\}/g, sanitizeInput(user.tag)),
          );
        }

        let logChannelId = config.logs.DMErrors || config.logs.default;
        let logChannel = await getChannel(logChannelId);

        let dmErrorReply = {
          embeds: [dmErrorEmbed],
        };

        if (config.dmErrorEmbed.pingUser) {
          dmErrorReply.content = `<@${user.id}>`;
        }

        if (config.toggleLogs.DMErrors && logsChannel) {
          try {
            await logChannel.send(dmErrorReply);
          } catch (error) {
            error.errorContext = `[Logging Error]: please make sure to at least configure your default log channel`;
            client.emit("error", error);
          }
        }
        logMessage(
          `The bot could not DM ${user.tag} because their DMs were closed`,
        );
      }
    }
  }
}

module.exports = {
  alertTicket,
};
