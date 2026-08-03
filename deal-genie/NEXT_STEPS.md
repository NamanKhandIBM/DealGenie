# Quote Genie — Next Steps

_Last updated: 2026-07-30 · Branch: `main` · Latest commit: `c321104`_

---

## ✅ Completed

### Infrastructure & Core
- **Quote history + Cloudant persistence** — save, retrieve, delete quotes; IAM bearer-token auth
- **QuoteCompare UI** — price cards with best-value badge, pricing drivers, diff table, plain-English insight banner
- **IBM Search AI integration** — Native TypeScript REST client; live IBM Docs context injected into system prompt
- **CSV export** — "Export CSV" button on quote result; outputs part numbers, quantities, prices, rationale
- **Password gate** — proxy middleware + login page
- **Rename: DealGenie → Quote Genie** — branding updated across all UI surfaces

### Product Engines
- **NS1 Connect full quoting** — four tiers (Essentials/Standard/Premium/Hybrid), confirmed IBM Marketplace prices for all 16+ Premium/Hybrid parts, graduated pricing, part numbers wired to CPQ
- **Vault 2.0 (Model A)** — RU/consumption pricing: secrets, dynamic roles, PKI certs, SSH credentials, Transit encrypt/decrypt, KMSE keys; Census reporting note; install + RU parts
- **Instana self-hosted pricing fixed** — was flat $321 base regardless of MVS; now MVS × rate correctly (D29RRLL $32.10/MVS/mo Essentials, D29RTLL $120/MVS/mo Standard)
- **MaaS360 prices corrected** — $4.24/$5.30/$6.63/$9.54 → $4.00/$5.00/$6.25/$9.00/device/mo per confirmed IBM pricing
- **webMethods SaaS rate corrected** — $11.54/RU/yr → $40.08/RU/yr (IWHI SaaS Calculator, 2nd Jul 2026)
- **webMethods B2B transactions** — `webMethodsB2bTxn` question added to flow and wired through engine as dedicated B2B volume
- **webMethods "confirmed rate" labels removed** — all per-transaction rates now labelled "budgetary reference rate" to avoid overpromising

### Cross-Sell Framework
- **Full 9-product cross-sell framework** — 15 plays in `lib/cross-sell.ts`
- **CrossSellPanel visual cards** — replaced old text blurbs with color-coded product attach cards
- **NS1 cross-sell cards** — NS1 → Turbonomic and NS1 → Concert guided mini-flows added, including `crossSellSource` context blocks in result formatters
- **Cross-sell text blurb removed** — `buildCrossSellResultMessage` and `maybeAppendCrossSellHint` deleted; cross-sell is purely visual now

### Scenario Compare — Bug Fixes
- **Bug 1 fixed: Static hardcoded options** — `getForkVariables()` now generates options **anchored to the actual quoted answer** using a ×5 geometric scale (2 below, current, 2 above). A seller who quoted 100 devices sees 4/20/100/500/2,500 instead of the generic 500/1K/5K/10K/25K list
- **Bug 2 fixed: Running Total mismatch** — full audit of `computeScenarioPrice` across all 9 products; confirmed and fixed 5 gaps:
  - **MaaS360** — add-ons (`mtdAdvanced`, `teamViewer`) and Concierge were stripped; now passed from original answers
  - **Verify (cross-sell path)** — `verifyNeedsSSO`/`verifyPopulation`/`verifyManagedUsers` answer keys now resolved for cross-sell quotes
  - **Vault** — SSH credentials, Transit encrypt/decrypt calls, and KMSE key management use cases now included
  - **Turbonomic** — `annualCloudSpend` and `scopingModel` now passed; "monitoredCosts" path was returning $0
  - **webMethods** — `webMethodsB2bTxn` (estimatedB2BTransactions) now passed through
  - **NS1** — `dedicatedPoPs`, `chinaMQ`, and `term` now passed (can add thousands/yr in list price)
  - Products confirmed clean (no gaps): Instana, Terraform, Concert

