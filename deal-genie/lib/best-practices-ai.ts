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
import {
  recommendMaaS360ToVerifyAttach,
  recommendVaultToVerifyAttach,
  recommendVerifyToMaaS360Attach,
  recommendVerifyToVaultAttach,
} from "./cross-sell";
import { fetchProductContext, buildContextSnippet } from "./ibm-search";
import {
  INSTANA_BEST_PRACTICES,
  INSTANA_QUICK_REFERENCE,
} from "./instana-data";
import {
  TURBONOMIC_BEST_PRACTICES,
  TURBONOMIC_QUICK_REFERENCE,
} from "./turbonomic-data";
import {
  TERRAFORM_BEST_PRACTICES,
  TERRAFORM_QUICK_REFERENCE,
} from "./terraform-data";
import {
  CONCERT_BEST_PRACTICES,
  CONCERT_QUICK_REFERENCE,
} from "./concert-data";
import {
  WEBMETHODS_BEST_PRACTICES,
  WEBMETHODS_QUICK_REFERENCE,
} from "./webmethods-data";

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

const MAAS360_KNOWLEDGE = `
IBM MaaS360 is IBM's unified endpoint management (UEM) platform for managing and securing laptops, smartphones, tablets, rugged devices, and apps.

RELEASE 1 POSITIONING IN DEALGENIE:
- This experience supports public-price guidance and best-practices advice, not CPQ-accurate SKU quoting
- Use it to help sellers qualify device-management opportunities, recommend a likely plan, and explain add-on tradeoffs
- If the customer needs custom enterprise pricing, unusual bundle structures, or procurement-specific terms, escalate to the IBM product team or formal pricing process

PUBLIC PRICING (CURRENTLY EXPOSED IN THE TOOL):
- Essentials: $4.24/device/month ($50.88/device/year)
- Deluxe: $5.30/device/month
- Premier: $6.63/device/month
- Enterprise: $9.54/device/month
- Essentials overage reference: $4.66/device/month

PUBLIC ADD-ONS CURRENTLY EXPOSED:
- Concierge customer setup service: $500 one-time
- Mobile Threat Defense Advanced: $3.71/device/month
- TeamViewer Remote Support: $1.00/device/month

PLAN GUIDANCE:
- Essentials: Core mobile device management for teams that mainly need device enrollment, policy enforcement, inventory, and basic compliance
- Deluxe: Better fit when the customer needs stronger app/content management and more day-to-day endpoint administration depth
- Premier: Better fit when security policy, identity context, and broader unified endpoint controls matter more
- Enterprise: Best fit for complex, high-security, or globally scaled environments that need the fullest control set and enterprise readiness

BEST-FIT DISCOVERY QUESTIONS:
1. Device scope: How many devices are in scope today, and what mix is mobile vs laptop/desktop?
2. Ownership model: Are these corporate-owned, BYOD, contractor devices, or a mix?
3. Core problem: Is the pain point onboarding, policy enforcement, app delivery, patch/compliance, remote support, or security risk?
4. Security posture: Do they need threat defense, zero trust controls, conditional access alignment, or audit/compliance evidence?
5. Support model: Does IT need remote troubleshooting or white-glove onboarding help?
6. Buying motion: Are they looking for a fast budgetary estimate or a formal enterprise quote?

CROSS-SELL POSITIONING WITH VERIFY:
- Verify → MaaS360: identity-aware device management; use device posture and managed endpoints to strengthen zero trust access conversations
- MaaS360 → Verify: device trust can feed identity policy; use Verify when the customer also needs SSO, MFA, adaptive access, or lifecycle controls
- Strong combined story: Zero Trust foundation built from trusted users + trusted devices

COMMON MISTAKES:
- Leading with features before confirming the customer's device mix and support model
- Treating every endpoint estate the same — frontline devices, corporate laptops, and BYOD often have different requirements
- Recommending higher plans without understanding whether the driver is management depth, security depth, or enterprise scale
- Presenting public-price guidance as if it were a custom IBM-approved enterprise quote
- Missing adjacent identity needs when the customer is really asking for device trust in access decisions

SELLER GUIDANCE:
- For a quick estimate, anchor on device count first, then recommend the likely plan and any obvious add-ons
- Position Mobile Threat Defense Advanced when endpoint risk or stronger mobile security is part of the story
- Position TeamViewer Remote Support when help desk efficiency or distributed workforce support is important
- Position Concierge when the customer wants faster setup or has limited admin capacity
- If the customer starts with Verify and is asking about device trust, compliance posture, or managed endpoints, introduce MaaS360 early

SIZING EXAMPLES:
- 500 corporate-owned mobile devices, basic management needs → Essentials starting point
- 2,000 mixed mobile and laptop devices with stronger operational controls → Deluxe or Premier discovery path
- 10,000 global endpoints with security/compliance requirements and zero trust goals → Premier or Enterprise discovery path, likely with add-ons depending on support/security needs
`;

const INSTANA_KNOWLEDGE = `
IBM Instana Observability is IBM's full-stack Application Performance Monitoring (APM) and observability platform.
Source: IBM public pricing page (ibm.com/products/instana) and IBM documentation, July 2026.

PRICING MODEL — MVS (Managed Virtual Server):
- The core billing unit is the MVS (Managed Virtual Server). Every host, container node, or equivalent compute resource counts as one MVS.
- Deployment options:
  1. PayPerUse SaaS: $0.03/MVS/hour (IBM Cloud, billed hourly — best for variable workloads)
  2. SaaS (monthly term):
     - Essentials: from ~$21.20/MVS/month (basic APM, no AI features)
     - Standard: from ~$21.20/MVS/month (full APM + AI-powered root cause analysis)
  3. Self-Hosted (on-premises / private cloud):
     - Starting from ~$1,440/month for the first license block
     - Requires a Kubernetes or Linux environment
- Add-ons (separate billing):
  - Managed PoPs (Synthetic Monitoring): $0.00031/execution
  - Logs in Context (log ingestion): $0.351/GB ingested

KEY CAPABILITIES:
- Auto-instrumentation: Instana automatically discovers and instruments 300+ technologies with no code changes required — agents deploy and trace automatically.
- Distributed Tracing: End-to-end trace capture across microservices, databases, and external calls with sub-second granularity.
- AI-Powered Root Cause Analysis: Dynamic graph and AI alerts identify the root cause of performance degradation automatically, reducing MTTR.
- Infrastructure Monitoring: Host, container (Kubernetes, OpenShift), serverless, and cloud service health monitoring.
- Synthetic Monitoring (Managed PoPs): Scheduled synthetic tests from globally distributed points of presence.
- Logs in Context: Correlates log entries with traces and spans — no separate log management tool required for context.
- Real User Monitoring (RUM): Browser and mobile session tracking linked to backend traces.

TURBONOMIC INTEGRATION (KEY CROSS-SELL — CONFIRMED IBM DOCS):
- Instana feeds real-time APM data into IBM Turbonomic's AI resource optimization engine.
- Without Instana, Turbonomic optimizes at the infrastructure layer only (CPU, memory, storage).
- With Instana, Turbonomic actions are application-aware — it can see whether a resource squeeze is causing latency or errors before taking action.
- AUTOMATED integration: both products under the same IBM account, min 200 MVS Instana Standard SaaS → one-click setup from Instana Optimizations tab. No manual configuration.
- Sidekick: Instana users see Turbonomic resource action recommendations inline; Turbonomic users see Instana performance metrics inline.
- The combined positioning: "See it with Instana, act on it with Turbonomic."

CONCERT INTEGRATION (KEY CROSS-SELL — CONFIRMED IBM DOCS):
- Concert Observe REQUIRES Instana agents as its observability data source (IBM Docs, Jul 2026).
- Concert Protect integrates with Instana for container CVE scanning — auto-imports Kubernetes clusters, container images, application components.
- Without Instana: Concert receives lower-fidelity signals. With Instana: rich APM telemetry, traces, spans.
- Automated Concert integration: when Instana SaaS detects Concert under same IBM account, auto-imports app components without SBOM files.
- The combined positioning: "Instana feeds the signals; Concert tells you what matters and orchestrates the response."

SIDEKICK — THE 3-PRODUCT UNIFIED EXPERIENCE (CONFIRMED IBM DOCS):
- IBM Sidekick is a collapsible sidebar available in all three UIs: Instana, Turbonomic, and Concert.
- In Instana: shows Turbonomic resource optimization recommendations + Concert CVE/resilience data.
- In Turbonomic: shows Instana performance metrics + Concert CVE/resilience data.
- In Concert: shows Instana performance metrics + Turbonomic optimization insights.
- Requires eligible SaaS subscriptions under the same IBM account.
- Seller positioning: "IBM built a single 3-product experience. No context-switching. Customers with all three get a unified view that no point-tool combination can match."

DISCOVERY BEST PRACTICES:
1. MVS Count: Ask for the number of hosts, VMs, or container nodes running in production. Each counts as 1 MVS.
   - Kubernetes / OpenShift: count nodes, not pods — the agent runs per node.
   - Container environments often have 5-20x more containers than nodes — this is the most common over-estimate mistake.
2. Deployment Preference: Cloud-hosted SaaS vs self-hosted? Self-hosted is for regulated industries (finance, healthcare) or data-sovereignty requirements.
3. Synthetic Monitoring Needs: Does the customer need to test endpoints proactively from outside? Ask for estimated test executions per month.
4. Logs in Context: Do they have a separate log tool (Splunk, Elastic) or do they need correlated log ingestion? Estimate GB/day.
5. Turbonomic/Concert: Ask whether the customer is trying to automatically act on observability data (Turbonomic) or wants AI-prioritized ITOps intelligence (Concert).

COMMON MISTAKES:
- Counting pods/containers instead of nodes for MVS (significantly overstates costs)
- Not asking about synthetic monitoring needs (common add-on revenue)
- Quoting SaaS when the customer has data-sovereignty requirements (needs self-hosted)
- Missing the Turbonomic and Concert cross-sell when the customer is trying to reduce manual ops work

SIZING EXAMPLES:
- 50-node Kubernetes cluster, SaaS Standard: 50 MVS × $21.20/month = $1,060/month list (~$12,720/year)
- 200-node hybrid cloud, SaaS Standard: 200 MVS × $21.20 = $4,240/month list (~$50,880/year)
- PayPerUse, 100 MVS, always on: 100 × $0.03 × 730h = $2,190/month (more expensive than monthly for stable workloads)
- Enterprise with synthetic (5M executions/month): 5,000,000 × $0.00031 = $1,550/month add-on
`;

