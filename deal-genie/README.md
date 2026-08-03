# Quote Genie

A chat-interface quoting calculator for IBM Software sellers. A seller picks a product, answers a short set of discovery questions, and gets back a formatted quote with IBM part numbers, quantities, and list prices — ready to paste into SAP CPQ. No spreadsheets. No manual lookup.

The core is **deterministic** — all pricing is hard-coded confirmed IBM list prices, and all math runs in-memory with no AI in the calculation path. There is a thin optional AI layer (watsonx.ai) for parsing free-text input and for a separate best-practices chat mode, but it has nothing to do with how prices are calculated.

---

## What it covers

**9 IBM products, each with a full quoting engine:**

| Product | Group | Billing metric |
|---|---|---|
| IBM Security Verify | Security & Identity | Resource Units (RU) per MAU |
| IBM HashiCorp Vault | Security & Identity | RU consumption (Model A — Vault 2.0) |
| IBM MaaS360 | Security & Endpoints | Per managed device / month (public pricing) |
| NS1 Connect | Networking & DNS | Queries, records, filter chains, monitors |
| IBM HashiCorp Terraform | Infrastructure & DevOps | Resources Under Management (RUM) |
| IBM webMethods Integration | Integration | RU / transaction volume |
| IBM Instana Observability | Observability & AIOps | Managed Virtual Server (MVS) |
| IBM Turbonomic | Observability & AIOps | MVS or annual cloud spend |
| IBM Concert | Observability & AIOps | Resource Units (RU) per module |

---

## How a seller uses it

1. **Pick a product** from the product grid on the welcome screen
2. **Answer the discovery questions** — rendered as option buttons or number inputs, seller-friendly language (no IBM jargon like RU, MAU, MVS shown during questioning)
3. **Get a result card** — part numbers, quantities, list prices, CPQ entry notes, discount guidance
4. **Optional: cross-sell** — after any quote, Quote Genie surfaces the strongest adjacent product recommendation with a one-click "launch mini-flow" button that opens a guided second quote

Additional capabilities after the quote:
- **Scenario Compare** — dynamic what-if explorer anchored to the actual quote value; options are generated relative to your specific answer (not static generic lists); add-ons from the original quote are preserved in the running total; zero API calls
- **Save quote** — persists to IBM Cloudant with auto-generated label; cross-sell quote pairs are saved as linked records
- **Quote history** — drawer panel, search, load saved quote back into conversation, compare two saved quotes side-by-side
- **Export CSV** — download the quote as a spreadsheet
- **Back button** — full undo history in-session; every send() snapshots the conversation state before acting
- **Best practices mode** — separate AI SME chat (watsonx.ai or OpenAI) that answers seller questions about a product

---

## Architecture

### Request flow

```
Browser (React SPA — app/page.tsx)
    │
    ├── POST /api/chat              ← every question answer goes here
    │     ├── extractEntities()     ← watsonx.ai: parse free text into structured fields
    │     └── processUserMessage()  ← deterministic state machine → returns reply + next question
    │
    ├── POST /api/compute-quote     ← ScenarioCompare "Build with these settings" button
    │
    ├── GET/POST/DELETE /api/quotes ← Cloudant quote history
    │
    ├── POST /api/best-practices    ← separate AI SME chat (not part of quoting flow)
    │
    └── POST /api/auth/login        ← password auth, sets 7-day httpOnly session cookie
```

### Conversation state machine (`lib/conversation.ts`)

```
welcome / product-select
    → user picks a product
    → phase = "discovery", answers seeded with defaults

discovery
    → each answer is stored, step advances
    → conditional questions are skipped if their condition is not met
    → watsonx entity extraction runs in parallel; pre-fills answers from free text
    → if a message looks like a question mid-flow, static knowledge base answers it
      without advancing the step (inline Q&A)
    → when all questions answered → phase = "computing"

computing → computeResult() → phase = "result"
    → formatted HTML card: part numbers, quantities, list prices, CPQ notes
    → cross-sell recommendation appended as visual attach cards

result
    → "cross-sell" command launches the adjacent product mini-flow
    → picking a new product name restarts discovery
    → "restart" / "reset" resets everything

best-practices (separate branch)
    → AI SME chat, stateful follow-up Q&A
    → does not affect quote state
```

