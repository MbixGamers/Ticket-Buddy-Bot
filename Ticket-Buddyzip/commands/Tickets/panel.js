const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  ChannelType,
} = require("discord.js");
const { ticketCategories, mainDB } = require("../../init.js");
const { configEmbed, logMessage, checkAdminRole } = require("../../utils/mainUtils.js");

module.exports = {
  enabled: config.commands.panel.enabled,
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send the ticket panel in a channel.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to send the panel to")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addIntegerOption((option) =>
      option
        .setName("panel_id")
        .setDescription("The panel ID from config (defaults to 1)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("layout")
        .setDescription("Buttons or select menu for the panel layout")
        .setRequired(false)
        .addChoices(
          { name: "Buttons", value: "Buttons" },
          { name: "Menu", value: "Menu" },
        ),
    )
    .setDMPermission(false),
  async execute(interaction) {
    // Check if user has Administrator permission or configured admin role
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAdminRole = await checkAdminRole(interaction);
    
    console.log(`[PANEL Command] User: ${interaction.user.tag} (${interaction.member.id}) | Admin: ${isAdmin} | HasAdminRole: ${hasAdminRole} | UserRoles: ${interaction.member.roles.cache.map(r => r.name).join(", ")}`);
    
    if (!isAdmin && !hasAdminRole) {
      // Get guild settings to show which roles are required
      const guildId = interaction.guild.id;
      const configuredRoles = await mainDB.get(`guildSettings.${guildId}.adminRoleIDs`) || [];
      const roleList = configuredRoles.length > 0 
        ? configuredRoles.map(id => `<@&${id}>`).join(", ")
        : "No admin roles configured. Use /rolesettings to configure roles.";
      
      return interaction.reply({
        content: `❌ You don't have permission to use this command!\n\n**Required:** Administrator role OR one of: ${roleList}\n\n**Troubleshooting:** Make sure your role has these permissions enabled:\n  • Use Application Commands\n  • Manage Channels\n  • Manage Messages`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const panels = [];

    for (const panel of config.panels) {
      const { id, categories, maxButtonsPerRow, menuPlaceholder, panelEmbed } =
        panel;

      panels.push({
        id,
        categories,
        maxButtonsPerRow,
        menuPlaceholder,
        panelEmbed,
      });
    }

    const targetChannel = interaction.options.getChannel("channel");
    const panelId = interaction.options.getInteger("panel_id") || 1;
    const layout = interaction.options.getString("layout") || "Buttons";

    if (!panels.some((panel) => panel.id === panelId)) {
      return interaction.reply({
        content: `A panel with ID ${panelId} does not exist. Please check your config.yml for valid panel IDs.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const defaultValues = {
      color: "#2FF200",
      title: "Support Tickets",
      description:
        "To create a support ticket, click on one of the options below depending on what help you need.",
      timestamp: true,
      footer: {
        text: "Sentinel Tickets",
      },
    };

    const panelIndex = config.panels.findIndex((panel) => panel.id === panelId);
    const panelEmbed = await configEmbed(
      ["panelEmbed", panelIndex],
      defaultValues,
    );
    const foundPanel = panels.find((p) => p.id === panelId);
    const customIds = foundPanel.categories.flatMap((str) => str.split(", "));

    if (layout === "Buttons") {
      // Creating the buttons, action rows and more
      const buttons = [];

      // Iterate over the configured custom IDs
      for (const customId of customIds) {
        const category = ticketCategories[customId];
        // Create a button for each configured category using the properties from `ticketCategories`
        const button = new ButtonBuilder()
          .setCustomId(customId)
          .setLabel(category.buttonLabel)
          .setStyle(ButtonStyle[category.buttonStyle]);

        if (category.buttonEmoji !== "") {
          button.setEmoji(category.buttonEmoji);
        }

        // Add the button to the array
        buttons.push(button);
      }

      // Create an array to store the action rows
      const actionRows = [];
      const maxButtonsPerRow = foundPanel.maxButtonsPerRow || 5;

      // Divide the buttons into groups of maxButtonsPerRow and create a new action row for each group
      for (let i = 0; i < buttons.length; i += maxButtonsPerRow) {
        const buttonsGroup = buttons.slice(i, i + maxButtonsPerRow);
        const actionRow = new ActionRowBuilder().addComponents(...buttonsGroup);
        actionRows.push(actionRow);
      }

      // Send an initial response to acknowledge receipt of the command
      await interaction.editReply({
        content: `Sending the panel with id ${panelId} in <#${targetChannel.id}>...`,
        flags: MessageFlags.Ephemeral,
      });
      // Send the panel embed and action rows
      await targetChannel.send({
        embeds: [panelEmbed],
        components: actionRows,
      });
      await logMessage(
        `${interaction.user.tag} sent the ticket panel with id ${panelId} in the channel #${targetChannel.name}`,
      );
    } else if (layout === "Menu") {
      // Create an array to hold select menu options
      const options = [];

      // Iterate over the configured custom IDs
      for (const customId of customIds) {
        const category = ticketCategories[customId];
        // Create an option for each configured category using the properties from `ticketCategories`
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(category.menuLabel)
          .setDescription(category.menuDescription)
          .setValue(customId);

        if (category.menuEmoji !== "") {
          option.setEmoji(category.menuEmoji);
        }

        // Add the option to the array
        options.push(option);
      }

      // Creating the select menu with the options
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("categoryMenu")
        .setPlaceholder(
          foundPanel.menuPlaceholder || "Select a category to open a ticket.",
        )
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options);

      // Create an action row to store the select menu
      const actionRowsMenus = new ActionRowBuilder().addComponents(selectMenu);

      // Send an initial response to acknowledge receipt of the command
      await interaction.editReply({
        content: `Sending the panel with id ${panelId} in <#${targetChannel.id}>...`,
        flags: MessageFlags.Ephemeral,
      });
      // Send the panel embed and action row
      await targetChannel
        .send({ embeds: [panelEmbed], components: [actionRowsMenus] })
        .then(async function (message) {
          await mainDB.set(`selectMenuOptions-${message.id}`, {
            options,
            placeholder:
              foundPanel.menuPlaceholder ||
              "Select a category to open a ticket.",
          });
        });
      await logMessage(
        `${interaction.user.tag} sent the ticket panel with id ${panelId} in the channel #${targetChannel.name}`,
      );
    }
  },
};