const TURBONOMIC_KNOWLEDGE = `
IBM Turbonomic Application Resource Management (ARM) is an AI-driven platform that continuously analyzes and automates resource decisions across hybrid and multi-cloud environments.

PRICING MODEL (confirmed IBM CPQ, July 2026):
- Billing metric: Managed Virtual Server (MVS) per month — same unit as Instana.
- SaaS subscription (Government Standard list price):
  * D11Q7ZX: $23.50/MVS/month (subscription)
  * D11Q8ZX: $28.20/MVS/month (overage — when actual MVS exceeds committed quantity)
- Essentials edition: $50,000/instance/year. 1 instance covers public cloud up to $2M annual cloud spend.
- Professional Services (always recommend on new SaaS deployments):
  * D0G8DZX: $9,700 one-time (Install)
  * D08YVZX: $40,560 one-time (Build SaaS — complex deployments)
  * D08YYZX: $9,700 one-time (Perform SaaS)
- On-Premises and Parking Edition: contact-for-quote.
- Standard IBM discounting applies — government list rate shown above.

TWO SCOPING PATHS (pick one per deal):
1. MVS count path: D11Q7ZX × count × $23.50/month
   Example: 500 MVS × $23.50 = $11,750/month = $141,000/year list
2. Essentials path: CEIL(annual_cloud_spend / $2M) × $50,000/year
   Example: $6M cloud spend → 3 instances × $50,000 = $150,000/year list
   ROI anchor at $6M: typical 20% cloud cost reduction = $1.2M savings vs $150K cost.

KEY CAPABILITIES:
- Continuous Analysis: AI engine analyzes application demand, resource supply, and cost 24/7 — generates prescriptive actions.
- Automated Actions: Can execute resource adjustments automatically (scale up/down VMs, resize containers, reallocate storage) within policy guardrails.
- Cloud Cost Optimization: Identifies over-provisioned cloud resources and recommends right-sizing, reserved instance optimization, and commitment purchases.
- Kubernetes Workload Optimization: Adjusts container resource requests/limits in real time based on actual application demand.
- Application-Aware Optimization: When integrated with Instana, resource actions account for application performance — Turbonomic will not scale down a resource that is causing a latency problem.
- Multi-Cloud Support: AWS, Azure, GCP, IBM Cloud, VMware, OpenShift.

INSTANA INTEGRATION (CRITICAL CROSS-SELL — CONFIRMED IBM DOCS):
- Without Instana: Turbonomic optimizes at infrastructure layer — it can see CPU/memory utilization but not whether an application is experiencing latency or errors.
- With Instana: Turbonomic receives real-time APM signals and makes application-aware decisions — it will not right-size a resource that is causing a performance degradation.
- AUTOMATED integration (IBM Docs confirmed): both under same IBM account, 200+ MVS Instana Standard SaaS → one-click from Instana Optimizations tab. Creates Instana target in Turbonomic automatically.
- Sidekick: in Turbonomic UI, Instana performance metrics appear inline via the Sidekick sidebar. Zero context-switching.
- Seller positioning: "Instana tells Turbonomic what the application needs. Without it, Turbonomic is flying partially blind."
- This is IBM's flagship observability + optimization cross-sell motion.

DISCOVERY BEST PRACTICES:
1. Pain Point: Is the customer trying to reduce cloud costs, prevent performance incidents, or automate ops work? The answer shapes which Turbonomic capabilities to lead with.
2. Environment: What is the size (number of VMs, nodes, services) and where (cloud, on-prem, hybrid)? This drives the scoping conversation.
3. Kubernetes: Containers are a primary use case. Does the customer use Kubernetes/OpenShift? Turbonomic's container sizing is a strong differentiated capability.
4. Automation Appetite: Does the customer want recommendations only, or are they willing to enable automated execution within guardrails? Automation = the primary ROI driver.
5. Instana: Does the customer already have an observability tool? If Instana is not in play, introduce it as the complementary motion.
6. PoC: Recommend the 30-day free trial to show ROI before formal pricing — it is the standard land motion.

COMMON MISTAKES:
- Leading with pricing before doing ROI discovery (Turbonomic deals are justified by cost savings, not compared on price)
- Not asking about Kubernetes environments (strong differentiation vs alternatives)
- Missing the Instana attach — without it, customers only get infrastructure-level optimization
- Not positioning the 30-day trial as the standard entry point

REFERENCE METRICS (use in ROI conversations):
- Typical cloud cost reduction: 30-40% of cloud spend after right-sizing
- Prevention of ~30K disruptions/year at a reference enterprise customer (jointly with Concert)
- Estimated 35% capacity freed after optimization
`;

