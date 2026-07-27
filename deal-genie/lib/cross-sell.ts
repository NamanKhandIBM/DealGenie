import type { Product } from "./types";
import { VERIFY_MAAS360_VALUE_POINTS } from "./maas360-data";
import {
  INSTANA_TURBONOMIC_VALUE_POINTS,
  INSTANA_CONCERT_VALUE_POINTS,
} from "./instana-data";
import { TERRAFORM_VAULT_VALUE_POINTS } from "./terraform-data";
import { TURBONOMIC_INSTANA_VALUE_POINTS } from "./turbonomic-data";
import { CONCERT_INSTANA_VALUE_POINTS } from "./concert-data";
import { WEBMETHODS_VERIFY_VALUE_POINTS } from "./webmethods-data";

const VAULT_VERIFY_VALUE_POINTS = [
  "Pairs human identity controls with workload and secrets controls in the same security conversation.",
  "Helps security teams connect workforce access policy with privileged and machine-level access boundaries.",
  "Creates a stronger zero-trust and governance story when customers must secure both people and non-human identities.",
];

const VAULT_TERRAFORM_VALUE_POINTS = [
  "Terraform provisions the infrastructure; Vault secures the secrets and credentials that infrastructure requires — no more static credentials in state files or CI/CD pipelines.",
  "IBM's flagship ILM+SLM story: Infrastructure Lifecycle Management (Terraform) and Security Lifecycle Management (Vault) delivered together as a complete automation and security platform.",
  "Customers buying Vault for secrets management almost always have a Terraform-driven infrastructure team that is the primary source of secrets sprawl.",
];

const VERIFY_WEBMETHODS_VALUE_POINTS = [
  "webMethods exposes APIs and integration endpoints; Verify provides the OAuth 2.0/OIDC identity and adaptive access layer that governs who can call those endpoints.",
  "Customers modernizing integration with webMethods often leave API access ungoverned — Verify closes that gap with identity-aware API security and lifecycle governance.",
  "The combined story is 'governed integration fabric': webMethods for secure connectivity, Verify for identity and access control.",
];

export interface CrossSellPlay {
  id: string;
  source: Product;
  target: Product;
  title: string;
  shortReason: string;
  businessProblem: string;
  inFlowMessage: string;
  resultMessage: string;
  valuePoints: string[];
}

export interface CrossSellRecommendation {
  target: Product;
  headline: string;
  rationale: string;
  evidence: string[];
}

export interface VerifyAttachDecision {
  target: "MaaS360" | "Vault";
  recommendation: CrossSellRecommendation;
}

