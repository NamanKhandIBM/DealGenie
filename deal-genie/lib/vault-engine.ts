// Vault quoting engine — handles Platform/RU (Model A) and Clients/RVU (Model B) fork.
// Model A accepts plain use-case inputs and derives RUs internally — sellers never see RU math.
import { VAULT_PARTS_MODEL_A, VAULT_PARTS_MODEL_B, VAULT_RU_DISCOUNTS, VAULT_CLIENT_DISCOUNTS } from "./data";
import {
  VAULT_ALL_PARTS,
  VAULT_BEST_PRACTICES,
  VAULT_TUTORIAL_STEPS,
  VAULT_QUICK_REFERENCE,
  type VaultPartNumber,
  type VaultBestPractice,
  type VaultTutorialStep,
  type VaultQuickReference
} from "./vault-parts";

export type VaultModel = "A-Platform" | "B-Clients";

export type VaultEdition = "Essentials" | "Standard" | "Premium";

// ─── Plain use-case inputs — what a seller collects from the client ───────────

export interface VaultUseCaseInputs {
  // Static secrets
  staticSecretCount?: number;           // unique secrets stored (monthly high-water)
  // Dynamic secrets
  dynamicRoles?: number;                // number of credential roles configured
  // PKI
  pkiCertsPerMonth?: number;            // certificates issued/renewed per month
  pkiCertLifetimeHours?: number;        // average cert lifetime in hours
  // SSH (same formula as PKI)
  sshCredsPerMonth?: number;
  sshLifetimeHours?: number;
  // Transit / Transform
  transitCallsPerMonth?: number;        // encrypt/decrypt API calls — 150,000 = 1 RU
  // KMSE
  kmseKeyCount?: number;                // managed keys (monthly high-water)
}

/**
 * Derives monthly RU count from plain use-case inputs.
 * Returns { totalRU, breakdown } where breakdown is a human-readable per-use-case summary.
 */
export function deriveVaultRU(inputs: VaultUseCaseInputs): { totalRU: number; breakdown: string[] } {
  const breakdown: string[] = [];
  let totalRU = 0;

  if (inputs.staticSecretCount) {
    const ru = inputs.staticSecretCount;
    breakdown.push(`Static secrets: ${inputs.staticSecretCount.toLocaleString()} secrets → ${ru.toLocaleString()} RU`);
    totalRU += ru;
  }

  if (inputs.dynamicRoles) {
    const ru = inputs.dynamicRoles;
    breakdown.push(`Dynamic credentials: ${inputs.dynamicRoles.toLocaleString()} roles → ${ru.toLocaleString()} RU`);
    totalRU += ru;
  }

  if (inputs.pkiCertsPerMonth && inputs.pkiCertLifetimeHours) {
    // RU = ceil(certs_per_month × (lifetime_hours / 730))
    const ru = Math.ceil(inputs.pkiCertsPerMonth * (inputs.pkiCertLifetimeHours / 730));
    breakdown.push(
      `PKI certificates: ${inputs.pkiCertsPerMonth.toLocaleString()} certs/month × ` +
      `(${inputs.pkiCertLifetimeHours}h ÷ 730h) = ${ru.toLocaleString()} RU`
    );
    totalRU += ru;
  }

  if (inputs.sshCredsPerMonth && inputs.sshLifetimeHours) {
    const ru = Math.ceil(inputs.sshCredsPerMonth * (inputs.sshLifetimeHours / 730));
    breakdown.push(`SSH credentials: ${inputs.sshCredsPerMonth.toLocaleString()}/month × (${inputs.sshLifetimeHours}h ÷ 730h) = ${ru.toLocaleString()} RU`);
    totalRU += ru;
  }

  if (inputs.transitCallsPerMonth) {
    const ru = Math.ceil(inputs.transitCallsPerMonth / 150_000);
    breakdown.push(`Encrypt/Decrypt operations: ${inputs.transitCallsPerMonth.toLocaleString()} calls ÷ 150,000 = ${ru.toLocaleString()} RU`);
    totalRU += ru;
  }

  if (inputs.kmseKeyCount) {
    const ru = inputs.kmseKeyCount;
    breakdown.push(`Encryption keys (KMIP): ${inputs.kmseKeyCount.toLocaleString()} keys → ${ru.toLocaleString()} RU`);
    totalRU += ru;
  }

  return { totalRU: Math.max(1, totalRU), breakdown };
}

