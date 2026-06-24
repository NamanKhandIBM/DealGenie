/**
 * AI-powered best practices subject matter expert.
 *
 * Uses watsonx.ai (Granite) with rich product knowledge as grounding.
 * The AI generates best practices and answers follow-up questions.
 * It never calculates prices or generates part numbers — that stays in the
 * deterministic engines.
 */

import { watsonxGenerate } from "./watsonx";
import type { Product } from "./types";

// ─── Per-product knowledge base (system prompt grounding) ─────────────────────

const VERIFY_KNOWLEDGE = `
IBM Security Verify is a cloud-based identity and access management (IAM) SaaS product.

PRICING MODEL:
- Priced on Resource Units (RU), calculated from Monthly Active Users (MAU) using graduated tier brackets
- MAU formula: ROUNDUP(population × MIN(avgLogins, 12) ÷ 12)
- 5 capabilities: SSO, MFA, Adaptive Access, Lifecycle Management, Analytics
- SSO/MFA/Adaptive use MAU as the driver
- Lifecycle and Analytics use Managed Users (accounts Verify actively provisions/deprovisions)
- Multi-region multiplies total RU by the number of regions
- Terms: 12-month (standard) or 3-year (better pricing)

CAPABILITIES IN DETAIL:
- SSO: Single sign-on for web and mobile applications. Most common starting capability.
- MFA: Multi-factor authentication — TOTP, push notification, SMS/email, biometric, FIDO2.
- Adaptive Access: Risk-based authentication using device, location, behaviour signals. Context-aware policies.
- Lifecycle Management: User provisioning, deprovisioning, access reviews, joiner-mover-leaver workflows.
- Analytics: User behaviour analytics, dashboards, reporting, anomaly detection.

KEY ADD-ONS (separate SKUs):
- D02T6ZX: SMS and Email MFA — per-event pricing ($33.70 per 1,000 events). Use when TOTP/biometric not sufficient.
- D01UQZX: Hosted Application Gateway — for legacy apps that can't use modern auth protocols (SAML/OIDC). $22,500/instance/month.
- D01URZX: Vanity Domain — custom branded login URL (login.company.com). $562/instance/month.
- D22PGLL: Non-Production with SLA — $2,810/instance/month.
- D21CWLL: Non-Production without SLA — $1,410/instance/month.

DISCOVERY BEST PRACTICES:
1. User Population: Always ask for total users AND login frequency. MAU is the real driver, not raw headcount.
   - "Multiple times a day" or "weekly" → avgLogins ≥ 12 → full population = MAU
   - "Monthly" → avgLogins = 12 → full population = MAU
   - "A few times a year" → avgLogins = 6 → ~50% of population is MAU
   - "Once or twice a year" → avgLogins ≈ 1.5 → small fraction is MAU
2. Capability Selection: Don't assume — ask specifically about each capability. Clients often don't know they need Adaptive.
3. Managed Users: Only ask if Lifecycle or Analytics is needed. Managed Users ≤ Total Population (often much smaller).
4. Multi-Region: Ask about data residency requirements (GDPR, data sovereignty). Most start with 1 region.
5. Add-ons: Always ask about SMS/Email MFA, legacy apps, custom branding, and dev/test needs.
6. Term: Introduce 3-year option for better pricing. Most new customers start with 12-month.

COMMON MISTAKES:
- Using total population as MAU (ignores login frequency)
- Forgetting to apply region multiplier
- Not asking about Managed Users for Lifecycle/Analytics
- Missing legacy app integration needs (Application Gateway)
- Quoting SMS/email MFA at the main RU rate instead of D02T6ZX per-event pricing

SIZING EXAMPLES:
- 10,000 employees logging in daily: MAU = 10,000. With SSO+MFA: ~180 RU → ~$180,000/year list
- 50,000 customers logging in 4×/year: MAU = CEIL(50,000 × 4 ÷ 12) = 16,667. SSO only: ~100 RU
- 100,000 users, 5,000 managed by Verify for Lifecycle: MAU = 100,000 (SSO/MFA), Managed = 5,000 (Lifecycle)
`;

