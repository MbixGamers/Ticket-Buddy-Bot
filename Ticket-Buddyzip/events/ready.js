const { Events, ActivityType } = require("discord.js");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const { client, mainDB } = require("../init.js");
const { logMessage } = require("../utils/mainUtils.js");
const { syncAllCustomCommands } = require("../utils/customCommandRegistry.js");

module.exports = {
  name: Events.ClientReady,
  async execute() {
    try {
      const rest = new REST({
        version: "10",
      }).setToken(process.env.BOT_TOKEN);
      const commands = Array.from(client.commands.values()).map((command) =>
        command.data.toJSON(),
      );

      (async () => {
        try {
          const registeredCommands = await rest.get(
            Routes.applicationCommands(process.env.CLIENT_ID),
          );

          const newCommands = commands.filter((command) => {
            return !registeredCommands.some((registeredCommand) => {
              return registeredCommand.name === command.name;
            });
          });

          const removedCommands = registeredCommands.filter(
            (registeredCommand) => {
              return !commands.some((command) => {
                return command.name === registeredCommand.name;
              });
            },
          );

          const updatedCommands = commands.filter((command) => {
            const registered = registeredCommands.find(
              (rc) => rc.name === command.name,
            );
            if (!registered) return false;
            const registeredOptions = registered.options || [];
            const commandOptions = command.options || [];
            if (registeredOptions.length !== commandOptions.length) return true;
            const registeredOptionNames = registeredOptions.map((o) => o.name).sort();
            const commandOptionNames = commandOptions.map((o) => o.name).sort();
            // Also check if default_member_permissions changed
            const registeredPerms = registered.default_member_permissions;
            const commandPerms = command.default_member_permissions;
            if (registeredPerms !== commandPerms) return true;
            return JSON.stringify(registeredOptionNames) !== JSON.stringify(commandOptionNames);
          });

          // FORCE UPDATE: Always re-register all commands to ensure Discord has latest versions
          await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            {
              body: commands,
            },
          );
          
          if (newCommands.length > 0) {
            console.log("New global slash commands registered successfully.");
            console.log(newCommands.map((command) => command.name));
          }
          if (updatedCommands.length > 0) {
            console.log("Updated global slash commands registered successfully.");
            console.log(updatedCommands.map((command) => command.name));
          }
          if (newCommands.length === 0 && updatedCommands.length === 0) {
            console.log("All slash commands are up to date with Discord.");
          }

          if (removedCommands.length > 0) {
            await Promise.all(
              removedCommands.map((command) =>
                rest.delete(
                  Routes.applicationCommand(
                    process.env.CLIENT_ID,
                    command.id,
                  ),
                ),
              ),
            );

            console.log("Existing slash commands removed successfully.");
            console.log(removedCommands.map((command) => command.name));
          } else {
            if (!config.silentStartup) {
              console.log("No existing slash commands to remove.");
            }
          }
        } catch (error) {
          if (error) {
            error.errorContext = `[Commands Registration Error]: an error occurred during slash command registration`;
            client.emit("error", error);
            console.log(
              'If you received an error saying "Unknown Application" then double check your client ID in your .env file.',
            );
            console.log(
              `The bot may have been invited with some missing options. Please use the link below to re-invite your bot if that is the case.`,
            );
            console.log(
              `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=268823632&scope=bot%20applications.commands`,
            );
          }
        }
      })();

      const presence = {
        activities: [
          {
            name: config.status.botActivityText || "Support Tickets",
            type: ActivityType[config.status.botActivityType || "Watching"],
          },
        ],
        status: config.status.botStatus || "online",
      };

      if (config.status.botActivityType === "Streaming") {
        presence.activities[0].url = config.status.streamingOptionURL;
      }

      client.user.setPresence(presence);
      
      // Clear guild-specific command permissions to allow roles to work
      try {
        const guilds = client.guilds.cache;
        for (const guild of guilds.values()) {
          try {
            const commands = await guild.commands.fetch();
            for (const command of commands.values()) {
              // Clear all permission overrides - let the command's default permissions take effect
              if (command.permissions && command.permissions.length > 0) {
                await command.permissions.set([]);
                console.log(`[PERMS] Cleared permissions for command '${command.name}' in guild '${guild.name}'`);
              }
            }
          } catch (guildError) {
            // Silently skip if there's an issue with permissions
          }
        }
        console.log(`[PERMS] Guild-specific command permissions have been cleared`);
      } catch (permError) {
        // Non-critical, continue startup
      }
      
      const keysToDelete = (await mainDB.startsWith("isClaimInProgress")).map(
        ({ id }) => id,
      );
      await Promise.all(
        keysToDelete.map(async (key) => {
          await mainDB.delete(key);
        }),
      );

      await syncAllCustomCommands(client);

      const totalCommands = client.commands.size;
      const guildCount = client.guilds.cache.size;
      const now = Date.now();
      const startupTime = (now - client.startingTime) / 1000;
      console.log(
        `The ticket bot is now ready! Logged in as ${client.user.tag}. Startup time was ${startupTime.toFixed(2)} seconds. A total of ${totalCommands} commands were registered globally. Bot is in ${guildCount} server(s).`,
      );
      await logMessage(
        `The ticket bot is now ready! Logged in as ${client.user.tag}. Startup time was ${startupTime.toFixed(2)} seconds. A total of ${totalCommands} commands were registered globally. Bot is in ${guildCount} server(s).`,
      );
    } catch (error) {
      error.errorContext = `[Ready Event Error]: an error occurred during initialization`;
      client.emit("error", error);
    }
  },
};