export const CROSS_SELL_PLAYS: CrossSellPlay[] = [
  {
    id: "verify-to-maas360",
    source: "Verify",
    target: "MaaS360",
    title: "Zero Trust Foundation",
    shortReason: "Identity policies are stronger when device posture is part of the trust decision.",
    businessProblem: "Access policy may not know whether the device is managed, compliant, or risky.",
    inFlowMessage:
      "This sounds like a strong **Verify + MaaS360** fit. If the client wants access policy to account for device posture, MaaS360 can close that endpoint-trust gap.",
    resultMessage:
      "**Cross-sell recommendation: IBM MaaS360**\n\nYou already sized the identity side with Verify. The next highest-value motion is MaaS360 so the client can pair user trust with device trust for a stronger zero-trust story.",
    valuePoints: VERIFY_MAAS360_VALUE_POINTS,
  },
  {
    id: "maas360-to-verify",
    source: "MaaS360",
    target: "Verify",
    title: "Device Trust to Identity Trust",
    shortReason: "Managed-device posture becomes more valuable when it can influence access policy.",
    businessProblem: "Endpoint compliance does not automatically strengthen authentication and authorization decisions.",
    inFlowMessage:
      "This could also become a **MaaS360 + Verify** motion if the client needs device trust to feed identity policy and conditional access.",
    resultMessage:
      "**Cross-sell recommendation: IBM Security Verify**\n\nYou already framed the endpoint side with MaaS360. Verify adds identity-aware access policy so the client can connect user trust with device posture.",
    valuePoints: VERIFY_MAAS360_VALUE_POINTS,
  },
  {
    id: "verify-to-vault",
    source: "Verify",
    target: "Vault",
    title: "Human Identity to Secrets and Workload Trust",
    shortReason: "Strong workforce identity programs often expose the next control gap around secrets, machine identities, and privileged workload access.",
    businessProblem: "The organization may have modernized workforce access but still relies on manual, static, or weakly governed secrets for applications and infrastructure.",
    inFlowMessage:
      "This could also become a **Verify + Vault** motion if the client needs stronger control over secrets, machine identities, or privileged application access beyond workforce authentication.",
    resultMessage:
      "**Cross-sell recommendation: IBM HashiCorp Vault**\n\nYou already framed the workforce identity side with Verify. Vault is the best adjacent motion when the customer also needs to secure application secrets, privileged credentials, certificates, or machine-to-machine trust.",
    valuePoints: VAULT_VERIFY_VALUE_POINTS,
  },
  {
    id: "vault-to-verify",
    source: "Vault",
    target: "Verify",
    title: "Secrets Security to Workforce Identity Modernization",
    shortReason: "Secrets and workload controls become more valuable when the same customer also modernizes human access, MFA, and governance.",
    businessProblem: "The organization may be securing applications and infrastructure but still lacks consistent workforce access controls, adaptive authentication, or lifecycle governance.",
    inFlowMessage:
      "This could also become a **Vault + Verify** motion if the client needs to connect secrets security with workforce access modernization, MFA, or adaptive policy.",
    resultMessage:
      "**Cross-sell recommendation: IBM Security Verify**\n\nYou already positioned Vault around secrets and workload trust. Verify is the strongest adjacent motion when the same client also needs to modernize human authentication, SSO, or lifecycle governance.",
    valuePoints: VAULT_VERIFY_VALUE_POINTS,
  },

  // ── NEW CROSS-PLAYS ────────────────────────────────────────────────────────

  // Turbonomic ↔ Instana
  {
    id: "turbonomic-to-instana",
    source: "Turbonomic",
    target: "Instana",
    title: "Resource Optimization to Full-Stack Observability",
    shortReason: "Turbonomic's AI-driven resource actions become application-aware when Instana feeds real-time APM data into the optimization engine.",
    businessProblem: "Organizations optimizing resources without full-stack observability risk degrading application performance when taking automated cost-saving actions.",
    inFlowMessage:
      "This could also become a **Turbonomic + Instana** motion if the client needs application-aware resource optimization rather than infrastructure-only actions.",
    resultMessage:
      "**Cross-sell recommendation: IBM Instana Observability**\n\nYou already positioned Turbonomic for resource optimization. Instana is the strongest adjacent motion — it feeds Turbonomic's AI engine with real-time APM data so optimization decisions are application-aware, not just infrastructure-level.",
    valuePoints: TURBONOMIC_INSTANA_VALUE_POINTS,
  },
  {
    id: "instana-to-turbonomic",
    source: "Instana",
    target: "Turbonomic",
    title: "Observability to Intelligent Resource Automation",
    shortReason: "Instana provides the visibility; Turbonomic closes the loop by automating the resource actions that observability data suggests.",
    businessProblem: "Teams with rich observability data still act on it manually — analyzing dashboards and opening tickets rather than having resources auto-corrected before users feel the impact.",
    inFlowMessage:
      "This could also become an **Instana + Turbonomic** motion if the client wants to automate resource decisions based on the observability data rather than analyzing dashboards manually.",
    resultMessage:
      "**Cross-sell recommendation: IBM Turbonomic**\n\nYou already framed the observability story with Instana. Turbonomic is the best adjacent motion — it ingests Instana's APM data and automates resource optimization actions, turning visibility into autonomous operations.",
    valuePoints: INSTANA_TURBONOMIC_VALUE_POINTS,
  },

  // Instana ↔ Concert
  {
    id: "instana-to-concert",
    source: "Instana",
    target: "Concert",
    title: "Real-Time Observability to AI-Driven Operational Intelligence",
    shortReason: "Instana captures high-fidelity signals across the stack; Concert elevates those signals into business-impact-prioritized operational intelligence and automated remediation.",
    businessProblem: "Teams with strong observability still face alert fatigue and slow mean-time-to-resolution because they lack cross-domain context and business-impact prioritization.",
    inFlowMessage:
      "This could also become an **Instana + Concert** motion if the client wants to move beyond dashboards into AI-prioritized, automated operational intelligence.",
    resultMessage:
      "**Cross-sell recommendation: IBM Concert**\n\nYou already positioned Instana for observability. Concert is the strongest adjacent motion — it ingests Instana's telemetry alongside cost, risk, and change data to surface what matters and orchestrate remediation across teams and tools.",
    valuePoints: INSTANA_CONCERT_VALUE_POINTS,
  },
  {
    id: "concert-to-instana",
    source: "Concert",
    target: "Instana",
    title: "Operational Intelligence to Full-Stack Observability",
    shortReason: "Concert's cross-domain intelligence is amplified when it has high-fidelity, real-time telemetry from Instana rather than lower-fidelity third-party monitoring feeds.",
    businessProblem: "Concert is most powerful when it has rich observability data — customers relying on basic monitoring feeds get lower-quality AI-generated context and less actionable insights.",
    inFlowMessage:
      "This could also become a **Concert + Instana** motion if the client wants the richest possible telemetry feeding Concert's AI engine rather than basic monitoring data.",
    resultMessage:
      "**Cross-sell recommendation: IBM Instana Observability**\n\nYou already positioned Concert for operational intelligence. Instana is the strongest adjacent motion — it provides the high-fidelity, real-time telemetry that makes Concert's AI-driven context and prioritization significantly more accurate.",
    valuePoints: CONCERT_INSTANA_VALUE_POINTS,
  },

  // Terraform ↔ Vault
  {
    id: "terraform-to-vault",
    source: "Terraform",
    target: "Vault",
    title: "Infrastructure Provisioning to Secrets Security (ILM + SLM)",
    shortReason: "Terraform provisions infrastructure but cannot secure the secrets, credentials, and certificates that provisioned resources need — Vault closes that gap.",
    businessProblem: "Terraform-managed environments frequently have static credentials embedded in state files, CI/CD pipelines, or environment variables — a common and serious secrets sprawl problem.",
    inFlowMessage:
      "This could also become a **Terraform + Vault** motion if the client needs to eliminate secrets sprawl and secure the credentials their infrastructure automation generates.",
    resultMessage:
      "**Cross-sell recommendation: IBM HashiCorp Vault**\n\nYou already framed the infrastructure automation story with Terraform. Vault is the strongest adjacent motion — it provides the secrets management, dynamic credentials, and certificate automation that Terraform-provisioned infrastructure requires.",
    valuePoints: TERRAFORM_VAULT_VALUE_POINTS,
  },
  {
    id: "vault-to-terraform",
    source: "Vault",
    target: "Terraform",
    title: "Secrets Security to Infrastructure Lifecycle Management (SLM + ILM)",
    shortReason: "Vault secures secrets but the same customers who care about secrets governance also need standardized, policy-compliant infrastructure provisioning.",
    businessProblem: "Organizations modernizing secrets and identity controls often have ad-hoc infrastructure provisioning that creates the secrets sprawl Vault is trying to fix.",
    inFlowMessage:
      "This could also become a **Vault + Terraform** motion if the client also needs to standardize infrastructure provisioning with policy guardrails and a secrets-safe automation workflow.",
    resultMessage:
      "**Cross-sell recommendation: IBM HashiCorp Terraform**\n\nYou already positioned Vault around secrets and machine trust. Terraform is IBM's flagship adjacent motion — it provisions infrastructure with policy guardrails and can dynamically pull secrets from Vault during every provisioning run.",
    valuePoints: VAULT_TERRAFORM_VALUE_POINTS,
  },

  // webMethods ↔ Verify
  {
    id: "webmethods-to-verify",
    source: "webMethods",
    target: "Verify",
    title: "Integration Platform to Identity-Secured API Fabric",
    shortReason: "webMethods exposes APIs and integration endpoints that need identity-based access governance — Verify provides the OAuth 2.0/OIDC and adaptive access layer.",
    businessProblem: "Organizations modernizing integration with webMethods frequently leave API access ungoverned, creating exposure at every integration and API endpoint.",
    inFlowMessage:
      "This could also become a **webMethods + Verify** motion if the client needs to secure integration and API endpoints with identity-based access control and governance.",
    resultMessage:
      "**Cross-sell recommendation: IBM Security Verify**\n\nYou already positioned webMethods for integration modernization. Verify is the strongest adjacent motion — it provides the identity and access governance layer that every integration endpoint and published API requires.",
    valuePoints: VERIFY_WEBMETHODS_VALUE_POINTS,
  },
  {
    id: "verify-to-webmethods",
    source: "Verify",
    target: "webMethods",
    title: "Identity Governance to Governed Integration Fabric",
    shortReason: "Customers with strong identity governance often need to extend that governance to the API and integration layer — webMethods provides the iPaaS platform that Verify can protect.",
    businessProblem: "Strong workforce identity controls become less effective when the same organization's APIs and integration workflows lack consistent governance and access policy.",
    inFlowMessage:
      "This could also become a **Verify + webMethods** motion if the client also needs a governed integration fabric that Verify's identity policies can protect and manage.",
    resultMessage:
      "**Cross-sell recommendation: IBM webMethods Integration**\n\nYou already positioned Verify for identity governance. webMethods is a strong adjacent motion when the same client also needs a modern hybrid integration platform — one that Verify's identity and API security policies can govern end-to-end.",
    valuePoints: VERIFY_WEBMETHODS_VALUE_POINTS,
  },
  // Terraform ↔ Turbonomic (Play 06)
  {
    id: "terraform-to-turbonomic",
    source: "Terraform",
    target: "Turbonomic",
    title: "Infrastructure Automation to AI-Driven Resource Optimization",
    shortReason: "Terraform provisions cloud infrastructure; Turbonomic ensures that infrastructure is right-sized and cost-optimized in real time.",
    businessProblem: "Teams that automate provisioning with Terraform often over-provision resources for safety margins — Turbonomic closes that gap by continuously right-sizing based on actual demand.",
    inFlowMessage:
      "This could also become a **Terraform + Turbonomic** motion if the client wants to ensure the infrastructure Terraform provisions is continuously right-sized and cost-optimized — not just initially sized.",
    resultMessage:
      "**Cross-sell recommendation: IBM Turbonomic**\n\nYou already framed the infrastructure automation story with Terraform. Turbonomic is a natural adjacent motion — it monitors the resources Terraform provisions and autonomously right-sizes them based on real demand, turning provisioning automation into continuous cost optimization.",
    valuePoints: [
      "Terraform automates provisioning; Turbonomic prevents the over-provisioning that automation often creates — together they deliver 'provision right and keep it right.'",
      "Turbonomic's AI-driven actions operate on the same resource scope Terraform manages: VMs, cloud instances, Kubernetes nodes — all tracked by the same MVS metric.",
      "IBM's combined ILM+ARM story: Infrastructure Lifecycle Management (Terraform) and Application Resource Management (Turbonomic) for a complete automation and optimization platform.",
    ],
  },

  // Turbonomic → Apptio (Play 04)
  {
    id: "turbonomic-to-apptio",
    source: "Turbonomic",
    target: "Turbonomic", // Apptio is not a Product type — note in resultMessage
    title: "Resource Optimization to FinOps and IT Financial Visibility",
    shortReason: "Turbonomic optimizes infrastructure spend in real time; Apptio Cloudability provides the FinOps governance and showback/chargeback layer for accountability.",
    businessProblem: "Organizations optimizing cloud resources with Turbonomic often lack the financial governance, showback, and cost allocation visibility that connects IT action to business value.",
    inFlowMessage:
      "This could also become a **Turbonomic + Apptio** motion if the client needs FinOps governance and cost allocation reporting alongside resource optimization actions.",
    resultMessage:
      "**Cross-sell recommendation: IBM Apptio Cloudability (FinOps)**\n\nYou already positioned Turbonomic for resource optimization. Apptio Cloudability is the strongest adjacent FinOps motion — it provides the cost allocation, showback/chargeback, and budget governance that makes Turbonomic's optimization actions visible and accountable to business stakeholders.\n\n**Note:** Apptio is a separate IBM product line — engage an IBM Apptio specialist for pricing and positioning.",
    valuePoints: [
      "Turbonomic takes the optimization actions; Apptio provides the financial reporting that shows leadership what those actions saved — closing the loop between engineering efficiency and business value.",
      "Together they form IBM's FinOps platform: Turbonomic for autonomous resource rightsizing, Apptio for cost allocation, forecast accuracy, and cloud financial governance.",
      "Customers with Turbonomic often lack the showback/chargeback mechanism to demonstrate ROI to finance — Apptio provides exactly that visibility layer.",
    ],
  },

  // Concert → Apptio (Play 09)
  {
    id: "concert-to-apptio",
    source: "Concert",
    target: "Concert", // Apptio is not a Product type — note in resultMessage
    title: "Operational Intelligence to IT Financial Governance",
    shortReason: "Concert surfaces operational risk and optimization signals; Apptio translates those signals into financial accountability and budget governance.",
    businessProblem: "Organizations with strong operational intelligence still lack the financial governance layer that connects infrastructure optimization decisions to business cost accountability.",
    inFlowMessage:
      "This could also become a **Concert + Apptio** motion if the client needs to connect Concert's operational optimization signals to IT financial governance, showback, and FinOps accountability.",
    resultMessage:
      "**Cross-sell recommendation: IBM Apptio Cloudability (FinOps)**\n\nYou already positioned Concert for operational intelligence and optimization. Apptio is the strongest adjacent FinOps motion — it takes Concert's optimization signals and translates them into cost allocation, budget governance, and showback/chargeback reporting that business stakeholders understand.\n\n**Note:** Apptio is a separate IBM product line — engage an IBM Apptio specialist for pricing and positioning.",
    valuePoints: [
      "Concert identifies what to optimize operationally; Apptio governs the financial impact of those optimizations — together they deliver the full FinOps story: technical action plus financial accountability.",
      "Concert's cost optimization signals (Concert Optimize module) are most valuable when they connect to Apptio's financial reporting and chargeback mechanisms.",
      "Customers buying Concert for operational intelligence are often simultaneously evaluating FinOps tools — Apptio prevents a competitor from landing that adjacent conversation.",
    ],
  },
];

