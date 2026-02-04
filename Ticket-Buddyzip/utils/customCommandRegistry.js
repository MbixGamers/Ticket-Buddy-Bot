const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { mainDB } = require("../init.js");
const { logMessage } = require("./mainUtils.js");

async function registerCustomCommand(guildId, cmdData) {
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

  try {
    const command = new SlashCommandBuilder()
      .setName(cmdData.name)
      .setDescription(cmdData.description || "Custom command")
      .setDMPermission(false);

    await rest.post(
      Routes.applicationGuildCommands(process.env.CLIENT_ID || process.env.BOT_CLIENT_ID, guildId),
      { body: command.toJSON() }
    );

    await logMessage(`Registered custom command /${cmdData.name} in guild ${guildId}`);
    return true;
  } catch (error) {
    console.error(`Failed to register custom command /${cmdData.name}:`, error);
    await logMessage(`Failed to register custom command /${cmdData.name}: ${error.message}`);
    return false;
  }
}

async function unregisterCustomCommand(guildId, cmdName) {
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

  try {
    const commands = await rest.get(
      Routes.applicationGuildCommands(process.env.CLIENT_ID || process.env.BOT_CLIENT_ID, guildId)
    );

    const command = commands.find(cmd => cmd.name === cmdName);
    if (command) {
      await rest.delete(
        Routes.applicationGuildCommand(process.env.CLIENT_ID || process.env.BOT_CLIENT_ID, guildId, command.id)
      );
      await logMessage(`Unregistered custom command /${cmdName} in guild ${guildId}`);
    }
    return true;
  } catch (error) {
    console.error(`Failed to unregister custom command /${cmdName}:`, error);
    await logMessage(`Failed to unregister custom command /${cmdName}: ${error.message}`);
    return false;
  }
}

async function syncAllCustomCommands(client) {
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  const clientId = process.env.CLIENT_ID || process.env.BOT_CLIENT_ID;

  if (!clientId) {
    console.log("[CustomCommands] CLIENT_ID not set, skipping command sync");
    return;
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      const existingCommands = await mainDB.get(`customCommands.${guild.id}`) || {};
      const commandNames = Object.keys(existingCommands);

      if (commandNames.length === 0) continue;

      const guildCommands = await rest.get(
        Routes.applicationGuildCommands(clientId, guild.id)
      );

      for (const cmdName of commandNames) {
        const cmd = existingCommands[cmdName];
        const existingCmd = guildCommands.find(c => c.name === cmdName);

        if (!existingCmd) {
          const command = new SlashCommandBuilder()
            .setName(cmd.name)
            .setDescription(cmd.description || "Custom command")
            .setDMPermission(false);

          await rest.post(
            Routes.applicationGuildCommands(clientId, guild.id),
            { body: command.toJSON() }
          );
          console.log(`[CustomCommands] Registered /${cmdName} in ${guild.name}`);
        }
      }
    } catch (error) {
      console.error(`[CustomCommands] Error syncing commands for guild ${guild.id}:`, error.message);
    }
  }
}

module.exports = {
  registerCustomCommand,
  unregisterCustomCommand,
  syncAllCustomCommands,
};
