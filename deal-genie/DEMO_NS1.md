# NS1 Feature Demo Guide

> **Note:** This guide was written during early development. The NS1 implementation is now production-ready with confirmed IBM Marketplace prices. Part numbers are real (not placeholders). See `NS1_IMPLEMENTATION.md` for the full technical reference.

---

## Quick test scenario

1. Open the app at `http://localhost:3000` and log in
2. Select **NS1 Connect** from the product picker
3. Answer the discovery questions — example inputs below:

| Question | Example answer |
|---|---|
| Current DNS provider | Route53 |
| Query volume | 200 (million queries/month) |
| DNS records | 8,000 |
| GSLB / traffic steering | Yes, RUM-based |
| Filter chains | 5 |
| Health monitors | 10 |
| Dedicated PoPs | No |
| China DNS | No |
| DNS Insights | Yes |
| Growth headroom | 25M |
| Contract term | 3-year |

4. The result card will show:
   - Real IBM part numbers (D0GN*) with quantities and list prices
   - Monthly and annual totals
   - A CPQ Input Summary table ready to paste into IBM Software CPQ
   - Flags: SLA requirement, pricing notes, discount guidance
   - Cross-sell attach cards for **Turbonomic** and **Concert**

---

## What the result includes

```
📋 PART NUMBERS FOR CPQ
┌──────────┬────────────────────────────────────┬──────┬────────────────┬──────────────────┐
│ Part #   │ Description                        │ Qty  │ List $/mo      │ Extended $/mo    │
├──────────┼────────────────────────────────────┼──────┼────────────────┼──────────────────┤
│ D0GNEZX  │ Managed DNS Requests               │  20  │ $5.47/Request  │ ~$109/mo         │
│ D0GNFZX  │ Managed DNS Records                │ 7000 │ $0.15/1K recs  │ ~$1,050/mo       │
│ D0GNGZX  │ Filter Chains (GSLB)               │  5   │ $40.00/chain   │ $200/mo          │
│ D0GNHZX  │ RUM Packs                          │ 40   │ $12.00/pack    │ $480/mo          │
│ D0GNIZX  │ Monitors                           │ 10   │ $1.30/monitor  │ $13/mo           │
│ D0GN6ZX  │ DNS Insights                       │ 20   │ (qty=MQ value) │ $X/mo            │
│ D0GNDZX  │ SLA (required)                     │  1   │ flat           │ flat             │
└──────────┴────────────────────────────────────┴──────┴────────────────┴──────────────────┘

~$X,XXX/mo  ·  ~$XX,XXX/yr list
```

The exact prices depend on the graduated pricing tiers — use the CPQ Input Summary to enter into IBM Software CPQ for the confirmed price.

---

## Compare Scenarios

After getting the result, click **Compare Scenarios** to open the what-if explorer:

- **Fork variable options are anchored** to your actual quote (200M queries → options like 40/200/1K/5K/25K)
- **Running Total** matches the quote result price exactly — dedicated PoPs, China DNS, and contract term are all included
- **Add-on panel** (right side) lets you toggle DDoS / NXD protection on/off and see the price delta live

---

**Status:** Production-ready. All prices confirmed from IBM Marketplace API.
**Last updated:** 2026-07-30
