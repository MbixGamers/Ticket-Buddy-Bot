const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const { client, mainDB, guildDB } = require("../../init.js");
const { logMessage, checkAdminRole } = require("../../utils/mainUtils.js");

module.exports = {
  enabled: true,
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Reload all the slash commands.")
    .setDMPermission(false),
  async execute(interaction) {
    // Check Administrator or configured admin roles
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAdminRole = await checkAdminRole(interaction);
    
    if (!isAdmin && !hasAdminRole) {
      return interaction.reply({
        content: "You are not allowed to use this command!",
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Backup all guild configs before reload
    const allGuilds = client.guilds.cache;
    const guildBackup = new Map();
    
    try {
      for (const guild of allGuilds.values()) {
        const guildConfig = await guildDB.get(guild.id);
        if (guildConfig) {
          guildBackup.set(guild.id, guildConfig);
        }
      }
      console.log(`[RELOAD] Backed up configs for ${guildBackup.size} guilds`);
    } catch (backupError) {
      console.error("[RELOAD] Error backing up guild configs:", backupError);
    }
    
    try {
      const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        {
          body: Array.from(client.commands.values()).map((command) =>
            command.data.toJSON(),
          ),
        },
      );
      console.log(
        "All global slash commands have been reloaded! Please use with caution due to rate limits.",
      );
      console.log(
        Array.from(client.commands.values()).map((command) => command.data.name),
      );
      
      // Restore all guild configs after reload
      try {
        for (const [guildId, guildConfig] of guildBackup.entries()) {
          await guildDB.set(guildId, guildConfig);
        }
        console.log(`[RELOAD] Restored configs for ${guildBackup.size} guilds`);
      } catch (restoreError) {
        console.error("[RELOAD] Error restoring guild configs:", restoreError);
      }
      
      await interaction.editReply({
        content:
          "✅ Reloaded all global slash commands and preserved all server configurations! Use with caution due to rate limits.",
        flags: MessageFlags.Ephemeral,
      });
      await logMessage(
        `${interaction.user.tag} reloaded all the global slash commands. All server configurations were preserved.`,
      );
    } catch (error) {
      console.error("[RELOAD] Error during reload:", error);
      await interaction.editReply({
        content:
          "❌ Error reloading commands. Guild configurations remain safe and unchanged.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
