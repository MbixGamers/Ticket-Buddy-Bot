const {
  StringSelectMenuOptionBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require("discord.js");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });
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

async function autoDeleteTicket(channelID) {
  const ticketChannel = await getChannel(channelID);
  const channelName = ticketChannel.name;
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
    thumbnail: `${client.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    footer: {
      text: `${client.user.tag}`,
      iconURL: `${client.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    },
  };

  const logAutoDeleteEmbed = await configEmbed(
    "logAutoDeleteEmbed",
    logDefaultValues,
  );

  logAutoDeleteEmbed.addFields([
    {
      name: config.logAutoDeleteEmbed.field_staff || "• Auto Deleted By",
      value: `> <@!${client.user.id}>\n> ${sanitizeInput(client.user.tag)}`,
    },
    {
      name: config.logAutoDeleteEmbed.field_user || "• Ticket Creator",
      value: `> <@!${ticketUserID.id}>\n> ${sanitizeInput(ticketUserID.tag)}`,
    },
    {
      name: config.logAutoDeleteEmbed.field_ticket || "• Ticket",
      value: `> #${sanitizeInput(channelName)}\n> ${ticketType}`,
    },
    {
      name: config.logAutoDeleteEmbed.field_creation || "• Creation Time",
      value: `> <t:${await ticketsDB.get(`${channelID}.creationTime`)}:F>`,
    },
  ]);

  const closedAt = await ticketsDB.get(`${channelID}.closedAt`);
  if (closedAt !== 0 && closedAt !== undefined) {
    const closedTime = Math.floor(closedAt / 1000);
    logAutoDeleteEmbed.addFields({
      name: config.logAutoDeleteEmbed.field_closedAt || "• Closed at",
      value: `> <t:${closedTime}:F>`,
    });
  }

  if (claimUser) {
    logAutoDeleteEmbed.addFields({
      name: config.logAutoDeleteEmbed.field_claimedBy || "• Claimed By",
      value: `> <@!${claimUser.id}>\n> ${sanitizeInput(claimUser.tag)}`,
    });
  }

  let attachment;
  const transcriptType = config.transcriptType || "HTML";
  const transcriptImages =
    config.transcriptImages !== undefined ? config.transcriptImages : false;
  if (transcriptType === "HTML") {
    attachment = await saveTranscript(
      null,
      ticketChannel,
      transcriptImages,
      ticketUserID,
    );
  } else if (transcriptType === "TXT") {
    attachment = await saveTranscriptTxt(null, ticketChannel, ticketUserID);
  }

  const deleteTicketTime =
    config.deleteTicketTime >= 0 ? config.deleteTicketTime : 5;
  const deleteTime = deleteTicketTime * 1000;

  const defaultValues = {
    color: "#FF0000",
    description: "Deleting ticket in {time} seconds",
  };

  const autoDeleteEmbed = await configEmbed("autoDeleteEmbed", defaultValues);

  if (autoDeleteEmbed.data && autoDeleteEmbed.data.description) {
    autoDeleteEmbed.setDescription(
      autoDeleteEmbed.data.description.replace(
        /\{time\}/g,
        `${deleteTicketTime}`,
      ),
    );
  }

  const ticketMessages = await countMessagesInTicket(ticketChannel);
  await guildDBAdd(mainDB, ticketChannel.guild.id, "totalMessages", ticketMessages);
  const lastMsgTime = await lastUserMsgTimestamp(ticketUserID.id, channelID);
  await ticketChannel.send({ embeds: [autoDeleteEmbed] });

  setTimeout(async () => {
    if (ticketStatus === "Open") {
      await guildDBSub(mainDB, ticketChannel.guild.id, "openTickets", 1);
    }
    
    const guildId = ticketChannel.guild.id;
    const guildIcon = ticketChannel.guild.iconURL();
    const guildName = ticketChannel.guild.name;

    await ticketsDB.delete(channelID);
    await ticketChannel.delete();

    // DM the user with an embed and the transcript
    const userPreference = await getUserPreference(ticketUserID.id, "delete");
    if (userPreference) {
      if (config.DMUserSettings.embed || config.DMUserSettings.transcript) {
        const defaultDMValues = {
          color: "#2FF200",
          title: "Ticket Deleted",
          description: "Your support ticket has been deleted. Here is your transcript and other information.",
          thumbnail: guildIcon,
          timestamp: true,
        };

        const deleteDMEmbed = await configEmbed("deleteDMEmbed", defaultDMValues);
        deleteDMEmbed.addFields(
          { name: config.deleteDMEmbed.field_server || "Server", value: `> ${guildName}`, inline: true },
          { name: config.deleteDMEmbed.field_ticket || "Ticket", value: `> #${sanitizeInput(channelName)}`, inline: true },
          { name: config.deleteDMEmbed.field_category || "Category", value: `> ${ticketType}`, inline: true },
          { name: config.deleteDMEmbed.field_author || "Ticket Author", value: `> ${sanitizeInput(ticketUserID.tag)}`, inline: true },
          { name: config.deleteDMEmbed.field_deletedBy || "Deleted By", value: `> ${sanitizeInput(client.user.tag)}`, inline: true },
          { name: config.deleteDMEmbed.field_claimedBy || "Claimed By", value: `> ${claimUser ? sanitizeInput(claimUser.tag) : "None"}`, inline: true }
        );

        const messageDM = {};
        if (config.DMUserSettings.embed) messageDM.embeds = [deleteDMEmbed];
        if (config.DMUserSettings.transcript) messageDM.files = [attachment];

        try {
          await ticketUserID.send(messageDM);
        } catch (error) {
          console.error(`[Auto Delete DM] Failed to DM ${ticketUserID.tag}:`, error.message);
        }
      }
    }

    // Send feedback after deletion and notification
    const sendRatingSystem = config.DMUserSettings.ratingSystem.enabled;
    if (sendRatingSystem) {
      try {
        await sendFeedback(ticketUserID, channelName, guildId);
      } catch (error) {
        console.error(`[Auto Delete] Failed to send feedback: ${error.message}`);
      }
    }
  }, deleteTime);

  let logChannelId = config.logs.ticketDelete || config.logs.default;
  let logsChannel = await getChannel(logChannelId);
  if (config.toggleLogs.ticketDelete && logsChannel && typeof logsChannel.send === "function") {
    try {
      await logsChannel.send({
        embeds: [logAutoDeleteEmbed],
        files: [attachment],
      });
    } catch (error) {
      error.errorContext = `[Logging Error]: please make sure to at least configure your default log channel`;
      client.emit("error", error);
    }
  }
  await logMessage(
    `${client.user.tag} automatically deleted the ticket #${channelName} which was created by ${ticketUserID.tag}`,
  );
}

module.exports = {
  autoDeleteTicket,
};
