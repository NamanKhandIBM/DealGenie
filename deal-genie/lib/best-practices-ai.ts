/**
 * AI-powered best practices subject matter expert.
 *
 * Provider priority (checked at runtime):
 *   1. OpenAI  — if OPENAI_API_KEY is set
 *   2. watsonx — if WATSONX_API_KEY is set
 *   3. Static fallback — always works, no API needed
 *
 * It never calculates prices or generates part numbers — that stays in the
 * deterministic engines.
 */

import { watsonxGenerate } from "./watsonx";
import type { Product } from "./types";
import { fetchProductContext, buildContextSnippet } from "./ibm-search";

// ─── OpenAI provider ──────────────────────────────────────────────────────────

async function openaiGenerate(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage },
      ],
      max_tokens: 600,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Unified generate — tries providers in priority order ────────────────────

async function generate(systemPrompt: string, userMessage: string): Promise<string> {
  // 1. OpenAI
  if (process.env.OPENAI_API_KEY) {
    return openaiGenerate(systemPrompt, userMessage);
  }
  // 2. watsonx
  if (process.env.WATSONX_API_KEY) {
    const { text } = await watsonxGenerate({ systemPrompt, userMessage, maxNewTokens: 512 });
    return text;
  }
  // 3. No provider configured — caller handles fallback
  throw new Error("NO_PROVIDER");
}

// ─── Per-product knowledge base (system prompt grounding) ─────────────────────

const VERIFY_KNOWLEDGE = `
IBM Security Verify is a cloud-based identity and access management (IAM) SaaS product.

PRICING MODEL:
- Priced on Resource Units (RU), calculated from Monthly Active Users (MAU) using graduated tier brackets
- MAU formula: ROUNDUP(population × MIN(avgLogins, 12) ÷ 12)
- 4 capabilities: SSO, MFA, Adaptive Access, Lifecycle Management
- SSO/MFA/Adaptive use MAU as the driver
- Lifecycle uses Managed Users (accounts Verify actively provisions/deprovisions)
- Terms: 12-month (standard) or 3-year (better pricing)

CAPABILITIES IN DETAIL:
- SSO: Single sign-on for web and mobile applications. Most common starting capability.
- MFA: Multi-factor authentication — TOTP, push notification, SMS/email, biometric, FIDO2.
- Adaptive Access: Risk-based authentication using device, location, behaviour signals. Context-aware policies.
- Lifecycle Management: User provisioning, deprovisioning, access reviews, joiner-mover-leaver workflows.

KEY ADD-ONS (separate SKUs):
- D02T6ZX: SMS and Email MFA — per-event pricing ($33.70 per 1,000 events). Use when TOTP/biometric not sufficient.
- D01UQZX: Hosted Application Gateway — for legacy apps that can't use modern auth protocols (SAML/OIDC). $22,500/instance/month.
- D01URZX: Vanity Domain — custom branded login URL (login.company.com). $562/instance/month.
- D22PGLL: Non-Production with SLA — $2,810/instance/month.
- D21CWLL: Non-Production without SLA — $1,410/instance/month.

DISCOVERY BEST PRACTICES:
1. User Population: Always ask for total users AND how many months per year they log in at least once. MAU is the real driver, not raw headcount.
   - Active every month (12/12) → full population = MAU
   - Active 9 months/year → MAU = 75% of population
   - Active 6 months/year → MAU = 50% of population
   - Active 3 months/year → MAU = 25% of population
   - Active 1 month/year → MAU = ~8% of population
   - Login frequency within a month does NOT matter — a user active once or 100× in a month counts the same.
2. Capability Selection: Don't assume — ask specifically about each capability. Clients often don't know they need Adaptive.
3. Managed Users: Only ask if Lifecycle is needed. Managed Users ≤ Total Population (often much smaller).
4. Add-ons: Always ask about SMS/Email MFA, legacy apps, custom branding, and dev/test needs.
5. Term: Introduce 3-year option for better pricing. Most new customers start with 12-month.

COMMON MISTAKES:
- Using total population as MAU (ignores login frequency)
- Not asking about Managed Users for Lifecycle
- Missing legacy app integration needs (Application Gateway)
- Quoting SMS/email MFA at the main RU rate instead of D02T6ZX per-event pricing

SIZING EXAMPLES:
- 10,000 employees active every month (12/12): MAU = 10,000. With SSO+MFA: ~180 RU → ~$180,000/year list
- 50,000 customers active 6 months/year (6/12): MAU = CEIL(50,000 × 6 ÷ 12) = 25,000. SSO only: ~200 RU
- 100,000 users active every month, 5,000 managed by Verify for Lifecycle: MAU = 100,000 (SSO/MFA), Managed = 5,000 (Lifecycle)
`;

