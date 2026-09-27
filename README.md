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

Do not commit your Discord token or Supabase secret key. Store them as Railway variables. Guardia uses the Supabase secret key only on the backend.

## Important

Guild settings, custom words, and violation counters are stored in Supabase. The Discord bot never stores secrets in GitHub.