### Pricing calculation (entirely in `lib/*-engine.ts`)

All calculation is deterministic and in-memory. The engines receive typed inputs and return structured line items using confirmed IBM list prices from `lib/*-data.ts` and `lib/data.ts`. No network calls, no AI.

```
User answers → conversation.ts → computeResult()
                                       ↓
                              routes to product engine
                                       ↓
              *-engine.ts  ×  *-data.ts (confirmed IBM list prices)
                                       ↓
                    line items: part number, qty, list price, notes
```

### Scenario Compare engine (`lib/compare-engine.ts`)

The `ScenarioCompare` component (zero AI, fully in-memory) provides a two-panel what-if explorer:

- **Fork variables** — `getForkVariables()` generates option lists **anchored to the actual quoted value** using a geometric ×5 scale (2 steps below, current value, 2 steps above). A user who quoted 100 devices sees 4/20/100/500/2,500 — not a static generic list
- **Scenario price** — `computeScenarioPrice()` fully audited against all 9 product quote flows. All add-ons, secondary use cases (Vault SSH/Transit/KMSE), cloud-spend scoping (Turbonomic), B2B transactions (webMethods), dedicated PoPs and China DNS (NS1), and cross-sell answer keys (Verify) are passed through so the Running Total always matches the original quote price
- **Add-on panel** — persistent checkboxes for binary add-ons (Verify: SMS/HAG/Vanity/NonProd; Vault: NonProd/KMIP; NS1: DDoS protection); live price delta shown per toggle

### Cross-sell system (`lib/cross-sell.ts`)

15 plays defined across all 9 products. After any quote result, the UI renders visual attach cards (one per recommended target) that include recommendation rationale, instant price preview, seller discovery prompt, and a launch button for the guided second quote.

---

## Project structure

