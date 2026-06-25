// Static data extracted from Quoting_Assistant_Data.xlsx — single source of truth.
// To update: edit this file (or eventually swap for a live XLSX read).

export const VERIFY_RU_PRICE = 281.40;

export const VERIFY_PARTS = [
  { part: "D0231ZX", description: "IBM Security Verify SaaS Resource Unit (RU)", listPrice: 281.40, unit: "per RU / year", type: "CORE" },
  { part: "D02T6ZX", description: "SMS and Email MFA Only", listPrice: 33.70, unit: "per event per thousand", type: "Add-on" },
  { part: "D01UQZX", description: "Hosted Application Gateway", listPrice: 22500, unit: "per instance / month", type: "Add-on" },
  { part: "D01URZX", description: "Vanity Domain", listPrice: 562, unit: "per instance / month", type: "Add-on" },
  { part: "D22PGLL", description: "Non-Production with SLA", listPrice: 2810, unit: "per instance / month", type: "Add-on" },
  { part: "D21CWLL", description: "Non-Production without SLA", listPrice: 1410, unit: "per instance / month", type: "Add-on" },
] as const;

// Verify RU rate tiers — graduated brackets (like tax brackets)
// maxUnits is the upper bound of the bracket (cumulative)
export const VERIFY_RU_TIERS = [
  { tier: 1, maxUnits: 500,       SSO: 0.10,   MFA: 0.10,   Adaptive: 0.10,   Lifecycle: 0.29   },
  { tier: 2, maxUnits: 5000,      SSO: 0.08,   MFA: 0.08,   Adaptive: 0.08,   Lifecycle: 0.075  },
  { tier: 3, maxUnits: 10000,     SSO: 0.06,   MFA: 0.06,   Adaptive: 0.06,   Lifecycle: 0.05   },
  { tier: 4, maxUnits: 100000,    SSO: 0.008,  MFA: 0.008,  Adaptive: 0.008,  Lifecycle: 0.005  },
  { tier: 5, maxUnits: 500000,    SSO: 0.0025, MFA: 0.0025, Adaptive: 0.0025, Lifecycle: 0.002  },
  { tier: 6, maxUnits: 1000000,   SSO: 0.002,  MFA: 0.002,  Adaptive: 0.002,  Lifecycle: 0.001  },
  { tier: 7, maxUnits: 5000000,   SSO: 0.0015, MFA: 0.0015, Adaptive: 0.0015, Lifecycle: 0.0005 },
  { tier: 8, maxUnits: 10000000,  SSO: 0.0015, MFA: 0.0015, Adaptive: 0.0015, Lifecycle: 0.0002 },
  { tier: 9, maxUnits: 50000000,  SSO: 0.001,  MFA: 0.001,  Adaptive: 0.001,  Lifecycle: 0.0001 },
  { tier: 10,maxUnits: 999999999, SSO: 0.0005, MFA: 0.0005, Adaptive: 0.0005, Lifecycle: 0.0001 },
] as const;

export type VerifyCapability = "SSO" | "MFA" | "Adaptive" | "Lifecycle";
export const VERIFY_MAU_CAPABILITIES: VerifyCapability[] = ["SSO", "MFA", "Adaptive"];
export const VERIFY_MANAGED_CAPABILITIES: VerifyCapability[] = ["Lifecycle"];

// NS1 Pricing Tiers — ILLUSTRATIVE, confirm in CPQ
export const NS1_PRICING_TIERS = [
  { tierBase: 5,     mrrBase: 100,   tierMRR: 20,    overage: 30     },
  { tierBase: 10,    mrrBase: 165,   tierMRR: 16.50, overage: 24.75  },
  { tierBase: 25,    mrrBase: 350,   tierMRR: 14,    overage: 21     },
  { tierBase: 50,    mrrBase: 600,   tierMRR: 12,    overage: 18     },
  { tierBase: 100,   mrrBase: 1000,  tierMRR: 10,    overage: 15     },
  { tierBase: 200,   mrrBase: 1100,  tierMRR: 5.50,  overage: 8.25   },
  { tierBase: 300,   mrrBase: 1200,  tierMRR: 4,     overage: 6      },
  { tierBase: 400,   mrrBase: 1300,  tierMRR: 3.25,  overage: 4.875  },
  { tierBase: 500,   mrrBase: 1400,  tierMRR: 2.80,  overage: 4.20   },
  { tierBase: 600,   mrrBase: 1500,  tierMRR: 2.50,  overage: 3.75   },
  { tierBase: 700,   mrrBase: 1600,  tierMRR: 2.286, overage: 3.429  },
  { tierBase: 800,   mrrBase: 1700,  tierMRR: 2.125, overage: 3.188  },
  { tierBase: 900,   mrrBase: 1800,  tierMRR: 2.00,  overage: 3.00   },
  { tierBase: 1000,  mrrBase: 1900,  tierMRR: 1.90,  overage: 2.85   },
  { tierBase: 2000,  mrrBase: 3000,  tierMRR: 1.50,  overage: 2.25   },
  { tierBase: 3000,  mrrBase: 4000,  tierMRR: 1.333, overage: 2.00   },
  { tierBase: 7500,  mrrBase: 7200,  tierMRR: 0.96,  overage: 1.44   },
  { tierBase: 10000, mrrBase: 7900,  tierMRR: 0.79,  overage: 1.185  },
  { tierBase: 12500, mrrBase: 8600,  tierMRR: 0.688, overage: 1.032  },
  { tierBase: 15000, mrrBase: 9250,  tierMRR: 0.617, overage: 0.925  },
  { tierBase: 17500, mrrBase: 9900,  tierMRR: 0.566, overage: 0.849  },
  { tierBase: 20000, mrrBase: 10550, tierMRR: 0.528, overage: 0.791  },
  { tierBase: 22500, mrrBase: 11200, tierMRR: 0.498, overage: 0.747  },
  { tierBase: 25000, mrrBase: 11800, tierMRR: 0.472, overage: 0.708  },
  { tierBase: 40000, mrrBase: 15000, tierMRR: 0.375, overage: 0.563  },
] as const;

