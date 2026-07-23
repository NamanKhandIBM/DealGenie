# Cross-Sell Framework Plan

## Top-Level Overview
Add a reusable cross-sell framework to DealGenie that can recommend adjacent products during discovery and after quote generation, while implementing only the first motion in release 1: IBM Security Verify ↔ IBM MaaS360. The first release should optimize for the highest expected-value motion by making the Verify-first journey the most polished path, while still allowing lighter MaaS360-entry support on the same framework. It should use public MaaS360 pricing and package information to drive a lightweight recommendation and estimate flow without pretending to produce CPQ-ready MaaS360 part numbers. The design should preserve the current single-product quote engines, reuse existing comparison and quote-history patterns where possible, and store accepted cross-sell outcomes as two linked quote records. A second release can extend the same framework to internal-SKU MaaS360 quoting once that data is available.

## Sub-Tasks

### 1. Define the reusable cross-sell domain model and product metadata
- **Intent** — Introduce a lightweight framework for expressing cross-sell relationships, recommendation rationale, trigger conditions, and minimal follow-up discovery without forcing a full multi-product rewrite of the conversation engine.
- **Expected Outcomes** — The codebase has a clear source of truth for cross-sell plays, release-1 support is limited to Verify ↔ MaaS360, and future product adjacencies can be added through configuration-like metadata rather than scattered conditional logic.
- **Todo List**
  1. Add MaaS360 to the supported product vocabulary where product identity is defined.
  2. Create a dedicated cross-sell metadata module that defines supported plays, starting products, target products, positioning copy, and rationale.
  3. Encode the release-1 Verify ↔ MaaS360 motion using the researched value proposition: identity plus device posture for zero trust.
  4. Make the Verify-first path the default flagship motion because it is the strongest researched adjacency and the cleanest seller story.
  5. Include separate recommendation strengths for in-discovery hints and post-result recommendations.
  6. Keep release-1 scope explicitly limited to recommendation and estimate support, not MaaS360 CPQ part-number output.