const NS1_KNOWLEDGE = `
NS1 Connect is IBM's managed authoritative DNS and intelligent traffic management product.
Source: NS1 Sales Decoder Ring – CPQ.pdf (IBM Seismic, 2025)

PRODUCT TIERS — THREE DISTINCT PRODUCTS (different part numbers, different CPQ flows):
1. NS1 Connect Standard (Product ID 5900B4J, D10A*/D10B* parts) — ARR $4K–$40K
   - Up to 1B queries/month, 10K records, 100 monitors/filter chains
   - Self-serve: IBM.com, partners, AWS Marketplace
   - Includes Spike Protection by default

2. NS1 Connect Premium (Product ID 5900B4J, D0GN* parts) — ARR $45K+ ASP
   - A la carte menu, fully customizable
   - Seller-assisted. Target: mid-market, new IBM customers
   - Key parts: D0GNDZX (SLA, required), D0GNEZX (Requests/queries), D0GNGZX (Records), D0GNIZX (Monitors/Jobs), D0GNKZX (Filter chains/Resource Units)

3. Hybrid Cloud DNS (Product ID 5900B5C, D0GY*/D0GZ* parts) — ARR $250K–$1M+
   - Pre-packaged bundles for whale-scale deals
   - Enterprise (D0GYUZX): <200K records, min 10B QPM, ~$350K ACV pre-discount
   - Enterprise Plus (D0GYWZX): 200K–2M records, min 10B QPM, ~$670K ACV pre-discount
   - GSLB Standard (D0GZ0ZX): NS1 RUM data, min 1B queries, ~$55K ACV
   - GSLB Advanced (D0GYYZX): Customer RUM data, min 5B queries, ~$87K ACV

CRITICAL: NEVER mix D10A* and D0GN* parts on the same quote. Pick one tier and stay in it.

IBM METRIC CONVERSIONS (CPQ auto-converts — sellers enter raw numbers):
- 1 IBM Request = 10 million DNS queries/month
- 1 IBM Record = 1,000 DNS records
- 1 IBM Interaction = 1 million RUM/GSLB queries/month
- 1 IBM Job = 1 monitor
- 1 IBM Resource Unit = 1 filter chain

PRICING MODEL:
- Tiered: more queries/records purchased = cheaper per-unit price
- Contract terms: 12–60 months. Auto-renewal default. Annual billing preferred.
- Discounting: up to 35% pre-authorized; +10% with sales leadership justification; >45% requires product team approval
- Overage charges can often be waived for seasonal/one-time spikes (upsell opportunity)

DISCOVERY BEST PRACTICES:
1. Tier Selection FIRST: Estimate ARR to pick the right tier before entering CPQ.
   - <$40K → Standard; $45K–$200K → Premium; $250K+ → Hybrid bundles
   - For Hybrid, confirm customer exceeds 10B QPM minimum before quoting bundles
2. Query Volume (most important): Always ask average AND peak monthly query volumes.
   - 1 Request = 10M queries. Add 20–30% growth headroom.
   - If unknown: estimate from web traffic (page views × 5–10 DNS lookups per page)
   - Consider seasonal spikes (retail holidays, sports events, product launches)
3. DNS Records: Ask for export from current provider. Count ALL types (A, AAAA, CNAME, MX, TXT, SRV).
   - 1 IBM Record = 1,000 DNS records
   - Zones ≠ records — count individual resource records, not zones
   - Under 200K → Enterprise bundle; 200K–2M → Enterprise Plus; 2M+ → Premium a la carte
4. GSLB Needs: Basic filter chains vs RUM-based routing?
   - Standard filter chains: D0GNKZX (Premium) — 1 Resource Unit = 1 filter chain
   - RUM Standard (NS1 data): D0GNQZX/D0GZ0ZX — 1 Interaction = 1M queries, min 1M
   - RUM Advanced (customer data): D0GNNZX/D0GYYZX — min 5M queries, must be multiple of 5
   - RUM queries must be a subset of total Managed DNS query count
5. China DNS (D0GN8ZX): Minimum 50M queries/month. Check China box in CPQ BEFORE Managed DNS section.
6. Dedicated DNS: Small (D0GNBZX, 8GB/4-core) or Large (D0GNAZX, 64GB/16-core). Min 3, max 12 PoPs. Already included in Hybrid bundles.
7. DNS Insights (D0GN6ZX): Quantity must equal Managed DNS Requests. CPQ auto-calculates. Included in both Hybrid bundles.
8. Services: Always recommend adding architecture + design, implementation, and/or training services.

CPQ ORDERING RULES (Premium):
- Check China/Insights boxes BEFORE entering Managed DNS section
- DDoS Overage Protection (D0GN5ZX) and NXD Waiver (D0GNMZX) quantities must equal D0GNEZX
- DNS Insights quantity must equal D0GNEZX
- Enhanced Monitor Interval (D0GNCZX) and Vanity Name Server (D0GNRZX): quantity 0 or 1
- Required on every Premium order: D0GNDZX (SLA), D0GNGZX (Records), D0GNEZX (Requests)

CPQ ORDERING RULES (Hybrid):
- Required: D0GZ2ZX (SLA)
- Choose bundle based on records: D0GYUZX (<200K) or D0GYWZX (200K–2M)
- Enter queries → CPQ auto-generates Requests (1 Request = 10M queries)
- Add GSLB upsell separately: D0GZ0ZX (Standard) or D0GYYZX (Advanced)

COMMON MISTAKES:
- Mixing D10A* (Standard) and D0GN* (Premium) parts on same quote
- Quoting Hybrid bundles for customers under 10B QPM minimum
- Counting DNS zones instead of individual records
- Not adding 20–30% query growth headroom
- Confusing web page views with DNS queries
- Checking China/Insights boxes after entering Managed DNS in CPQ (must be before)
- Forgetting required SLA parts (D0GNDZX for Premium, D0GZ2ZX for Hybrid)
- Not adding services to the quote

BUNDLE CONTENTS (Hybrid Cloud DNS):
Enterprise (D0GYUZX): up to 200K records, 250 filter chains, 500 monitors, 5× Dedicated DNS Standard (8GB/4-core, 2.5M records, 10B QPM), DNS Insights + 10 policies, NXD Waiver, DDoS Overage Protection, Enhanced Monitor Interval (5s), Vanity Name Server
Enterprise Plus (D0GYWZX): up to 2M records, 1,000 filter chains, 2,000 monitors, 5× Dedicated DNS Large (64GB/16-core, 50M records, 75B QPM), DNS Insights + 10 policies, NXD Waiver, DDoS Overage Protection, Enhanced Monitor Interval (5s), Vanity Name Server

SIZING EXAMPLES:
- Startup/SMB: 25M queries, 500 records, no GSLB → Standard tier (D10A* parts), ARR ~$4K–$8K
- Mid-market: 200M queries, 8K records, 5 filter chains → Premium a la carte (D0GN* parts), ARR ~$50K–$80K
- Enterprise: 500M queries, 50K records, RUM GSLB, Insights → Premium, ARR ~$150K–$200K
- Whale: 15B queries, 180K records → Hybrid Enterprise bundle (D0GYUZX), ARR ~$350K+ pre-discount
- Whale+: 15B queries, 350K records → Hybrid Enterprise Plus bundle (D0GYWZX), ARR ~$670K+ pre-discount

MIGRATION TIMING:
- DNS migrations require careful planning — TTL changes, propagation, testing period
- Recommend 30–60 day migration timeline for large customers
- Services packages significantly reduce migration risk
`;

