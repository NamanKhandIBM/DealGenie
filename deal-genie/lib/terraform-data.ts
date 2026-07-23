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
 *   Reference list prices at 10,000 RUM:
 *     Standard (D100DZX):  $51,600/year
 *     Premium  (D11GDZX): $108,000/year
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

// ─── Pricing tiers (graduated — lower per-RUM rate at higher volumes) ─────────
// Reference: IBM HashiCorp Product Pricing Guidance, Jun 18, 2026
// These are list prices; standard IBM discounting applies.

export interface TerraformRUMTier {
  minRUM: number;
  maxRUM: number | null;
  standardAnnual: number;   // D100DZX annual list at this tier
  premiumAnnual: number;    // D11GDZX annual list at this tier
}

/** Known reference point — graduated tier structure with 10K RUM as anchor.
 *  Linear interpolation used for other volumes until full tier table confirmed. */
export const TERRAFORM_RUM_REFERENCE_ANNUAL = {
  standard: { rums: 10000, annualList: 51600 },   // D100DZX
  premium:  { rums: 10000, annualList: 108000 },  // D11GDZX
};

// Simple per-RUM rate derived from 10K reference (used for estimates at other volumes)
export const TERRAFORM_PER_RUM_ANNUAL = {
  standard: 51600 / 10000,  // $5.16/RUM/year list
  premium:  108000 / 10000, // $10.80/RUM/year list
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
    body: "HCP Terraform Free covers up to 500 RUM at no cost. IBM's paid parts (D100DZX Standard, D11GDZX Premium) are priced per RUM/year — reference price at 10K RUM: Standard $51,600/yr, Premium $108,000/yr. Graduated tiers mean larger customers pay less per RUM.",
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
  { term: "D100DZX", definition: "Terraform Standard SaaS — $51,600/year at 10K RUM list. Advanced governance and team management." },
  { term: "D11GDZX", definition: "Terraform Premium SaaS — $108,000/year at 10K RUM list. Audit logging, compliance, enterprise SLAs." },
  { term: "ILM", definition: "Infrastructure Lifecycle Management — IBM's term for the Terraform-centered provisioning story." },
  { term: "SLM", definition: "Security Lifecycle Management — IBM's term for the Vault-centered secrets/identity story." },
  { term: "Terraform Enterprise", definition: "Self-hosted Terraform for air-gapped or on-prem environments — contact IBM for pricing." },
];
