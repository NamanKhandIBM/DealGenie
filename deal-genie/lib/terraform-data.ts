/**
 * IBM HashiCorp Terraform — data module
 *
 * HCP Terraform (HashiCorp Cloud Platform Terraform) is the SaaS offering.
 * Terraform Enterprise is the self-hosted equivalent for large enterprises.
 *
 * IBM PID: 5900BJ7 (GA'd June 2026 per "IBM HashiCorp Product Pricing Guidance", Jun 18, 2026)
 *
 * IBM GA'd parts (SaaS — HCP Terraform):
 *   D100DZX  Terraform Standard  — equates to HCP Terraform "Plus" tier
 *   D11GDZX  Terraform Premium   — enterprise governance, audit, compliance
 *
 *   Both priced by RUM (Resource Under Management) volume with graduated tiers.
 *   List price = $5.16/RUM/year (Standard) or $10.80/RUM/year (Premium) — flat rate,
 *   with a graduated DISCOUNT schedule applied on top (see TERRAFORM_RUM_TIERS).
 *
 *   Graduated discount table (source: IBM HashiCorp Product Pricing Guidance):
 *     Standard (D100DZX):
 *       10,000 RUM → 11% off → $46,064 net
 *       25,000 RUM → 19% off → $104,834 net
 *       50,000 RUM → 26% off → $190,051 net
 *      100,000 RUM → 34% off → $340,469 net
 *      250,000 RUM → 42% off → $751,892 net
 *      500,000 RUM → 48% off → $1,332,181 net
 *     Premium (D11GDZX):
 *       10,000 RUM → 17% off → $89,220 net
 *       25,000 RUM → 26% off → $199,954 net
 *       50,000 RUM → 34% off → $357,945 net
 *      100,000 RUM → 40% off → $642,666 net
 *      250,000 RUM → 48% off → $1,398,445 net
 *      500,000 RUM → 54% off → $2,493,828 net
 *
 *   RUM = 1 managed resource (any Terraform-managed cloud/infra object)
 *   Free tier: up to 500 RUM, no IBM part number needed.
 *   No separate IBM "Essentials" SKU — it maps to HCP Free → Standard range.
 *
 *   Terraform Enterprise (self-hosted): contact IBM for pricing.
 *
 * IBM positioning:
 *  IBM sells HashiCorp Terraform as part of the HashiCorp portfolio acquired in 2024.
 *  The IBM go-to-market story is "Infrastructure Lifecycle Management (ILM)" —
 *  Terraform + Vault together deliver ILM (provision) + SLM (secure).
 *
 * Key cross-sell: Terraform ↔ Vault
 *  Terraform provisions infrastructure; Vault secures the secrets, credentials, and
 *  certificates that provisioned infrastructure requires. Together they close the loop
 *  on secure-by-default infrastructure automation.
 */

// ─── Editions ─────────────────────────────────────────────────────────────────

export type TerraformEdition = "Free" | "Standard" | "Premium";
export type TerraformDeployment = "HCP" | "Enterprise";

export interface TerraformPlan {
  edition: TerraformEdition;
  label: string;
  part: string;
  pricing: string;
  managedResourceLimit: string;
  summary: string;
  includes: string[];
}

export const TERRAFORM_HCP_PLANS: TerraformPlan[] = [
  {
    edition: "Free",
    label: "HCP Terraform Free",
    part: "—",
    pricing: "Free — up to 500 RUM",
    managedResourceLimit: "500 RUM",
    summary: "Suitable for small teams and PoC — covers most HCP Terraform features.",
    includes: [
      "Remote state storage",
      "Remote Terraform execution",
      "VCS integration (GitHub, GitLab, Bitbucket)",
      "Private module registry",
      "Single sign-on",
      "Policy enforcement (1 policy set, up to 5 policies)",
      "Run tasks",
      "Up to 500 managed resources",
    ],
  },
  {
    edition: "Standard",
    label: "HCP Terraform Standard",
    part: "D100DZX",
    pricing: "$51,600/year at 10,000 RUM (graduated tiers — lower rate as RUM grows)",
    managedResourceLimit: "Unlimited",
    summary: "Advanced governance and collaboration for platform/SRE teams. Equates to HCP Terraform 'Plus'.",
    includes: [
      "All Free features",
      "Unlimited managed resources",
      "Project-level team permissions",
      "Advanced team management and access controls",
      "Policy set version control integration",
      "Cost estimation",
      "Expanded policy enforcement (Sentinel/OPA)",
    ],
  },
  {
    edition: "Premium",
    label: "HCP Terraform Premium",
    part: "D11GDZX",
    pricing: "$108,000/year at 10,000 RUM (graduated tiers — lower rate as RUM grows)",
    managedResourceLimit: "Unlimited",
    summary: "Enterprise-grade governance with full audit, compliance, and enterprise SLAs.",
    includes: [
      "All Standard features",
      "Audit logging",
      "Audit bundle",
      "Full enterprise governance controls",
      "Business critical SLAs",
      "Dedicated support",
    ],
  },
];