- **Relevant Context** — [`Product`](deal-genie/lib/types.ts:3), [`detectProduct()`](deal-genie/lib/conversation.ts:56), [`PRODUCTS`](deal-genie/app/page.tsx:26), cross-sell research from the public framework page showing [`Verify → MaaS360`](https://sales-play-framework--maryamshah2348.replit.app/) and [`MaaS360 → Verify`](https://sales-play-framework--maryamshah2348.replit.app/) as strong motions.
- **Status** — [ ] pending

### 2. Add MaaS360 public-package knowledge and estimate inputs for release 1
- **Intent** — Ground the first MaaS360 flow in public evidence so sellers can get a credible recommendation and directional estimate without implying internal quote fidelity.
- **Expected Outcomes** — MaaS360 public plans, package differentiation, add-ons, public pricing, and simple seller-facing value framing for the Verify + MaaS360 motion are available in code for the AI SME and the release-1 estimate flow.
- **Todo List**
  1. Create a MaaS360 data module containing the public package tiers and package descriptions.
  2. Capture the public package pricing surfaced on the IBM product page.
  3. Capture public add-ons and pricing available from the IBM self-service product configuration page for the release-1 estimate scope.
  4. Define the minimum estimate inputs required for release 1, such as managed client device count, package choice, and optional add-ons.
  5. Add simple seller-facing zero-trust value messaging for the Verify + MaaS360 motion, including the business problem, why the pairing matters, and how to explain the combined story without overclaiming ROI precision.
  6. Make the data intentionally public-price-only and mark internal SKU quoting as a later phase.
- **Relevant Context** — Public pricing page [`IBM MaaS360 pricing`](https://www.ibm.com/products/maas360#pricing), self-service product configuration findings from the Essentials buy-now flow: base monthly price, annualized base price, overage price, Concierge setup service, Mobile Threat Defense Advanced, and TeamViewer Remote Support.
- **Status** — [ ] pending

### 3. Introduce in-flow cross-sell hints during discovery
- **Intent** — Help sellers uncover the adjacent need while they are still in the conversation, without derailing the active product quote flow, and bias the experience toward the highest-conviction Verify-first motion.
- **Expected Outcomes** — When discovery signals indicate a strong Verify ↔ MaaS360 adjacency, the chat can surface a lightweight hint with a pain-point-based rationale, simple seller-facing value messaging, and an option to explore later.
- **Todo List**
  1. Identify the minimum conditions in the current discovery flow that should trigger a cross-sell hint for Verify and MaaS360.
  2. Add non-blocking recommendation messaging that can appear during discovery without changing the current active question progression.
  3. Make the messaging anchored to business problems rather than product pushing.
  4. Include concise seller-facing language for the zero-trust story, such as identity policy plus device posture, compliance confidence, and reduced exposure from unmanaged devices.
  5. Ensure the hint can be dismissed or deferred so sellers can finish the original quote first.
  6. Keep hint logic driven by the new cross-sell metadata rather than hard-coded per-screen copy.
- **Relevant Context** — [`processUserMessage()`](deal-genie/lib/conversation.ts:176), question flow in [`VERIFY_QUESTIONS`](deal-genie/lib/questions.ts:26), current single-product state model in [`ConversationState`](deal-genie/lib/types.ts:20), cross-sell discovery prompt from the research page about device posture awareness in identity policy.
- **Status** — [ ] pending

### 4. Add a stronger post-result cross-sell recommendation and mini-flow
- **Intent** — Present the strongest cross-sell recommendation after the original quote result, when the seller has context, pricing, and momentum, then collect only the minimum extra information needed for the adjacent product estimate.
- **Expected Outcomes** — After a Verify or MaaS360 result, the UI can offer an explicit cross-sell recommendation, with the Verify-first path receiving the strongest polish and messaging. If accepted, the seller enters a guided mini-flow that asks only a small set of additional questions and then produces a second product recommendation beside the original quote.
- **Todo List**
  1. Add a post-result recommendation panel or card with value-chain rationale, buyer pain, and a call to start the mini-flow.
  2. Define the minimum-question MaaS360 mini-flow for release 1 using public-price estimate inputs only.
  3. Add seller-facing value and ROI-style messaging that frames the combined Verify + MaaS360 motion in practical terms, such as stronger zero-trust posture, fewer unmanaged-device gaps, and easier compliance conversations, while avoiding unsupported quantified claims.
  4. Keep the original product quote intact and append the cross-sell estimate as a companion result instead of replacing the first quote.
  5. Make the experience symmetrical enough that MaaS360 → Verify can later use the same framework, even if Verify-first is the first polished motion.
  6. Clearly label release-1 MaaS360 output as an estimate based on public pricing, not CPQ-ready part numbers.
- **Relevant Context** — Current result phase handling in [`processUserMessage()`](deal-genie/lib/conversation.ts:328), current result rendering patterns in [`computeVerifyResult()`](deal-genie/lib/conversation.ts:366), comparison/add-on interaction patterns in [`ScenarioCompare`](deal-genie/components/ScenarioCompare.tsx:39), researched recommendation that Verify + MaaS360 forms a zero-trust foundation.
- **Status** — [ ] pending

### 5. Save accepted cross-sell outcomes as linked quote records
- **Intent** — Preserve the current quote-history model while making it possible to trace that two quotes belong to the same cross-sell motion.
- **Expected Outcomes** — The original quote and the accepted cross-sell quote are stored as separate records with link metadata, so history, loading, and later comparison remain simple.
- **Todo List**
  1. Extend saved-quote metadata so one quote can reference a linked quote or bundle group identifier.
  2. Save the original quote and the cross-sell quote as two records rather than inventing a fully bundled quote schema in release 1.
  3. Ensure quote labels and summaries distinguish the base quote from the cross-sell estimate.
  4. Preserve backwards compatibility for existing saved quotes that have no linkage fields.
  5. Plan for future history UI affordances that can display linked quotes together without requiring them for release 1.
- **Relevant Context** — [`SavedQuote`](deal-genie/lib/quote-history.ts:23), save endpoint in [`POST`](deal-genie/app/api/quotes/route.ts:24), current label generation in [`buildQuoteLabel()`](deal-genie/lib/quote-history.ts:157).
- **Status** — [ ] pending

### 6. Prepare release 2 for internal MaaS360 SKU quoting on the same framework
- **Intent** — Ensure the release-1 framework does not dead-end once internal MaaS360 SKU and CPQ logic become available.
- **Expected Outcomes** — The plan explicitly separates the recommendation framework from the quoting fidelity layer so MaaS360 can evolve from public-price estimate to full deterministic quoting without redoing the user journey.
- **Todo List**
  1. Define release-2 scope as MaaS360 internal pricing, part numbers, and deterministic quote logic.
  2. Reserve a MaaS360 quote-engine slot that can later mirror the existing Verify, Vault, and NS1 engine pattern.
  3. Keep release-1 mini-flow question keys compatible with a future full MaaS360 engine where possible.
  4. Identify where the result formatter and quote summary logic will need MaaS360-specific extensions later.
  5. Avoid overbuilding release 1: no generalized bundle engine unless the first implementation proves the need.
- **Relevant Context** — Existing deterministic compute routing in [`computeResult()`](deal-genie/lib/conversation.ts:355), current product summary extraction in [`extractSummary()`](deal-genie/lib/quote-history.ts:170), IBM public pricing sources versus missing internal SKU data.
- **Status** — [ ] pending
