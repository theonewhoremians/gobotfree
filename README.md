# Go Bot Free

A small, dependency-free website for collecting Instagram handles, public Reel links, and short text posts. It does not request or store Instagram passwords.

## Run locally

Use Node.js 18 or newer. Copy `.env.example` to `.env`, fill in an admin username and a strong admin password, then start the server:

```powershell
Copy-Item .env.example .env
# Edit .env and set ADMIN_USER and ADMIN_PASSWORD
node server.js
```

Open `http://localhost:3000`. The admin panel is at `http://localhost:3000/head`; the browser will show its built-in username/password prompt. The prompt protects the dashboard and its data API.

Requests and posts are stored in `data/submissions.json` and `data/posts.json` on the server and excluded from Git. Posts are limited to 800 characters and are visible in the protected admin panel.

## Telegram notifications

Create a bot with [@BotFather](https://t.me/BotFather), open its private chat in Telegram, and send `/start`. To get your chat ID, run this in PowerShell from the project folder; it prompts for the token without echoing it and prints the latest chat ID:

```powershell
$secureToken = Read-Host 'Bot token' -AsSecureString
$token = [System.Net.NetworkCredential]::new('', $secureToken).Password
$updates = Invoke-RestMethod "https://api.telegram.org/bot$token/getUpdates"
$updates.result | ForEach-Object { $_.message.chat.id } | Select-Object -Last 1
Remove-Variable token, secureToken, updates
```

Put the token and chat ID in `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`, then restart the server. Successful Reel requests and new posts will send a Telegram message to that chat using the Bot API's [`sendMessage`](https://core.telegram.org/bots/api#sendmessage) method. If Telegram is unavailable, the website still saves the submission and logs the delivery failure.

Keep `.env` private and do not commit or share the bot token. For public hosting, run the server behind HTTPS and configure all four values as hosting-provider secrets.
