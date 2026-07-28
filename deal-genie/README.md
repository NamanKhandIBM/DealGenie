# DealGenie

A chat-interface quoting calculator for IBM Software sellers. A seller picks a product, answers a short set of discovery questions, and gets back a formatted quote with IBM part numbers, quantities, and list prices — ready to paste into SAP CPQ. No spreadsheets. No manual lookup.

The core is **deterministic** — all pricing is hard-coded confirmed IBM list prices, and all math runs in-memory with no AI in the calculation path. There is a thin optional AI layer (watsonx.ai) for parsing free-text input and for a separate best-practices chat mode, but it has nothing to do with how prices are calculated.

---

## What it covers

**9 IBM products, each with a full quoting engine:**

| Product | Group | Billing metric |
|---|---|---|
| IBM Security Verify | Security & Identity | Resource Units (RU) per MAU |
| IBM HashiCorp Vault | Security & Identity | RU consumption (Model A) or per-client RVU (Model B) |
| IBM MaaS360 | Infrastructure & Integration | Per managed device (public pricing) |
| NS1 Connect | Infrastructure & Integration | Queries, records, filter chains, monitors |
| IBM HashiCorp Terraform | Infrastructure & Integration | Resources Under Management (RUM) |
| IBM webMethods Integration | Infrastructure & Integration | RU / transaction volume |
| IBM Instana Observability | Observability & AIOps | Managed Virtual Server (MVS) |
| IBM Turbonomic | Observability & AIOps | MVS or annual cloud spend |
| IBM Concert | Observability & AIOps | Resource Units (RU) per module |

---

## How a seller uses it

1. **Pick a product** from the product grid on the welcome screen
2. **Answer the discovery questions** — rendered as option buttons or number inputs, seller-friendly language (no IBM jargon like RU, MAU, MVS shown during questioning)
3. **Get a result card** — part numbers, quantities, list prices, CPQ entry notes, discount guidance
4. **Optional: cross-sell** — after any quote, DealGenie surfaces the strongest adjacent product recommendation with a one-click "launch mini-flow" button that opens a guided second quote

Additional capabilities after the quote:
- **Scenario Compare** — change variables and add-ons in real time to see the price effect without re-running the full flow (zero API calls, pure in-memory)
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
    → cross-sell recommendation appended

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

### Cross-sell system (`lib/cross-sell.ts`)

15 plays defined across all 9 products. Each play has:
- Source + target product pair
- Business problem being solved
- In-flow hint message (shown during discovery if signals warrant)
- Post-result recommendation message
- Value point bullets for the seller pitch

After any quote result, the UI renders attach cards (one per target) that include:
- Recommendation rationale and evidence points
- Instant price preview — computed live from the existing answers using the target product's engine with sensible defaults
- Seller discovery prompt ("Ask: …")
- A button that sends "cross-sell [target]" to launch the guided second quote

---

## Project structure

```
deal-genie/
├── app/
│   ├── page.tsx                      # Single-page chat UI (~1,100 lines)
│   │                                 # Product picker, message list, question cards,
│   │                                 # result action bar, cross-sell attach cards,
│   │                                 # scenario compare trigger, save/history controls
│   ├── layout.tsx                    # Root layout, Geist fonts
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
│   ├── conversation.ts               # Conversation orchestrator + all result renderers (~1,800 lines)
│   ├── questions.ts                  # Per-product question definitions (seller-facing language)
│   ├── compare-engine.ts             # ScenarioCompare fan-out logic (fork variables, add-ons, sliders)
│   ├── cross-sell.ts                 # 15 cross-sell play definitions + recommendation functions
│   │
│   ├── verify-engine.ts              # IBM Security Verify: RU calculation, MAU tiers, add-ons
│   ├── verify-parts.ts               # Verify part catalog, best practices, tutorial steps
│   ├── vault-engine.ts               # IBM HashiCorp Vault: Model A (RU) and Model B (per-client)
│   ├── vault-parts.ts                # Vault part catalog, best practices, tutorial steps
│   ├── ns1-engine.ts                 # NS1 Connect: Standard / Premium / Hybrid Cloud DNS
│   ├── ns1-parts.ts                  # NS1 part catalog (all 3 tiers), best practices, tutorial
│   ├── maas360-engine.ts             # IBM MaaS360: plan recommendation + public-price estimate
│   ├── maas360-data.ts               # MaaS360 public plans, add-ons, pricing, cross-sell value points
│   ├── instana-engine.ts             # IBM Instana: SaaS / Self-Hosted / PayPerUse, Essentials / Standard
│   ├── instana-data.ts               # Instana parts, tier pricing, add-on pricing, cross-sell points
│   ├── turbonomic-engine.ts          # IBM Turbonomic: SaaS / SaaSGov / OnPrem / Parking / Essentials
│   ├── turbonomic-data.ts            # Turbonomic parts, discount thresholds, cross-sell points
│   ├── terraform-engine.ts           # IBM HashiCorp Terraform: Free / Standard / Premium, RUM tiers
│   ├── terraform-data.ts             # Terraform RUM pricing, SCS discount matrix, cross-sell points
│   ├── concert-engine.ts             # IBM Concert: module recommendation, RU sizing (5 confirmed mappings)
│   ├── concert-data.ts               # Concert parts, RU rates (SaaS + on-prem), module definitions
│   ├── webmethods-engine.ts          # IBM webMethods: SaaS RU model, per-product transaction rates
│   ├── webmethods-data.ts            # webMethods rates, CP4I/on-prem parts, Event Automation, cross-sell
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
│       ├── conversation-cross-sell.test.ts# 8 end-to-end cross-sell conversation flows
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
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, TypeScript |
| AI — entity extraction | watsonx.ai `ibm/granite-3-8b-instruct` (optional, fails gracefully) |
| AI — best practices chat | watsonx.ai or OpenAI (optional, separate from quoting) |
| Live docs context | IBM Search API (injected into AI SME prompts only) |
| Quote persistence | IBM Cloudant (NoSQL REST, IAM auth) |
| Auth | Password session cookie (7-day, httpOnly) |
| Deployment | Vercel |
| Tests | Jest 30 + ts-jest (252 tests, ~0.5s, no network) |

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
npm test           # 252 tests
npm run build      # production build
npx tsc --noEmit   # type check
```