const VAULT_KNOWLEDGE = `
IBM HashiCorp Vault (PID: 5900BJF) is a self-managed secrets management platform.
Minimum term: 12 months. Two pricing models that CANNOT be mixed for the same customer.

MODEL A — Platform / RU (Usage-based):
- Best for: dynamic workloads, cloud-native, variable usage patterns, new customers
- SKUs: D15FQZX (install/year), D15FKZX (RU/month), D155GZX (non-prod install)
- KMIP variant: D155LZX replaces standard install when KMIP/external key management needed
- RU calculation (tool does this automatically):
  - Static secrets: 1 secret = 1 RU (monthly high-water mark)
  - Dynamic credential roles: 1 role = 1 RU
  - PKI certificates: CEIL(certs/month × lifetime_hours ÷ 730)
  - Transit/Transform encryption: 150,000 API calls = 1 RU
  - KMIP keys: 1 key = 1 RU (monthly high-water)

MODEL B — Clients / RVU (Predictable):
- Best for: stable/traditional infrastructure, known application count, renewal customers
- SKUs: D1015ZX (Essentials), D101FZX (Standard), D101AZX (Premium) — install + D1017ZX (client/RVU)
- Non-prod: D1018ZX
- A "Client" = any unique application, service, or user that authenticates to Vault
  - 10 instances of the same app = 1 client
  - Each unique microservice = 1 client
  - CI/CD pipelines, monitoring tools also count as clients
- Editions:
  - Essentials: Basic features (~50% discount on install)
  - Standard: Most common. Includes namespaces for team isolation. (~55% discount)
  - Premium: DR replication + performance replication. Requires ≥2 installs. (~60% discount)

KEY ADD-ONS (work with both models):
- D1406ZX + D1405ZX: PKI Certificate Add-On. Requires Vault v1.21+. For certificate issuance.
- D1013ZX: Vault ADP – Key Management (KMIP for Model B, per cluster needing it)
- D1014ZX: Vault ADP – Transform (data tokenization/masking, subset of total clients)
- D1556ZX: Custom Plugin Install (per plugin)

DISCOVERY BEST PRACTICES:
1. Model Selection (CRITICAL — cannot change without new contract):
   - "Do you know how many apps/services will use Vault?" → Model B if yes and stable
   - "Do you expect variable or unpredictable usage?" → Model A
   - "Are you expanding significantly?" → Model A safer
   - Renewals with stable client counts → Model B
2. Use Case Discovery: Static secrets (passwords, API keys, DB creds), dynamic credentials (auto-rotating DB users, cloud IAM roles), PKI certs (TLS/SSL), SSH access, encryption (transit), KMIP (DB/storage encryption)
3. Client Counting (Model B): Count unique apps/services, not instances. Include microservices, CI/CD, monitoring. Non-prod counts too.
4. Edition Selection (Model B): Does customer need DR? → Premium + ≥2 installs. Need namespace isolation? → Standard minimum.
5. HA and DR: HA = 3-5 nodes in one cluster (counts as 1 install). DR = Premium + ≥2 installs.
6. Non-Production: Almost always needed. Include dev/test environment in quote.
7. Advanced features: PKI certificate volume and lifetime (for RU calc). KMIP needs. Data transform needs.

COMMON MISTAKES:
- Mixing models for the same customer (strictly prohibited)
- Counting container instances instead of unique services (client count)
- Choosing Premium without buying ≥2 installs
- Not asking about certificate lifetimes (affects PKI RU significantly)
- Forgetting non-production environments
- Not asking about DR requirements upfront

SIZING EXAMPLES:
- Startup (Model A): 100 static secrets, 10 dynamic roles, 1 install → ~110 RU/month
- Mid-market (Model B Standard): 50 unique apps/services, 2 installs (HA + non-prod) → 50 clients
- Enterprise (Model A): 1,000 static secrets, 50 dynamic roles, 500 PKI certs/month (720h lifetime) → ~1,550 RU/month
- Enterprise with DR (Model B Premium): 200 clients, 3 installs (primary + DR + non-prod) → 200 clients × Premium rate
`;