export interface VaultInputsModelA {
  model: "A-Platform";
  installCount: number;
  useCaseInputs: VaultUseCaseInputs;    // plain inputs — engine derives RU
  includeNonProd?: boolean;
  includeKMIP?: boolean;
  customPlugins?: number;
}

export interface VaultInputsModelB {
  model: "B-Clients";
  edition: VaultEdition;
  installCount: number;
  clientCount: number;
  includeNonProd?: boolean;
  pkiCerts?: number;
  adpKeyMgmt?: number; // number of clusters needing KMIP
  adpTransformClients?: number;
  advancedSupport?: boolean;
}

export type VaultInputs = VaultInputsModelA | VaultInputsModelB;

export interface QuoteLine {
  part: string;
  description: string;
  quantity: number;
  unitPrice: number;
  annualList: number;
  rationale: string;
}

export interface VaultQuoteResult {
  model: VaultModel;
  lines: QuoteLine[];
  totalAnnualList: number;
  ballparkNet?: number;
  recDiscount?: number;
  flags: string[];
  partNumbers?: VaultPartNumber[];
  bestPractices?: VaultBestPractice[];
  tutorialSteps?: VaultTutorialStep[];
  quickReference?: VaultQuickReference[];
}

/** Find the closest discount tier for RU quantity (rounds down to nearest bracket). */
function getVaultRUDiscount(rusMonthly: number): { recDiscount: number; netPerRU: number } {
  let best: { recDiscount: number; netPerRU: number } = VAULT_RU_DISCOUNTS[0];
  for (const row of VAULT_RU_DISCOUNTS) {
    if (rusMonthly >= row.rusMonthly) best = row;
    else break;
  }
  return { recDiscount: best.recDiscount, netPerRU: best.netPerRU };
}

/** Find the closest discount tier for Client count.
 *  Returns null recDiscount when below the lowest published bracket (<100 clients)
 *  so the UI can show "no guidance" rather than applying the 100-client tier incorrectly.
 */
function getVaultClientDiscount(clients: number): { recDiscount: number; hasGuidance: boolean } {
  if (clients < VAULT_CLIENT_DISCOUNTS[0].clients) {
    // Below the lowest bracket — discount guidance not published for this volume
    return { recDiscount: 0, hasGuidance: false };
  }
  let best: { recDiscount: number } = VAULT_CLIENT_DISCOUNTS[0];
  for (const row of VAULT_CLIENT_DISCOUNTS) {
    if (clients >= row.clients) best = row;
    else break;
  }
  return { recDiscount: best.recDiscount, hasGuidance: true };
}

