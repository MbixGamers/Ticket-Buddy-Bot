const { mainDB } = require("../init.js");
const { logMessage, logError } = require("../utils/mainUtils.js");
const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith("roleSettings_select_")) return;

    const guildId = interaction.guildId;
    const selectedRoleIds = interaction.values;

    try {
      console.log(`[Role Settings] Interaction received. Guild: ${guildId}, Roles: ${selectedRoleIds.length}`);
      
      // Save the selected roles for admin command access
      if (selectedRoleIds.length > 0) {
        await mainDB.set(
          `guildSettings.${guildId}.adminRoleIDs`,
          selectedRoleIds,
        );
      } else {
        await mainDB.delete(`guildSettings.${guildId}.adminRoleIDs`);
      }
      console.log(`[Role Settings] Saved admin roles to database`);

      // Build response message
      let successMessage = "";
      if (selectedRoleIds.length === 0) {
        successMessage = "✅ Admin roles cleared. Only users with Administrator permission can use admin commands.";
      } else {
        successMessage = "✅ **Admin Roles Updated**\n\n";
        
        // Verify role details
        const roleVerification = selectedRoleIds.map((roleId) => {
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) return null;
          const hasUseCommands = role.permissions.has(PermissionFlagsBits.UseApplicationCommands);
          const hasManageChannels = role.permissions.has(PermissionFlagsBits.ManageChannels);
          const hasManageMessages = role.permissions.has(PermissionFlagsBits.ManageMessages);
          const missingPerms = [];
          if (!hasUseCommands) missingPerms.push("Use Application Commands");
          if (!hasManageChannels) missingPerms.push("Manage Channels");
          if (!hasManageMessages) missingPerms.push("Manage Messages");
          return { name: role.name, missingPerms };
        }).filter(r => r !== null);

        const rolesReady = roleVerification.filter(r => r.missingPerms.length === 0);
        const rolesMissing = roleVerification.filter(r => r.missingPerms.length > 0);
        
        if (rolesReady.length > 0) {
          successMessage += `**✓ Ready to Use:**\n${rolesReady.map(r => `  • ${r.name}`).join("\n")}\n\n`;
        }
        
        if (rolesMissing.length > 0) {
          successMessage += `**⚠️ Roles Missing Permissions:**\n`;
          rolesMissing.forEach(r => {
            successMessage += `  • **${r.name}** - Missing: ${r.missingPerms.join(", ")}\n`;
          });
          successMessage += `\n📋 **Enable Permissions:** Right-click role → Edit Role → Permissions → Enable all three`;
        }
      }

      // Defer the interaction first
      await interaction.deferUpdate().catch(err => {
        console.error(`[Role Settings] deferUpdate failed:`, err.message);
      });
      
      console.log(`[Role Settings] Deferred update, now sending response`);
      
      // Send response as a follow-up
      await interaction.followUp({
        content: successMessage,
        ephemeral: true,
      }).catch(err => {
        console.error(`[Role Settings] followUp failed:`, err.message);
      });

      console.log(`[Role Settings] Response sent successfully`);
      
    } catch (error) {
      console.error("[Role Settings] Critical error:", error.message);
      console.error("[Role Settings] Error details:", error);
      
      try {
        // Try to respond with error
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "An error occurred. Please try again.",
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: "An error occurred. Please try again.",
            ephemeral: true,
          });
        }
      } catch (responseError) {
        console.error("[Role Settings] Could not send error response:", responseError.message);
      }
    }
  },
};
