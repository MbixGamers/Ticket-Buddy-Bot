const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  enabled: true,
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Get the bot invite link to add it to your server")
    .setDMPermission(true),
  async execute(interaction) {
    try {
      const inviteLink = "https://discord.com/oauth2/authorize?client_id=1453297422712180796&permissions=6755986106821686&integration_type=0&scope=bot";

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("Invite Ticket Buddy")
        .setDescription("Click the button below to add Ticket Buddy to your server!\n\nAfter adding the bot, use `/setup` to configure server-specific settings like ticket categories and transcript channels.")
        .addFields(
          { name: "Getting Started", value: "1. Click the invite button below\n2. Select your server\n3. Authorize the bot\n4. Use `/setup categories` to set ticket categories\n5. Use `/setup logs` to set transcript channel\n6. Use `/panel` to create a ticket panel" }
        )
        .setThumbnail(interaction.client.user.displayAvatarURL({ extension: "png", size: 1024 }))
        .setTimestamp()
        .setFooter({ text: "Ticket Buddy", iconURL: interaction.client.user.displayAvatarURL({ extension: "png", size: 1024 }) });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Add to Server")
          .setURL(inviteLink)
          .setStyle(ButtonStyle.Link)
          .setEmoji("🎫")
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error("[Invite Command Error]", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "An error occurred while generating the invite link.", flags: require("discord.js").MessageFlags.Ephemeral });
      }
    }
  },
};