// ─── Per-product system prompt builders ───────────────────────────────────────

function buildSystemPrompt(product: Product, liveContext?: string): string {
  const knowledge =
    product === "Verify" ? VERIFY_KNOWLEDGE :
    product === "NS1"    ? NS1_KNOWLEDGE :
                           VAULT_KNOWLEDGE;

  const productName =
    product === "Verify" ? "IBM Security Verify" :
    product === "NS1"    ? "NS1 Connect" :
                           "IBM HashiCorp Vault";

  const liveSection = liveContext
    ? `\n\nLIVE CONTEXT FROM IBM SEISMIC (fetched now — more current than the knowledge base above):\n${liveContext}\n`
    : "";

  return `You are an AI Subject Matter Expert (AI SME) for ${productName}, built into IBM's DealGenie quoting assistant.
You help IBM sellers and business partners deeply understand this product so they can run better discovery conversations with customers — and build accurate quotes.

Your role:
- Answer questions about ${productName} quoting, discovery, sizing, and best practices
- Help sellers understand what questions to ask customers and why
- Explain pricing models, tier selection, part numbers, CPQ rules, and common pitfalls
- Walk sellers through customer scenarios and help them size deals
- Be conversational, practical, and direct — sellers are in the middle of deals

Your boundaries:
- You do NOT generate exact net prices (those come from CPQ after discounting)
- You do NOT invent part numbers beyond what is in your knowledge base
- If asked something outside your knowledge, say so clearly and suggest the IBM product team

Your product knowledge for ${productName}:
${knowledge}${liveSection}

Conversation style:
- Be direct and practical — sellers are busy, often in front of a customer
- Lead with the answer, then explain
- Use examples and real scenarios wherever helpful
- If the seller describes a specific customer, tailor your advice to that scenario
- Keep responses concise but complete (3–6 bullet points or a short paragraph)
- Proactively flag gotchas, minimums, and CPQ ordering rules
- After your initial overview, invite follow-up questions`;
}