const NS1_KNOWLEDGE = `
NS1 Connect is IBM's managed authoritative DNS and intelligent traffic management product.

PRICING MODEL:
- Primary driver: Monthly DNS query volume (priced in millions of queries/month — "MQ")
- Secondary: DNS record count (first 3,000 records free)
- Add-ons: GSLB (filter chains, monitors, RUM packs), Dedicated DNS, China DNS, Insights, DDoS protection
- Terms: 12-month or 3-year

CORE COMPONENTS:
- Managed DNS: Query volume (tiered pricing) + records beyond 3,000
- GSLB / Traffic Steering: Requires filter chains (one per routing policy)
  - RUM-based routing: Needs RUM packs (sold in 5M query increments)
  - Health monitoring: Up/Down monitors (per endpoint)
- Dedicated DNS: Dedicated PoP infrastructure, minimum 3 PoPs, maximum 12 PoPs. For compliance or very high volume.
- China DNS: Specialized routing for China-origin traffic. Minimum 50M queries/month.
- DNS Insights: Analytics and query visibility. Priced at ~20% of total query volume (negotiable to ~10%).
- DDoS / Spike Protection: Variable pricing based on threat profile. Requires NS1 security team consultation.

DISCOVERY BEST PRACTICES:
1. Query Volume (most important): Always ask for BOTH average AND peak monthly query volumes.
   - Request historical data from current provider (CloudFlare, Route53, Akamai, etc.)
   - If they don't know: estimate from web traffic (page views × DNS lookups per page, typically 5-10)
   - Add 20-30% growth headroom to avoid overages in the first year
   - Consider seasonal spikes (retail during holidays, sports events, etc.)
2. Current DNS Provider: Who are they using now? This helps establish migration complexity.
3. DNS Records: Ask for count from current provider. First 3,000 free. Count ALL types: A, AAAA, CNAME, MX, TXT, SRV, etc.
4. GSLB Needs: Ask about multi-region deployments, CDN, geographic/latency-based routing, failover.
   - Each routing policy = 1 filter chain
   - RUM routing requires separate RUM packs
5. Geographic Requirements: China users? Compliance/data residency needs for dedicated infrastructure?
6. Analytics: Does security or ops team need DNS query visibility? Useful for capacity planning.
7. DDoS History: Have they been attacked before? Any existing DDoS protection?

COMMON MISTAKES:
- Not asking about peak vs average (undersizing leads to overage charges)
- Not adding growth headroom (20-30% recommended)
- Confusing web traffic page views with DNS queries
- Counting zones instead of individual DNS records
- Missing RUM pack requirements for RUM-based GSLB
- Not flagging China DNS minimum (50M MQ)
- Not flagging Dedicated DNS minimum (3 PoPs)

PART NUMBER NOTE:
NS1 part numbers in CPQ are placeholder "D0XXXZX" in this tool — actual part numbers must come from SAP CPQ or be validated with Tony Nicolakis / Nick Lammert.

SIZING EXAMPLES:
- Small business: 5-25M queries/month, <3,000 records, no GSLB → Core DNS only
- Mid-market: 50-200M queries/month, 3,000-10,000 records, basic GSLB (3-5 filter chains)
- Enterprise: 500M+ queries/month, 10,000+ records, full GSLB + Insights
- Global enterprise: 1B+ queries/month, Dedicated DNS, China DNS, full analytics + DDoS

MIGRATION TIMING:
- DNS migrations should be planned carefully — TTL changes, propagation time, testing period
- Recommend 30-60 day migration timeline for large customers
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

// ─── Per-product system prompt builder ────────────────────────────────────────

function buildSystemPrompt(product: Product): string {
  const knowledge =
    product === "Verify" ? VERIFY_KNOWLEDGE :
    product === "NS1"    ? NS1_KNOWLEDGE :
                           VAULT_KNOWLEDGE;

  const productName =
    product === "Verify" ? "IBM Security Verify" :
    product === "NS1"    ? "NS1 Connect" :
                           "IBM HashiCorp Vault";

  return `You are DealGenie, an expert IBM seller assistant specialising in ${productName}.
You help IBM sellers and business partners understand how to quote this product accurately.

Your role:
- Answer questions about ${productName} quoting, discovery, sizing, and best practices
- Help sellers understand what questions to ask customers
- Explain pricing models, calculations, and common pitfalls
- Be conversational, practical, and concise
- Use bullet points and clear formatting in your answers

Your boundaries:
- You do NOT generate exact prices (those come from CPQ)
- You do NOT invent part numbers beyond what is in your knowledge base
- If asked something outside your knowledge, say so clearly and suggest consulting the IBM product team

