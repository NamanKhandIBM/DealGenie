# DealGenie — Next Steps

## ✅ Completed

- **Quote history + Cloudant persistence** — save, retrieve, delete quotes; IAM bearer-token auth
- **QuoteCompare UI** — price cards with best-value badge, pricing drivers, diff table, plain-English insight banner
- **IBM Search AI integration** — Native TypeScript REST client; live IBM Docs context injected into Genie system prompt
- **NS1 Connect full quoting** — four tiers (Essentials/Standard/Premium/Hybrid), confirmed IBM Marketplace prices for all 16+ Premium/Hybrid parts, graduated pricing, part numbers wired to CPQ
- **CSV export** — "Export CSV" button on quote result; outputs part numbers, quantities, prices, rationale; source citations stripped from notes
- **Compare Scenarios** — deterministic scenario explorer; running total matches quote price exactly; no AI
- **Password gate** — proxy middleware + login page (password: garland)
- **NS1 pricing confirmed** — all prices sourced directly from IBM Marketplace API (`api.marketplace.ibm.com`); no more "illustrative only" warnings

---

## 🟡 Ready to build (no blockers)

### 1. PDF quote export
**What:** Add a "Download PDF" button that exports the quote as a formatted, printable PDF.
**Why:** Sellers need to share quotes with clients — CSV is for CPQ entry, PDF is for client-facing communication.
**Effort:** ~half day. Use `jsPDF` or `@react-pdf/renderer`.

### 2. Multi-product quotes in one session
**What:** Allow a seller to quote Verify + Vault in the same conversation rather than switching products.
**Why:** Most deals involve multiple IBM Security products.
**Effort:** ~1 day. Extend `ConversationState` to hold multiple product states.

### 3. Discount guardrails
**What:** Warn the seller when they enter a discount that exceeds IBM's approval threshold for that product tier.
**Why:** Prevents deals going to approval with out-of-policy discounts.
**Effort:** ~half day. Add threshold constants to `data.ts` and check in the engine.

### 4. CRM pre-fill (Salesforce)
**What:** Accept an opportunity URL or ID and pre-fill customer name, deal size, and product from Salesforce.
**Why:** Removes manual re-entry of data the seller already has in their CRM.
**Effort:** ~1 day. Requires Salesforce Connected App credentials from your Salesforce admin.

---

## 🟢 Longer term

### 5. Deploy to IBM Cloud / w3 (internal hosting)
**What:** Host DealGenie on IBM Cloud Code Engine so any IBM seller can use it without running it locally.
**Effort:** ~1 day once the app is stable. Deploy instructions are in `README.md`.

### 6. CPQ integration
**What:** Push the generated quote directly into IBM's CPQ (Configure Price Quote) system.
**Why:** Eliminates manual re-entry from DealGenie into CPQ.
**Blocker:** Requires CPQ API credentials — ask your CPQ admin or `#cpq-support`.
