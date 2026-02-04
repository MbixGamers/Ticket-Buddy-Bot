const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const { listUserTickets, getGuildSupportRoles } = require("../../utils/mainUtils.js");

module.exports = {
  enabled: config.commands.tickets.enabled,
  data: new SlashCommandBuilder()
    .setName("tickets")
    .setDescription("List the current tickets of a user.")
    .addUserOption((option) =>
      option.setName("user").setDescription("Select a user").setRequired(false),
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits[config.commands.tickets.permission],
    )
    .setDMPermission(false),
  async execute(interaction) {
    const isEphemeral =
      config.ticketsEmbed.ephemeral !== undefined
        ? config.ticketsEmbed.ephemeral
        : true;

    let user = interaction.options.getUser("user") || interaction.user;
    if (user.bot) {
      return interaction.reply({
        content: "Bots cannot have tickets.",
        flags: MessageFlags.Ephemeral,
      });
    }
    if (user !== interaction.user) {
      const guildId = interaction.guild.id;
      const supportRoles = await getGuildSupportRoles(guildId, config.commands.tickets.support_role_ids || []);
      const hasSupportRole = interaction.member.roles.cache.some((role) =>
        supportRoles.includes(role.id),
      );

      if (supportRoles.length > 0 && !hasSupportRole) {
        return interaction.reply({
          content:
            config.errors.not_allowed || "You are not allowed to use this!",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    await interaction.deferReply({
      flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
    });
    await listUserTickets(interaction, user, isEphemeral);
  },
};