export function computeVaultQuote(inputs: VaultInputs): VaultQuoteResult {
  const flags: string[] = [
    "All prices are LIST — confirm exact pricing, discounts, and approval in CPQ.",
  ];
  const lines: QuoteLine[] = [];

  if (inputs.model === "A-Platform") {
    // Derive RU from plain use-case inputs — seller never touches raw RU numbers
    const { totalRU: ruMonthly, breakdown: ruBreakdown } = deriveVaultRU(inputs.useCaseInputs);

    const installPart = inputs.includeKMIP
      ? VAULT_PARTS_MODEL_A.find((p) => p.part === "D155LZX")!
      : VAULT_PARTS_MODEL_A.find((p) => p.part === "D15FQZX")!;

    const installAnnual = installPart.listPrice * inputs.installCount;
    lines.push({
      part: installPart.part,
      description: installPart.description,
      quantity: inputs.installCount,
      unitPrice: installPart.listPrice,
      annualList: installAnnual,
      rationale: `${inputs.installCount} cluster(s) × $${installPart.listPrice.toLocaleString()}/yr`,
    });

    const ruPart = VAULT_PARTS_MODEL_A.find((p) => p.part === "D15FKZX")!;
    const ruAnnual = ruPart.listPrice * ruMonthly * 12;
    const { recDiscount, netPerRU } = getVaultRUDiscount(ruMonthly);
    lines.push({
      part: ruPart.part,
      description: ruPart.description,
      quantity: ruMonthly,
      unitPrice: ruPart.listPrice,
      annualList: ruAnnual,
      rationale: ruBreakdown.join("; ") + ` → total ${ruMonthly.toLocaleString()} RU/month × $48 × 12`,
    });

    if (inputs.includeNonProd) {
      const np = VAULT_PARTS_MODEL_A.find((p) => p.part === "D155GZX")!;
      lines.push({
        part: np.part,
        description: np.description,
        quantity: 1,
        unitPrice: np.listPrice,
        annualList: np.listPrice,
        rationale: "1 non-production install",
      });
    }

    if (inputs.customPlugins && inputs.customPlugins > 0) {
      const cp = VAULT_PARTS_MODEL_A.find((p) => p.part === "D1556ZX")!;
      const cpAnnual = cp.listPrice * inputs.customPlugins;
      lines.push({
        part: cp.part,
        description: cp.description,
        quantity: inputs.customPlugins,
        unitPrice: cp.listPrice,
        annualList: cpAnnual,
        rationale: `${inputs.customPlugins} custom plugin(s) × $${cp.listPrice.toLocaleString()}/yr`,
      });
    }

    const totalAnnualList = lines.reduce((s, l) => s + l.annualList, 0);
    const ballparkNet = Math.round(ruAnnual * (1 - recDiscount) + installAnnual);

    flags.push(
      `Rec. RU discount ~${Math.round(recDiscount * 100)}% based on ${ruMonthly.toLocaleString()} RU/month; ballpark net ≈ $${ballparkNet.toLocaleString()}/yr (CPQ is authoritative).`
    );
    flags.push("Model A (Platform/RU) — may NOT be mixed with Model B for this customer.");

    return {
      model: "A-Platform",
      lines,
      totalAnnualList,
      ballparkNet,
      recDiscount,
      flags,
      partNumbers: VAULT_ALL_PARTS,
      bestPractices: VAULT_BEST_PRACTICES,
      tutorialSteps: VAULT_TUTORIAL_STEPS,
      quickReference: VAULT_QUICK_REFERENCE
    };
  }

  // Model B — Clients/RVU
  const editionPartMap: Record<VaultEdition, string> = {
    Essentials: "D1015ZX",
    Standard:   "D101FZX",
    Premium:    "D101AZX",
  };
  const editionDiscountMap: Record<VaultEdition, number> = {
    Essentials: 0.50,
    Standard:   0.55,
    Premium:    0.60,
  };

  const installPart = VAULT_PARTS_MODEL_B.find((p) => p.part === editionPartMap[inputs.edition])!;
  const installAnnual = installPart.listPrice * inputs.installCount;
  lines.push({
    part: installPart.part,
    description: installPart.description,
    quantity: inputs.installCount,
    unitPrice: installPart.listPrice,
    annualList: installAnnual,
    rationale: `${inputs.installCount} × $${installPart.listPrice.toLocaleString()}/yr (${inputs.edition})`,
  });

  const clientPart = VAULT_PARTS_MODEL_B.find((p) => p.part === "D1017ZX")!;
  const clientAnnual = clientPart.listPrice * inputs.clientCount;
  lines.push({
    part: clientPart.part,
    description: clientPart.description,
    quantity: inputs.clientCount,
    unitPrice: clientPart.listPrice,
    annualList: clientAnnual,
    rationale: `${inputs.clientCount.toLocaleString()} client(s) × $${clientPart.listPrice.toLocaleString()}/RVU`,
  });

  if (inputs.includeNonProd) {
    const np = VAULT_PARTS_MODEL_B.find((p) => p.part === "D1018ZX")!;
    lines.push({
      part: np.part,
      description: np.description,
      quantity: 1,
      unitPrice: np.listPrice,
      annualList: np.listPrice,
      rationale: "1 non-production install",
    });
  }

  if (inputs.pkiCerts && inputs.pkiCerts > 0) {
    const pkiInstall = VAULT_PARTS_MODEL_B.find((p) => p.part === "D1406ZX")!;
    lines.push({
      part: pkiInstall.part,
      description: pkiInstall.description,
      quantity: 1,
      unitPrice: pkiInstall.listPrice,
      annualList: pkiInstall.listPrice,
      rationale: "PKI Certificate Add-On Install (requires v1.21+)",
    });
    const pkiRVU = VAULT_PARTS_MODEL_B.find((p) => p.part === "D1405ZX")!;
    const pkiAnnual = pkiRVU.listPrice * inputs.pkiCerts;
    lines.push({
      part: pkiRVU.part,
      description: pkiRVU.description,
      quantity: inputs.pkiCerts,
      unitPrice: pkiRVU.listPrice,
      annualList: pkiAnnual,
      rationale: `${inputs.pkiCerts} PKI certificate(s) × $${pkiRVU.listPrice}/RVU`,
    });
  }

  if (inputs.adpKeyMgmt && inputs.adpKeyMgmt > 0) {
    const adp = VAULT_PARTS_MODEL_B.find((p) => p.part === "D1013ZX")!;
    const adpAnnual = adp.listPrice * inputs.adpKeyMgmt;
    lines.push({
      part: adp.part,
      description: adp.description,
      quantity: inputs.adpKeyMgmt,
      unitPrice: adp.listPrice,
      annualList: adpAnnual,
      rationale: `${inputs.adpKeyMgmt} cluster(s) needing KMIP × $${adp.listPrice.toLocaleString()}`,
    });
  }

  if (inputs.adpTransformClients && inputs.adpTransformClients > 0) {
    const adpT = VAULT_PARTS_MODEL_B.find((p) => p.part === "D1014ZX")!;
    const adpTAnnual = adpT.listPrice * inputs.adpTransformClients;
    lines.push({
      part: adpT.part,
      description: adpT.description,
      quantity: inputs.adpTransformClients,
      unitPrice: adpT.listPrice,
      annualList: adpTAnnual,
      rationale: `${inputs.adpTransformClients} ADP Transform client(s) × $${adpT.listPrice.toLocaleString()}`,
    });
  }

  const totalAnnualList = lines.reduce((s, l) => s + l.annualList, 0);
  const { recDiscount: clientRec, hasGuidance: clientDiscountKnown } = getVaultClientDiscount(inputs.clientCount);
  const installRec = editionDiscountMap[inputs.edition];
  const ballparkNet = clientDiscountKnown
    ? Math.round(installAnnual * (1 - installRec) + clientAnnual * (1 - clientRec))
    : Math.round(installAnnual * (1 - installRec)); // install-only estimate when client discount unknown

  if (clientDiscountKnown) {
    flags.push(
      `Rec. install discount ~${Math.round(installRec * 100)}% (${inputs.edition}); rec. client discount ~${Math.round(clientRec * 100)}% for ${inputs.clientCount.toLocaleString()} clients. Ballpark net ≈ $${ballparkNet.toLocaleString()}/yr.`
    );
  } else {
    flags.push(
      `Rec. install discount ~${Math.round(installRec * 100)}% (${inputs.edition}). Client discount guidance is only published for 100+ clients — confirm exact client pricing in CPQ. Ballpark net (install only) ≈ $${ballparkNet.toLocaleString()}/yr.`
    );
  }
  flags.push("Model B (Clients/RVU) — may NOT be mixed with Model A for this customer.");
  if (inputs.edition === "Premium" && inputs.installCount < 2) {
    flags.push("Premium edition: buy ≥ 2 installs for Performance Replication / DR.");
  }

  return {
    model: "B-Clients",
    lines,
    totalAnnualList,
    ballparkNet,
    recDiscount: clientRec,
    flags,
    partNumbers: VAULT_ALL_PARTS,
    bestPractices: VAULT_BEST_PRACTICES,
    tutorialSteps: VAULT_TUTORIAL_STEPS,
    quickReference: VAULT_QUICK_REFERENCE
  };
}
