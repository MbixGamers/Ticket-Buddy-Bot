const {
  StringSelectMenuOptionBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require("discord.js");
const { mainDB, ticketsDB, client } = require("../init.js");
const {
  configEmbed,
  getUser,
  sanitizeInput,
  logMessage,
  getUserPreference,
  saveTranscript,
  saveTranscriptTxt,
  countMessagesInTicket,
  getChannel,
  lastUserMsgTimestamp,
  logError,
  guildDBAdd,
  guildDBSub,
} = require("./mainUtils.js");
const { sendFeedback } = require("./ticketFeedback.js");

async function deleteTicket(interaction, reason = "No reason provided.") {
  const channelID = interaction.channel.id;
  const channelName = interaction.channel.name;
  const ticketUserID = await getUser(
    await ticketsDB.get(`${channelID}.userID`),
  );
  const claimUserID = await ticketsDB.get(`${channelID}.claimUser`);
  let claimUser;

  if (claimUserID) {
    claimUser = await getUser(claimUserID);
  }
  const ticketType = await ticketsDB.get(`${channelID}.ticketType`);
  const ticketStatus = await ticketsDB.get(`${channelID}.status`);

  const logDefaultValues = {
    color: "#FF0000",
    title: "Ticket Logs | Ticket Deleted",
    timestamp: true,
    thumbnail: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    footer: {
      text: `${interaction.user.tag}`,
      iconURL: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    },
  };

  const logDeleteEmbed = await configEmbed("logDeleteEmbed", logDefaultValues);

  logDeleteEmbed.addFields([
    {
      name: config.logDeleteEmbed.field_staff || "• Deleted By",
      value: `> <@!${interaction.user.id}>\n> ${sanitizeInput(interaction.user.tag)}`,
    },
    {
      name: config.logDeleteEmbed.field_user || "• Ticket Creator",
      value: `> <@!${ticketUserID.id}>\n> ${sanitizeInput(ticketUserID.tag)}`,
    },
    {
      name: config.logDeleteEmbed.field_ticket || "• Ticket",
      value: `> #${sanitizeInput(channelName)}\n> ${ticketType}`,
    },
    {
      name: config.logDeleteEmbed.field_creation || "• Creation Time",
      value: `> <t:${await ticketsDB.get(`${channelID}.creationTime`)}:F>`,
    },
    {
      name: config.logDeleteEmbed.field_reason || "• Reason",
      value: `> ${reason}`,
    },
  ]);

  const closedAt = await ticketsDB.get(`${channelID}.closedAt`);
  if (closedAt !== 0 && closedAt !== undefined) {
    const closedTime = Math.floor(closedAt / 1000);
    logDeleteEmbed.addFields({
      name: config.logDeleteEmbed.field_closedAt || "• Closed at",
      value: `> <t:${closedTime}:F>`,
    });
  }

  if (claimUser) {
    logDeleteEmbed.addFields({
      name: config.logDeleteEmbed.field_claimedBy || "• Claimed By",
      value: `> <@!${claimUser.id}>\n> ${sanitizeInput(claimUser.tag)}`,
    });
  }

  let attachment;
  const transcriptType = config.transcriptType || "HTML";
  const transcriptImages =
    config.transcriptImages !== undefined ? config.transcriptImages : false;
  if (transcriptType === "HTML") {
    attachment = await saveTranscript(
      interaction,
      null,
      transcriptImages,
      ticketUserID,
    );
  } else if (transcriptType === "TXT") {
    attachment = await saveTranscriptTxt(interaction, null, ticketUserID);
  }

  const deleteTicketTime =
    config.deleteTicketTime >= 0 ? config.deleteTicketTime : 5;
  const deleteTime = deleteTicketTime * 1000;

  const defaultValues = {
    color: "#FF0000",
    description: "Deleting ticket in {time} seconds",
  };

  const deleteEmbed = await configEmbed("deleteEmbed", defaultValues);

  if (deleteEmbed.data && deleteEmbed.data.description) {
    deleteEmbed.setDescription(
      deleteEmbed.data.description
        .replace(/\{time\}/g, `${deleteTicketTime}`)
        .replace(/\{reason\}/g, reason),
    );
  }

  const ticketMessages = await countMessagesInTicket(interaction.channel);
  await guildDBAdd(mainDB, interaction.guild.id, "totalMessages", ticketMessages);
  const lastMsgTime = await lastUserMsgTimestamp(ticketUserID.id, channelID);
  await interaction.editReply({ embeds: [deleteEmbed] });

  setTimeout(async () => {
    if (ticketStatus === "Open") {
      await guildDBSub(mainDB, interaction.guild.id, "openTickets", 1);
    }
    
    await ticketsDB.delete(channelID);
    await interaction.channel.delete();

    // DM the user with an embed and the transcript of the ticket depending on the enabled settings
    const sendEmbed = config.DMUserSettings.embed;
    const sendTranscript = config.DMUserSettings.transcript;
    const userPreference = await getUserPreference(ticketUserID.id, "delete");
    if (userPreference) {
      if (sendEmbed || sendTranscript) {
        const defaultDMValues = {
          color: "#2FF200",
          title: "Ticket Deleted",
          description:
            "Your support ticket has been deleted. Here is your transcript and other information.",
          thumbnail: interaction.guild.iconURL(),
          timestamp: true,
        };

        const deleteDMEmbed = await configEmbed("deleteDMEmbed", defaultDMValues);

        deleteDMEmbed
          .addFields(
            {
              name: config.deleteDMEmbed.field_server || "Server",
              value: `> ${interaction.guild.name}`,
              inline: true,
            },
            {
              name: config.deleteDMEmbed.field_ticket || "Ticket",
              value: `> #${sanitizeInput(channelName)}`,
              inline: true,
            },
            {
              name: config.deleteDMEmbed.field_category || "Category",
              value: `> ${ticketType}`,
              inline: true,
            },
          )
          .addFields(
            {
              name: config.deleteDMEmbed.field_author || "Ticket Author",
              value: `> ${sanitizeInput(ticketUserID.tag)}`,
              inline: true,
            },
            {
              name: config.deleteDMEmbed.field_deletedBy || "Deleted By",
              value: `> ${sanitizeInput(interaction.user.tag)}`,
              inline: true,
            },
            {
              name: config.deleteDMEmbed.field_claimedBy || "Claimed By",
              value: `> ${claimUser ? sanitizeInput(claimUser.tag) : "None"}`,
              inline: true,
            },
          )
          .addFields({
            name: config.deleteDMEmbed.field_count || "Ticket Creation Time",
            value: `> <t:${await ticketsDB.get(`${channelID}.creationTime`)}:F>`,
            inline: true,
          });

        if (closedAt !== 0 && closedAt !== undefined) {
          const closedTime = Math.floor(closedAt / 1000);
          deleteDMEmbed.addFields({
            name: "Closed at",
            value: `> <t:${closedTime}:F>`,
            inline: true,
          });
        }

        const messageDM = {};

        if (sendEmbed) {
          messageDM.embeds = [deleteDMEmbed];
        }

        if (sendTranscript) {
          messageDM.files = [attachment];
        }

        try {
          if (Object.keys(messageDM).length !== 0) {
            await ticketUserID.send(messageDM);
          }
        } catch (error) {
          error.errorContext = `[Delete Slash Command Error]: failed to DM ${ticketUserID.tag} because their DMs were closed.`;
          await logError("ERROR", error);
        }
      }
    }

    // Send feedback after deletion and notification
    const sendRatingSystem = config.DMUserSettings.ratingSystem.enabled;
    if (sendRatingSystem) {
      try {
        await sendFeedback(ticketUserID, channelName, interaction.guild.id);
      } catch (error) {
        console.error(`[Delete] Failed to send feedback: ${error.message}`);
      }
    }
  }, deleteTime);

  let logChannelId = config.logs.ticketDelete || config.logs.default;
  let logsChannel = await getChannel(logChannelId);
  if (config.toggleLogs.ticketDelete && logsChannel && typeof logsChannel.send === "function") {
    try {
      await logsChannel.send({ embeds: [logDeleteEmbed], files: [attachment] });
    } catch (error) {
      error.errorContext = `[Logging Error]: please make sure to at least configure your default log channel`;
      client.emit("error", error);
    }
  }
  await logMessage(
    `${interaction.user.tag} deleted the ticket #${channelName} which was created by ${ticketUserID.tag} with the reason: ${reason}`,
  );
}

module.exports = {
  deleteTicket,
};
