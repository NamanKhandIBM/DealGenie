# DealGenie

AI-powered quoting assistant for IBM Security sellers. Generates accurate, structured quotes for IBM Security Verify, IBM Vault, and NS1 products from a conversational interface.

## Running locally

```bash
cd deal-genie
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `deal-genie/.env.local` with:

```bash
# IBM Cloud API key — exchanged for an IAM bearer token to call watsonx.ai
WATSONX_API_KEY=...

# watsonx.ai project ID
WATSONX_PROJECT_ID=...

# watsonx.ai regional endpoint
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# --- Coming soon ---
# IBM Search wrapper token (from Access Hub — search "IBM Search wrapper")
# Used to query live Seismic pricing content via the IBM Unified Search v2 API
# IBM_SEARCH_API_KEY=...
```

## Architecture

```
app/
  page.tsx                  — Chat UI
  api/chat/route.ts         — Quoting conversation endpoint
  api/best-practices/route.ts — Best practices AI endpoint

lib/
  watsonx.ts                — watsonx.ai wrapper (IAM auth + text generation)
  extractor.ts              — AI entity extraction from user messages
  conversation.ts           — Conversation state machine
  data.ts                   — Hardcoded pricing data (Verify, Vault, NS1)
  types.ts                  — Shared types
  verify-engine.ts          — IBM Verify quote calculation
  vault-engine.ts           — IBM Vault quote calculation
  ns1-engine.ts             — NS1 quote calculation
```

## Next steps

See [NEXT_STEPS.md](./NEXT_STEPS.md).