```
deal-genie/
├── app/
│   ├── page.tsx                      # Single-page chat UI
│   ├── layout.tsx                    # Root layout — Quote Genie branding
│   ├── globals.css                   # IBM Design System dark-mode palette, all component styles
│   ├── login/page.tsx                # Password login
│   └── api/
│       ├── chat/route.ts             # Main conversation endpoint
│       ├── compute-quote/route.ts    # Direct compute (ScenarioCompare)
│       ├── quotes/route.ts           # Cloudant CRUD
│       ├── best-practices/route.ts   # AI SME chat
│       ├── auth/login/route.ts       # Password auth
│       └── search-health/route.ts    # IBM Search config check
│
├── components/
│   ├── QuestionInput.tsx             # Renders a single question (single/multi/number/free)
│   ├── ScenarioCompare.tsx           # Two-panel what-if explorer (zero AI, real-time pricing)
│   ├── QuoteCompare.tsx              # Side-by-side comparison of 2 saved quotes
│   ├── QuoteHistoryDrawer.tsx        # Slide-out quote history panel
│   └── NS1QuoteDisplay.tsx           # Tabbed NS1 result view (quote, parts, tutorial)
│
├── lib/
│   ├── types.ts                      # Product union, ConversationState, Message, initialState
│   ├── data.ts                       # Master pricing constants (Verify RU tiers, NS1 tiers, Vault parts)
│   │
│   ├── conversation.ts               # Conversation orchestrator + all result renderers
│   ├── questions.ts                  # Per-product question definitions (seller-facing language)
│   ├── compare-engine.ts             # ScenarioCompare fan-out logic (fork variables, add-ons, sliders)
│   ├── cross-sell.ts                 # 15 cross-sell play definitions + recommendation functions
│   │
│   ├── verify-engine.ts              # IBM Security Verify: RU calculation, MAU tiers, add-ons
│   ├── verify-parts.ts               # Verify part catalog, best practices, tutorial steps
│   ├── vault-engine.ts               # IBM HashiCorp Vault: Model A (RU/consumption — Vault 2.0)
│   ├── vault-parts.ts                # Vault part catalog, best practices, tutorial steps
│   ├── ns1-engine.ts                 # NS1 Connect: Standard / Premium / Hybrid Cloud DNS
│   ├── ns1-parts.ts                  # NS1 part catalog (all 3 tiers), best practices, tutorial
│   ├── maas360-engine.ts             # IBM MaaS360: plan recommendation + public-price estimate
│   ├── maas360-data.ts               # MaaS360 plans ($4/$5/$6.25/$9/device/mo), add-ons, pricing
│   ├── instana-engine.ts             # IBM Instana: SaaS / Self-Hosted / PayPerUse, Essentials / Standard
│   ├── instana-data.ts               # Instana parts, tier pricing, add-on pricing, cross-sell points
│   ├── turbonomic-engine.ts          # IBM Turbonomic: SaaS / SaaSGov / OnPrem / Parking / Hosting
│   ├── turbonomic-data.ts            # Turbonomic parts, monitored-costs tiers, cross-sell points
│   ├── terraform-engine.ts           # IBM HashiCorp Terraform: Free / Standard / Premium, RUM tiers
│   ├── terraform-data.ts             # Terraform RUM pricing, SCS discount matrix, cross-sell points
│   ├── concert-engine.ts             # IBM Concert: module recommendation, RU sizing
│   ├── concert-data.ts               # Concert parts, RU rates (SaaS $1.06/RU + on-prem $212/RU)
│   ├── webmethods-engine.ts          # IBM webMethods: SaaS RU model, per-product transaction rates
│   ├── webmethods-data.ts            # webMethods rates ($40.08/RU/yr confirmed Jul 2026), B2B txn
│   │
│   ├── quote-history.ts              # Cloudant CRUD, SavedQuote type, auto-label, linked quote groups
│   ├── extractor.ts                  # watsonx entity extraction (runs in parallel, fails gracefully)
│   ├── watsonx.ts                    # watsonx.ai generate wrapper + IAM token cache
│   ├── best-practices-ai.ts          # AI SME system prompts + chat continuation (Verify, NS1, Vault)
│   ├── ibm-search.ts                 # IBM Search API — injects live IBM docs into AI SME prompts
│   ├── export-csv.ts                 # CSV export for quotes and part catalogs
│   │
│   └── __tests__/
│       ├── simulation.test.ts             # 200+ pricing simulations across all 9 products
│       ├── pricing-accuracy.test.ts       # Cross-product pricing validation
│       ├── full-precision.test.ts         # High-precision engine accuracy tests
│       ├── conversation-cross-sell.test.ts# End-to-end cross-sell conversation flows
│       ├── verify-engine.test.ts          # Verify RU calculation unit tests
│       └── ns1-engine.test.ts             # NS1 part selection and pricing unit tests
│
├── next.config.ts                    # Next.js config (Turbopack enabled, Vercel deploy)
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS, TypeScript |
| AI — entity extraction | watsonx.ai `ibm/granite-3-8b-instruct` (optional, fails gracefully) |
| AI — best practices chat | watsonx.ai or OpenAI (optional, separate from quoting) |
| Live docs context | IBM Search API (injected into AI SME prompts only) |
| Quote persistence | IBM Cloudant (NoSQL REST, IAM auth) |
| Auth | Password session cookie (7-day, httpOnly) |
| Deployment | Vercel |
| Tests | Jest + ts-jest (357 tests, ~1s, no network) |

---

## Environment variables

```bash
# Required
APP_PASSWORD=your-password

# Cloudant — quote history (disable by omitting)
CLOUDANT_API_KEY=...
CLOUDANT_URL=https://your-instance.cloudantnosqldb.appdomain.cloud

# watsonx.ai — entity extraction + AI SME (disable by omitting)
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=...
WATSONX_URL=https://us-south.ml.cloud.ibm.com   # default

# IBM Search API — live docs in AI SME prompts (disable by omitting)
IBM_SEARCH_API_KEY=...

