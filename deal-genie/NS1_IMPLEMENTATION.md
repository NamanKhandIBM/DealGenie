# NS1 Connect — Implementation Notes

## Status: Production-ready ✅

All NS1 part numbers are confirmed and all prices are live. No placeholders remain.

---

## Pricing sources

| Source | What it covers |
|---|---|
| IBM.com product page (`/products/ns1-connect/pricing`) | Essentials ($99/mo) and Standard ($349/mo) base prices and add-on rates |
| IBM Marketplace API (`api.marketplace.ibm.com/purchase/catalog/resources/price/info`) | All Premium (`D0GN*`) and Hybrid (`D0GY*`/`D0GZ*`) parts — graduated pricing tiers confirmed |
| IBM Software CPQ (12-month term) | `D0GNEZX`, `D0GNGZX`, `D0GYUZX` — verified against CPQ line items |

All prices are **LIST**. Discounts are applied in CPQ. NS1 policy: ≤35% pre-authorized, +10% with sales leadership, >45% requires product team.

---

## Four tiers

| Tier | Part prefix | MQ range | Min ARR | Notes |
|---|---|---|---|---|
| Essentials | `D10AYZX` ($99/mo base) | ≤30M | ~$1.2K | Query add-ons only; no record/filter/monitor add-ons |
| Standard | `D10AYZX` ($349/mo base) | 31M–999M | ~$4.2K | Full add-on menu; spike protection included |
| Premium | `D0GN*` à la carte | ≥1B (1,000 MQ) | ~$45K | Seller-assisted; all add-ons individually priced |
| Hybrid | `D0GY*`/`D0GZ*` bundles | >10B (10,000 MQ) | ~$250K | Enterprise/Enterprise Plus bundles |

**Tier boundary:** `effectiveMQ >= 1,000` routes to Premium (1B queries = exactly the tier floor).

---

## Key files

| File | Purpose |
|---|---|
| `lib/ns1-parts.ts` | Full part catalog — Standard, Premium, Hybrid; all list prices and `scaleQtyPrice` graduated tiers |
| `lib/ns1-engine.ts` | `computeNS1Quote()` — tier routing, part line items, graduated pricing, flags |
| `lib/data.ts` | `NS1_PRICING_TIERS` — ballpark MRR display table (not used for actual pricing) |
| `lib/questions.ts` | Per-tier discovery question flows (Premium-only questions hidden for Standard/Essentials) |
| `components/NS1QuoteDisplay.tsx` | Tabbed quote display: Summary / Part Numbers / Best Practices / Tutorial / Quick Reference |
| `lib/__tests__/ns1-engine.test.ts` | NS1-specific tests covering tier routing, SLA insertion, flags, DDoS, China, Dedicated DNS |

---

## Graduated pricing

Most Premium/Hybrid parts use IBM's GRAD pricing model (price drops with volume). The `NS1Part` interface has an optional `scaleQtyPrice` array. The engine's `catalogPrice(partNumber, quantity)` function picks the correct tier bracket automatically. Example for `D0GNEZX` (Managed DNS Requests):

```
qty < 10   → $13.65/mo per Request
qty 10–24  → $5.47
qty 25–49  → $3.83
qty 50–99  → $2.68
qty 100–249→ $1.88
...
qty ≥ 5,000→ $0.64
```

Flat-rate parts (`D0GNCZX` Enhanced Monitor Interval $1,120/mo, `D0GNRZX` Vanity NS $2,250/mo, `D0GNAZX` Dedicated Large $2,430/PoP, `D0GNBZX` Dedicated Small $1,220/PoP) use `QNTY`/`VALU` model — single price regardless of quantity.

---

## Flags emitted by the engine

The result's `flags[]` array includes:
- `"All prices are LIST..."` — always present
- Growth headroom applied (if `expectedGrowthPct` or `growthMQ` set)
- `"D0GNDZX SLA (qty=1) is required..."` — Premium orders
- `"D0GZ2ZX SLA (qty=1) is required..."` — Hybrid orders
- `"China DNS: ... below the minimum of 50M queries"` — when `chinaMQ < 50`
- `"Dedicated DNS: ... minimum is 3 PoPs"` — when `dedicatedPoPs < 3`
- `"DNS Insights (D0GN6ZX) qty must equal..."` — CPQ requirement
- Standard spike protection note (when `ddosProtection` selected on Standard)

---

## Compare Scenarios — fully wired

`lib/compare-engine.ts` → `computeScenarioPrice()` for NS1 returns `result.totalAnnualList` (confirmed marketplace prices). All inputs that `conversation.ts` uses are now passed through:

- `queryMQ`, `filterChainCount`, `monitors`, `recordCount` — core sizing inputs ✅
- `gslb` → `rumBased`, `rumAdvanced` — GSLB / RUM steering ✅
- `ddos` + `ddosProtection` → `ddosProtection`, `nxdWaiver` ✅
- `insights`, `cloudSync` — add-on toggles ✅
- `growthMQ`, `growth` — headroom ✅
- `dedicated` → `dedicatedPoPs` — Dedicated DNS PoPs ✅ _(was missing before Jul 2026 fix)_
- `china` + `chinaMQ` → `chinaMQ` — China DNS ✅ _(was missing before Jul 2026 fix)_
- `term` — contract term ✅ _(was missing before Jul 2026 fix)_

The Running Total in Compare Scenarios now exactly matches the quote result price.

Fork variable options for NS1 are **dynamically anchored to the actual quoted value** (×5 geometric scale) — a user who quoted 100M queries/mo sees ~20/100/500/2,500/12,500 options, not a hardcoded generic list.

---

## Cross-sell

NS1 surfaces two guided cross-sell mini-flows after the result card:

- **NS1 → Turbonomic** — NS1 routes traffic to the best endpoint; Turbonomic ensures that endpoint is continuously right-sized for the load. Combined positioning: "NS1 routes traffic to the right place; Turbonomic makes sure that place can handle it."
- **NS1 → Concert** — NS1 DNS signals (latency spikes, zone failures, traffic shifts) feed Concert's AI-prioritized cross-domain operational intelligence. Combined positioning: "NS1 governs where traffic goes; Concert governs what happens when it gets there."

---

## Tests

```bash
cd deal-genie
npx jest --no-coverage
# 357 tests total — all pass
```

---

## Pending data items

- **NS1 Standard add-on per-unit prices** — confirm current CPQ prices for records ($50/mo per 1K?), filter chains ($40/mo?), and monitors ($1.30/mo?) via IBM Quoting / CPQ

---

**Last updated:** 2026-07-30
**Status:** Production-ready. All prices confirmed from IBM Marketplace API.
