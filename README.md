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