const TERRAFORM_KNOWLEDGE = `
IBM HashiCorp Terraform is IBM's Infrastructure Lifecycle Management (ILM) product, delivered under IBM's ownership of HashiCorp.

PRODUCT BACKGROUND:
- IBM completed the acquisition of HashiCorp in August 2024. Terraform is now sold and supported by IBM.
- HCP Terraform (HashiCorp Cloud Platform) is the managed SaaS version — this is what IBM primarily positions.
- Open-source Terraform (OSS) remains free but has no IBM commercial support or enterprise features.
- The BSL license change (August 2023) means OpenTofu is an open-source fork — IBM will not support OpenTofu.

PRICING MODEL (HCP Terraform):
- Free tier: Up to 500 managed resources (great for PoC and small teams).
- Essentials, Standard, Premium tiers: Contact-for-quote. Priced per managed resource block.
  - Standard adds team and policy features (Sentinel), SSO, audit logs, and priority support.
  - Premium adds business critical SLAs, custom contract terms, and dedicated support.
- Terraform Plus (on-premises / self-hosted HCP): Also contact-for-quote. For regulated environments.
- IBM sellers should engage the Terraform/HashiCorp product team for formal pricing. No public per-resource pricing for paid tiers.

KEY CAPABILITIES:
- Infrastructure as Code (IaC): Define cloud, on-prem, and hybrid infrastructure declaratively in HCL (HashiCorp Configuration Language).
- Plan / Apply Workflow: Changes are reviewed as "plans" before execution — full change preview and approval gate.
- Remote State Management: Centralized, encrypted state storage — eliminates local state file risk.
- Policy as Code (Sentinel): Enforce compliance guardrails (CIS benchmarks, cost limits, naming conventions) at plan time — infrastructure cannot be provisioned if it violates policy.
- Drift Detection: Continuously detects when actual infrastructure diverges from the declared state.
- Private Registry: Host and share Terraform modules across teams with versioning and access controls.
- VCS Integration: GitHub, GitLab, Bitbucket — triggers runs from pull requests with full audit trail.

VAULT INTEGRATION (CRITICAL CROSS-SELL — ILM + SLM):
- Terraform provisions infrastructure but generates the credentials, certificates, and API keys that provisioned resources need.
- Without Vault: Those credentials are typically stored in Terraform state files, CI/CD environment variables, or hardcoded in HCL — this is a primary source of secrets sprawl.
- With Vault: Terraform dynamically pulls secrets from Vault at run time using the Vault provider — no static credentials ever touch state files.
- IBM's flagship story: Infrastructure Lifecycle Management (Terraform) + Security Lifecycle Management (Vault) = complete automation + security platform.
- Seller positioning: "Terraform provisions it; Vault secures the secrets it needs."

DISCOVERY BEST PRACTICES:
1. Current State: What IaC tool does the customer use today? (Terraform OSS, CloudFormation, ARM templates, Pulumi, Ansible, none?)
   - OSS Terraform users: Upgrade conversation — remote state, Sentinel policies, team collaboration.
   - No IaC tool: Greenfield — lead with HCP Free tier for PoC, then show the Standard value.
2. Scale: How many managed resources? (VMs, databases, network configs, cloud services)
   - <500: Free tier is the entry point. Focus on showing the platform and building habit.
   - 500+: Essentials or Standard becomes the formal conversation.
3. Compliance Needs: Do they need policy enforcement to prevent non-compliant infra? → Sentinel (Standard+)
4. Secrets: Where do credentials for provisioned infrastructure go? Static in state files or CI/CD pipelines is the Vault cross-sell trigger.
5. Team Size: Is this an individual or a platform/SRE team? Multi-user workflows drive Standard value.
6. Hybrid / Air-Gapped: Does the customer have on-prem or air-gapped requirements? → Terraform Plus / self-hosted.

COMMON MISTAKES:
- Not asking about current secrets handling in CI/CD pipelines (misses Vault cross-sell)
- Treating OSS users as a threat rather than an upgrade conversation
- Leading with paid pricing before showing the Free tier PoC path
- Not validating Sentinel compliance needs (strong differentiator vs OSS)
- Forgetting to mention IBM support and enterprise SLAs as the core value-add over community support

SIZING EXAMPLES:
- Startup / small team: 300 resources, 3 users → Free tier. Focus on building the habit and proving remote state value.
- Mid-market platform team: 2,000 resources, 15 users, compliance requirements → Standard tier. Add Vault for secrets.
- Enterprise: 50,000+ resources, multiple business units, audit requirements → Premium + Terraform Plus for self-hosted workloads.
`;

const CONCERT_KNOWLEDGE = `
IBM Concert is IBM's Agentic ITOps platform — an AI-driven operational intelligence hub that correlates signals across observability, cost, risk, and change data to prioritize what matters and orchestrate remediation.

PRICING MODEL (CONFIRMED IBM CPQ, Jun 17, 2026):
- PID: 5900BBE · Billing metric: Resource Unit (RU)
- Subscription license:   $212/RU/year
- Monthly license:        $265/RU/month
- Term license + support: $6,360/RU
- CONFIRMED RU mappings:
  * Concert Protect (vulnerability management): 3 RU per managed application
  * Concert Optimize (resource optimization): 1 RU per 5 MVS (= 0.2 RU/MVS)
- Other modules (Observe, Operate, Resilience, Workflows): RU mapping — confirm with IBM
- Sizing example: 50 apps Protect = 150 RU = $31,800/yr · 500 MVS Optimize = 100 RU = $21,200/yr

SIX MODULES — capabilities and dependencies:
  1. Concert Observe: Cross-domain observability. REQUIRES Instana agents as data source (IBM Docs, Jul 2026).
  2. Concert Operate: AI-guided incident response and root-cause analysis.
  3. Concert Optimize: Resource right-sizing. POWERED BY IBM Turbonomic — requires Turbonomic target configuration.
  4. Concert Protect: CVE and vulnerability analysis. Integrates with Instana for container image scanning.
     → 3 RU per managed application (confirmed pricing).
  5. Concert Resilience: Resilience scoring — availability, compliance, configuration, runtime health signals.
  6. Concert Workflows: AI-generated playbooks and agentic automation for ops tasks.

KEY CAPABILITIES:
- AI-Powered Operational Graph: Continuously builds a real-time map of applications, services, infrastructure, and their dependencies — the foundation for all downstream insights.
- Cross-Domain Correlation: Ingests signals from monitoring, ITSM, CMDB, CI/CD, cost, and security tools — correlates them into a unified operational picture.
- Business-Impact Prioritization: Ranks incidents and risks by their likely impact on business services, not just technical severity.
- Agentic Automation (Workflows module): AI agents that can diagnose, remediate, or escalate based on defined playbooks — reducing human toil.
- Change Risk Analysis: Before a deployment or change, Concert models the blast radius and flags high-risk changes.
- Integration Breadth: Works alongside ServiceNow, PagerDuty, Jira, Splunk, Datadog, Prometheus, and IBM Instana.

INSTANA INTEGRATION (CRITICAL CROSS-SELL — CONFIRMED IBM DOCS Jul 2026):
- Concert Observe architecturally requires Instana agents as its observability data source.
- Concert Protect integrates with Instana: CVE sensor polls Concert APIs every 6h; auto-imports Kubernetes clusters, container images, and application components when both are under the same IBM account.
- Without Instana: Concert receives lower-fidelity signals (basic metrics, logs, alerts from third-party monitoring). AI model has significantly less context.
- With Instana: Concert receives rich APM telemetry including traces, spans, and AI root-cause signals — quality of Concert insights is dramatically better.
- Automated integration: when Instana SaaS detects Concert under same account, auto-imports application components without manual SBOM file creation.
- Combined positioning: "Instana captures high-fidelity signals; Concert tells you what those signals mean for the business and orchestrates the response."
- IBM reference metric: 30,000 disruptions avoided per year at an enterprise customer using both Concert and Turbonomic together.

TURBONOMIC INTEGRATION (CONCERT OPTIMIZE):
- Concert Optimize capability is literally powered by IBM Turbonomic — Turbonomic targets must be configured.
- This makes Concert+Turbonomic a required pair for the resource optimization use case.
- Sidekick: Concert users see Instana performance metrics + Turbonomic optimization insights in the sidebar.

DISCOVERY BEST PRACTICES:
1. Primary Pain: What is the customer's biggest ITOps problem?
   - Alert fatigue / too many tools → Observe + Operate modules
   - Cloud cost overruns / wasted resources → Optimize module
   - Security risk exposure → Protect module
   - Risky deployments / change management → Resilience module
   - Repetitive ops toil → Workflows module
2. Current Tooling: What monitoring, ITSM, and observability tools does the customer use? Is Instana in play? (Critical for telemetry quality.)
3. Application Count: How many applications or services does the ITOps team support? Larger environments amplify Concert's value.
4. Automation Appetite: Is the customer ready to let AI agents take actions, or do they want recommendations only?
5. Integration Points: Which ITSM tools (ServiceNow, Jira) and monitoring tools need to be connected? Concert's value depends on rich integration.

COMMON MISTAKES:
- Positioning Concert as an observability tool — it is an operational intelligence hub that consumes observability data.
- Not asking about Instana — Concert's AI quality is directly tied to the richness of the telemetry it ingests.
- Trying to sell all six modules at once — start with the one that matches the primary pain and expand.
- Not referencing the 30K disruptions avoided / 35% capacity freed ROI metrics in the business case.
- Forgetting that Concert and Turbonomic together form IBM's flagship AIOps story.

REFERENCE METRICS (use in business cases):
- 30,000 disruptions avoided per year (IBM reference customer, Concert + Turbonomic)
- 35% of capacity freed through AI-driven optimization
- Typical MTTR reduction: 60-80% when AI-prioritized triage replaces manual alert review
`;