function buildClientModeSystemPrompt(product: Product, liveContext?: string): string {
  const knowledge =
    product === "Verify" ? VERIFY_KNOWLEDGE :
    product === "NS1"    ? NS1_KNOWLEDGE :
                           VAULT_KNOWLEDGE;

  const productName =
    product === "Verify" ? "IBM Security Verify" :
    product === "NS1"    ? "NS1 Connect" :
                           "IBM HashiCorp Vault";

  const liveSection = liveContext
    ? `\n\nLIVE CONTEXT FROM IBM SEISMIC (use to inform answers — do NOT recite prices or part numbers to the client):\n${liveContext}\n`
    : "";

  return `You are Genie, an AI assistant helping a prospective customer understand ${productName} and whether it is a good fit for their needs.
You are being used live in a conversation between an IBM seller and their client. Speak directly to the client in plain, friendly, non-technical business language.

Your role:
- Help the client understand what ${productName} does and the value it delivers
- Ask them clear, open-ended questions to understand their current situation and pain points
- Explain how the product addresses their specific challenges
- Make the conversation feel natural and consultative — not a sales pitch
- Guide the client toward understanding their own requirements (query volume, users, use cases, etc.)

Your boundaries:
- Do NOT quote specific list prices or discount levels — those are handled separately
- Do NOT use internal IBM jargon (RU, MAU, MQ, CPQ, SKU, ARR) — use plain English equivalents
- Do NOT mention part numbers or internal metrics
- If a technical question is beyond the scope of this conversation, say "that's a great question for our technical team"

Your product knowledge (use this to inform answers — do NOT recite it verbatim):
${knowledge}${liveSection}

Conversation style:
- Warm, clear, and consultative — you are helping them, not selling to them
- Ask one focused question at a time
- Acknowledge what they say before responding or asking the next question
- Use analogies and plain English to explain technical concepts
- Keep responses short — 2–4 sentences or a few bullet points maximum
- Your goal is for the client to feel heard and understood, and to naturally arrive at their own requirements`;
}

