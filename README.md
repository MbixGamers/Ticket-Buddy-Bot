# Ticket Buddy - Discord Bot

## Overview

Ticket Buddy is a comprehensive Discord ticket management bot built with discord.js v14. It provides multi-server support ticket functionality including ticket creation, claiming, auto-close/delete, transcripts, user blacklisting, and detailed logging. The bot is designed to run across multiple Discord servers with per-server configuration capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Framework
- **Runtime**: Node.js with discord.js v14 for Discord API interactions
- **Entry Point**: `index.js` initializes the client, loads commands/events, and starts background tasks
- **Initialization**: `init.js` handles client setup, database connections, and configuration parsing

### Database Design
- Uses SQLite via quick.db (backed by better-sqlite3) for persistent storage
- **Three separate databases** for separation of concerns:
  - `main.sqlite` - Guild settings, statistics, user preferences
  - `tickets.sqlite` - Active ticket data and metadata
  - `blacklist.sqlite` - User/role blacklist entries with expiration
- Data stored in configurable directory (defaults to `./data/`)
- Guild-scoped keys use pattern `guild:{guildId}:{key}` for multi-server isolation

### Configuration System
- **Static config**: `config.yml` for bot-wide settings, embed templates, feature toggles
- **Per-server config**: Stored in database via `guildConfig.js` utility
- Environment variables via `.env` for sensitive data (BOT_TOKEN, CLIENT_ID)

### Command Architecture
- Slash commands organized by category: `commands/Tickets/`, `commands/Utility/`, `commands/ContextMenu/`
- Commands are dynamically loaded and registered with Discord API on startup
- Each command module exports `enabled`, `data` (SlashCommandBuilder), and `execute` function
- Permission checks use Discord's native permission system plus custom role validation

### Event System
- Event handlers in `events/` directory (guildCreate, guildDelete, interactionCreate, messageCreate, ready)
- `interactionCreate.js` is the main handler routing buttons, modals, select menus, and slash commands

### Ticket Lifecycle
- **Creation**: `ticketCreate.js` - Creates channel with permissions, sends welcome embed
- **Claiming**: `ticketClaim.js` - Staff can claim tickets for 1-on-1 support
- **Closing**: `ticketClose.js` - Moves to closed category, adjusts permissions
- **Deletion**: `ticketDelete.js` - Generates transcript, removes channel
- **Auto-close/delete**: Background tasks check ticket inactivity and apply timeouts

### Custom Commands System
- **Admin Setup**: `/customcmd create|delete|list|edit` - Manage custom commands
- **Storage**: Custom commands stored in database per guild at `customCommands.{guildId}`
- **Command Types**:
  - **Message**: Simple text or embed response when command is used
  - **Button**: Shows message with clickable button, triggers follow-up on click
  - **Questionnaire**: Opens modal with questions, sends formatted answers as embed
- **Registration**: Commands are registered as guild-specific slash commands via Discord API
- **Files**: 
  - `commands/Utility/customcmd.js` - Admin command for setup
  - `events/customCommandHandler.js` - Handles execution and modals
  - `utils/customCommandRegistry.js` - Discord API registration utilities

### Transcript Generation
- Uses `discord-html-transcripts` library for HTML format
- Alternative TXT format available via configuration
- Transcripts sent to configured log channels and optionally to ticket creator via DM

### Utility Functions
- `utils/mainUtils.js` - Core helpers for embeds, permissions, logging, database operations
- `utils/guildConfig.js` - Per-server configuration management
- Specialized utilities for each ticket operation (alert, claim, close, etc.)

## External Dependencies

### Discord API
- **discord.js v14.15.3** - Primary Discord bot framework
- Requires BOT_TOKEN and CLIENT_ID in environment variables
- Uses Gateway Intents: Guilds, GuildMessages, MessageContent, GuildMembers

### Database
- **quick.db v9.1.7** - Simple key-value wrapper for SQLite
- **better-sqlite3 v11.0.0** - Native SQLite3 bindings for Node.js
- Data persists locally in SQLite files

### Transcript Service
- **discord-html-transcripts v3.2.0** - Generates HTML transcripts of Discord channels

### Configuration & Utilities
- **yaml v2.4.5** - Parses config.yml configuration file
- **dotenv v16.4.5** - Loads environment variables from .env file
- **moment-timezone v0.5.45** - Timezone-aware date/time formatting for logs

### External Services
- No external APIs beyond Discord
- All data stored locally in SQLite databases
- Logging to console and Discord channels (configurable)
