const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require("discord.js");
const { client, mainDB } = require("../../init.js");
const {
  configEmbed,
  sanitizeInput,
  logMessage,
} = require("../../utils/mainUtils.js");

module.exports = {
  enabled: config.commands.roleSettings?.enabled ?? true,
  data: new SlashCommandBuilder()
    .setName("rolesettings")
    .setDescription("Configure which roles can execute admin commands (setup, panel, etc).")
    .setDMPermission(false),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const currentRoles =
      (await mainDB.get(`guildSettings.${guildId}.adminRoleIDs`)) || [];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`roleSettings_select_${guildId}`)
      .setPlaceholder("Select roles that can use admin commands")
      .setMinValues(0)
      .setMaxValues(Math.min(25, interaction.guild.roles.cache.size - 1));

    let availableRoles = interaction.guild.roles.cache
      .filter((role) => role.id !== interaction.guild.id) // Exclude @everyone
      .sort((a, b) => b.position - a.position);

    if (availableRoles.size === 0) {
      return interaction.reply({
        content: "No roles available to select from.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Discord only allows 25 options max in a select menu
    const rolesToShow = availableRoles.first(25);
    const isTruncated = availableRoles.size > 25;

    rolesToShow.forEach((role) => {
      const isSelected = currentRoles.includes(role.id);
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${role.name}${isSelected ? " ✓" : ""}`)
          .setValue(role.id)
          .setDefault(isSelected),
      );
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const defaultValues = {
      color: "#2FF200",
      title: "Role Settings",
      description:
        "Select which roles can use admin commands like `/setup`, `/panel`, creating/managing tickets, etc." +
        (isTruncated ? "\n\n⚠️ Only showing first 25 roles due to Discord limits." : ""),
      fields: [
        {
          name: "Current Admin Roles",
          value:
            currentRoles.length > 0
              ? currentRoles.map((roleId) => `<@&${roleId}>`).join(", ")
              : "No roles configured yet",
          inline: false,
        },
      ],
    };

    const embed = await configEmbed("roleSettingsEmbed", defaultValues);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    await logMessage(
      `${interaction.user.tag} opened the role settings menu in ${interaction.guild.name}`,
    );
  },
};
