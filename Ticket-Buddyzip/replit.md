# Ticket Buddy - Discord Bot

A comprehensive Discord ticket management bot built with discord.js v14.

## Project Status

**Last Updated**: December 26, 2025  
**Current Version**: 1.7.0  
**Status**: Production Ready

## Overview

Ticket Buddy is a fully-featured Discord bot that provides comprehensive ticket management functionality for Discord servers. The bot enables server administrators to create, manage, and track support tickets with features including auto-closing, transcripts, claiming, blacklisting, and detailed logging.

### Key Features
- Multi-category ticket system
- Auto-close and auto-delete tickets
- Ticket claiming system for staff
- HTML/TXT transcripts
- User blacklisting with expiration
- Per-server configurations
- Comprehensive logging
- Button-based interactions

## Core Technologies

- **Runtime**: Node.js v18+
- **Discord Framework**: Discord.js v14.25.0
- **Database**: SQLite via quick.db (v9.1.7) and better-sqlite3 (v12.4.1)
- **Configuration**: YAML for static configuration
- **Environment**: dotenv for API keys and secrets
- **Transcript Generation**: discord-html-transcripts for ticket archival
- **Timezone Support**: moment-timezone

## Project Structure

```
/
├── index.js              # Main bot entry point - starts client, loads commands/events
├── init.js               # Client initialization, database setup, config parsing
├── config.yml            # Complete bot configuration
├── package.json          # Node.js dependencies
├── .env.example          # Environment variable template
├── .gitignore            # Git ignore rules
├── README.md             # Setup instructions
├── start.sh              # Startup script
│
├── commands/             # Slash commands (organized by type)
│   ├── Tickets/          # Ticket management commands (add, close, claim, etc)
│   ├── ContextMenu/      # Right-click context menu commands
│   └── Utility/          # Admin & configuration commands
│
├── events/               # Discord.js event handlers
│   ├── ready.js          # Bot startup initialization
│   ├── interactionCreate.js  # Slash commands, buttons, modals
│   ├── messageCreate.js  # Message events
│   ├── guildCreate.js    # Server join events
│   ├── guildDelete.js    # Server leave events
│   └── ...
│
├── utils/                # Utility functions
│   ├── mainUtils.js      # Core utilities
│   ├── guildConfig.js    # Per-server configuration
│   ├── ticketCreate.js   # Ticket creation logic
│   ├── ticketClose.js    # Ticket closing logic
│   ├── ticketTranscript.js  # Transcript generation
│   └── ...
│
└── data/                 # SQLite databases (auto-created)
    ├── main.sqlite       # Global bot state
    ├── tickets.sqlite    # Ticket data
    ├── blacklist.sqlite  # Blacklisted users/roles
    └── guilds.sqlite     # Per-server configurations
```

## Database Structure

The bot uses four separate SQLite databases for organization:

1. **mainDB** (`main.sqlite`) - Global statistics and claim locks
2. **ticketsDB** (`tickets.sqlite`) - Individual ticket data
3. **blacklistDB** (`blacklist.sqlite`) - User/role blacklist entries
4. **guildDB** (`guilds.sqlite`) - Per-server custom configurations

All keys follow a guild-scoped pattern for multi-server support.

## File Links & Imports

All imports are **relative paths** and use Node.js require():
- `require("./init.js")` - Local files
- `require("../../utils/mainUtils.js")` - Relative paths with `__dirname`
- Database paths use `path.join(__dirname, "data")`

**This ensures the bot works when extracted from a ZIP and deployed anywhere.**

## Installation & Setup

### Prerequisites
- Node.js 18 or higher
- Discord Bot Token

### Quick Start

1. **Extract the bot files**
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file**:
   ```bash
   cp .env.example .env
   ```

4. **Add your Discord Bot Token** to `.env`:
   ```
   BOT_TOKEN=your_token_here
   ```

5. **Configure the bot** using `config.yml`

6. **Run the bot**:
   ```bash
   npm start
   ```

### Startup Options
- `npm start` - Run with `node index.js`
- `bash start.sh` - Run with automatic dependency check

## Configuration Guide

Edit `config.yml` to customize:
- Ticket categories and buttons
- Staff roles and permissions
- Auto-close/delete settings
- Transcript settings
- Blacklist behavior
- Button labels and emojis
- Modal questions
- And much more...

## Dependencies

All dependencies are in `package.json`:
- **discord.js** - Discord API library
- **discord-html-transcripts** - Generate ticket transcripts
- **quick.db** - Simple key-value database
- **better-sqlite3** - SQLite database support
- **yaml** - Parse YAML config
- **moment-timezone** - Timezone utilities
- **dotenv** - Load environment variables
- **@discordjs/rest** - Discord REST API

Install with: `npm install`

## Deployment

The bot is ready to deploy to any hosting platform:
- **Replit**: Native support with `.replit` configuration
- **VPS/Dedicated Server**: Extract ZIP and run `npm start`
- **Docker**: Can be containerized with Node.js image
- **Cloud Platforms**: AWS, Heroku, Railway, Render, etc.

All file paths are relative, making deployment seamless.

## File Cleanup

**Removed (for portability)**:
- ✓ Old nested directories
- ✓ ZIP files
- ✓ Log files
- ✓ Temporary cache files

**Included (for functionality)**:
- ✓ Clean source code
- ✓ Configuration template
- ✓ Environment template
- ✓ Documentation

## Development Notes

- Commands are loaded dynamically from the `commands/` directory
- Events are loaded dynamically from the `events/` directory
- Config is parsed once at startup from `config.yml`
- Databases are created automatically if they don't exist
- All file paths use `__dirname` for portability

## User Preferences

- Simple, clear documentation
- Production-ready code
- Relative imports for portability
- Clean file structure