const WEBMETHODS_KNOWLEDGE = `
IBM webMethods Integration is IBM's Hybrid iPaaS (Integration Platform as a Service) — a comprehensive integration platform for connecting applications, APIs, B2B partners, and event-driven systems.
Current release: webMethods 12.1. Recognized as a Forrester Wave Leader in Enterprise iPaaS (Q3 2025).

PRICING MODEL (CONFIRMED IBM Docs hybrid-integration-lib, Jul 2026 + Seismic Dec 2025):
- SaaS billing metric: Resource Unit (RU) [NOTE: official IBM term in the docs, not "RVU"]
- SaaS base charge: 60 RU/month per enabled integration capability instance (production)
- SaaS usage charge — App Integration (CONFIRMED):
  * Tier 1: 4 RU per 100,000 transactions for first 1M transactions/year
  * Tier 2: 1 RU per 100,000 transactions over 1M/year
- List price: ~$11.54/RU/year (Seismic Dec 2025)
- Monthly base example: 60 RU × $11.54/12 = ~$57.70/month. Annual base: 720 RU × $11.54 = ~$8,309/year per instance
- 7-day no-charge exploration period when a capability is first enabled in a subscription
- API Management, Events, B2B transaction rates: separately metered by bundle — confirm with IBM
- On-Premises / CP4I webMethods Add-on: priced per VPC (Virtual Processor Core) — same rate as CP4I. Contact IBM.
- Deployment options:
  1. webMethods SaaS (IBM-hosted): fastest to deploy, RU-based.
  2. On-Premises: Self-managed. webMethods 12.1 is the current release.
  3. Hybrid: Mix of cloud and on-premises Integration Server for regulated workloads.
- The "Flow Pilot" AI feature (AI-assisted integration authoring) is available on current SaaS plans.

KEY CAPABILITIES:
- Application Integration: Bi-directional connectors for 200+ SaaS, on-premises, and cloud applications (Salesforce, SAP, ServiceNow, Workday, Oracle, etc.)
- API Management: Full API lifecycle — design, publish, secure, monitor, and version APIs via API gateway and developer portal.
- B2B / EDI Integration: Electronic data interchange (EDI X12, EDIFACT, TRADACOMS), partner onboarding, and supply-chain connectivity.
- Event-Driven Architecture: Apache Kafka-compatible messaging, pub/sub patterns, real-time event streaming for modern microservices.
- Managed File Transfer (MFT): Secure, auditable file transfer across enterprise and cloud environments.
- Flow Pilot (AI Authoring): AI assistant that suggests integration flows, transforms, and connector mappings — accelerates development.

VERIFY INTEGRATION (KEY CROSS-SELL — CONFIRMED IBM API CONNECT DOCS):
- webMethods publishes APIs and integration endpoints — every published API is an access vector that needs identity governance.
- IBM API Connect documentation confirms: the webMethods API Gateway uses an "Identify and Authorize" policy for OAuth/OIDC. This is the direct integration point with IBM Security Verify.
- Without Verify: API access is often secured with static API keys or basic auth — weak governance, no adaptive policy.
- With Verify: OAuth 2.0/OIDC identity layer governs API access with token-based security, adaptive access policies, and lifecycle governance.
- IBM's combined story: "webMethods for the governed integration fabric; Verify for identity-aware access and API security."
- Seller positioning: "Every API endpoint you publish with webMethods is a surface area that Verify can secure with modern, adaptive identity."

DISCOVERY BEST PRACTICES:
1. Integration Pain: What is the customer trying to connect and why?
   - App-to-app: ERP ↔ CRM ↔ HR systems → Application Integration
   - External partners: EDI, supply chain, B2B networks → B2B module
   - API exposure: Building or governing APIs → API Management
   - Real-time events: Microservices, Kafka, streaming → Event-Driven module
2. Deployment Constraints: Are there data-sovereignty, compliance, or air-gapped requirements? → On-prem or hybrid deployment.
3. Current Integration Landscape: What tools do they use today? (MuleSoft, Boomi, Azure Logic Apps, custom scripts?)
   - Migration conversation for MuleSoft/Boomi users: licensing cost and complexity.
4. API Governance: Are APIs already published and how are they secured? (Static keys = Verify cross-sell trigger.)
5. Industry Vertical: Healthcare, financial services, and manufacturing have specialized compliance drivers (HL7, FHIR, ISO 20022, SWIFT).
6. Verify Ownership: Does the customer already use IBM Security Verify? If yes, the webMethods + Verify story is ready-made.

COMMON MISTAKES:
- Treating webMethods as a point connector tool rather than a full integration platform (it covers iPaaS, API management, B2B, and event-driven)
- Not asking about B2B / EDI needs (high-value add-on, often drives the deal)
- Missing the Verify cross-sell — every API endpoint published with webMethods is an access governance opportunity
- Not mentioning Forrester Wave Leader recognition (strong third-party validation)
- Forgetting to ask about AI authoring (Flow Pilot) as a developer productivity differentiator

SIZING EXAMPLES:
- Retail: SAP ERP ↔ Salesforce CRM ↔ Shopify e-commerce + EDI for 50 suppliers → App Integration + B2B modules; on-prem for ERP, cloud for SaaS connectors.
- Healthcare: HL7 FHIR APIs connecting EHR to patient portal and third-party apps → API Management + App Integration; strict data sovereignty → hybrid deployment.
- Financial Services: ISO 20022 payment message transformation + partner bank connectivity + API gateway → B2B + API Management + Event-Driven.
`;

