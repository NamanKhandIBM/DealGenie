# IBM Quoting Assistant — Product Spec & Build Brief

*Prepared for Naman's IBM internship project. Source material: three meeting transcripts (Dennis Weru / Verify, Tony Nicolakis / NS1, Olivia Erdman / Vault) plus three pricing artifacts (Verify SaaS RU calculator, NS1 L2 Seller Deck, IBM HashiCorp Product Pricing Guidance).*

---

## 1. The problem, in one sentence

IBM's quoting tool (SAP CPQ) speaks only **part numbers and quantities**. Clients speak in **capabilities, user counts, and budgets**. The translation between the two is the hard, undocumented, tribal-knowledge step — and it's exactly what this tool automates.

Dennis Weru put the scope in his own words: *"translate customer requirements into part numbers and quantities. If nothing else, that's a simple message."* Everything past that point — discounts, approvals, the CPQ workflow itself — he called out as beyond the team's influence (it's an IBM Finance tool). **That sentence is the MVP boundary. Hold it.**

---

## 2. What we're building

A **product-agnostic, conversational quoting assistant** that sits *outside* CPQ. The flow:

1. User picks a product (Verify, NS1, Vault to start).
2. The tool states how that product is licensed and asks the right discovery questions.
3. User enters the client's answers.
4. The tool computes the required units and returns **part number(s) + quantities**, ready to paste into CPQ.
5. (Bonus) The tool returns a **ballpark list price** so the seller can give a live answer on a call.

The manual CPQ step stays manual — by design. The tool is a translator, not a replacement for the quoting system.

This matches Naman's own pitch ("one dashboard / chatbot instead of separate links per product") and Dennis confirmed it with *"that's perfect."*

---

## 3. Stakeholders & what each one actually needs

| Person | Product | Role in this project | What they need from the tool | Notes |
|---|---|---|---|---|
| **Dennis Weru** | Verify | Project sponsor (with Garland). Best-documented product. | Requirement→part#+qty translation, usable live on a client call; standalone/agnostic; ideally auto-updates from Seismic; ballpark pricing. | Your **beachhead**. Verify is fully specced and Dennis is motivated. |
| **Tony Nicolakis** | NS1 | NS1 walkthrough. | A part-number lookup so he stops memorizing random `D…ZX` strings; one dashboard for all products. | Says NS1 is "the most simple" to quote. Escalation expert: **Nick Lammert**. |
| **Olivia Erdman** | Vault | Vault walkthrough. | Part-number help (had to trial-and-error with HashiCorp SCs); ICN/customer-number disambiguation; wants ISC (Salesforce) integration. | Vault is the **newest** product — nobody on the team had quoted it before. Pain is loudest here, data availability is best for it (full HashiCorp guide). |
| **Ranya El-Shinawy** | — | Co-intern, co-building. | Sourcing NS1 part numbers via Slack. | |
| **Naman** | — | Builder. | — | Vision: single chatbot, all products, extensible. |

---

## 4. The three products (what BOB has to know)

### 4.1 Verify — **fully specced. Lead with this.**
- **Metric:** Resource Units (RU). Consumable part **D0231ZX** @ **$281.40/RU/yr**.
- **Five capabilities**, each burning RUs at a graduated rate:
  - SSO, MFA, Adaptive Access → driven by **Monthly Active Users (MAU)**
  - Lifecycle Management & Governance, Analytics → driven by **# Managed Users**
- **MAU = ROUNDUP( population × MIN(avg_logins_per_year, 12) ÷ 12 )**. If avg logins ≥ 12, MAU = population.
- Validated against Dennis's example: 500 users, SSO, logins ≥12 → MAU 500 → 500 × 0.10 = **50 RU of D0231ZX**. Exact match.
- Add-ons all have real part numbers (SMS/Email MFA, Hosted App Gateway, Vanity Domain, Non-Prod ±SLA).
- Full rate tables and add-on prices are in the master prompt.

