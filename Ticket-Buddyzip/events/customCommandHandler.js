const {
  Events,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const { client, mainDB, ticketsDB } = require("../init.js");
const { logMessage } = require("../utils/mainUtils.js");
const yaml = require("yaml");
const fs = require("fs");
const configPath = "./Ticket-Buddyzip/config.yml";
const config = yaml.parse(fs.readFileSync(configPath, "utf8"));
const { registerCustomCommand } = require("../utils/customCommandRegistry.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("customcmd_message_") || 
          interaction.customId.startsWith("customcmd_edit_message_")) {
        const isEdit = interaction.customId.startsWith("customcmd_edit_");
        const pendingData = await mainDB.get(`customCmdPending.${interaction.user.id}`);
        
        if (!pendingData) {
          return interaction.reply({
            content: "Session expired. Please try creating the command again.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const responseMessage = interaction.fields.getTextInputValue("response_message");
        const embedTitle = interaction.fields.getTextInputValue("embed_title") || "";
        const embedColor = interaction.fields.getTextInputValue("embed_color") || "#5865F2";

        const existingCommands = await mainDB.get(`customCommands.${pendingData.guildId}`) || {};
        
        existingCommands[pendingData.name] = {
          name: pendingData.name,
          description: pendingData.description,
          type: "message",
          access: pendingData.access || "everyone",
          responseMessage,
          embedTitle,
          embedColor,
          createdBy: interaction.user.id,
          createdAt: isEdit ? existingCommands[pendingData.name]?.createdAt : Date.now(),
          updatedAt: Date.now(),
        };

        await mainDB.set(`customCommands.${pendingData.guildId}`, existingCommands);
        await mainDB.delete(`customCmdPending.${interaction.user.id}`);

        if (!isEdit) {
          await registerCustomCommand(pendingData.guildId, existingCommands[pendingData.name]);
        }

        const action = isEdit ? "updated" : "created";
        await logMessage(`${interaction.user.tag} ${action} custom command /${pendingData.name} (message type) in guild ${interaction.guild.name}`);

        return interaction.reply({
          content: `Custom command \`/${pendingData.name}\` has been ${action} successfully!\n\nUsers can now use \`/${pendingData.name}\` to get your configured response.${!isEdit ? "\n\n**Note:** It may take up to a minute for the command to appear in Discord." : ""}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.customId.startsWith("customcmd_button_") || 
          interaction.customId.startsWith("customcmd_edit_button_")) {
        const isEdit = interaction.customId.startsWith("customcmd_edit_");
        const pendingData = await mainDB.get(`customCmdPending.${interaction.user.id}`);
        
        if (!pendingData) {
          return interaction.reply({
            content: "Session expired. Please try creating the command again.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const messageContent = interaction.fields.getTextInputValue("message_content");
        const buttonLabel = interaction.fields.getTextInputValue("button_label");
        const triggerCommand = interaction.fields.getTextInputValue("trigger_command") || "";
        const autoRoles = interaction.fields.getTextInputValue("auto_roles") || "";
        const followUpMessage = interaction.fields.getTextInputValue("followup_message");

        const existingCommands = await mainDB.get(`customCommands.${pendingData.guildId}`) || {};
        
        existingCommands[pendingData.name] = {
          name: pendingData.name,
          description: pendingData.description,
          type: "button",
          access: pendingData.access || "everyone",
          messageContent,
          buttonLabel,
          buttonStyle: "Success", // Defaulted due to modal limit
          triggerCommand,
          autoRoles: autoRoles.split(",").map(id => id.trim()).filter(id => id),
          followUpMessage,
          createdBy: interaction.user.id,
          createdAt: isEdit ? existingCommands[pendingData.name]?.createdAt : Date.now(),
          updatedAt: Date.now(),
        };

        await mainDB.set(`customCommands.${pendingData.guildId}`, existingCommands);
        await mainDB.delete(`customCmdPending.${interaction.user.id}`);

        if (!isEdit) {
          await registerCustomCommand(pendingData.guildId, existingCommands[pendingData.name]);
        }

        const action = isEdit ? "updated" : "created";
        await logMessage(`${interaction.user.tag} ${action} custom command /${pendingData.name} (button type) in guild ${interaction.guild.name}`);

        return interaction.reply({
          content: `Custom command \`/${pendingData.name}\` has been ${action} successfully!\n\nUsers can now use \`/${pendingData.name}\` to see a message with a "${buttonLabel}" button.${!isEdit ? "\n\n**Note:** It may take up to a minute for the command to appear in Discord." : ""}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.customId.startsWith("customcmd_questionnaire_submit_")) {
        const cmdName = interaction.customId.replace("customcmd_questionnaire_submit_", "");
        const guildId = interaction.guild.id;
        
        const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};
        const cmd = existingCommands[cmdName];

        if (!cmd) {
          return interaction.reply({
            content: "This command no longer exists.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const answers = [];
        for (let i = 0; i < cmd.questions.length; i++) {
          try {
            const answer = interaction.fields.getTextInputValue(`question_${i}`);
            answers.push({ question: cmd.questions[i], answer });
          } catch (e) {
            answers.push({ question: cmd.questions[i], answer: "No response" });
          }
        }

        await mainDB.set(`questionnaireResponse.${interaction.user.id}`, {
          cmdName,
          guildId,
          answers,
          resultTitle: cmd.resultTitle,
          targetChannel: cmd.targetChannel,
          autoRoles: cmd.autoRoles,
          approvalRequired: cmd.approvalRequired,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          userAvatar: interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
          channelId: interaction.channel.id,
          createdAt: Date.now(),
        });

        const attachButton = new ButtonBuilder()
          .setCustomId(`questionnaire_attach_${interaction.user.id}`)
          .setLabel("Attach Files/Screenshots")
          .setStyle(ButtonStyle.Primary);

        const submitButton = new ButtonBuilder()
          .setCustomId(`questionnaire_send_${interaction.user.id}`)
          .setLabel("Submit Without Attachments")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(attachButton, submitButton);

        return interaction.reply({
          content: "Would you like to attach any files or screenshots to your response?",
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.customId.startsWith("customcmd_questionnaire_") || 
          interaction.customId.startsWith("customcmd_edit_questionnaire_")) {
        const isEdit = interaction.customId.startsWith("customcmd_edit_");
        const pendingData = await mainDB.get(`customCmdPending.${interaction.user.id}`);
        
        if (!pendingData) {
          return interaction.reply({
            content: "Session expired. Please try creating the command again.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const introMessage = interaction.fields.getTextInputValue("intro_message");
        const questionsRaw = interaction.fields.getTextInputValue("questions");
        const targetChannel = interaction.fields.getTextInputValue("target_channel") || "";
        const autoRolesRaw = interaction.fields.getTextInputValue("auto_roles") || "";
        const approvalRequired = (interaction.fields.getTextInputValue("approval_required") || "no").toLowerCase() === "yes";

        const questions = questionsRaw.split("\n").filter(q => q.trim()).slice(0, 5);

        if (questions.length === 0) {
          return interaction.reply({
            content: "You must provide at least one question.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const existingCommands = await mainDB.get(`customCommands.${pendingData.guildId}`) || {};
        
        existingCommands[pendingData.name] = {
          name: pendingData.name,
          description: pendingData.description,
          type: "questionnaire",
          access: pendingData.access || "everyone",
          introMessage,
          questions,
          targetChannel,
          autoRoles: autoRolesRaw.split(",").map(id => id.trim()).filter(id => id),
          approvalRequired,
          resultTitle: "Questionnaire Response",
          createdBy: interaction.user.id,
          createdAt: isEdit ? existingCommands[pendingData.name]?.createdAt : Date.now(),
          updatedAt: Date.now(),
        };

        await mainDB.set(`customCommands.${pendingData.guildId}`, existingCommands);
        await mainDB.delete(`customCmdPending.${interaction.user.id}`);

        if (!isEdit) {
          await registerCustomCommand(pendingData.guildId, existingCommands[pendingData.name]);
        }

        const action = isEdit ? "updated" : "created";
        await logMessage(`${interaction.user.tag} ${action} custom command /${pendingData.name} (questionnaire type) in guild ${interaction.guild.name}`);

        return interaction.reply({
          content: `Custom command \`/${pendingData.name}\` has been ${action} successfully!\n\nUsers can now use \`/${pendingData.name}\` to fill out a questionnaire with ${questions.length} question(s).${!isEdit ? "\n\n**Note:** It may take up to a minute for the command to appear in Discord." : ""}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith("q_approve_") || interaction.customId.startsWith("q_deny_")) {
        const isApprove = interaction.customId.startsWith("q_approve_");
        const userId = interaction.customId.split("_")[2];
        const guildId = interaction.guild.id;

        // Staff check
        const ticketData = await ticketsDB.get(interaction.channel.id);
        const categoryId = ticketData?.categoryID;
        const category = config.TicketCategories.find(c => c.id === categoryId);
        const staffRoles = category?.support_role_ids || [];
        
        const hasStaffRole = interaction.member.roles.cache.some(role => staffRoles.includes(role.id));
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        
        if (!hasStaffRole && !isAdmin) {
          return interaction.reply({
            content: "Only staff members can approve or deny this response.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const responseData = await mainDB.get(`questionnaireResponse.${userId}`);
        if (!responseData) {
          return interaction.reply({
            content: "This response data has expired or already been processed.",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (isApprove) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member && responseData.autoRoles) {
              await member.roles.add(responseData.autoRoles);
            }
          } catch (e) {
            console.error("Failed to add roles on approval:", e);
          }
          
          await logMessage(`${interaction.user.tag} approved questionnaire for ${responseData.userTag} in ${interaction.guild.name}`);
          
          const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor("#00FF00")
            .setFooter({ text: `Approved by ${interaction.user.tag}` });

          await interaction.update({
            embeds: [embed],
            components: [],
          });
        } else {
          await logMessage(`${interaction.user.tag} denied questionnaire for ${responseData.userTag} in ${interaction.guild.name}`);
          
          const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor("#FF0000")
            .setFooter({ text: `Denied by ${interaction.user.tag}` });

          await interaction.update({
            embeds: [embed],
            components: [],
          });
        }

        await mainDB.delete(`questionnaireResponse.${userId}`);
        return;
      }

      if (interaction.customId.startsWith("customcmd_btn_")) {
        const cmdName = interaction.customId.replace("customcmd_btn_", "");
        const guildId = interaction.guild.id;
        
        const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};
        const cmd = existingCommands[cmdName];

        if (!cmd) {
          return interaction.reply({
            content: "This command no longer exists.",
            flags: MessageFlags.Ephemeral,
          });
        }

        // Handle Auto Roles
        if (cmd.autoRoles && cmd.autoRoles.length > 0) {
          try {
            await interaction.member.roles.add(cmd.autoRoles);
          } catch (e) {
            console.error("Failed to add auto roles:", e);
          }
        }

        // Handle Trigger Command (Questionnaire)
        if (cmd.triggerCommand) {
          const triggerCmd = existingCommands[cmd.triggerCommand];
          if (triggerCmd && triggerCmd.type === "questionnaire") {
            const modal = new ModalBuilder()
              .setCustomId(`customcmd_questionnaire_submit_${cmd.triggerCommand}`)
              .setTitle(triggerCmd.resultTitle || "Questionnaire");

            triggerCmd.questions.slice(0, 5).forEach((question, index) => {
              const input = new TextInputBuilder()
                .setCustomId(`question_${index}`)
                .setLabel(question.substring(0, 45))
                .setPlaceholder("Enter your answer...")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000);

              modal.addComponents(new ActionRowBuilder().addComponents(input));
            });

            return interaction.showModal(modal);
          }
        }

        await logMessage(`${interaction.user.tag} clicked button for custom command /${cmdName} in guild ${interaction.guild.name}`);

        const embed = new EmbedBuilder()
          .setDescription(cmd.followUpMessage)
          .setColor("#00FF00")
          .setAuthor({
            name: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
        });
      }

      if (interaction.customId.startsWith("questionnaire_send_")) {
        const userId = interaction.customId.replace("questionnaire_send_", "");
        
        if (userId !== interaction.user.id) {
          return interaction.reply({
            content: "This button is not for you.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const responseData = await mainDB.get(`questionnaireResponse.${userId}`);
        if (!responseData) {
          return interaction.reply({
            content: "Your session has expired. Please fill out the questionnaire again.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(responseData.resultTitle || "Questionnaire Response")
          .setColor("#5865F2")
          .setAuthor({
            name: responseData.userTag,
            iconURL: responseData.userAvatar,
          })
          .setTimestamp()
          .setFooter({ text: `Command: /${responseData.cmdName}${responseData.approvalRequired ? " | Pending Approval" : ""}` });

        responseData.answers.forEach((item, index) => {
          embed.addFields({
            name: `${index + 1}. ${item.question}`,
            value: item.answer || "No response",
            inline: false,
          });
        });

        const components = [];
        if (responseData.approvalRequired && responseData.autoRoles && responseData.autoRoles.length > 0) {
          const approveBtn = new ButtonBuilder()
            .setCustomId(`q_approve_${userId}`)
            .setLabel("Approve")
            .setStyle(ButtonStyle.Success);

          const denyBtn = new ButtonBuilder()
            .setCustomId(`q_deny_${userId}`)
            .setLabel("Deny")
            .setStyle(ButtonStyle.Danger);

          components.push(new ActionRowBuilder().addComponents(approveBtn, denyBtn));
        }

        let targetChannel = interaction.channel;
        if (responseData.targetChannel) {
          try {
            const channel = await interaction.guild.channels.fetch(responseData.targetChannel);
            if (channel) {
              targetChannel = channel;
            }
          } catch (e) {}
        }

        try {
          await targetChannel.send({ embeds: [embed], components });
          // Note: We don't delete responseData yet if approval is required because we need it for the role assignment
          if (!responseData.approvalRequired) {
             await mainDB.delete(`questionnaireResponse.${userId}`);
          }
          await logMessage(`${responseData.userTag} submitted questionnaire response for /${responseData.cmdName} in guild ${interaction.guild.name}`);

          return interaction.update({
            content: "Your responses have been submitted successfully!",
            components: [],
          });
        } catch (error) {
          return interaction.reply({
            content: "There was an error submitting your responses. Please try again.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      if (interaction.customId.startsWith("questionnaire_attach_")) {
        const userId = interaction.customId.replace("questionnaire_attach_", "");
        
        if (userId !== interaction.user.id) {
          return interaction.reply({
            content: "This button is not for you.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const responseData = await mainDB.get(`questionnaireResponse.${userId}`);
        if (!responseData) {
          return interaction.reply({
            content: "Your session has expired. Please fill out the questionnaire again.",
            flags: MessageFlags.Ephemeral,
          });
        }

        await interaction.update({
          content: "Please upload your files/screenshots in the next message (you have 2 minutes). You can attach up to 10 files.",
          components: [],
        });

        const filter = (msg) => {
          if (msg.author.id !== interaction.user.id) return false;
          if (msg.attachments.size === 0) return false;
          
          // Limit total size to 25MB (Discord default limit for most servers)
          const totalSize = msg.attachments.reduce((acc, a) => acc + a.size, 0);
          if (totalSize > 25 * 1024 * 1024) return false;
          
          return true;
        };
        
        try {
          const collected = await interaction.channel.awaitMessages({
            filter,
            max: 1,
            time: 120000,
            errors: ["time"],
          });

          const userMessage = collected.first();
          
          // Check if message was deleted before we can process
          if (!userMessage) throw new Error("message_not_found");

          const attachments = Array.from(userMessage.attachments.values());

          if (attachments.length > 10) {
             return interaction.followUp({
              content: "You can only upload up to 10 files at once. Please try again.",
              flags: MessageFlags.Ephemeral,
            });
          }

          const embed = new EmbedBuilder()
            .setTitle(responseData.resultTitle || "Questionnaire Response")
            .setColor("#5865F2")
            .setAuthor({
              name: responseData.userTag,
              iconURL: responseData.userAvatar,
            })
            .setTimestamp()
            .setFooter({ text: `Command: /${responseData.cmdName}` });

          responseData.answers.forEach((item, index) => {
            embed.addFields({
              name: `${index + 1}. ${item.question}`,
              value: item.answer || "No response",
              inline: false,
            });
          });

          if (attachments.length > 0) {
            const imageAttachments = attachments.filter(a => a.contentType?.startsWith("image/"));
            const imageEmbeds = [];
            
            if (imageAttachments.length > 0) {
              // The main embed gets the first image
              embed.setImage(imageAttachments[0].url);
              imageEmbeds.push(embed);
              
              // Additional images go in separate embeds
              for (let i = 1; i < Math.min(imageAttachments.length, 10); i++) {
                const nextEmbed = new EmbedBuilder()
                  .setURL("https://discord.com") // Match main embed URL if any, or just use a dummy to group
                  .setImage(imageAttachments[i].url);
                imageEmbeds.push(nextEmbed);
              }
            } else {
              imageEmbeds.push(embed);
            }
            
            const fileLinks = attachments.map(a => `[${a.name}](${a.url}) (${(a.size / 1024 / 1024).toFixed(2)}MB)`).join("\n");
            
            if (fileLinks.length > 1024) {
               embed.addFields({
                name: "Attached Files",
                value: "File list too long, check message attachments.",
                inline: false,
              });
            } else {
              embed.addFields({
                name: "Attached Files",
                value: fileLinks,
                inline: false,
              });
            }

            let targetChannel = interaction.channel;
            if (responseData.targetChannel) {
              try {
                const channel = await interaction.guild.channels.fetch(responseData.targetChannel);
                if (channel) {
                  targetChannel = channel;
                }
              } catch (e) {}
            }

            // We must send the embeds as an array
            const components = [];
            if (responseData.approvalRequired && responseData.autoRoles && responseData.autoRoles.length > 0) {
              const approveBtn = new ButtonBuilder()
                .setCustomId(`q_approve_${userId}`)
                .setLabel("Approve")
                .setStyle(ButtonStyle.Success);

              const denyBtn = new ButtonBuilder()
                .setCustomId(`q_deny_${userId}`)
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger);

              components.push(new ActionRowBuilder().addComponents(approveBtn, denyBtn));
            }

            await targetChannel.send({ embeds: imageEmbeds, components });
            if (!responseData.approvalRequired) {
              await mainDB.delete(`questionnaireResponse.${userId}`);
            }
            await logMessage(`${responseData.userTag} submitted questionnaire response with ${imageAttachments.length} images for /${responseData.cmdName} in guild ${interaction.guild.name}`);
          } else {
            // No attachments, just send the original embed
            let targetChannel = interaction.channel;
            if (responseData.targetChannel) {
              try {
                const channel = await interaction.guild.channels.fetch(responseData.targetChannel);
                if (channel) {
                  targetChannel = channel;
                }
              } catch (e) {}
            }

            const components = [];
            if (responseData.approvalRequired && responseData.autoRoles && responseData.autoRoles.length > 0) {
              const approveBtn = new ButtonBuilder()
                .setCustomId(`q_approve_${userId}`)
                .setLabel("Approve")
                .setStyle(ButtonStyle.Success);

              const denyBtn = new ButtonBuilder()
                .setCustomId(`q_deny_${userId}`)
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger);

              components.push(new ActionRowBuilder().addComponents(approveBtn, denyBtn));
            }

            await targetChannel.send({ embeds: [embed], components });
            if (!responseData.approvalRequired) {
              await mainDB.delete(`questionnaireResponse.${userId}`);
            }
          }

          try {
            await userMessage.delete();
          } catch (e) {}

          await interaction.followUp({
            content: "Your responses and attachments have been submitted successfully!",
            flags: MessageFlags.Ephemeral,
          });

        } catch (error) {
          if (error.message === "time") {
            const embed = new EmbedBuilder()
              .setTitle(responseData.resultTitle || "Questionnaire Response")
              .setColor("#5865F2")
              .setAuthor({
                name: responseData.userTag,
                iconURL: responseData.userAvatar,
              })
              .setTimestamp()
              .setFooter({ text: `Command: /${responseData.cmdName}` });

            responseData.answers.forEach((item, index) => {
              embed.addFields({
                name: `${index + 1}. ${item.question}`,
                value: item.answer || "No response",
                inline: false,
              });
            });

            let targetChannel = interaction.channel;
            if (responseData.targetChannel) {
              try {
                const channel = await interaction.guild.channels.fetch(responseData.targetChannel);
                if (channel) {
                  targetChannel = channel;
                }
              } catch (e) {}
            }

            await targetChannel.send({ embeds: [embed] });
            await mainDB.delete(`questionnaireResponse.${userId}`);
            await logMessage(`${responseData.userTag} submitted questionnaire response for /${responseData.cmdName} in guild ${interaction.guild.name} (timed out on attachments)`);

            await interaction.followUp({
              content: "Time expired. Your responses have been submitted without attachments.",
              flags: MessageFlags.Ephemeral,
            });
          } else {
            await interaction.followUp({
              content: "There was an error processing your attachments. Please try again.",
              flags: MessageFlags.Ephemeral,
            });
          }
        }
        return;
      }
    }

    if (interaction.isChatInputCommand()) {
      const guildId = interaction.guild?.id;
      if (!guildId) return;

      const existingCommands = await mainDB.get(`customCommands.${guildId}`) || {};
      const cmdName = interaction.commandName;
      
      if (!existingCommands[cmdName]) return;

      if (!(await ticketsDB.has(interaction.channel.id))) {
        return interaction.reply({
          content: config.errors.not_in_a_ticket || "You can only use this command in a ticket channel!",
          flags: MessageFlags.Ephemeral,
        });
      }

      const cmd = existingCommands[cmdName];

      if (cmd.access === "staff") {
        const ticketData = await ticketsDB.get(interaction.channel.id);
        const categoryId = ticketData?.categoryID;
        const category = config.TicketCategories.find(c => c.id === categoryId);
        const staffRoles = category?.support_role_ids || [];
        
        const hasStaffRole = interaction.member.roles.cache.some(role => staffRoles.includes(role.id));
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        
        if (!hasStaffRole && !isAdmin) {
          return interaction.reply({
            content: "This command is restricted to staff members only.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      if (cmd.type === "message") {
        if (cmd.embedTitle) {
          const embed = new EmbedBuilder()
            .setTitle(cmd.embedTitle)
            .setDescription(cmd.responseMessage)
            .setColor(cmd.embedColor || "#5865F2")
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        } else {
          return interaction.reply({ content: cmd.responseMessage });
        }

      } else if (cmd.type === "button") {
        const buttonStyle = ButtonStyle[cmd.buttonStyle] || ButtonStyle.Success;
        
        const button = new ButtonBuilder()
          .setCustomId(`customcmd_btn_${cmdName}`)
          .setLabel(cmd.buttonLabel)
          .setStyle(buttonStyle);

        const row = new ActionRowBuilder().addComponents(button);

        const embed = new EmbedBuilder()
          .setDescription(cmd.messageContent)
          .setColor("#5865F2")
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          components: [row],
        });

      } else if (cmd.type === "questionnaire") {
        const modal = new ModalBuilder()
          .setCustomId(`customcmd_questionnaire_submit_${cmdName}`)
          .setTitle(cmd.resultTitle || "Questionnaire");

        cmd.questions.slice(0, 5).forEach((question, index) => {
          const input = new TextInputBuilder()
            .setCustomId(`question_${index}`)
            .setLabel(question.substring(0, 45))
            .setPlaceholder("Enter your answer...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

          modal.addComponents(new ActionRowBuilder().addComponents(input));
        });

        return interaction.showModal(modal);
      }
    }
  },
};
