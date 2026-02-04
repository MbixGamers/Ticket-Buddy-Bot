const { Events } = require("discord.js");
const { ticketsDB } = require("../init.js");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    const ticketData = await ticketsDB.get(message.channel.id);
    if (!ticketData) return;

    // Stop auto-close if an alert is active and user responds
    const alertDueTime = ticketData.alertDueTime;
    if (alertDueTime && message.author.id === ticketData.userID) {
      await ticketsDB.delete(`${message.channel.id}.alertDueTime`).catch(() => {});

      const { configEmbed } = require("../utils/mainUtils.js");
      const replyDefaultValues = {
        color: "#2FF200",
        title: "Alert Reply Notification",
        description: "✅ **User responded!** Auto close stopped.\n\nThe ticket has been reset and the alert system is ready to be used again when needed.",
        timestamp: true,
      };
      const alertReplyEmbed = await configEmbed("alertReplyEmbed", replyDefaultValues);
      await message.channel.send({ embeds: [alertReplyEmbed] }).catch(() => {});
    }

    // Update last message timestamp for auto-close
    await ticketsDB.set(`${message.channel.id}.lastMessageSent`, Date.now());

    // Auto-delete messages in closed tickets
    if (ticketData.status === "Closed") {
      try {
        await message.delete();
      } catch (error) {
        console.error(`Failed to delete message in closed ticket:`, error);
      }
      return;
    }

    if (!ticketData.claimed) return;

    const claimUser = ticketData.claimUser;
    const ticketCreator = ticketData.userID;

    if (message.author.id === claimUser || message.author.id === ticketCreator) {
      return;
    }

    try {
      await message.delete();
    } catch (error) {
      console.error(`Failed to delete message in claimed ticket:`, error);
    }
  },
};