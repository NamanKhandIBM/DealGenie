/**
 * Terraform estimation engine — HCP Terraform sizing and scoping.
 *
 * Confirmed IBM pricing (IBM HashiCorp Product Pricing Guidance, Jun 18, 2026):
 *   PID: 5900BJ7
 *   D100DZX  Standard  $51,600/year at 10,000 RUM
 *   D11GDZX  Premium   $108,000/year at 10,000 RUM
 *   Both use graduated tiers — per-RUM rate decreases at higher volumes.
 *   Simple per-RUM rates (derived from 10K reference):
 *     Standard: $5.16/RUM/year
 *     Premium:  $10.80/RUM/year
 *
 *   Free: up to 500 RUM, no IBM part number.
 *   Terraform Enterprise (self-hosted): contact IBM for pricing.
 *
 * NOTE: Pricing is linear from the 10K reference until full graduated tier table
 * is confirmed. Flag estimates as budgetary references.
 */
import {
  TERRAFORM_HCP_PLANS,
  TERRAFORM_ENTERPRISE_SUMMARY,
  TERRAFORM_BEST_PRACTICES,
  TERRAFORM_QUICK_REFERENCE,
  TERRAFORM_PER_RUM_ANNUAL,
  type TerraformEdition,
  type TerraformDeployment,
} from "./terraform-data";

export interface TerraformInputs {
  deployment: TerraformDeployment;
  estimatedManagedResources: number;   // RUM count
  teamSize: number;
  needsGovernance?: boolean;
  needsAuditLog?: boolean;
  needsAirGap?: boolean;
  vaultAlreadyOwned?: boolean;
  workspaceCount?: number;
}

export interface TerraformLineItem {
  part: string;
  description: string;
  quantity: number;
  annualList: number;
  notes: string;
}

export interface TerraformRecommendationResult {
  recommendedEdition: TerraformEdition;
  deployment: TerraformDeployment;
  editionLabel: string;
  estimatedManagedResources: number;
  workspaceCount: number;
  lines: TerraformLineItem[];
  totalAnnualList: number;
  rationale: string[];
  keyFeatures: string[];
  vaultNote?: string;
  nextStep: string;
  flags: string[];
  bestPractices: typeof TERRAFORM_BEST_PRACTICES;
  quickReference: typeof TERRAFORM_QUICK_REFERENCE;
}

function recommendEdition(inputs: TerraformInputs): TerraformEdition {
  if (inputs.needsAirGap)    return "Premium"; // Enterprise actually, but closest HCP
  if (inputs.needsAuditLog)  return "Premium";
  if (inputs.needsGovernance || inputs.teamSize >= 10) return "Standard";
  if (inputs.estimatedManagedResources > 500 || inputs.teamSize >= 5) return "Standard";
  return "Free";
}