export function getCrossSellPlay(source: Product | null): CrossSellPlay | null {
  if (!source) return null;
  return CROSS_SELL_PLAYS.find((play) => play.source === source) ?? null;
}

export function getCrossSellPlays(source: Product | null): CrossSellPlay[] {
  if (!source) return [];
  return CROSS_SELL_PLAYS.filter((play) => play.source === source);
}

export function shouldShowCrossSellHint(
  product: Product | null,
  answers: Record<string, string | number | boolean | string[]>
): boolean {
  if (product === "Verify") {
    const caps = Array.isArray(answers.capabilities) ? answers.capabilities : [];
    const population = Number(answers.population ?? 0);
    return caps.length > 0 || population >= 500;
  }

  if (product === "MaaS360") {
    const devices = Number(answers.maas360Devices ?? 0);
    return devices >= 250;
  }

  if (product === "Vault") {
    const model = String(answers.vaultModel ?? "");
    const clientCount = Number(answers.clientCount ?? 0);
    const useCases = Array.isArray(answers.useCases) ? answers.useCases : [];
    return model === "B" ? clientCount >= 25 : useCases.length > 0;
  }

  // New products — always show cross-sell hint when discovery is underway
  if (product === "Instana") {
    const mvs = Number(answers.instanaMVS ?? 0);
    return mvs >= 10;
  }

  if (product === "Turbonomic") return true;

  if (product === "Terraform") {
    const resources = Number(answers.terraformResources ?? 0);
    return resources > 0;
  }

  if (product === "Concert") return true;

  if (product === "webMethods") return true;

  return false;
}