### Tests
- **357/357 tests passing** — all test suites clean with no regressions
- **3 pre-existing test bugs fixed** — FP-IN10 (stale Instana base price), PA-N02/N03 (NS1 duplicate declarations), conversation-cross-sell (stale assertion)

---

## 🟡 Ready to build (no blockers)

### 1. PDF quote export
**What:** "Download PDF" button that exports the quote as a formatted, printable PDF.
**Why:** Sellers need to share quotes with clients — CSV is for CPQ entry, PDF is for client-facing communication.
**Effort:** ~half day. Use `@react-pdf/renderer` or `jsPDF`.

### 2. Discount guardrails
**What:** Warn the seller when they enter a discount that exceeds IBM's approval threshold for that product tier.
**Why:** Prevents deals going to approval with out-of-policy discounts. Terraform SCS discount matrix already exists in `terraform-data.ts` as a pattern.
**Effort:** ~half day. Add threshold constants to each `*-data.ts` and check in the result formatter.

### 3. Multi-product quotes in one session
**What:** Allow a seller to quote Verify + Vault (or any 2 products) in the same conversation without switching.
**Why:** Most deals involve multiple IBM Security products; the seller shouldn't have to restart.
**Effort:** ~1 day. Extend `ConversationState` to hold multiple product states; update the result renderer to aggregate.

### 4. CRM pre-fill (Salesforce)
**What:** Accept a Salesforce opportunity URL or ID and pre-fill customer name, deal size, and product.
**Why:** Removes manual re-entry of data the seller already has in their CRM.
**Effort:** ~1 day. Requires a Salesforce Connected App credential from your Salesforce admin.

---

## 🔴 Blocked — waiting on data

### 5. MaaS360 CPQ part numbers
**What:** Replace public-price estimate with CPQ-ready part numbers (matching the pattern for all other 8 products).
**Blocker:** IBM CPQ SKUs for MaaS360 are not publicly published. Need MaaS360 product team to share the internal SKU list.

### 6. webMethods IWHI per-transaction RU values
**What:** Replace "budgetary reference" per-transaction rates with confirmed IWHI calculator RU values.
**Blocker:** Need someone to open the IWHI SaaS Sizing Calculator XLSX, navigate to the Master data tab, and read the Calculator column values next to each transaction tier row for Integration, API Management, and B2B.

### 7. webMethods CP4I on-premises VPC rate
**What:** Show a confirmed list price for the CP4I on-premises deployment path (D16NRZX / D16NSZX).
**Blocker:** VPC rate is not in any Seismic deck. Need IBM pricing desk / Passport Advantage confirmation.

### 8. Vault Model B renewal status
**What:** Confirm whether Vault Model B (per-client/RVU) is still valid for renewals or fully retired.
**Blocker:** Vault SME confirmation needed. Model B is currently present in the engine but not used for new quotes.

### 9. Concert SaaS billing model
**What:** Confirm whether Concert SaaS charges a committed annual RU block or metered hourly consumption.
**Blocker:** Concert SME confirmation needed. Current engine uses ~$1.06/RU/yr which may be an annual block price.

---

## 🟢 Longer term

### 10. Deploy to IBM Cloud / w3 (internal hosting)
**What:** Host Quote Genie on IBM Cloud Code Engine so any IBM seller can use it without running locally.
**Effort:** ~1 day once stable. A `Dockerfile` is already present; the app has no external hard dependencies beyond `APP_PASSWORD`.

### 11. CPQ direct integration
**What:** Push the generated quote directly into IBM's CPQ system.
**Why:** Eliminates manual re-entry from Quote Genie into CPQ.
**Blocker:** Requires CPQ API credentials — ask CPQ admin or `#cpq-support`.

### 12. NS1 Standard add-on per-unit price confirmation
**What:** Confirm current CPQ prices for NS1 Standard add-ons: records ($50/mo per 1K), filter chains ($40/mo), monitors ($1.30/mo).
**Blocker:** IBM Quoting / CPQ confirmation needed.
