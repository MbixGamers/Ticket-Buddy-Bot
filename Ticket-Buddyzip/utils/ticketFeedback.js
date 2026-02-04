const { MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { mainDB, client } = require("../init.js");
const {
  configEmbed,
  sanitizeInput,
  logMessage,
  getChannel,
  guildDBAdd,
  guildDBPush,
} = require("./mainUtils.js");

async function sendFeedback(ticketUserID, ticketChannelName, guildId) {
  try {
    const starButtons = [];
    for (let i = 1; i <= 5; i++) {
      starButtons.push(
        new ButtonBuilder()
          .setCustomId(`feedbackStar_${i}`)
          .setLabel(`${"⭐".repeat(i)}`)
          .setStyle(ButtonStyle.Primary)
      );
    }
    
    const row = new ActionRowBuilder().addComponents(starButtons);
    
    const { EmbedBuilder } = require("discord.js");
    const feedbackEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("📋 Ticket Feedback")
      .setDescription(`Thank you for using our support! Please rate your experience with ticket **#${ticketChannelName}** by clicking a star rating below.\n\n⭐ = Poor | ⭐⭐⭐ = Good | ⭐⭐⭐⭐⭐ = Excellent`)
      .setFooter({ text: ticketChannelName });

    const dmMessage = await ticketUserID.send({
      embeds: [feedbackEmbed],
      components: [row],
    });

    const feedbackData = {
      guildId: guildId,
      ticketName: ticketChannelName,
      messageId: dmMessage.id,
      timestamp: Date.now()
    };
    
    await mainDB.set(`feedbackContext_${ticketUserID.id}`, feedbackData);
    await mainDB.set(`ratingMenuOptions-${ticketUserID.id}`, feedbackData);
    await mainDB.set(`ratingMenuOptions-${ticketUserID.id}`, feedbackData);
  } catch (error) {
    console.error(`[Feedback] Failed to send feedback DM to ${ticketUserID.tag}:`, error.message);
  }
}

async function handleFeedbackButton(interaction) {
  const customId = interaction.customId;
  const rating = parseInt(customId.split("_")[1]);
  const userId = interaction.user.id;
  const feedbackContext = await mainDB.get(`feedbackContext_${userId}`);
  
  if (!feedbackContext) {
    return interaction.reply({ content: "This feedback session has expired.", ephemeral: true });
  }

  const { guildId, ticketName } = feedbackContext;

  await interaction.message.edit({ components: [] }).catch(() => {});

  if (guildId) {
    await guildDBAdd(mainDB, guildId, "totalReviews", 1);
    await guildDBPush(mainDB, guildId, "ratings", rating);
  } else {
    await mainDB.add("totalReviews", 1);
    await mainDB.push("ratings", rating);
  }

  const logDefaultValues = {
    color: "#2FF200",
    title: "Ticket Logs | Ticket Feedback",
    timestamp: true,
    thumbnail: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    footer: {
      text: `${interaction.user.tag}`,
      iconURL: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    },
  };

  const logRatingEmbed = await configEmbed("logRatingEmbed", logDefaultValues);
  logRatingEmbed.addFields(
    { name: "• Ticket Creator", value: `> <@!${userId}>\n> ${sanitizeInput(interaction.user.tag)}` },
    { name: "• Ticket", value: `> #${sanitizeInput(ticketName)}` },
    { name: "• Ticket Rating", value: `${"⭐".repeat(rating)} **(${rating}/5)**` }
  );

  let logChannelId = config.logs.ticketFeedback || config.logs.default;
  let logChannel = await getChannel(logChannelId);
  if (config.toggleLogs.ticketFeedback && logChannel && typeof logChannel.send === "function") {
    await logChannel.send({ embeds: [logRatingEmbed] }).catch(() => {});
  }

  await mainDB.delete(`feedbackContext_${userId}`);
  await mainDB.delete(`ratingMenuOptions-${userId}`);

  await interaction.reply({ content: "Thank you for your rating!", ephemeral: true });
  await logMessage(`${interaction.user.tag} rated ticket #${ticketName} with ${rating} stars`);
}

async function getFeedback(interaction, i, withModal = false) {
  const message = await interaction.user.dmChannel.messages.fetch(
    interaction.message.id,
  );
  await message.edit({ components: [] });
  const currentFooter = message.embeds[0].footer.text;
  const defaultValues = {
    color: "#2FF200",
    title: "Ticket Logs | Ticket Feedback",
    timestamp: true,
    thumbnail: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    footer: {
      text: `${interaction.user.tag}`,
      iconURL: `${interaction.user.displayAvatarURL({ extension: "png", size: 1024 })}`,
    },
  };

  const logRatingEmbed = await configEmbed("logRatingEmbed", defaultValues);

  logRatingEmbed.addFields({
    name: config.logRatingEmbed.field_creator || "• Ticket Creator",
    value: `> <@!${interaction.user.id}>\n> ${sanitizeInput(interaction.user.tag)}`,
  });

  logRatingEmbed.addFields({
    name: config.logRatingEmbed.field_ticket || "• Ticket",
    value: `> ${sanitizeInput(currentFooter)}`,
  });

  logRatingEmbed.addFields({
    name: config.logRatingEmbed.field_rating || "• Ticket Rating",
    value: `${"⭐".repeat(i)} **(${i}/5)**`,
  });

  let logChannelId = config.logs.ticketFeedback || config.logs.default;
  let logChannel = await getChannel(logChannelId);
    if (config.toggleLogs.ticketFeedback && logChannel && typeof logChannel.send === "function") {
      try {
        await logChannel.send({ embeds: [logRatingEmbed] });
      } catch (error) {
        error.errorContext = `[Logging Error]: please make sure to at least configure your default log channel`;
        client.emit("error", error);
      }
    }
  const ratingMenuOptions = await mainDB.get(`ratingMenuOptions-${interaction.user.id}`);
  const guildId = ratingMenuOptions?.guildId;
  if (guildId) {
    await guildDBAdd(mainDB, guildId, "totalReviews", 1);
    await guildDBPush(mainDB, guildId, "ratings", i);
  } else {
    await mainDB.add("totalReviews", 1);
    await mainDB.push("ratings", i);
  }
  await mainDB.delete(`ratingMenuOptions-${interaction.user.id}`);
  await interaction.editReply({
    content: "Your feedback has been sent successfully!",
    flags: MessageFlags.Ephemeral,
  });
  await logMessage(
    `${interaction.user.tag} rated the ticket "${currentFooter}" with ${i} stars`,
  );
}

module.exports = {
  getFeedback,
  sendFeedback,
  handleFeedbackButton,
};