// ─── Pricing tiers (graduated discount on flat per-RUM list rate) ─────────────
// Reference: IBM HashiCorp Product Pricing Guidance, Jun 18, 2026
// List rate: Standard $5.16/RUM/year, Premium $10.80/RUM/year.
// Discount schedule below yields the confirmed NET annual price at each tier.

export interface TerraformRUMTier {
  minRUM: number;
  maxRUM: number | null;
  discountPct: number;  // % discount applied to list
  standardNet: number;  // D100DZX net annual price at this tier
  premiumNet: number;   // D11GDZX net annual price at this tier
}

/** Full graduated discount table (source: IBM HashiCorp Product Pricing Guidance).
 *  Linear interpolation between tier break-points is used for intermediate volumes. */
export const TERRAFORM_RUM_TIERS: TerraformRUMTier[] = [
  { minRUM:      1, maxRUM:   9999, discountPct:  0, standardNet: 0,         premiumNet: 0         }, // placeholder — no confirmed net below 10K
  { minRUM:  10000, maxRUM:  24999, discountPct: 11, standardNet:  46064,    premiumNet:  89220    },
  { minRUM:  25000, maxRUM:  49999, discountPct: 19, standardNet: 104834,    premiumNet: 199954    },
  { minRUM:  50000, maxRUM:  99999, discountPct: 26, standardNet: 190051,    premiumNet: 357945    },
  { minRUM: 100000, maxRUM: 249999, discountPct: 34, standardNet: 340469,    premiumNet: 642666    },
  { minRUM: 250000, maxRUM: 499999, discountPct: 42, standardNet: 751892,    premiumNet: 1398445   },
  { minRUM: 500000, maxRUM: null,   discountPct: 48, standardNet: 1332181,   premiumNet: 2493828   },
];

// Flat list rates (before tier discounts)
export const TERRAFORM_PER_RUM_ANNUAL = {
  standard: 5.16,   // $5.16/RUM/year list — D100DZX
  premium:  10.80,  // $10.80/RUM/year list — D11GDZX
};

/** Look up the confirmed net price for a given RUM count.
 *  Returns the net for the matching tier, or null if below 10K (no confirmed data). */
export function terraformNetPrice(rum: number, edition: "standard" | "premium"): number | null {
  const tier = [...TERRAFORM_RUM_TIERS].reverse().find((t) => rum >= t.minRUM);
  if (!tier || tier.minRUM < 10000) return null; // below confirmed range
  // Interpolate linearly between this tier's break-point and the next
  const tierIdx = TERRAFORM_RUM_TIERS.indexOf(tier);
  const nextTier = TERRAFORM_RUM_TIERS[tierIdx + 1];
  const baseNet = edition === "premium" ? tier.premiumNet : tier.standardNet;
  if (!nextTier || nextTier.minRUM === undefined) return baseNet; // top tier
  const nextNet = edition === "premium" ? nextTier.premiumNet : nextTier.standardNet;
  const fraction = (rum - tier.minRUM) / (nextTier.minRUM - tier.minRUM);
  return Math.round(baseNet + fraction * (nextNet - baseNet));
}

// ─── SCS Discount Authorization Matrix ───────────────────────────────────────
// Source: "HashiCorp SCS Update – 14 June 2026" — NEW IBM Lifecycle Automation
//         SaaS Committed Spend (SCS) Discount Approval Matrix.
// Supersedes the Jul 2025 "HashiCorp Tactical SCS Quoting in PA Guide."
// Scoped to HashiCorp Tactical SCS committed-spend deals (the standard vehicle
// for Terraform and Vault commercial sales).
//
//   ≤10%  discount → no approval needed (seller can proceed)
//   10–40% discount → Sales Theater VP approval required
//   >40%  discount → Deal Management / CRO approval
//                    (Jack Huber; backup: Freddy Vaquero)

export interface TerraformDiscountTier {
  maxPct: number;
  label: string;
  approver: string;
}

export const TERRAFORM_SCS_DISCOUNT_MATRIX: TerraformDiscountTier[] = [
  { maxPct: 10,  label: "No approval required",           approver: "Seller self-approve" },
  { maxPct: 40,  label: "Sales Theater VP approval",      approver: "Sales Theater VP" },
  { maxPct: 100, label: "Deal Management / CRO approval", approver: "Jack Huber (backup: Freddy Vaquero)" },
];

/** Returns the approval tier for a given additional discount percentage (on top of IBM tier pricing).
 *  @param additionalDiscountPct — the % additional discount being requested (0–100) */
export function getTerraformDiscountApproval(additionalDiscountPct: number): TerraformDiscountTier {
  return TERRAFORM_SCS_DISCOUNT_MATRIX.find((t) => additionalDiscountPct <= t.maxPct)
    ?? TERRAFORM_SCS_DISCOUNT_MATRIX[TERRAFORM_SCS_DISCOUNT_MATRIX.length - 1];
}