# OpenAI — alternative backend for best-practices chat (disable by omitting)
OPENAI_API_KEY=sk-...
```

**Only `APP_PASSWORD` is required to run.** All 9 quoting engines work with no external services. Cloudant, watsonx, and IBM Search all degrade gracefully when unconfigured.

---

## Running locally

```bash
cd deal-genie
npm install
npm run dev        # http://localhost:3000
npm test           # 357 tests
npm run build      # production build
npx tsc --noEmit   # type check
```

---

## Pricing data — source and confidence

| Product | Part numbers | List prices | Source |
|---|---|---|---|
| Verify | ✅ Confirmed | ✅ Confirmed | Quoting_Assistant_Data.xlsx |
| Vault Model A (2.0) | ✅ Confirmed | ✅ Confirmed | IBM Vault 2.0 SalesCast Apr 2026 |
| Vault Model B | ✅ Confirmed | ✅ Confirmed | IBM parts deck (legacy — not quoted for new deals) |
| NS1 (all 3 tiers) | ✅ Confirmed | ✅ Confirmed | IBM Marketplace API + CPQ |
| Instana SaaS | ✅ Confirmed | ✅ Confirmed | IBM Parts deck Apr 7, 2026 |
| Instana Self-Hosted | ✅ Confirmed | ✅ Confirmed | IBM Parts deck Apr 7, 2026 |
| Turbonomic | ✅ Confirmed | ✅ Confirmed | IBM Pricing & Sizing Guide Jul 2026 |
| Terraform HCP | ✅ Confirmed | ✅ Confirmed | IBM HashiCorp Pricing Guidance Jun 2026 |
| Terraform Enterprise | ❌ No part number | — | Self-hosted — contact IBM |
| Concert on-prem | ✅ Confirmed | ✅ Confirmed | IBM Concert Parts & Pricing Deck Jun 2026 |
| Concert SaaS | ⚠️ PID only (5900BD6) | ✅ ~$1.06/RU/yr | Jul 2026 SaaS pricing deck |
| webMethods SaaS | ✅ Confirmed | ✅ $40.08/RU/yr | IBM Docs Jul 2026 + IWHI SaaS Calculator 2nd Jul 2026 |
| webMethods on-prem | ✅ D16NRZX / D16NSZX | ⚠️ Contact IBM | VPC rate not published |
| MaaS360 | ❌ No IBM SKUs | ✅ $4/$5/$6.25/$9/device/mo | ibm.com public pricing — CPQ SKUs not published |

---

## Cross-sell plays

| Source | Target | Positioning title |
|---|---|---|
| Verify | MaaS360 | Zero Trust Foundation |
| Verify | Vault | Human Identity to Secrets and Workload Trust |
| MaaS360 | Verify | Device Trust to Identity Trust |
| Vault | Verify | Secrets Security to Workforce Identity Modernization |
| Vault | Terraform | Secrets Security to Infrastructure Lifecycle Management (SLM+ILM) |
| Instana | Turbonomic | Observability to Intelligent Resource Automation |
| Instana | Concert | Real-Time Observability to AI-Driven Operational Intelligence |
| Turbonomic | Instana | Resource Optimization to Full-Stack Observability |
| Terraform | Vault | Infrastructure Provisioning to Secrets Security (ILM+SLM) |
| Terraform | Turbonomic | Infrastructure Automation to AI-Driven Resource Optimization |
| Concert | Instana | Operational Intelligence to Full-Stack Observability |
| Concert | Turbonomic | Operational Intelligence to Resource Optimization |
| NS1 | Turbonomic | DNS Traffic Optimization to Resource Right-Sizing |
| NS1 | Concert | DNS Intelligence to Agentic ITOps |
| webMethods | Verify | Integration Platform to Identity-Secured API Fabric |

**Guided mini-flows** (full second quote via conversational questions): Verify↔Vault, Verify↔MaaS360, Vault↔Verify, MaaS360↔Verify, NS1→Turbonomic, NS1→Concert.

---

## Active branch

All production work is on **`main`**. The `cross-plays` branch is stale (behind main) and should not be used.

Latest commit: `c321104` — Complete `computeScenarioPrice` input audit across all 9 products.