function buildCrossSellPrompt(product: Product): string {
  if (product === "Verify") {
    return `
CROSS-SELL GUIDANCE:
- When sellers describe adaptive access, device posture, managed endpoints, compliance posture, risky-device access, contractor/BYOD risk, or zero trust, proactively explain the MaaS360 attach motion.
- When sellers describe identity governance maturity, privileged access gaps, secrets sprawl, certificate pain, service-account risk, or the need to secure machine identities alongside users, proactively explain the Vault attach motion.
- When sellers describe API security, integration governance, or the need to secure published APIs and integration endpoints, proactively explain the webMethods attach motion.
- Position MaaS360 as identity trust + device trust.
- Position Vault as human identity + machine identity / secrets governance.
- Position webMethods as the governed integration fabric that Verify's identity policies protect.
- Keep the recommendation practical: what to position first, what to validate next, and why it matters commercially.
`;
  }

  if (product === "MaaS360") {
    return `
CROSS-SELL GUIDANCE:
- When sellers describe threat defense, device posture, conditional access alignment, secure app access, onboarding friction, or workforce access modernization, proactively explain the Verify attach motion.
- Position the attach as extending endpoint trust into SSO, MFA, adaptive access, and lifecycle policy.
- If the MaaS360 opportunity already includes threat defense, secure apps, or broader productivity controls, explain why Verify is the best adjacent identity motion.
- Keep the recommendation practical: what to position first, what to validate next, and why it matters commercially.
`;
  }

  if (product === "Vault") {
    return `
CROSS-SELL GUIDANCE:
- When sellers describe secrets sprawl, machine identities, privileged operator workflows, service-account risk, certificate governance, or Zero Trust that stops at workloads, proactively explain the Verify attach motion.
- When sellers describe infrastructure provisioning, IaC, CI/CD pipelines, state file security, or policy-as-code, proactively explain the Terraform (ILM + SLM) attach motion.
- Position Vault as non-human identity and secrets control, and Verify as human identity, MFA, adaptive access, and lifecycle governance.
- Position Terraform as the infrastructure automation layer that Vault's secrets backend secures — IBM's flagship ILM + SLM story.
- Keep the recommendation practical: what to position first, what to validate next, and why it matters commercially.
`;
  }

  if (product === "Instana") {
    return `
CROSS-SELL GUIDANCE:
- When sellers describe resource waste, cloud cost overruns, manual scaling decisions, or the desire to automate resource adjustments, proactively explain the Turbonomic attach motion.
- When sellers describe alert fatigue, cross-domain ITOps complexity, slow MTTR, incident prioritization, or operational toil, proactively explain the Concert attach motion.
- Position Turbonomic as "act on it" — Instana sees it, Turbonomic automates the resource response.
- Position Concert as "understand the business impact" — Instana provides the signals; Concert provides cross-domain context and AI-prioritized response orchestration.
- Keep the recommendation practical: what to position first, what to validate next, and why it matters commercially.
`;
  }

  if (product === "Turbonomic") {
    return `
CROSS-SELL GUIDANCE:
- When sellers describe manual performance analysis, dashboards that generate tickets but not actions, or the need to understand why a resource is being constrained, proactively explain the Instana attach motion.
- Position Instana as the observability layer that makes Turbonomic application-aware — without it, Turbonomic optimizes at the infrastructure layer only.
- Use the combined story: "See it with Instana, act on it with Turbonomic — autonomous application-aware resource management."
- Keep the recommendation practical: what to position first, what to validate next, and why it matters commercially.
`;
  }

  if (product === "Terraform") {
    return `
CROSS-SELL GUIDANCE:
- When sellers describe static credentials in state files, secrets in CI/CD pipelines, hardcoded API keys, or certificate lifecycle risk, proactively explain the Vault attach motion.
- Position the ILM + SLM story: Terraform provisions the infrastructure; Vault secures the secrets that provisioned infrastructure requires — no static credentials in state files, ever.
- This is IBM's flagship automation + security narrative — the more infrastructure the customer automates with Terraform, the larger the Vault opportunity.
- Keep the recommendation practical: what to position first, what to validate next, and why it matters commercially.
`;
  }

  if (product === "Concert") {
    return `
CROSS-SELL GUIDANCE:
- When sellers describe basic monitoring data, low-fidelity telemetry feeds, or the customer asking for deeper application-level signals in Concert, proactively explain the Instana attach motion.
- Position Instana as the premium telemetry source that significantly improves Concert's AI-generated context and prioritization accuracy.
- Use the combined story: "Instana captures the high-fidelity signals; Concert tells you what matters and orchestrates the response."
- Keep the recommendation practical: what to position first, what to validate next, and why it matters commercially.
`;
  }

  if (product === "webMethods") {
    return `
CROSS-SELL GUIDANCE:
- When sellers describe ungoverned API access, static API keys, weak integration endpoint security, or the need to modernize access governance alongside integration, proactively explain the Verify attach motion.
- Position the combined story: webMethods publishes the governed integration fabric; Verify provides the OAuth 2.0/OIDC identity and adaptive access layer that protects every endpoint.
- Every API published with webMethods is a surface area that Verify can secure — make this concrete for the customer.
- Keep the recommendation practical: what to position first, what to validate next, and why it matters commercially.
`;
  }

  return "";
}

// ─── Per-product system prompt builders ───────────────────────────────────────

function getProductKnowledge(product: Product): string {
  switch (product) {
    case "Verify":    return VERIFY_KNOWLEDGE;
    case "NS1":       return NS1_KNOWLEDGE;
    case "Vault":     return VAULT_KNOWLEDGE;
    case "MaaS360":   return MAAS360_KNOWLEDGE;
    case "Instana":   return INSTANA_KNOWLEDGE;
    case "Turbonomic": return TURBONOMIC_KNOWLEDGE;
    case "Terraform": return TERRAFORM_KNOWLEDGE;
    case "Concert":   return CONCERT_KNOWLEDGE;
    case "webMethods": return WEBMETHODS_KNOWLEDGE;
    default: return MAAS360_KNOWLEDGE;
  }
}

function getProductDisplayName(product: Product): string {
  switch (product) {
    case "Verify":     return "IBM Security Verify";
    case "NS1":        return "NS1 Connect";
    case "Vault":      return "IBM HashiCorp Vault";
    case "MaaS360":    return "IBM MaaS360";
    case "Instana":    return "IBM Instana Observability";
    case "Turbonomic": return "IBM Turbonomic";
    case "Terraform":  return "IBM HashiCorp Terraform";
    case "Concert":    return "IBM Concert";
    case "webMethods": return "IBM webMethods Integration";
    default: return "IBM MaaS360";
  }
}