/** Pre-formatted one-liner for result cards and flags */
export const TERRAFORM_DISCOUNT_AUTHORIZATION_NOTE =
  "Discount authorization (HashiCorp SCS Update, 14 Jun 2026 — supersedes Jul 2025 guide): " +
  "≤10% → no approval · 10–40% → Sales Theater VP · >40% → Deal Management/CRO " +
  "(Jack Huber; backup: Freddy Vaquero). Scoped to HashiCorp Tactical SCS committed-spend deals.";

// Backward-compat alias
export const TERRAFORM_RUM_REFERENCE_ANNUAL = {
  standard: { rums: 10000, annualList: 46064 },   // D100DZX — net at 10K
  premium:  { rums: 10000, annualList: 89220 },   // D11GDZX — net at 10K
};

export const TERRAFORM_ENTERPRISE_SUMMARY = `
Terraform Enterprise is the self-hosted version of HCP Terraform for large organizations
requiring on-premises deployment, air-gapped environments, or full data control.
It includes all HCP Terraform Premium features plus enterprise-only capabilities.
Pricing is per deployment — contact IBM for licensing.
`.trim();

// ─── Seller value story: Terraform + Vault cross-sell ────────────────────────
export const TERRAFORM_VAULT_VALUE_POINTS = [
  "Terraform provisions infrastructure; Vault ensures the secrets and credentials that infrastructure needs are securely managed, rotated, and never hard-coded.",
  "Without Vault, Terraform configurations often leak credentials as static secrets in state files or CI/CD pipelines. With Vault's dynamic secrets engine, those credentials are ephemeral and automatically rotated.",
  "The IBM positioning story is 'Infrastructure Lifecycle Management + Security Lifecycle Management' — Terraform handles the provisioning workflow, Vault handles the secrets and identity trust layer.",
];

// ─── Best practices snippets ─────────────────────────────────────────────────
export const TERRAFORM_BEST_PRACTICES = [
  {
    title: "Use HCP Free as the trial hook, sell Standard/Premium by RUM volume",
    body: "HCP Terraform Free covers up to 500 RUM at no cost. IBM's paid parts (D100DZX Standard, D11GDZX Premium) are priced at $5.16/$10.80 per RUM/year (list) with a graduated discount schedule: at 10K RUM Standard nets $46,064 (11% off list), Premium $89,220 (17% off). Discounts deepen at higher volumes — 48%/54% at 500K RUM.",
  },
  {
    title: "Terraform + Vault is the flagship IBM ILM/SLM story",
    body: "IBM's primary go-to-market for HashiCorp is the combined Infrastructure Lifecycle Management (Terraform) + Security Lifecycle Management (Vault) story. Lead with both in the same conversation.",
  },
  {
    title: "Identify secrets in Terraform state as a cross-sell trigger",
    body: "Ask: 'Do you currently store credentials, API keys, or database passwords in Terraform state files or CI/CD pipelines?' If yes, Vault's dynamic secrets and secrets injection solve that exact problem.",
  },
  {
    title: "Standard vs Premium: audit logging is the premium trigger",
    body: "Most platform/SRE teams need Standard (D100DZX). Upgrade to Premium (D11GDZX) when the customer needs audit logging, audit bundle, or business-critical SLAs — common in financial services, healthcare, and government.",
  },
  {
    title: "Terraform Enterprise for regulated or air-gapped environments",
    body: "Recommend Terraform Enterprise over HCP for financial services, government, or healthcare customers who cannot route Terraform runs through IBM cloud infrastructure. Contact IBM for pricing.",
  },
];

export const TERRAFORM_QUICK_REFERENCE = [
  { term: "HCP Terraform", definition: "HashiCorp Cloud Platform Terraform — IBM-hosted SaaS Terraform (PID 5900BJ7)." },
  { term: "RUM", definition: "Resource Under Management — the billing unit. 1 RUM = 1 Terraform-managed resource (VM, bucket, DB, etc.)." },
  { term: "D100DZX", definition: "Terraform Standard SaaS — $5.16/RUM/year list with graduated discounts. Net at 10K RUM: $46,064 (11% off). 500K RUM: $1,332,181 (48% off)." },
  { term: "D11GDZX", definition: "Terraform Premium SaaS — $10.80/RUM/year list with graduated discounts. Net at 10K RUM: $89,220 (17% off). 500K RUM: $2,493,828 (54% off)." },
  { term: "Graduated discount", definition: "Both Terraform tiers use a volume-discount schedule — the same flat per-RUM rate applies at all volumes, but a larger % discount is layered on top as RUM count grows." },
  { term: "SCS discount approval", definition: "HashiCorp Tactical SCS (Jun 2026): ≤10% no approval · 10–40% Sales Theater VP · >40% Deal Mgmt/CRO (Jack Huber; backup Freddy Vaquero)." },
  { term: "ILM", definition: "Infrastructure Lifecycle Management — IBM's term for the Terraform-centered provisioning story." },
  { term: "SLM", definition: "Security Lifecycle Management — IBM's term for the Vault-centered secrets/identity story." },
  { term: "Terraform Enterprise", definition: "Self-hosted Terraform for air-gapped or on-prem environments — contact IBM for pricing." },
];