// ─── Conversation history type ────────────────────────────────────────────────

export interface BestPracticesMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Initial best practices generation ───────────────────────────────────────

/**
 * Generates an initial best practices overview for the given product.
 * Called once when the user selects "View Best Practices".
 */
export async function generateBestPracticesIntro(product: Product, clientMode = false): Promise<string> {
  const productName =
    product === "Verify" ? "IBM Security Verify" :
    product === "NS1"    ? "NS1 Connect" :
                           "IBM HashiCorp Vault";

  if (clientMode) {
    return `👋 Hi, I'm Genie — an AI assistant here to help you understand **${productName}** and whether it's a good fit for your needs.\n\nTell me a bit about what you're trying to solve, and we can explore it together. What's driving your interest in this area?`;
  }

  return `👋 Hi, I'm Genie — your AI SME for **${productName}**.\n\nAsk me anything: discovery questions to ask your client, how to size a deal, which tier or part number to use, CPQ gotchas, or how to handle a specific customer scenario.\n\nWhat would you like to know?`;
}

/**
 * Continues a best practices / client-mode conversation.
 * Only the last 4 turns of history are included to stay within token limits.
 * Errors propagate to the route handler (not swallowed here).
 */
export async function continueBestPracticesChat(
  product: Product,
  history: BestPracticesMessage[],
  userMessage: string,
  clientMode = false
): Promise<string> {
  // Keep only the last 4 messages (2 turns) to avoid blowing the input token budget.
  const recentHistory = history.slice(-4);

  const speakerLabel = clientMode ? "Client" : "Seller";
  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? speakerLabel : "Genie"}: ${m.content}`)
    .join("\n\n");

  const fullUserMessage = historyText
    ? `Prior context:\n${historyText}\n\n${speakerLabel}: ${userMessage}`
    : userMessage;

  // Fetch live IBM Search context in parallel with prompt building (fire-and-forget on failure).
  // Only fetch on the first user message in a session (history.length <= 1) to avoid
  // hammering the IBM Search API on every follow-up turn.
  let liveContext: string | undefined;
  if (history.length <= 1) {
    const searchResults = await fetchProductContext(product);
    if (searchResults && searchResults.length > 0) {
      liveContext = buildContextSnippet(searchResults);
    }
  }

  const systemPrompt = clientMode
    ? buildClientModeSystemPrompt(product, liveContext)
    : buildSystemPrompt(product, liveContext);

  try {
    const text = await generate(systemPrompt, fullUserMessage);
    return text || staticFollowUp(product, userMessage);
  } catch (err) {
    const errDetail = err instanceof Error ? err.message : String(err);
    console.error("[best-practices-ai] continueBestPracticesChat failed:", errDetail);
    // Always return something useful — never show a raw error to the user
    return staticFollowUp(product, userMessage);
  }
}

// ─── Static follow-up fallback ────────────────────────────────────────────────
// Returns a helpful canned response when no AI provider is available.

function staticFollowUp(product: Product, question: string): string {
  const q = question.toLowerCase();

  if (product === "NS1") {
    if (q.includes("query") || q.includes("volume") || q.includes("mq")) {
      return `**Query Volume Sizing**\n\n- 1 IBM "Request" = 10 million DNS queries/month\n- Always size to peak, not average — add 20–30% growth headroom\n- Starter: <50M QPM → Standard tier. Mid-market: 50M–1B → Premium. Enterprise: 1B+ → Hybrid bundle (min 10B QPM)\n- Ask the customer to pull a 3-month history from their current provider (Route53, Cloudflare, etc.)`;
    }
    if (q.includes("record") || q.includes("zone")) {
      return `**DNS Records**\n\n- 1 IBM "Record" = 1,000 DNS records\n- Count all types: A, AAAA, CNAME, MX, TXT, SRV — not just zones\n- Under 200K records → Enterprise bundle (D0GYUZX). 200K–2M → Enterprise Plus (D0GYWZX). 2M+ → Premium a la carte`;
    }
    if (q.includes("gslb") || q.includes("traffic") || q.includes("rum") || q.includes("steering")) {
      return `**GSLB / Traffic Steering**\n\n- Standard filter chains (non-RUM): D0GNKZX — 1 Resource Unit = 1 filter chain\n- RUM Standard (NS1 data): D0GNQZX — 1 Interaction = 1M queries, min 1M\n- RUM Advanced (customer data): D0GNNZX — min 5M queries, must be multiple of 5\n- RUM queries must be a subset of total Managed DNS query count`;
    }
    if (q.includes("price") || q.includes("cost") || q.includes("discount")) {
      return `**NS1 Pricing**\n\n- Standard tier: $349–$3,429/month\n- Premium: ~$45K ASP ARR (a la carte)\n- Hybrid Enterprise: ~$350K ACV pre-discount\n- Hybrid Enterprise Plus: ~$670K ACV pre-discount\n- Discounts: up to 35% pre-authorised; +10% with sales leadership; >45% needs product team approval`;
    }
  }

  if (product === "Verify") {
    if (q.includes("mau") || q.includes("user") || q.includes("population")) {
      return `**MAU Calculation**\n\n- MAU = ROUNDUP(population × MIN(avgLoginsPerYear, 12) ÷ 12)\n- A user active once or 100× in a month counts the same — it's monthly active, not login count\n- 10,000 employees active every month → MAU = 10,000\n- 50,000 seasonal customers active 6 months/year → MAU = 25,000`;
    }
    if (q.includes("lifecycle") || q.includes("managed")) {
      return `**Lifecycle Management**\n\n- Uses "Managed Users" not MAU — the accounts Verify actively provisions/deprovisions\n- Always ≤ total population, often much smaller (e.g. only HR-managed employees)\n- Part: D0231ZX (same RU SKU, different quantity driver)`;
    }
    if (q.includes("price") || q.includes("cost") || q.includes("ru")) {
      return `**Verify Pricing**\n\n- Priced in Resource Units (RU) at $281.40/RU/year\n- RU tiers are graduated (like tax brackets) — first 500 RU at full rate, then cheaper\n- SSO + MFA for 10,000 MAU ≈ 180 RU ≈ $50,600/year list\n- 3-year term gives better pricing than 12-month`;
    }
  }

  if (product === "Vault") {
    if (q.includes("model") || q.includes("model a") || q.includes("model b")) {
      return `**Model Selection**\n\n- Model A (Platform/RU): Dynamic workloads, new deployments, variable usage. RU = high-water mark of secrets/roles/certs in use\n- Model B (Clients/RVU): Stable known app count, renewals. Count unique apps/services — NOT instances\n- Cannot mix models for the same customer`;
    }
    if (q.includes("client") || q.includes("rvu")) {
      return `**Client Counting (Model B)**\n\n- 1 Client = any unique app, service, or user that authenticates to Vault\n- 10 containers running the same app = 1 client\n- Each unique microservice = 1 client\n- CI/CD pipelines, monitoring tools count too\n- Editions: Essentials / Standard (most common) / Premium (needs ≥2 installs for DR)`;
    }
    if (q.includes("price") || q.includes("cost")) {
      return `**Vault Pricing**\n\n- Model A: $96,000/install/year + $48/RU/month\n- Model B Standard: $90,000/install/year + $1,296/client/year\n- Model B Premium: $99,960/install/year (buy ≥2 for DR replication)\n- Non-prod: $48,000/install (Model A) or $12,480/install (Model B)`;
    }
  }

  // Generic fallback
  return `I'm not able to connect to the AI right now, but I can help with specific questions about ${
    product === "Verify" ? "IBM Security Verify" : product === "NS1" ? "NS1 Connect" : "IBM HashiCorp Vault"
  }. Try asking about pricing, specific part numbers, sizing, or common mistakes.`;
}