function buildSystemPrompt(product: Product, liveContext?: string): string {
  const knowledge = getProductKnowledge(product);
  const productName = getProductDisplayName(product);

  const liveSection = liveContext
    ? `\n\nLIVE CONTEXT FROM IBM SEISMIC (fetched now — more current than the knowledge base above):\n${liveContext}\n`
    : "";
  const crossSellSection = buildCrossSellPrompt(product);

  return `You are an AI Subject Matter Expert (AI SME) for ${productName}, built into IBM's QuoteGenie quoting assistant.
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
${crossSellSection}

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
  const knowledge = getProductKnowledge(product);
  const productName = getProductDisplayName(product);

  const liveSection = liveContext
    ? `\n\nLIVE CONTEXT FROM IBM SEISMIC (use to inform answers — do NOT recite prices or part numbers to the client):\n${liveContext}\n`
    : "";
  const crossSellSection = buildCrossSellPrompt(product);

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
${crossSellSection}

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
  const productName = getProductDisplayName(product);

  const fallback = fallbackIntro(product, clientMode);

  if (!process.env.OPENAI_API_KEY && !process.env.WATSONX_API_KEY) {
    return fallback;
  }

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

  if (product === "Instana") {
    if (q.includes("mvs") || q.includes("host") || q.includes("node") || q.includes("container")) {
      return `**MVS Sizing**\n\n- MVS = Managed Virtual Server. Count compute nodes, not containers or pods.\n- Kubernetes: count nodes. Each node = 1 MVS regardless of how many pods run on it.\n- 50 nodes (SaaS Standard) → 50 × $21.20/month = $1,060/month list price\n- PayPerUse: $0.03/MVS/hour — more expensive than monthly for always-on workloads`;
    }
    if (q.includes("turbonomic") || q.includes("cross-sell") || q.includes("attach") || q.includes("resource") || q.includes("optimization")) {
      return `**Instana → Turbonomic Attach**\n\n- Instana provides the APM telemetry. Turbonomic ingests it to make resource decisions application-aware.\n- Without Instana: Turbonomic optimizes at infrastructure layer only (CPU, memory).\n- With Instana: Turbonomic knows whether a resource squeeze is causing latency — it will not scale down a resource that is actively degrading performance.\n- Positioning: "See it with Instana, act on it with Turbonomic."\n- Start with Instana PoC; introduce Turbonomic when the customer asks about acting on the data automatically.`;
    }
    if (q.includes("concert") || q.includes("alert") || q.includes("fatigue") || q.includes("aiops")) {
      return `**Instana → Concert Attach**\n\n- Instana generates high-fidelity APM signals. Concert ingests those signals alongside cost, risk, and change data.\n- Without Concert: Instana users often suffer alert fatigue — they see the signals but lack business-impact prioritization.\n- With Concert: AI prioritizes what matters, correlates across domains, and orchestrates the response across teams and tools.\n- Positioning: "Instana feeds the signals; Concert tells you what matters and orchestrates the response."\n- Trigger: Ask whether the customer acts on observability data manually (tickets, Slack threads). If yes, introduce Concert.`;
    }
    if (q.includes("price") || q.includes("cost") || q.includes("pricing")) {
      return `**Instana Pricing**\n\n- PayPerUse: $0.03/MVS/hour (IBM Cloud, variable workloads)\n- SaaS Standard: ~$21.20/MVS/month list\n- Self-Hosted: from ~$1,440/month\n- Synthetic Monitoring: $0.00031/execution\n- Logs in Context: $0.351/GB ingested\n- 100 MVS, SaaS Standard, always on: ~$2,120/month list (~$25,440/year)`;
    }
  }

  if (product === "Turbonomic") {
    if (q.includes("instana") || q.includes("observability") || q.includes("apm") || q.includes("application aware")) {
      return `**Turbonomic → Instana Attach**\n\n- Without Instana: Turbonomic optimizes at the infrastructure layer — it can see resource utilization but not application performance.\n- With Instana: Turbonomic receives real-time APM signals and makes application-aware resource decisions.\n- Seller positioning: "Instana tells Turbonomic what the application needs. Without it, Turbonomic is flying partially blind."\n- Always qualify whether the customer has an existing observability tool. If not, Instana is the natural pairing.`;
    }
    if (q.includes("price") || q.includes("cost") || q.includes("pricing") || q.includes("d11q") || q.includes("part") || q.includes("sku")) {
      return `**Turbonomic Pricing (confirmed IBM CPQ, July 2026)**\n\n- **D11Q7ZX**: $23.50/MVS/month list — SaaS subscription (Government Standard)\n- **D11Q8ZX**: $28.20/MVS/month list — overage when consumption exceeds committed quantity\n- **Essentials edition**: $50,000/instance/year — 1 instance covers up to $2M annual cloud spend\n- **Professional Services**: D0G8DZX Install $9,700 · D08YVZX Build SaaS $40,560 · D08YYZX Perform $9,700\n- On-Premises and Parking Edition: contact-for-quote\n- Standard IBM discounting applies\n\n**Quick sizing examples:**\n- 500 MVS × $23.50/month = $141,000/year list\n- $4M cloud spend → 2 Essentials instances = $100,000/year list\n- ROI anchor: typical 20% cloud cost reduction on $4M = $800K savings vs $100K cost`;
    }
    if (q.includes("kubernetes") || q.includes("container") || q.includes("k8s")) {
      return `**Turbonomic Kubernetes Optimization**\n\n- Container sizing is a primary Turbonomic use case and a strong differentiator vs alternatives.\n- Turbonomic adjusts container resource requests/limits (CPU, memory) in real time based on actual demand.\n- Common customer pain: containers are over-provisioned out of caution, wasting cloud spend.\n- With Instana: Turbonomic gets container-level APM traces and can right-size without degrading application performance.`;
    }
  }

  if (product === "Terraform") {
    if (q.includes("vault") || q.includes("secret") || q.includes("credential") || q.includes("state file") || q.includes("ci/cd")) {
      return `**Terraform → Vault Attach (ILM + SLM)**\n\n- Terraform provisions infrastructure but generates credentials that need secure storage.\n- Without Vault: credentials end up in Terraform state files, CI/CD env vars, or hardcoded in HCL — this is secrets sprawl.\n- With Vault: Terraform uses the Vault provider to pull dynamic credentials at run time — nothing static ever touches the state file.\n- IBM's flagship story: Infrastructure Lifecycle Management (Terraform) + Security Lifecycle Management (Vault).\n- Positioning: "Terraform provisions it; Vault secures the secrets it needs."`;
    }
    if (q.includes("price") || q.includes("cost") || q.includes("pricing") || q.includes("free")) {
      return `**Terraform (HCP) Pricing**\n\n- Free tier: Up to 500 managed resources — great for PoC and small teams.\n- Essentials / Standard / Premium: Contact-for-quote. Standard adds Sentinel policies, SSO, audit logs.\n- Self-hosted (Terraform Plus): Also contact-for-quote for regulated/air-gapped environments.\n- Always start with the Free tier for discovery — it shows value before the pricing conversation.`;
    }
    if (q.includes("sentinel") || q.includes("policy") || q.includes("compliance")) {
      return `**Sentinel Policy-as-Code**\n\n- Sentinel enforces compliance guardrails at plan time — infrastructure cannot be provisioned if it violates policy.\n- Use cases: CIS benchmark enforcement, cost limit policies, naming convention rules, approved AMI/image lists.\n- Available from Standard tier and above.\n- Strong differentiator vs open-source Terraform — this is the "rails" that platform teams need to enable self-service safely.`;
    }
  }

  if (product === "Concert") {
    if (q.includes("instana") || q.includes("telemetry") || q.includes("observability") || q.includes("monitoring")) {
      return `**Concert → Instana Attach**\n\n- Concert's AI quality depends directly on the richness of the telemetry it ingests.\n- Without Instana: Concert receives lower-fidelity signals from basic monitoring tools — AI context is limited.\n- With Instana: Concert gets auto-correlated APM traces, spans, and AI root-cause signals — significantly more accurate prioritization.\n- Positioning: "Instana captures high-fidelity signals; Concert tells you what those signals mean for the business and orchestrates the response."\n- If the customer has an existing monitoring tool (Datadog, Dynatrace), position Instana as the higher-quality IBM-native telemetry source.`;
    }
    if (q.includes("price") || q.includes("cost") || q.includes("pricing") || q.includes("module")) {
      return `**Concert Pricing & Modules**\n\n- Contact-for-quote only. Six modules: Observe, Operate, Optimize, Protect, Resilience, Workflows.\n- Always start with the module that matches the customer's primary pain — do not try to sell all six at once.\n- Alert fatigue / MTTR → Observe + Operate. Cloud cost waste → Optimize. Risky deployments → Resilience. Security risk → Protect. Repetitive toil → Workflows.\n- Reference ROI: 30K disruptions avoided/year, 35% capacity freed.`;
    }
    if (q.includes("aiops") || q.includes("alert") || q.includes("fatigue") || q.includes("mttr")) {
      return `**Concert AIOps Positioning**\n\n- Concert is NOT an observability tool — it is an operational intelligence hub that consumes observability data.\n- Primary value: AI correlates signals across monitoring, ITSM, change, cost, and security — surfaces what matters with business-impact context.\n- MTTR reduction: AI-prioritized triage typically reduces MTTR 60-80% vs manual alert review.\n- Agentic automation (Workflows module): AI agents execute runbooks and remediation steps without human intervention.`;
    }
  }

  if (product === "webMethods") {
    if (q.includes("verify") || q.includes("api") || q.includes("governance") || q.includes("oauth") || q.includes("identity") || q.includes("cross-sell") || q.includes("attach")) {
      return `**webMethods → Verify Attach**\n\n- webMethods publishes APIs and integration endpoints — each is an access vector.\n- Without Verify: API access is often protected by static API keys or basic auth — weak governance.\n- With Verify: OAuth 2.0/OIDC identity layer governs API access with adaptive access policies and lifecycle governance.\n- Positioning: "Every API you publish with webMethods is a surface area that Verify can secure with modern, adaptive identity."\n- Trigger: Ask how current API endpoints are secured. Static keys = immediate cross-sell opening.`;
    }
    if (q.includes("b2b") || q.includes("edi") || q.includes("partner") || q.includes("supply chain")) {
      return `**webMethods B2B / EDI**\n\n- webMethods supports EDI X12, EDIFACT, TRADACOMS — the primary standard formats for supply chain and trading-partner connectivity.\n- B2B module is often the deal driver for manufacturing, retail, and logistics customers.\n- Partner onboarding, transaction monitoring, and exception management are included.\n- Often co-exists with the App Integration module for hybrid EDI + modern API connectivity.`;
    }
    if (q.includes("price") || q.includes("cost") || q.includes("pricing")) {
      return `**webMethods Pricing**\n\n- Contact-for-quote only. Deployment options: webMethods.io SaaS, on-premises (12.1), or hybrid.\n- Scoping drivers: number of integrations, transaction volumes, modules needed (App Integration, API Management, B2B, Event-Driven, MFT).\n- Flow Pilot (AI authoring) is available on current cloud plans.\n- Forrester Wave Leader, Enterprise iPaaS Q3 2025 — strong third-party validation for competitive displacement conversations.`;
    }
  }

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
    if (q.includes("vault") || q.includes("machine identity") || q.includes("machine identities") || q.includes("service account") || q.includes("service accounts") || q.includes("secret") || q.includes("secrets") || q.includes("certificate") || q.includes("privileged access")) {
      const attach = recommendVerifyToVaultAttach({
        capabilities: q.includes("adaptive") ? ["Adaptive"] : q.includes("lifecycle") ? ["Lifecycle"] : q.includes("mfa") ? ["MFA"] : [],
        population: q.includes("10000") ? 10000 : q.includes("5000") ? 5000 : 0,
      });
      const evidence = attach.evidence.length > 0 ? attach.evidence.map((item) => `- ${item}`).join("\n") : "- Workforce identity programs often expose the next gap around machine credentials and secrets governance.";
      return `**Verify → Vault Attach Guidance**\n\n- ${attach.headline}\n- ${attach.rationale}\n- Position it as human identity plus machine identity governance\n- Validate whether the customer has secrets sprawl, service-account risk, or certificate lifecycle pain\n\n**Why this attach fits**\n${evidence}`;
    }
    if (q.includes("cross-sell") || q.includes("cross sell") || q.includes("attach") || q.includes("maas360") || q.includes("device trust") || q.includes("zero trust")) {
      const attach = recommendVerifyToMaaS360Attach({
        capabilities: q.includes("adaptive") ? ["Adaptive"] : q.includes("lifecycle") ? ["Lifecycle"] : q.includes("mfa") ? ["MFA"] : [],
        population: q.includes("10000") ? 10000 : q.includes("5000") ? 5000 : 0,
      });
      const evidence = attach.evidence.length > 0 ? attach.evidence.map((item) => `- ${item}`).join("\n") : "- Device posture is the natural adjacent control when identity is already in scope.";
      return `**Verify → MaaS360 Attach Guidance**\n\n- ${attach.headline}\n- ${attach.rationale}\n- Position it as user trust plus device trust in one zero-trust story\n- Validate whether the client also needs threat defense, remote support, or rollout help\n\n**Why this attach fits**\n${evidence}`;
    }
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
    if (q.includes("cross-sell") || q.includes("cross sell") || q.includes("attach") || q.includes("verify") || q.includes("human identity") || q.includes("mfa") || q.includes("identity perimeter")) {
      const attach = recommendVaultToVerifyAttach({
        vaultModel: q.includes("renewal") ? "B" : "A",
        clientCount: q.includes("50") ? 50 : q.includes("25") ? 25 : 0,
        useCases: [
          ...(q.includes("dynamic") ? ["dynamic"] : []),
          ...(q.includes("ssh") ? ["ssh"] : []),
          ...(q.includes("pki") || q.includes("certificate") ? ["pki"] : []),
          ...(q.includes("kmip") || q.includes("key") ? ["kmse"] : []),
        ],
      });
      const evidence = attach.evidence.length > 0 ? attach.evidence.map((item) => `- ${item}`).join("\n") : "- Secrets and workload controls are strongest when the customer also modernizes workforce identity controls.";
      return `**Vault → Verify Attach Guidance**\n\n- ${attach.headline}\n- ${attach.rationale}\n- Position it as unified identity governance across human and machine actors\n- Validate whether the customer still has inconsistent SSO, MFA, adaptive access, or lifecycle controls\n\n**Why this attach fits**\n${evidence}`;
    }
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

  if (product === "MaaS360") {
    if (q.includes("cross-sell") || q.includes("cross sell") || q.includes("attach") || q.includes("verify") || q.includes("identity") || q.includes("conditional access")) {
      const attach = recommendMaaS360ToVerifyAttach({
        maas360ThreatDefense: q.includes("threat") ? "yes" : "no",
        maas360AdvancedApps: q.includes("app") || q.includes("browser") ? "yes" : "no",
        maas360SecureMail: q.includes("mail") || q.includes("productivity") ? "yes" : "no",
        maas360Devices: q.includes("2500") ? 2500 : q.includes("5000") ? 5000 : 0,
      });
      const evidence = attach.evidence.length > 0 ? attach.evidence.map((item) => `- ${item}`).join("\n") : "- Managed-device programs usually create a clean adjacent SSO and MFA conversation.";
      return `**MaaS360 → Verify Attach Guidance**\n\n- ${attach.headline}\n- ${attach.rationale}\n- Position it as device trust flowing into identity-aware access policy\n- Validate whether adaptive access or lifecycle management should be part of the identity motion\n\n**Why this attach fits**\n${evidence}`;
    }
    if (q.includes("plan") || q.includes("edition") || q.includes("tier")) {
      return `**MaaS360 Plan Guidance**\n\n- Essentials is the starting point for core device enrollment, policy, inventory, and compliance\n- Deluxe and Premier fit better when the customer needs broader endpoint administration or stronger security controls\n- Enterprise is usually for larger, more complex, or higher-security environments\n- Start with device count and management/security depth, then narrow the likely plan`;
    }
    if (q.includes("device") || q.includes("endpoint") || q.includes("byod") || q.includes("laptop") || q.includes("mobile")) {
      return `**Device Discovery**\n\n- Ask how many devices are in scope today and what the mix is across mobile, laptop/desktop, rugged, and BYOD\n- Confirm whether devices are corporate-owned, employee-owned, or shared/frontline\n- The device mix often matters as much as the raw count when choosing the right plan and rollout approach`;
    }
    if (q.includes("price") || q.includes("cost") || q.includes("estimate")) {
      return `**MaaS360 Public Pricing Guidance**\n\n- Essentials: $4.24/device/month ($50.88/device/year)\n- Deluxe: $5.30/device/month\n- Premier: $6.63/device/month\n- Enterprise: $9.54/device/month\n- Add-ons exposed in the tool: Mobile Threat Defense Advanced ($3.71/device/month), TeamViewer Remote Support ($1.00/device/month), Concierge setup ($500 one-time)\n- Treat these as budgetary public-price estimates, not custom enterprise quotes`;
    }
    if (q.includes("threat") || q.includes("remote support") || q.includes("teamviewer") || q.includes("concierge") || q.includes("add-on") || q.includes("addon")) {
      return `**MaaS360 Add-On Guidance**\n\n- Mobile Threat Defense Advanced fits when endpoint risk reduction or stronger mobile security is part of the conversation\n- TeamViewer Remote Support fits when IT needs faster remote troubleshooting for distributed users\n- Concierge setup fits when the customer wants white-glove onboarding or has limited admin capacity\n- Tie add-ons to the operating model and security goals instead of attaching them by default`;
    }
  }

  // Generic fallback
  return `I'm not able to connect to the AI right now, but I can help with specific questions about ${getProductDisplayName(product)}. Try asking about pricing, specific part numbers, sizing, or common mistakes.`;
}

