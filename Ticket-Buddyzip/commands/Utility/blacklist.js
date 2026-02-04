const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const { client, blacklistDB, mainDB } = require("../../init.js");
const {
  configEmbed,
  parseDurationToMilliseconds,
  checkAdminRole,
} = require("../../utils/mainUtils.js");
const {
  blacklistAdd,
  blacklistRemove,
} = require("../../utils/userBlacklist.js");

module.exports = {
  enabled: config.commands.blacklist.enabled,
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Manage the blacklist.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a user or role to the blacklist.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Select a user")
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("Select a role")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("The reason for adding to the blacklist")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("duration")
            .setDescription("The duration of the blacklist")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a user or role from the blacklist.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Select a user")
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("Select a role")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("The reason for removing from the blacklist")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List users or roles in the blacklist.")
        .addIntegerOption((option) =>
          option
            .setName("page")
            .setDescription("The page number")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Specify whether to list users or roles")
            .setRequired(false)
            .addChoices(
              { name: "Users", value: "users" },
              { name: "Roles", value: "roles" },
            ),
        ),
    )
    .setDMPermission(false),
  async execute(interaction) {
    // Check Administrator or configured admin roles
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAdminRole = await checkAdminRole(interaction);
    
    if (!isAdmin && !hasAdminRole) {
      return interaction.reply({
        content:
          config.errors.not_allowed || "You are not allowed to use this!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      let user = interaction.options.getUser("user");
      let member;
      if (user) {
        member = await interaction.guild.members.fetch(user.id).catch(() => null);
      }
      let role = interaction.options.getRole("role");
      let duration = interaction.options.getString("duration") || "permanent";
      let reason =
        interaction.options.getString("reason") || "No reason provided.";

      if ((!user && !role) || (user && role)) {
        return interaction.reply({
          content:
            config.commands.blacklist.userOrRoleError ||
            "Please provide either a user or a role, but not both or none.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (duration !== "permanent") {
        const durationRegex = /^[0-9]+[smhdw]$/;
        if (!durationRegex.test(duration)) {
          return interaction.reply({
            content:
              config.commands.blacklist.wrongDuration ||
              "Invalid duration format, please use one of the following formats: 1s 1m 1h 1d 1w (e.g. 5s, 10m, 2h, 3d, 4w)",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await blacklistAdd(interaction, user, member, duration, reason, role);
    }

    if (subcommand === "remove") {
      let user = interaction.options.getUser("user");
      let member;
      if (user) {
        member = await interaction.guild.members.fetch(user.id).catch(() => null);
      }
      let role = interaction.options.getRole("role");
      let reason =
        interaction.options.getString("reason") || "No reason provided.";

      if ((!user && !role) || (user && role)) {
        return interaction.reply({
          content:
            config.commands.blacklist.userOrRoleError ||
            "Please provide either a user or a role, but not both or none.",
          flags: MessageFlags.Ephemeral,
        });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await blacklistRemove(interaction, user, member, reason, role);
    }

    if (subcommand === "list") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const page = interaction.options.getInteger("page") || 1;
        if (page < 0) {
          return interaction.editReply({
            content:
              config.commands.blacklist.validPage ||
              "Please provide a valid page number greater than or equal to 1.",
            flags: MessageFlags.Ephemeral,
          });
        }
        const type = interaction.options.getString("type") || "users";
        const pageSize = 10;
        const startIndex = (page - 1) * pageSize;
        const endIndex = page * pageSize;
        const blacklistData = await blacklistDB.all();
        const guildId = interaction.guild.id;
        
        // Filter entries that belong to this guild and are of the requested type
        const guildFilteredEntries = blacklistData.filter(entry => {
          const key = entry.id;
          // Key format in quick.db/better-sqlite3 depends on how it's stored
          // If stored as guild:id:key, we check for guild:id:user- or guild:id:role-
          const parts = key.split(':');
          if (parts.length < 3) return false;
          if (parts[0] !== 'guild' || parts[1] !== guildId) return false;
          
          return parts[2].startsWith(`${type === "users" ? "user" : "role"}-`);
        });

        const totalEntriesCount = guildFilteredEntries.length;
        if (totalEntriesCount === 0) {
          let blacklistEmptyType;
          blacklistEmptyType =
            `${config.commands.blacklist.blacklistEmptyType || "The {type} blacklist is currently empty!"}`.replace(
              /\{type\}/g,
              type,
            );
          return interaction.editReply({
            content: blacklistEmptyType,
            flags: MessageFlags.Ephemeral,
          });
        }
        const maxPage = Math.ceil(totalEntriesCount / pageSize);
        if (page > maxPage) {
          let pageError;
          pageError =
            `${config.commands.blacklist.pageError || "The specified page does not exist. Please choose a page between 1 and {maxPage}."}`.replace(
              /\{maxPage\}/g,
              maxPage,
            );
          return interaction.editReply({
            content: pageError,
            flags: MessageFlags.Ephemeral,
          });
        }
        const sortedBlacklistedEntries = guildFilteredEntries.sort(
          (a, b) => (a.value?.timestamp || 0) - (b.value?.timestamp || 0),
        );

        const paginatedEntries = sortedBlacklistedEntries.slice(
          startIndex,
          endIndex,
        );

        const listDefault = {
          color: "#2FF200",
          title: `Blacklisted ${type === "users" ? "Users" : "Roles"} - Page ${page}`,
          description: "The blacklist is currently empty",
        };

        const blacklistListEmbed = await configEmbed(
          "blacklistListEmbed",
          listDefault,
        );

        if (blacklistListEmbed.data && blacklistListEmbed.data.title) {
          blacklistListEmbed.setTitle(
            blacklistListEmbed.data.title
              .replace(/\{type\}/g, `${type === "users" ? "Users" : "Roles"}`)
              .replace(/\{page\}/g, `${page}`),
          );
        }

        let description = "";
        paginatedEntries.forEach((entry, index) => {
          const fullId = entry.id.split(":")[2]; // guild:guildId:user-id or guild:guildId:role-id
          const id = fullId.split("-")[1];
          const userOrRole = type === "users" ? `<@${id}>` : `<@&${id}>`;
          const reason = entry.value?.reason || "No reason";
          const timestamp = entry.value?.timestamp || Date.now();
          const duration = entry.value?.duration || "permanent";
          const staffID = entry.value?.staff || "Unknown";
          const expirationTime =
            timestamp + parseDurationToMilliseconds(duration);
          const expires =
            duration === "permanent"
              ? "never"
              : `<t:${Math.floor(expirationTime / 1000)}:R>`;
          const timeAgo = `<t:${Math.floor(timestamp / 1000)}:R>`;
          description += `${startIndex + index + 1}. ${userOrRole}\nStaff: <@${staffID}>\nReason: ${reason}\nTime: ${timeAgo}\nDuration: ${duration}\nExpires: ${expires}\n`;
        });

        blacklistListEmbed.setDescription(description);

        await interaction.editReply({
          embeds: [blacklistListEmbed],
        });
      } catch (error) {
        client.emit("error", error);
      }
    }
  },
};
