# Contextual Agent

Evidence-aware mediation agent built with Next.js.

## Local Development

```bash
npm install
npm run dev
```

## Production Check

```bash
npm run typecheck
npm run build
```

## Deploy To Vercel

Run from this folder:

```bash
npx vercel
npx vercel --prod
```

## Public Context

`usePublicContext` only applies to public facts.

- If the pasted input includes public URLs, the server can fetch those pages directly.
- If `CONTEXTUAL_PUBLIC_CONTEXT_MCP_URL` is set, the server will try that MCP bridge first.

Create a local env file if needed:

```bash
cp .env.example .env.local
```

## Slack Entry Point

Contextual now includes a Slack mention handler built with Chat SDK.

- Webhook route: `/api/webhooks/slack`
- Shared agent core: `lib/contextual/run-agent.ts`
- Chat handler: `lib/contextual/chat/slack-bot.ts`

Required environment variables:

```bash
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_BOT_USERNAME=contextual
```

Import the Slack app manifest from `slack-app-manifest.yml`.
It is already configured for the production webhook URL:

```text
https://contextual-agent.vercel.app/api/webhooks/slack
```

Recommended Slack bot behavior:

- Mention the bot in a thread with the shared conversation.
- The bot reads recent thread messages as shared evidence.
- If reflections are missing, the bot asks each participant to either:
  - DM the bot: `reflection for <thread-id>: ...`
  - or reply in-thread: `reflection: ...`

Privacy notes:

- The bot does not claim access to private DMs unless a participant sends one directly to the bot.
- Private reflections are used as context but are not quoted back into the thread as shared evidence.
- Reflection storage is currently in-memory only and is not durable across redeploys or cold starts.