// ─── Fallback static intro (used when watsonx is unreachable) ─────────────────

function fallbackIntro(product: Product): string {
  if (product === "Verify") {
    return `**IBM Security Verify — Best Practices Overview**

**Top questions to ask every customer:**
- How many total users need access, and how often do they log in? *(determines MAU — the pricing driver)*
- Which capabilities do they need: SSO, MFA, Adaptive Access, Lifecycle?
- Do they need to manage user accounts (provisioning/deprovisioning)? *(Lifecycle requires Managed User count)*
- Do they need SMS/email MFA, legacy app integration, or custom branded login?

**Common mistakes to avoid:**
- Using raw headcount as MAU — login frequency matters (yearly login count ÷ 12, capped at 1×)
- Not asking about Managed Users when Lifecycle is selected
- Missing the Hosted Application Gateway for legacy apps

**Quick example:**
10,000 employees who log in daily → MAU = 10,000. SSO + MFA → ~180 RU → ~$180k/year list.

---
What specific scenario or area would you like to dig into?`;
  }
  if (product === "NS1") {
    return `**NS1 Connect — Best Practices Overview**

**Top questions to ask every customer:**
- What is your current monthly DNS query volume (average AND peak)?
- Who is your current DNS provider, and how many DNS records do you manage?
- Do you need intelligent traffic routing (geographic, latency-based, failover)?
- Do you serve users in China or need dedicated infrastructure for compliance?
- Do you need DNS query analytics or DDoS protection?

**Common mistakes to avoid:**
- Not adding 20-30% growth headroom to query volume (causes first-year overages)
- Confusing web page views with DNS query volume
- Counting DNS zones instead of individual records (first 1,000 are free on Standard)
- Missing RUM pack requirement when RUM-based GSLB is selected

**Quick example:**
150M queries/month average → quote 200M (with headroom). 5,000 records → 4,000 billable on Standard. 3 filter chains for GSLB.

---
What specific scenario or area would you like to dig into?`;
  }
  // Vault
  return `**IBM HashiCorp Vault — Best Practices Overview**

**Top questions to ask every customer:**
- Is this a new deployment or a renewal? How stable/predictable is their workload? *(determines Model A vs B)*
- What types of secrets do they manage: static secrets, dynamic credentials, PKI certs, SSH, encryption?
- How many unique applications or services will connect to Vault? *(Model B client count)*
- Do they need disaster recovery or multi-region? *(Premium edition, ≥2 installs)*
- Do they need to issue TLS certificates (PKI) or encrypt database data (KMIP/Transform)?

**Common mistakes to avoid:**
- Mixing Model A and Model B for the same customer (not allowed — pick one)
- Counting container instances instead of unique services (client count for Model B)
- Choosing Premium without ordering ≥2 installs (DR/replication requires it)
- Forgetting non-production environments in the quote

**Quick example:**
50 microservices, predictable workload, Standard edition → Model B: 50 clients × 2 installs (prod + non-prod).

---
What specific scenario or area would you like to dig into?`;
}