// Vault Parts
export const VAULT_PARTS_MODEL_A = [
  { part: "D15FQZX", description: "Vault Platform Standard Install",              listPrice: 96000,  metric: "Install",       notes: "Required, min 1 (the cluster/server)" },
  { part: "D15FKZX", description: "Vault Platform Standard Resource Unit",        listPrice: 48,     metric: "Resource Unit", notes: "Required add-on" },
  { part: "D155GZX", description: "Vault Platform Standard Non-Production Install",listPrice: 48000, metric: "Install",       notes: "Recommended" },
  { part: "D155LZX", description: "Vault Platform Standard incl. KMIP Install",   listPrice: 360000, metric: "Install",       notes: "Replaces the production install" },
  { part: "D1556ZX", description: "Vault Platform Custom Plugin Install",          listPrice: 72000,  metric: "Install",       notes: "Per plugin" },
  { part: "D15FNZX", description: "Vault Platform Standard RU Monthly License",   listPrice: 48,     metric: "Resource Unit", notes: "Short-term, max 3 months/calendar year" },
] as const;

export const VAULT_PARTS_MODEL_B = [
  { part: "D1015ZX", description: "Vault Self-Managed Essentials Install", listPrice: 24960,  metric: "Install",       notes: "Good" },
  { part: "D101FZX", description: "Vault Self-Managed Standard Install",   listPrice: 90000,  metric: "Install",       notes: "Better" },
  { part: "D101AZX", description: "Vault Self-Managed Premium Install",    listPrice: 99960,  metric: "Install",       notes: "Best; buy >=2 for DR/perf replication" },
  { part: "D1017ZX", description: "Vault Self-Managed Client",             listPrice: 1296,   metric: "RVU (Client)",  notes: "Required add-on; unique apps/services/users" },
  { part: "D1018ZX", description: "Vault Self-Managed Non-Production",     listPrice: 12480,  metric: "Install",       notes: "Non-prod" },
  { part: "D1406ZX", description: "Vault PKI Certificate Add-On Install",  listPrice: 5004,   metric: "Install",       notes: "Requires Vault Install+Clients & v1.21+" },
  { part: "D1405ZX", description: "Vault Client PKI Certificate Add-On RVU",listPrice: 60,   metric: "RVU",           notes: "Per PKI certificate" },
  { part: "D1013ZX", description: "Vault ADP – Key Management",            listPrice: 249600, metric: "Install",       notes: "Per cluster needing KMIP" },
  { part: "D1014ZX", description: "Vault ADP – Transform",                 listPrice: 3000,   metric: "RVU (Client)",  notes: "Subset of total Vault Clients" },
] as const;

// Vault RU discount guidance
export const VAULT_RU_DISCOUNTS = [
  { rusMonthly: 1,      recDiscount: 0,    netPerRU: 48.00,  totalNetAnnual: 48       },
  { rusMonthly: 500,    recDiscount: 0.30, netPerRU: 33.60,  totalNetAnnual: 16800    },
  { rusMonthly: 1000,   recDiscount: 0.35, netPerRU: 31.20,  totalNetAnnual: 31200    },
  { rusMonthly: 2500,   recDiscount: 0.40, netPerRU: 28.80,  totalNetAnnual: 72000    },
  { rusMonthly: 5000,   recDiscount: 0.45, netPerRU: 26.40,  totalNetAnnual: 132000   },
  { rusMonthly: 10000,  recDiscount: 0.50, netPerRU: 24.00,  totalNetAnnual: 240000   },
  { rusMonthly: 25000,  recDiscount: 0.55, netPerRU: 21.60,  totalNetAnnual: 540000   },
  { rusMonthly: 50000,  recDiscount: 0.60, netPerRU: 19.20,  totalNetAnnual: 960000   },
  { rusMonthly: 75000,  recDiscount: 0.65, netPerRU: 16.80,  totalNetAnnual: 1260000  },
  { rusMonthly: 100000, recDiscount: 0.70, netPerRU: 14.40,  totalNetAnnual: 1440000  },
] as const;

// Vault Client discount guidance
export const VAULT_CLIENT_DISCOUNTS = [
  { clients: 100,   listTotal: 129600,    recDiscount: 0.35, netTotal: 84240    },
  { clients: 500,   listTotal: 648000,    recDiscount: 0.55, netTotal: 291600   },
  { clients: 1500,  listTotal: 1944000,   recDiscount: 0.70, netTotal: 584010   },
  { clients: 10000, listTotal: 11016000,  recDiscount: 0.75, netTotal: 2700000  },
] as const;