### 4.2 NS1 — **pricing model known, part numbers MISSING.**
- **Metric:** Queries (millions/month, "MQ", required), Records (3,000 free), Filter Chains (traffic steering), Monitors.
- Tiered query pricing model is known (tier table in the master prompt) but the deck stamps it **"illustrative only."**
- Add-ons: Dedicated DNS, DNS for China, DNS Insights, GSLB (requires Managed DNS), Traffic Steering, spike/DDoS protection.
- **GAP: no CPQ part numbers exist in any provided document.** BOB must ask the right questions and compute unit counts, but must **refuse to invent part numbers** and instead tell the user to pull them from CPQ / Tony / Nick Lammert. This is wired into the prompt.

### 4.3 Vault (IBM HashiCorp) — **fully specced, but has a fork.**
- **Two mutually-exclusive models — you may NOT mix them for one customer:**
  - **Platform / Resource Units (RU)** — new + land/expand. Parts: Install **D15FQZX** ($96k), RU **D15FKZX** ($48), Non-Prod **D155GZX**, KMIP **D155LZX**, Custom Plugin **D1556ZX**.
  - **Clients / RVU** — renewals + stable. Parts: Essentials **D1015ZX**, Standard **D101FZX**, Premium **D101AZX**, Client **D1017ZX** ($1,296), Non-Prod **D1018ZX**, PKI **D1406ZX/D1405ZX**, ADP **D1013ZX/D1014ZX**.
- RU counting rules (Static Secrets, Dynamic, PKI, SSH, Transit/Transform, KMSE) and both discount tables are in the master prompt.
- Olivia's "3 certificates across 6 servers" maps roughly to PKI certs + Installs/clusters — the ambiguity she hit is *exactly* what the tool removes.
- The broader HashiCorp guide also fully specs **Terraform, Packer, Nomad, Consul, Boundary, Vault Radar** with part numbers — so Vault is your on-ramp to the entire IBM Automation family later.

---

## 5. Scope guardrails

**In scope (MVP):** requirement → part number + quantity, for Verify / NS1 / Vault, conversationally, with ballpark list pricing where data allows (Verify, Vault).

**Out of scope (Dennis was explicit):** CPQ discount calculation, approval routing, quote submission, VAD handoff. Don't build toward CPQ's internals.

**Stretch (wishes, not MVP):**
- Auto-sync from Seismic so the tool never quotes a retired metric. *This is the riskiest line in all three meetings — a genuine data-engineering problem. Build the static-but-correct version first; flag sync as Phase 2.*
- ISC / Salesforce integration (Olivia's ask).
- ICN / Passport Advantage disambiguation (Olivia's Vault pain) — a separate feature from quoting; park it.

---

## 6. Known data gaps / TODO before this is production-trustworthy

1. **NS1 CPQ part numbers** — missing entirely. Source from CPQ export, Tony, or Nick Lammert. Until then BOB returns *unit counts only* for NS1 and says so.
2. **NS1 real prices** — deck prices are "illustrative." Treat NS1 ballpark pricing as rough until confirmed.
3. **Confirm BOB's capabilities** — can it run arithmetic (graduated bracket math), or is it retrieval-only? The master prompt includes both the formulas (for a computing agent) and lookup tables (for a retrieval agent), so it degrades gracefully either way.
4. **Region multiplier (Verify)** and **3-yr vs 12-mo entitlement** — confirm whether these belong in the tool or stay manual.
5. **Source of truth** — decide where part-number tables live so updates don't mean editing the prompt by hand forever (a small Google Sheet BOB reads beats a hard-coded prompt).

---

## 7. Recommended build sequence

1. **Verify, end to end.** Full data, motivated sponsor, validated math. Get it returning `D0231ZX × N` + add-ons + ballpark. This is your proof.
2. **Vault.** Full data; handle the RU-vs-Client fork up front; biggest felt pain.
3. **NS1 questions + unit math now; part numbers when Ranya/Tony deliver them.**
4. Then use the working demo to pull the rest of the Automation family (Terraform/Consul/Nomad/Boundary) out of the HashiCorp guide — most of the work is already done there.

The companion file `BOB_Master_Prompt.md` is the self-contained prompt to paste into BOB. It embeds the full knowledge base for all three products so BOB can start from scratch.