// ─── Fallback static intro (used when watsonx is unreachable) ─────────────────

function fallbackIntro(product: Product, clientMode = false): string {
  if (clientMode) {
    const productName = getProductDisplayName(product);
    return `👋 Hi, I'm Genie — an AI assistant here to help you understand **${productName}** and whether it's a good fit for your needs.

Tell me a bit about what you're trying to solve, and we can explore it together. What's driving your interest in this area?`;
  }

  // New products — use data-module best practices for fallback intros
  if (product === "Instana") {
    const bpItems = INSTANA_BEST_PRACTICES.slice(0, 3).map((bp) => `- **${bp.title}:** ${bp.body}`).join("\n");
    const qrItems = INSTANA_QUICK_REFERENCE.slice(0, 4).map((qr) => `- **${qr.term}:** ${qr.definition}`).join("\n");
    return `**IBM Instana Observability — Best Practices Overview**\n\n**Top questions to ask every customer:**\n- How many compute nodes (hosts/VMs/Kubernetes nodes) are in scope? *(each = 1 MVS — the billing unit)*\n- Cloud-hosted SaaS or self-hosted? *(self-hosted for regulated industries)*\n- Do they need synthetic monitoring (proactive endpoint testing) or Logs in Context?\n- Are they trying to act on observability data automatically? *(Turbonomic attach)*\n- Are they drowning in alerts without business-impact context? *(Concert attach)*\n\n**Key knowledge**\n${qrItems}\n\n**Discovery practices**\n${bpItems}\n\n---\nWhat specific scenario or area would you like to dig into?`;
  }

  if (product === "Turbonomic") {
    const bpItems = TURBONOMIC_BEST_PRACTICES.slice(0, 3).map((bp) => `- **${bp.title}:** ${bp.body}`).join("\n");
    const qrItems = TURBONOMIC_QUICK_REFERENCE.slice(0, 4).map((qr) => `- **${qr.term}:** ${qr.definition}`).join("\n");
    return `**IBM Turbonomic — Best Practices Overview**\n\n**Top questions to ask every customer:**\n- What is the primary pain: cloud cost waste, performance incidents, or manual ops toil?\n- What is the environment size (VMs, nodes) and where is it hosted? *(MVS count = billing unit)*\n- Do they know their annual cloud spend? *(Essentials: $50K/instance/yr, 1 instance per $2M spend)*\n- Do they use Kubernetes/OpenShift? *(strong Turbonomic differentiation)*\n- Do they have IBM Instana? *(with Instana: application-aware optimization vs infrastructure-only)*\n\n**Confirmed pricing (July 2026):**\n- D11Q7ZX: **$23.50/MVS/month** list · D11Q8ZX: $28.20/MVS/month (overage)\n- Essentials: **$50,000/instance/year** (1 instance = up to $2M annual cloud spend)\n- Services: D0G8DZX $9,700 · D08YVZX $40,560 · D08YYZX $9,700\n\n**Key knowledge**\n${qrItems}\n\n**Discovery practices**\n${bpItems}\n\n---\nWhat specific scenario or area would you like to dig into?`;
  }

  if (product === "Terraform") {
    const bpItems = TERRAFORM_BEST_PRACTICES.slice(0, 3).map((bp) => `- **${bp.title}:** ${bp.body}`).join("\n");
    const qrItems = TERRAFORM_QUICK_REFERENCE.slice(0, 4).map((qr) => `- **${qr.term}:** ${qr.definition}`).join("\n");
    return `**IBM HashiCorp Terraform — Best Practices Overview**\n\n**Top questions to ask every customer:**\n- Are they using open-source Terraform OSS today? *(upgrade conversation)*\n- How many managed resources are in scope? *(< 500 → Free tier PoC)*\n- Do they need policy-as-code enforcement (Sentinel)? *(Standard+ trigger)*\n- Where do credentials for provisioned infrastructure end up? *(static secrets = Vault cross-sell)*\n- Is this for a single team or a company-wide platform team? *(multi-team → Standard+)*\n\n**Key knowledge**\n${qrItems}\n\n**Discovery practices**\n${bpItems}\n\n---\nWhat specific scenario or area would you like to dig into?`;
  }

  if (product === "Concert") {
    const bpItems = CONCERT_BEST_PRACTICES.slice(0, 3).map((bp) => `- **${bp.title}:** ${bp.body}`).join("\n");
    const qrItems = CONCERT_QUICK_REFERENCE.slice(0, 4).map((qr) => `- **${qr.term}:** ${qr.definition}`).join("\n");
    return `**IBM Concert — Best Practices Overview**\n\n**Top questions to ask every customer:**\n- What is the primary pain: alert fatigue, cloud cost waste, risky deployments, security risk, or ops toil?\n- How many applications does the ITOps team support? *(more apps = more Concert value)*\n- What observability and monitoring tools do they use today? *(Instana = richer AI context)*\n- Are they ready for AI-automated remediation, or recommendations only?\n- What ITSM tools are in play (ServiceNow, Jira)? *(Concert integrates with both)*\n\n**Key knowledge**\n${qrItems}\n\n**Discovery practices**\n${bpItems}\n\n---\nWhat specific scenario or area would you like to dig into?`;
  }

  if (product === "webMethods") {
    const bpItems = WEBMETHODS_BEST_PRACTICES.slice(0, 3).map((bp) => `- **${bp.title}:** ${bp.body}`).join("\n");
    const qrItems = WEBMETHODS_QUICK_REFERENCE.slice(0, 4).map((qr) => `- **${qr.term}:** ${qr.definition}`).join("\n");
    return `**IBM webMethods Integration — Best Practices Overview**\n\n**Top questions to ask every customer:**\n- What are they trying to connect and why? (App-to-app, EDI/B2B, APIs, event-driven?)\n- Are there data-sovereignty, compliance, or air-gapped requirements? *(on-prem/hybrid)*\n- What integration tools do they use today? (MuleSoft, Boomi = migration opportunity)\n- How are published APIs currently secured? *(static keys = Verify cross-sell trigger)*\n- Is their industry healthcare, financial services, or manufacturing? *(specialized standards)*\n\n**Key knowledge**\n${qrItems}\n\n**Discovery practices**\n${bpItems}\n\n---\nWhat specific scenario or area would you like to dig into?`;
  }

  if (product === "Verify") {
    return `**IBM Security Verify — Best Practices Overview**

**Top questions to ask every customer:**
- How many total users need access, and how often do they log in? *(determines MAU — the pricing driver)*
- Which capabilities do they need: SSO, MFA, Adaptive Access, Lifecycle?
- Do they need to manage user accounts (provisioning/deprovisioning)? *(Lifecycle requires Managed User count)*
- Do they need SMS/email MFA, legacy app integration, or custom branded login?
- Is device posture, endpoint compliance, or zero trust part of the access story? *(this is the trigger for the MaaS360 attach)*

**Common mistakes to avoid:**
- Using raw headcount as MAU — login frequency matters (yearly login count ÷ 12, capped at 1×)
- Not asking about Managed Users when Lifecycle is selected
- Missing the Hosted Application Gateway for legacy apps
- Missing the MaaS360 attach when the customer is really asking for device trust as part of access policy

**Quick example:**
10,000 employees who log in daily → MAU = 10,000. SSO + MFA → ~180 RU → ~$180k/year list.
If adaptive access is also in scope, validate whether managed-device posture and endpoint trust should be attached through MaaS360.

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
  if (product === "MaaS360") {
    return `**IBM MaaS360 — Best Practices Overview**

**Top questions to ask every customer:**
- How many devices are in scope today, and what mix is mobile vs laptop/desktop?
- Are the devices corporate-owned, BYOD, shared, or a mix?
- Is the main driver onboarding, policy/compliance, app delivery, remote support, or endpoint security?
- Do they need add-ons like Mobile Threat Defense Advanced, TeamViewer Remote Support, or Concierge setup?
- Do they also need SSO, MFA, adaptive access, or lifecycle controls for the same workforce? *(this is the trigger for the Verify attach)*
- Is this a quick budgetary estimate or a formal enterprise pricing exercise?

**Common mistakes to avoid:**
- Recommending a plan before understanding the device mix and operating model
- Treating public-price guidance like a formal custom quote
- Missing adjacent Verify opportunities when the customer is really talking about device trust and zero trust access
- Adding services or security options without tying them to a specific customer need

**Quick example:**
2,000 mixed corporate devices with stronger security and operational needs → start discovery in Deluxe/Premier territory, then validate whether threat defense or remote support should be added.
If they also want conditional access or a cleaner workforce login experience, attach Verify for SSO, MFA, and possibly Adaptive.

---
What specific scenario or area would you like to dig into?`;
  }
  return `**IBM HashiCorp Vault — Best Practices Overview**

**Top questions to ask every customer:**
- Is this a new deployment or a renewal? How stable/predictable is their workload? *(determines Model A vs B)*
- What types of secrets do they manage: static secrets, dynamic credentials, PKI certs, SSH, encryption?
- How many unique applications or services will connect to Vault? *(Model B client count)*
- Do they need disaster recovery or multi-region? *(Premium edition, ≥2 installs)*
- Do they need to issue TLS certificates (PKI) or encrypt database data (KMIP/Transform)?
- Are human identities and machine identities governed separately today? *(this is the trigger for the Verify attach)*

**Common mistakes to avoid:**
- Mixing Model A and Model B for the same customer (not allowed — pick one)
- Counting container instances instead of unique services (client count for Model B)
- Choosing Premium without ordering ≥2 installs (DR/replication requires it)
- Forgetting non-production environments in the quote
- Missing the Verify attach when the customer still has fragmented workforce SSO, MFA, or identity governance

**Quick example:**
50 microservices, predictable workload, Standard edition → Model B: 50 clients × 2 installs (prod + non-prod).
If the same client also manages employees, admins, and service accounts in separate silos, attach Verify for unified human identity modernization.

---
What specific scenario or area would you like to dig into?`;
}
