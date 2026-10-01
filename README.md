# Go Bot Free

A small website for collecting Instagram handles, public Reel links, and short text posts. It does not request or store Instagram passwords. The hosted site uses Vercel Functions and Supabase Postgres; no paid add-ons or packages are required for a small personal project.

## Run locally

Use Node.js 18 or newer. Copy `.env.example` to `.env`, fill in an admin username and a strong admin password, then start the server:

```powershell
Copy-Item .env.example .env
# Edit .env and set ADMIN_USER and ADMIN_PASSWORD
node server.js
```

Open `http://localhost:3000`. The admin panel is at `http://localhost:3000/head`; the browser will show its built-in username/password prompt. The prompt protects the dashboard and its data API.

When running locally, requests and posts are stored in `data/submissions.json` and `data/posts.json`, excluded from Git. Posts are limited to 800 characters.

## Free hosted admin panel

The live backend uses Vercel Functions and a Supabase database so saved entries persist between deployments. Create a Supabase project on its Free plan, then:

1. In Supabase, open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it. This creates the two private tables for Reel requests and posts.
2. In Supabase **Project Settings → API Keys**, copy the **Project URL** and a **Secret key** (`sb_secret_...`). Do not use the publishable key in the server settings.
3. In Vercel, open the `gobotfree` project and add these environment variables for **Production** (and Preview too if you want preview deployments to work):

   - `ADMIN_USER` — the name for the `/head` prompt
   - `ADMIN_PASSWORD` — a long, unique password
   - `SUPABASE_URL` — the Supabase Project URL
   - `SUPABASE_SECRET_KEY` — the Supabase Secret key
   - `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` — optional; set these to receive Telegram alerts

4. Redeploy the latest Vercel deployment. Then open `https://gobotfree.vercel.app/head` and use the admin username and password. Each saved Reel request or post appears in the panel; a Telegram alert is sent when the Telegram values are configured.

The Supabase Secret key bypasses database row policies, so it must stay in Vercel environment settings and never be put in browser code or GitHub. The SQL keeps direct `anon` and `authenticated` table access revoked; only the server function uses the secret key.

Free plans have limits: Supabase Free currently includes 500 MB of database space and may pause projects after a week of inactivity. Vercel Hobby includes Functions within its usage limits and is intended for personal projects. If a Supabase project pauses, resume it in Supabase before submissions can be saved again.

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