export function buildCrossSellHint(product: Product | null): string | null {
  const play = getCrossSellPlay(product);
  if (!play) return null;
  return `${play.inFlowMessage}\n\nYou can finish the current quote first and explore the cross-sell right after.`;
}

export function buildCrossSellResultMessage(product: Product | null): string | null {
  const play = getCrossSellPlay(product);
  if (!play) return null;

  const bullets = play.valuePoints.map((point) => `- ${point}`).join("\n");
  return `${play.resultMessage}\n\n**Seller value story**\n${bullets}\n\nType **cross-sell** to launch the guided mini-flow.`;
}

export function recommendVerifyToMaaS360Attach(
  answers: Record<string, string | number | boolean | string[]>
): CrossSellRecommendation {
  const capabilities = Array.isArray(answers.capabilities) ? answers.capabilities : [];
  const population = Number(answers.population ?? 0);
  const adaptiveSelected = capabilities.includes("Adaptive");
  const lifecycleSelected = capabilities.includes("Lifecycle");
  const mfaSelected = capabilities.includes("MFA");
  const evidence: string[] = [];

  if (adaptiveSelected) {
    evidence.push("Adaptive access is already in scope, so device posture is a natural next control.");
  }
  if (lifecycleSelected) {
    evidence.push("Lifecycle implies an owned identity estate, which often expands well into managed-device policy.");
  }
  if (population >= 5000) {
    evidence.push("The user population is large enough that endpoint standardization and remote operations usually matter.");
  }
  if (!adaptiveSelected && mfaSelected) {
    evidence.push("MFA is already part of the story, which makes endpoint trust the next adjacent zero-trust step.");
  }

  if (adaptiveSelected) {
    return {
      target: "MaaS360",
      headline: "Lead with Enterprise or Premier plus security-focused add-ons.",
      rationale: "When Verify is being sold on adaptive access, the cleanest attach is managed device posture, stronger endpoint controls, and remote remediation.",
      evidence,
    };
  }

  if (lifecycleSelected || population >= 5000) {
    return {
      target: "MaaS360",
      headline: "Lead with Premier for broader endpoint control, then validate remote support and rollout help.",
      rationale: "Larger or more operationally mature identity deals usually have adjacent device-governance, app-access, and admin-efficiency needs.",
      evidence,
    };
  }

  return {
    target: "MaaS360",
    headline: "Start with Essentials or Deluxe as the first device-management attach.",
    rationale: "For lighter Verify motions, the best cross-sell is usually core device management and compliance before a deeper endpoint-security expansion.",
    evidence,
  };
}

