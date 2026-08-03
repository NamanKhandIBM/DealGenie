# Cross-Sell Framework — Implementation Status

_Last updated: 2026-07-30 · All tasks complete as of commit `c321104` on `main`._

---

## Summary

The full 9-product cross-sell framework is live. 15 cross-sell plays are defined in `lib/cross-sell.ts`, visual attach cards are rendered after every quote result, and 6 guided mini-flows are available for the highest-conviction product pairs.

---

## ✅ All sub-tasks completed

### 1. Cross-sell domain model and product metadata
- All 9 products registered in `lib/types.ts` and `lib/cross-sell.ts`
- 15 plays defined with source, target, positioning title, rationale, value points, and guided mini-flow flag
- `CROSS_SELL_PLAYS` array is the single source of truth — no scattered conditional logic

### 2. Per-product public knowledge and estimate inputs
- All 9 products have full `*-engine.ts` + `*-data.ts` modules with confirmed IBM list prices
- MaaS360: public pricing $4/$5/$6.25/$9/device/mo confirmed; CPQ SKUs not yet available
- webMethods: $40.08/RU/yr confirmed from IWHI SaaS Calculator (2nd Jul 2026); per-transaction rates labelled "budgetary reference"
- All "confirmed rate" / "Source: IBM SaaS Calculator Oct 2024" labels removed from webMethods questions and engine

### 3. In-flow cross-sell hints
- Text-blurb hints (`buildCrossSellResultMessage`, `maybeAppendCrossSellHint`) have been **removed**
- Cross-sell is now exclusively post-result visual cards — no in-flow hint text injection

### 4. Post-result cross-sell cards and mini-flows

**Visual attach cards** (all 15 plays):
- Color-coded product card with recommendation rationale and evidence points
- Instant live price preview computed from current answers via the target engine
- "Ask: ..." seller discovery prompt
- Launch button that sends `cross-sell [target]` to start the guided second quote

**Guided mini-flows** (full conversational question set):
- Verify → Vault ✅
- Verify → MaaS360 ✅
- Vault → Verify ✅
- MaaS360 → Verify ✅
- NS1 → Turbonomic ✅
- NS1 → Concert ✅

**`crossSellSource` context blocks** (result formatters explain why the attach was launched):
- All 9 product result formatters handle `crossSellSource` and show the correct "Why this attach" message

### 5. Linked quote records for cross-sell pairs
- Cross-sell quote pairs saved as two Cloudant records with shared `linkedQuoteGroupId`
- `linkedQuoteRole`: "base" | "cross-sell" distinguishes the two records
- Deleting either record deletes both (referential integrity enforced in `lib/quote-history.ts`)
- Backwards compatible — existing single-product quotes have no linkage fields

### 6. Compare Scenarios — cross-sell quote fidelity
- `computeScenarioPrice()` correctly resolves cross-sell Verify answer keys (`verifyNeedsSSO`, `verifyPopulation`, `verifyManagedUsers`) so the Running Total is accurate for cross-sell Verify quotes
- Full input audit completed for all 9 products (see `NEXT_STEPS.md`)

---

## Plays reference

| # | Source | Target | Mini-flow | Positioning |
|---|---|---|---|---|
| 1 | Verify | MaaS360 | ✅ | Zero Trust Foundation |
| 2 | Verify | Vault | ✅ | Human Identity to Secrets and Workload Trust |
| 3 | MaaS360 | Verify | ✅ | Device Trust to Identity Trust |
| 4 | Vault | Verify | ✅ | Secrets Security to Workforce Identity Modernization |
| 5 | Vault | Terraform | Preview only | Secrets Security to ILM+SLM |
| 6 | Instana | Turbonomic | Preview only | Observability to Intelligent Resource Automation |
| 7 | Instana | Concert | Preview only | Real-Time Observability to AI-Driven Operational Intelligence |
| 8 | Turbonomic | Instana | Preview only | Resource Optimization to Full-Stack Observability |
| 9 | Terraform | Vault | Preview only | Infrastructure Provisioning to Secrets Security |
| 10 | Terraform | Turbonomic | Preview only | Infrastructure Automation to AI-Driven Resource Optimization |
| 11 | Concert | Instana | Preview only | Operational Intelligence to Full-Stack Observability |
| 12 | Concert | Turbonomic | Preview only | Operational Intelligence to Resource Optimization |
| 13 | NS1 | Turbonomic | ✅ | DNS Traffic Optimization to Resource Right-Sizing |
| 14 | NS1 | Concert | ✅ | DNS Intelligence to Agentic ITOps |
| 15 | webMethods | Verify | Preview only | Integration Platform to Identity-Secured API Fabric |

---

## Remaining gaps

- **MaaS360 CPQ part numbers** — still on public pricing; blocked on IBM product team sharing internal SKUs
- **More guided mini-flows** — plays 5–12 and 15 currently show instant preview only; full mini-flows could be added following the NS1 pattern when seller demand warrants it