export function computeTerraformRecommendation(inputs: TerraformInputs): TerraformRecommendationResult {
  const flags: string[] = [];
  const lines: TerraformLineItem[] = [];

  const deploymentActual: TerraformDeployment = inputs.needsAirGap ? "Enterprise" : inputs.deployment;
  if (inputs.needsAirGap) {
    flags.push("Air-gapped or data-residency requirement — Terraform Enterprise (self-hosted) is required, not HCP Terraform. Engage IBM for pricing.");
  }

  const recommendedEdition = recommendEdition(inputs);
  const plan = TERRAFORM_HCP_PLANS.find((p) => p.edition === recommendedEdition) ?? TERRAFORM_HCP_PLANS[0];
  const workspaceCount = inputs.workspaceCount ?? Math.max(1, Math.ceil(inputs.estimatedManagedResources / 50));
  const rum = inputs.estimatedManagedResources;

  // ── Build line items ───────────────────────────────────────────────────────
  if (deploymentActual === "HCP" && recommendedEdition !== "Free") {
    const perRum = recommendedEdition === "Premium"
      ? TERRAFORM_PER_RUM_ANNUAL.premium
      : TERRAFORM_PER_RUM_ANNUAL.standard;
    const part = recommendedEdition === "Premium" ? "D11GDZX" : "D100DZX";
    const annual = Math.round(rum * perRum * 100) / 100;

    lines.push({
      part,
      description: `HCP Terraform ${recommendedEdition} (IBM PID 5900BJ7)`,
      quantity: rum,
      annualList: annual,
      notes: `$${perRum.toFixed(2)}/RUM/year list (derived from $${recommendedEdition === "Premium" ? "108,000" : "51,600"}/yr at 10K RUM reference). Graduated tiers apply — larger volumes may cost less per RUM.`,
    });

    flags.push(`Reference price: $${recommendedEdition === "Premium" ? "108,000" : "51,600"}/yr at 10,000 RUM. Graduated pricing — confirm actual tier with IBM for ${rum.toLocaleString()} RUM.`);
    flags.push("List-price estimate — standard IBM discounting applies. Engage IBM for a formal CPQ quote.");
  }

  // ── Rationale ─────────────────────────────────────────────────────────────
  const rationale: string[] = [];
  if (rum <= 500 && recommendedEdition === "Free") {
    rationale.push(`${rum} RUM is within the 500-RUM Free plan limit — no purchase required.`);
  }
  if (rum > 500) {
    rationale.push(`${rum.toLocaleString()} RUM exceeds the 500-RUM Free limit — ${recommendedEdition} (${plan.part}) required.`);
  }
  if (inputs.teamSize >= 10) {
    rationale.push(`${inputs.teamSize}-person team warrants ${recommendedEdition} for advanced team permissions and governance.`);
  }
  if (inputs.needsGovernance) {
    rationale.push("Policy-as-code (Sentinel/OPA) governance → Standard or Premium.");
  }
  if (inputs.needsAuditLog) {
    rationale.push("Audit logging requirement → Premium (D11GDZX).");
  }

  const keyFeatures = plan.includes.slice();
  if (deploymentActual === "Enterprise") {
    keyFeatures.push("Terraform Enterprise: self-hosted, air-gapped capable, all Premium features plus enterprise-only capabilities.");
  }

  // ── Vault cross-sell note ──────────────────────────────────────────────────
  let vaultNote: string | undefined;
  if (inputs.vaultAlreadyOwned) {
    vaultNote =
      "**Vault is already in scope.** Highlight the Vault secrets integration: Terraform dynamically pulls credentials from Vault during provisioning runs, eliminating static secrets in state files. This is IBM's flagship ILM+SLM story.";
    flags.push("Vault owned: emphasize Terraform + Vault secrets injection — eliminates static credentials in state files.");
  } else {
    vaultNote =
      "**Cross-sell: IBM HashiCorp Vault.** Terraform provisions infrastructure; Vault secures the secrets it needs. Ask: 'Where are your Terraform credentials and API keys stored today?' Type **cross-sell** to explore the Vault attach.";
  }

  // ── Next step ──────────────────────────────────────────────────────────────
  const nextStep = deploymentActual === "Enterprise"
    ? "Engage IBM for a Terraform Enterprise self-hosted deployment discussion and custom pricing."
    : recommendedEdition === "Free"
      ? "Start with HCP Terraform Free (up to 500 RUM) — no purchase needed. Upgrade to Standard/Premium when scale grows."
      : `Engage IBM for HCP Terraform ${recommendedEdition} (${plan.part}) pricing for ${rum.toLocaleString()} RUM. Reference: $${recommendedEdition === "Premium" ? "108,000" : "51,600"}/yr at 10K RUM.`;

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalAnnualList = lines.reduce((s, l) => s + l.annualList, 0);

  return {
    recommendedEdition,
    deployment: deploymentActual,
    editionLabel: deploymentActual === "Enterprise"
      ? "Terraform Enterprise (self-hosted)"
      : plan.label,
    estimatedManagedResources: rum,
    workspaceCount,
    lines,
    totalAnnualList: Math.round(totalAnnualList * 100) / 100,
    rationale,
    keyFeatures,
    vaultNote,
    nextStep,
    flags,
    bestPractices: TERRAFORM_BEST_PRACTICES,
    quickReference: TERRAFORM_QUICK_REFERENCE,
  };
}