export function recommendMaaS360ToVerifyAttach(
  answers: Record<string, string | number | boolean | string[]>
): CrossSellRecommendation {
  const devices = Number(answers.maas360Devices ?? 0);
  const threatDefense = String(answers.maas360ThreatDefense ?? "no") === "yes";
  const advancedApps = String(answers.maas360AdvancedApps ?? "no") === "yes";
  const secureMail = String(answers.maas360SecureMail ?? "no") === "yes";
  const evidence: string[] = [];

  if (threatDefense) {
    evidence.push("Threat defense is in scope, which is a strong trigger for adaptive access policy on the identity side.");
  }
  if (advancedApps) {
    evidence.push("Secure app and browser requirements often expand into SSO and policy-based access controls.");
  }
  if (secureMail) {
    evidence.push("Protected productivity use cases often create follow-on demand for MFA and user lifecycle controls.");
  }
  if (devices >= 2500) {
    evidence.push("The device estate is large enough that centralized identity controls become more valuable operationally.");
  }

  if (threatDefense) {
    return {
      target: "Verify",
      headline: "Lead with SSO + MFA + Adaptive as the primary identity attach.",
      rationale: "If the endpoint story already includes risk and posture controls, Verify should extend that into adaptive authentication and conditional access.",
      evidence,
    };
  }

  if (advancedApps || secureMail) {
    return {
      target: "Verify",
      headline: "Lead with SSO + MFA, then validate whether Lifecycle belongs in the deal.",
      rationale: "Broader app and productivity management usually means the customer also needs cleaner workforce access and onboarding controls.",
      evidence,
    };
  }

  return {
    target: "Verify",
    headline: "Start with SSO + MFA as the adjacent identity modernization motion.",
    rationale: "Core endpoint management often opens a follow-on Verify motion for access consolidation, stronger authentication, and app onboarding.",
    evidence,
  };
}

