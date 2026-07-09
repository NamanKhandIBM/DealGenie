# DealGenie — Next Steps

## ✅ Recently completed
- **Quote history + Cloudant persistence** — save, retrieve, delete quotes; IAM bearer-token auth
- **QuoteCompare UI (seller-facing)** — price cards with best-value badge, pricing drivers, diff table, and plain-English insight banner

---

## 🟡 Ready to build (token received)

### 1. IBM Search wrapper — live Seismic pricing
**What:** Connect DealGenie to IBM's internal vector store so pricing data is always current, pulled live from Seismic instead of hardcoded in `lib/data.ts`.
**Status:** ✅ Token received — `IBM_SEARCH_API_KEY` added to `.env.local`.
**Ready to build:** `lib/ibm-search.ts` client + wire into quoting engines (~1 day).
**API endpoint:** `POST https://www-api.ibm.com/search/api/v2/`
**Auth header:** `x-search-query-token: <IBM_SEARCH_API_KEY>`
**Plan:**
- Query Seismic on each quote for the relevant product pricing sheet
- Parse and overlay on `lib/data.ts` constants (data.ts stays as offline fallback)
- Priority: NS1 — currently all `$0 / PENDING`; this would give real prices

---

## 🟡 Ready to build (no blockers)

### 2. PDF / Excel quote export
**What:** Add a "Download Quote" button that exports the generated quote as a PDF or Excel file.
**Why:** Sellers need to send quotes to customers — currently the quote only exists in the chat window.
**Effort:** ~half day. Use `jsPDF` or `xlsx` (already in dependencies).

### 3. Multi-product quotes in one session
**What:** Allow a seller to quote Verify + Vault in the same conversation rather than switching products.
**Why:** Most deals involve multiple IBM Security products.
**Effort:** ~1 day. Extend `ConversationState` to hold multiple product states.

### 4. Discount guardrails
**What:** Warn the seller when they enter a discount that exceeds IBM's approval threshold for that product tier.
**Why:** Prevents deals going to approval with out-of-policy discounts.
**Effort:** ~half day. Add threshold constants to `data.ts` and check in the engine.

### 5. CRM pre-fill (Salesforce)
**What:** Accept an opportunity URL or ID and pre-fill customer name, deal size, and product from Salesforce.
**Why:** Removes manual re-entry of data the seller already has in their CRM.
**Effort:** ~1 day. Requires Salesforce Connected App credentials from your Salesforce admin.
**Slack to ask:** `#salesforce-dev` or your Salesforce admin.

---

## 🟢 Longer term

### 6. Deploy to IBM Cloud / w3 (internal hosting)
**What:** Host DealGenie on IBM Cloud Code Engine or as a w3 app so any IBM seller can use it without running it locally.
**Effort:** ~1 day once the app is stable.

### 7. CPQ integration
**What:** Push the generated quote directly into IBM's CPQ (Configure Price Quote) system.
**Why:** Eliminates manual re-entry from DealGenie into CPQ.
**Blocker:** Requires CPQ API credentials — ask your CPQ admin or `#cpq-support`.
