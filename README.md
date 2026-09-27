# 🛡️ Guardia

Guardia is a Discord anti-bad-word moderation bot built with Node.js and Discord.js.

## Features

- Unicode normalization
- Confusable-character detection
- Zero-width character handling
- Spacing/separator evasion handling
- Default bad-word dataset
- Per-server custom bad words
- `/badword add`
- `/badword remove`
- `/badword list`
- Automatic message deletion
- Violation counting
- Automatic timeout after the configured limit
- Private `#guardia-logs` channel
- Logs restricted to Administrators
- `/guardia setup`
- `/guardia status`
- Railway-friendly environment variables

## Environment variables

Set these in Railway:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_discord_application_id
```

## Discord intents

Enable **Message Content Intent** in the Discord Developer Portal.

## Run locally

```bash
npm install
npm start
```

## Railway

Use the repository as the source for a Railway service. Railway should run:

```bash
npm start
```

Do not commit your Discord token. Store it as a Railway variable.

## Important

The current runtime store uses a JSON file for the MVP. Railway's filesystem should not be treated as permanent storage for production configuration. A database can be added in the next stage.
