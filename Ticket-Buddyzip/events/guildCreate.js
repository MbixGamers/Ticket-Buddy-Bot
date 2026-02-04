const { Events } = require("discord.js");
const { client, mainDB } = require("../init.js");
const { logMessage } = require("../utils/mainUtils.js");

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    const guildCount = client.guilds.cache.size;
    const message = `✅ Bot joined a new server: **${guild.name}** (ID: ${guild.id})\n📊 Total Servers: ${guildCount}`;
    console.log(message);
    await logMessage(message).catch(() => {});
    
    // Clear any guild-specific command permissions to use global defaults
    try {
      const commands = await guild.commands.fetch();
      for (const command of commands.values()) {
        try {
          if (command.permissions && command.permissions.length > 0) {
            await command.permissions.set([]);
            console.log(`[PERMS] Cleared permissions for command '${command.name}'`);
          }
        } catch (cmdError) {
          // Continue if permission clearing fails
        }
      }
    } catch (err) {
      // Non-critical, continue
    }
  },
};