Your product knowledge for ${productName}:
${knowledge}

Conversation style:
- Be direct and practical — sellers are busy
- Use examples wherever helpful
- If the seller describes a specific customer scenario, tailor your advice to it
- Keep responses concise but complete (aim for 3-6 bullet points or a short paragraph per answer)
- After your initial best practices overview, invite follow-up questions`;
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
export async function generateBestPracticesIntro(product: Product): Promise<string> {
  const productName =
    product === "Verify" ? "IBM Security Verify" :
    product === "NS1"    ? "NS1 Connect" :
                           "IBM HashiCorp Vault";

  const userMessage = `Give me a concise best practices overview for quoting ${productName}. Cover: the top 4-5 discovery questions to ask a customer, the most common mistakes sellers make, and one quick sizing example. End with an invitation to ask follow-up questions.`;

  try {
    const { text } = await watsonxGenerate({
      systemPrompt: buildSystemPrompt(product),
      userMessage,
      maxNewTokens: 512,
    });
    return text || fallbackIntro(product);
  } catch (err) {
    // Log the real error server-side, return static fallback so the UI is still useful
    console.error("[best-practices-ai] generateBestPracticesIntro failed:", err instanceof Error ? err.message : err);
    return fallbackIntro(product);
  }
}

/**
 * Continues a best practices conversation — handles follow-up questions.
 * Only the last 4 turns of history are included to stay within token limits.
 * Errors propagate to the route handler (not swallowed here).
 */
export async function continueBestPracticesChat(
  product: Product,
  history: BestPracticesMessage[],
  userMessage: string
): Promise<string> {
  // Keep only the last 4 messages (2 turns) to avoid blowing the input token budget.
  // The system prompt already carries the full product knowledge.
  const recentHistory = history.slice(-4);

  const historyText = recentHistory
    .map((m) => `${m.role === "user" ? "Seller" : "DealGenie"}: ${m.content}`)
    .join("\n\n");

  const fullUserMessage = historyText
    ? `Prior context:\n${historyText}\n\nSeller: ${userMessage}`
    : userMessage;

  try {
    const { text } = await watsonxGenerate({
      systemPrompt: buildSystemPrompt(product),
      userMessage: fullUserMessage,
      maxNewTokens: 512,
    });
    return text || "I'm not sure about that — try rephrasing or check with the IBM product team.";
  } catch (err) {
    const errDetail = err instanceof Error ? err.message : String(err);
    console.error("[best-practices-ai] continueBestPracticesChat failed:", errDetail);
    // Return a user-friendly message that also hints at the underlying issue
    if (errDetail.includes("no_associated_service_instance")) {
      return "⚠️ The watsonx.ai project is not linked to a Watson Machine Learning instance. Ask your IBM Cloud admin to associate a WML service with the project in watsonx.ai, then try again.";
    }
    if (errDetail.includes("403") || errDetail.includes("401")) {
      return `⚠️ AI unavailable — authentication error (${errDetail.slice(0, 120)}). Check WATSONX credentials.`;
    }
    return `⚠️ AI unavailable — ${errDetail.slice(0, 200)}`;
  }
}

// ─── Fallback static intro (used when watsonx is unreachable) ─────────────────

function fallbackIntro(product: Product): string {
  if (product === "Verify") {
    return `**IBM Security Verify — Best Practices Overview**

**Top questions to ask every customer:**
- How many total users need access, and how often do they log in? *(determines MAU — the pricing driver)*
- Which capabilities do they need: SSO, MFA, Adaptive Access, Lifecycle, Analytics?
- Do they need to manage user accounts (provisioning/deprovisioning)? *(Lifecycle/Analytics require Managed User count)*
- How many geographic regions? *(each region multiplies RU)*
- Do they need SMS/email MFA, legacy app integration, or custom branded login?

**Common mistakes to avoid:**
- Using raw headcount as MAU — login frequency matters (yearly login count ÷ 12, capped at 1×)
- Forgetting to ask about Managed Users for Lifecycle/Analytics capabilities
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
- Counting DNS zones instead of individual records (first 3,000 are free)
- Missing RUM pack requirement when RUM-based GSLB is selected

**Quick example:**
150M queries/month average → quote 200M (with headroom). 5,000 records → 2,000 billable. 3 filter chains for GSLB.

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