export function recommendVerifyToVaultAttach(
  answers: Record<string, string | number | boolean | string[]>
): CrossSellRecommendation {
  const capabilities = Array.isArray(answers.capabilities) ? answers.capabilities : [];
  const population = Number(answers.population ?? 0);
  const adaptiveSelected = capabilities.includes("Adaptive");
  const lifecycleSelected = capabilities.includes("Lifecycle");
  const mfaSelected = capabilities.includes("MFA");
  const evidence: string[] = [];

  if (adaptiveSelected) {
    evidence.push("Adaptive access suggests the client is already investing in stronger trust decisions, which often exposes gaps around non-human and privileged access.");
  }
  if (lifecycleSelected) {
    evidence.push("Lifecycle programs usually surface service-account, secrets, and privileged workflow gaps outside workforce identity.");
  }
  if (population >= 10000) {
    evidence.push("Larger identity estates often have parallel application, automation, and secrets-governance requirements.");
  }
  if (mfaSelected && !adaptiveSelected) {
    evidence.push("MFA modernization often opens the follow-on conversation about privileged credentials and secrets sprawl.");
  }

  if (adaptiveSelected || lifecycleSelected || population >= 10000) {
    return {
      target: "Vault",
      headline: adaptiveSelected || lifecycleSelected
        ? "Lead with Vault around privileged secrets, machine identities, and application credential governance."
        : "Validate whether the client also needs secrets management or certificate automation for apps and infrastructure.",
      rationale: adaptiveSelected || lifecycleSelected
        ? "When Verify is landing deeper governance or adaptive access, Vault is the best adjacent motion to secure the non-human side of trust: secrets, certificates, and privileged machine access."
        : "Large workforce identity deals often run alongside modernization of application security, automation, and privileged credential handling.",
      evidence,
    };
  }

  return {
    target: "Vault",
    headline: "Probe for application secrets, service credentials, and certificate lifecycle pain as the next security attach.",
    rationale: "If the customer is fixing human access first, the next deterministic Vault motion is usually around secrets sprawl, machine trust, and privileged operational access.",
    evidence,
  };
}

