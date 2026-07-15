# DealGenie

AI-powered quoting assistant for IBM Security sellers. Generates accurate, structured quotes for IBM Security Verify, IBM HashiCorp Vault, and NS1 Connect from a conversational interface. Outputs part numbers + quantities ready to paste into CPQ.

Created by **Ranya El-Shinawy** and **Naman Khandelwal** — IBM

---

## Running locally

```bash
cd deal-genie
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Password: **garland**

## Running tests

```bash
cd deal-genie
npx jest --no-coverage
```

50 tests pass (36 NS1 + 14 Verify).

---

## Environment variables

Create `deal-genie/.env.local` with:

```bash
# watsonx.ai — entity extraction and AI SME chat
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=...
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Cloudant — quote history persistence
CLOUDANT_URL=...
CLOUDANT_API_KEY=...

# IBM Search AI — live IBM Docs context injected into Genie system prompt
IBM_SEARCH_API_KEY=...

# Password gate
APP_PASSWORD=garland
```

---

## What it does

| Feature | Detail |
|---|---|
| **Conversational quoting** | Ask discovery questions, compute RUs / part counts / line items |
| **Three products** | IBM Security Verify, IBM HashiCorp Vault, NS1 Connect |
| **Confirmed prices** | NS1 prices sourced from IBM Marketplace API; Verify/Vault from CPQ |
| **CSV export** | Part numbers + quantities + pricing ready for CPQ entry |
| **Compare Scenarios** | Explore pricing levers deterministically (no AI); running total matches quote |
| **Quote history** | Save, retrieve, compare past quotes via Cloudant |
| **Best Practices / AI SME** | watsonx.ai–powered product guide and seller coaching |
| **Password gate** | Proxy middleware; login page before any content |

---

## Architecture

```
app/
  page.tsx                      — Chat UI
  api/chat/route.ts             — Quoting conversation endpoint
  api/best-practices/route.ts   — Best practices AI endpoint
  api/compute-quote/route.ts    — Direct quote compute endpoint
  api/quotes/route.ts           — Quote history (Cloudant)
  api/search-health/route.ts    — IBM Search AI health check
  api/auth/login/route.ts       — Password gate auth endpoint

lib/
  watsonx.ts                    — watsonx.ai wrapper (IAM auth + text generation)
  ibm-search.ts                 — IBM Search AI client (live IBM Docs context)
  extractor.ts                  — AI entity extraction from user messages
  best-practices-ai.ts          — Injects IBM Docs into Genie system prompt
  conversation.ts               — Conversation state machine
  data.ts                       — Pricing data (Verify, Vault, NS1 tiers)
  types.ts                      — Shared types
  questions.ts                  — Per-product discovery question flows
  verify-engine.ts              — IBM Security Verify quote calculation
  vault-engine.ts               — IBM HashiCorp Vault quote calculation
  ns1-engine.ts                 — NS1 Connect quote calculation (Essentials/Standard/Premium/Hybrid)
  ns1-parts.ts                  — NS1 part catalog with confirmed IBM Marketplace prices + graduated tiers
  verify-parts.ts               — Verify part catalog
  vault-parts.ts                — Vault part catalog
  export-csv.ts                 — CSV export (quote + full catalog)
  quote-history.ts              — Cloudant persistence helpers
  compare-engine.ts             — Scenario comparison engine (deterministic, no AI)

components/
  QuestionInput.tsx             — Structured question UI (buttons, multi-select, free text)
  NS1QuoteDisplay.tsx           — NS1 tabbed quote display (Summary/Parts/Best Practices/Tutorial/Quick Ref)
  QuoteCompare.tsx              — Side-by-side saved quote comparison
  QuoteHistoryDrawer.tsx        — Saved quote history drawer
  ScenarioCompare.tsx           — Scenario comparison view (fork variables + add-on toggles)

proxy.ts                        — Password gate middleware
```

---

## Deploying to IBM Cloud Code Engine

### First deploy (~45 min)

**Prerequisites — run once:**
```bash
# Install IBM Cloud CLI
curl -fsSL https://clis.cloud.ibm.com/install/osx | sh

# Install required plugins
ibmcloud plugin install container-registry
ibmcloud plugin install code-engine

# Log in (opens browser — use your IBM w3 ID, select us-south + Default)
ibmcloud login --sso -a https://cloud.ibm.com
ibmcloud target -r us-south -g Default

# Create Container Registry namespace
ibmcloud cr region-set us-south
ibmcloud cr namespace-add deal-genie
ibmcloud cr login
```

**Build and push the image:**
```bash
cd /path/to/DealGenie/deal-genie

# Confirm clean before building
npx jest --no-coverage
npm run build

# Build for linux/amd64 (Code Engine is x86, not Apple Silicon)
docker build --platform linux/amd64 -t us.icr.io/deal-genie/app:latest .
docker push us.icr.io/deal-genie/app:latest
```

**Create the Code Engine project and secrets:**
```bash
ibmcloud ce project create --name deal-genie
ibmcloud ce project select --name deal-genie

# Registry pull secret
ibmcloud iam api-key-create deal-genie-registry-key --output json
ibmcloud ce registry create \
  --name icr-secret \
  --server us.icr.io \
  --username iamapikey \
  --password <PASTE_API_KEY_HERE>

# App secrets — all env vars, never baked into the image
ibmcloud ce secret create --name deal-genie-env \
  --from-literal WATSONX_API_KEY=... \
  --from-literal WATSONX_PROJECT_ID=... \
  --from-literal WATSONX_URL=https://us-south.ml.cloud.ibm.com \
  --from-literal CLOUDANT_URL=... \
  --from-literal CLOUDANT_API_KEY=... \
  --from-literal IBM_SEARCH_API_KEY=... \
  --from-literal APP_PASSWORD=garland
```

**Deploy:**
```bash
ibmcloud ce app create \
  --name deal-genie \
  --image us.icr.io/deal-genie/app:latest \
  --registry-secret icr-secret \
  --env-from-secret deal-genie-env \
  --port 3000 \
  --min-scale 1 \
  --max-scale 3 \
  --cpu 1 \
  --memory 4G
```

**Get your live URL:**
```bash
ibmcloud ce app get --name deal-genie
# Look for the URL line — e.g. https://deal-genie.<hash>.us-south.codeengine.appdomain.cloud
```

---

### Redeploying after code changes (~5 min)

```bash
# 1. Rebuild with your new code
docker build --platform linux/amd64 -t us.icr.io/deal-genie/app:latest .

# 2. Push the new image
docker push us.icr.io/deal-genie/app:latest

# 3. Rolling deploy — old version stays live until new one is ready
ibmcloud ce app update --name deal-genie --image us.icr.io/deal-genie/app:latest
```

The URL never changes. Zero downtime.

**If you added a new environment variable**, update the secret first:
```bash
ibmcloud ce secret update --name deal-genie-env \
  --from-literal NEW_VAR=value
ibmcloud ce app update --name deal-genie --image us.icr.io/deal-genie/app:latest
```

**To stream live logs:**
```bash
ibmcloud ce app logs --name deal-genie --follow
```

---

## Key contacts

| Area | Contact |
|---|---|
| IBM Security Verify | Dennis Weru |
| IBM HashiCorp Vault | Olivia Erdman |
| Project owner | Naman Khandelwal (IBM intern) |

## Next steps

See [NEXT_STEPS.md](./NEXT_STEPS.md).