---

## Pricing data — source and confidence

| Product | Part numbers | List prices | Source |
|---|---|---|---|
| Verify | ✅ Confirmed | ✅ Confirmed | Quoting_Assistant_Data.xlsx |
| Vault Model A | ✅ Confirmed | ✅ Confirmed | IBM parts deck |
| Vault Model B | ✅ Confirmed | ✅ Confirmed | IBM parts deck |
| NS1 (all 3 tiers) | ✅ Confirmed | ✅ Confirmed | IBM Marketplace API + CPQ |
| Instana | ✅ Confirmed | ✅ Confirmed | IBM Parts deck Apr 7, 2026 |
| Turbonomic | ✅ Confirmed | ✅ Confirmed | IBM Pricing & Sizing Guide Jul 2026 |
| Terraform HCP | ✅ Confirmed | ✅ Confirmed | IBM HashiCorp Pricing Guidance Jun 2026 |
| Terraform Enterprise | ❌ No part number | — | Self-hosted — contact IBM |
| Concert on-prem | ✅ Confirmed | ✅ Confirmed | IBM Concert Parts & Pricing Deck Jun 2026 |
| Concert SaaS | ⚠️ PID only (5900BD6) | ✅ ~$1.06/RU/yr | Jul 2026 SaaS pricing deck |
| webMethods SaaS | ✅ Confirmed | ✅ Confirmed | IBM Docs Jul 2026 + Seismic Dec 2025 |
| webMethods on-prem | ✅ D16NRZX / D16NSZX | ⚠️ Contact IBM | Not in Seismic |
| MaaS360 | ❌ No IBM SKUs | ✅ Public pricing | ibm.com — CPQ SKUs not published |

Engines emit explicit disclaimers when results are estimates rather than confirmed CPQ-ready quotes.

---

## Saved quote schema

```typescript
interface SavedQuote {
  id: string;                    // client-generated UUID (also Cloudant _id)
  savedAt: number;               // Date.now()
  name?: string;                 // user-supplied, unique across all quotes
  label: string;                 // auto: "Verify · SSO+MFA · 2,000 users · $38K/yr"
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
  summary: { keyMetrics: string[]; totalAnnual?: number };
  chatSnapshot: Message[];
  linkedQuoteGroupId?: string;   // ties cross-sell quote pairs together
  linkedQuoteRole?: "base" | "cross-sell";
  linkedToQuoteId?: string;
}
```

When a cross-sell mini-flow completes, saving stores two records — the base quote and the cross-sell quote — as a linked group under a shared `linkedQuoteGroupId`. Deleting either one deletes both.

---

## Cross-sell plays

| Source | Target | Positioning title |
|---|---|---|
| Verify | MaaS360 | Zero Trust Foundation |
| Verify | Vault | Human Identity to Secrets and Workload Trust |
| Verify | webMethods | Identity Governance to Governed Integration Fabric |
| MaaS360 | Verify | Device Trust to Identity Trust |
| Vault | Verify | Secrets Security to Workforce Identity Modernization |
| Vault | Terraform | Secrets Security to Infrastructure Lifecycle Management (SLM+ILM) |
| Instana | Turbonomic | Observability to Intelligent Resource Automation |
| Instana | Concert | Real-Time Observability to AI-Driven Operational Intelligence |
| Turbonomic | Instana | Resource Optimization to Full-Stack Observability |
| Turbonomic | Apptio | Resource Optimization to FinOps and IT Financial Visibility |
| Terraform | Vault | Infrastructure Provisioning to Secrets Security (ILM+SLM) |
| Terraform | Turbonomic | Infrastructure Automation to AI-Driven Resource Optimization |
| Concert | Instana | Operational Intelligence to Full-Stack Observability |
| Concert | Apptio | Operational Intelligence to IT Financial Governance |
| webMethods | Verify | Integration Platform to Identity-Secured API Fabric |

**Guided mini-flows** (full second quote via conversational questions): Verify↔Vault, Verify↔MaaS360, Vault↔Verify, MaaS360↔Verify.

**Instant preview** (live price estimate on the attach card using target engine + answer defaults): all 9 products.

---

## Branch: `cross-plays`

Active branch off `main`. Contains:

- Full 9-product cross-sell framework (`lib/cross-sell.ts`)
- 6 new product engines + data modules: MaaS360, Instana, Turbonomic, Terraform, Concert, webMethods
- Instant cross-sell price previews on result attach cards
- Linked quote records for cross-sell pairs (save, delete, history)
- All `*Action` selector questions removed — quoting starts immediately on product pick
- 252/252 tests passing, TypeScript clean, Next.js production build passing

```
cd74379  ux: remove action selector gate — go straight to quoting on product select
176ca6a  feat: full 9-product cross-sell framework
```