export function recommendVerifyCrossSellAttach(
  answers: Record<string, string | number | boolean | string[]>
): VerifyAttachDecision {
  const capabilities = Array.isArray(answers.capabilities) ? answers.capabilities : [];
  const population = Number(answers.population ?? 0);
  const adaptiveSelected = capabilities.includes("Adaptive");
  const lifecycleSelected = capabilities.includes("Lifecycle");

  if (adaptiveSelected && !lifecycleSelected && population < 10000) {
    return {
      target: "MaaS360",
      recommendation: recommendVerifyToMaaS360Attach(answers),
    };
  }

  if (!adaptiveSelected && !lifecycleSelected && population < 5000) {
    return {
      target: "MaaS360",
      recommendation: recommendVerifyToMaaS360Attach(answers),
    };
  }

  return {
    target: "Vault",
    recommendation: recommendVerifyToVaultAttach(answers),
  };
}

export function recommendVaultToVerifyAttach(
  answers: Record<string, string | number | boolean | string[]>
): CrossSellRecommendation {
  const model = String(answers.vaultModel ?? "A");
  const clientCount = Number(answers.clientCount ?? 0);
  const useCases = Array.isArray(answers.useCases) ? answers.useCases : [];
  const installCount = Number(answers.installCount ?? 0);
  const evidence: string[] = [];

  if (model === "B" && clientCount >= 25) {
    evidence.push("A broader application client estate often means the same customer also needs stronger workforce SSO and MFA consistency.");
  }
  if (useCases.includes("pki") || useCases.includes("kmse")) {
    evidence.push("Certificate and key-management use cases usually point to a broader trust and governance discussion beyond machine credentials alone.");
  }
  if (useCases.includes("dynamic") || useCases.includes("ssh")) {
    evidence.push("Privileged access and dynamic credential workflows often reveal adjacent human authentication and approval-policy needs.");
  }
  if (installCount >= 2) {
    evidence.push("Multi-cluster or more mature Vault deployments often sit in organizations with more complex human-access governance requirements too.");
  }

  if (useCases.includes("dynamic") || useCases.includes("ssh")) {
    return {
      target: "Verify",
      headline: "Lead with Verify MFA and Adaptive around privileged operator access and stronger workforce controls.",
      rationale: "When Vault is in play for privileged or dynamic credential scenarios, the strongest adjacent Verify motion is better human authentication, SSO, and adaptive access for administrators and workforce users.",
      evidence,
    };
  }

  if ((model === "B" && clientCount >= 25) || useCases.includes("pki") || useCases.includes("kmse")) {
    return {
      target: "Verify",
      headline: "Lead with SSO + MFA, then validate Lifecycle if identity governance maturity is part of the roadmap.",
      rationale: "Customers investing in secrets, certificates, or workload trust frequently also need cleaner workforce access policy and onboarding governance.",
      evidence,
    };
  }

  return {
    target: "Verify",
    headline: "Probe for workforce access modernization, MFA gaps, and joiner-mover-leaver pain as the adjacent identity motion.",
    rationale: "Even when Vault starts as a focused secrets play, Verify is the best adjacent motion if the client still has inconsistent human authentication and governance controls.",
    evidence,
  };
}
