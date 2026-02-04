const { Events } = require("discord.js");
const { client } = require("../init.js");
const { logMessage } = require("../utils/mainUtils.js");

module.exports = {
  name: Events.GuildDelete,
  async execute(guild) {
    try {
      const guildCount = client.guilds.cache.size;
      const message = `❌ Bot left server: **${guild.name}** (ID: ${guild.id})\n📊 Total Servers: ${guildCount}`;
      console.log(message);
      await logMessage(message).catch(() => {});
    } catch (error) {
      console.error("[Guild Delete Event Error]", error);
    }
  },
};
