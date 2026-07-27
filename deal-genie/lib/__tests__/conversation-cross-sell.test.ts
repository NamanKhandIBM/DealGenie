import { initialState } from "../types";
import { processUserMessage } from "../conversation";

function runConversation(messages: string[]) {
  let state = JSON.parse(JSON.stringify(initialState));
  let lastReply = "";
  let lastActiveQuestionKey: string | null = null;

  for (const message of messages) {
    const result = processUserMessage(state, message, {});
    state = result.state;
    lastReply = result.reply;
    lastActiveQuestionKey = result.activeQuestion?.question.key ?? null;
  }

  return { state, lastReply, lastActiveQuestionKey };
}

describe("cross-sell conversation flows", () => {
  test("Verify seller with adaptive + lifecycle launches Vault mini-flow", () => {
    const { state, lastReply, lastActiveQuestionKey } = runConversation([
      "Verify",
      "quote",
      "SSO,MFA,Adaptive,Lifecycle",
      "12000",
      "12",
      "8000",
      "none",
      "none",
      "1",
      "12-month",
      "cross-sell",
    ]);

    expect(state.product).toBe("Vault");
    expect(state.phase).toBe("discovery");
    expect(state.answers.crossSellSource).toBe("Verify");
    expect(lastActiveQuestionKey).toBe("installCount");
    expect(lastReply).toContain("Guided cross-sell mini-flow: IBM HashiCorp Vault");
  });

  test("Verify seller with a very light motion remains in discovery until the regions question", () => {
    const { state, lastReply, lastActiveQuestionKey } = runConversation([
      "Verify",
      "quote",
      "SSO",
      "1500",
      "12",
      "none",
      "1",
    ]);

    expect(state.product).toBe("Verify");
    expect(state.phase).toBe("discovery");
    expect(state.answers.crossSellSource).toBeUndefined();
    expect(lastActiveQuestionKey).toBe("regions");
    expect(lastReply).toBe("");
  });

  test("Verify seller with an adaptive-only motion still finishes the quote before cross-sell is available", () => {
    const { state, lastReply, lastActiveQuestionKey } = runConversation([
      "Verify",
      "quote",
      "SSO,MFA,Adaptive",
      "1500",
      "12",
      "none",
      "1",
      "12-month",
      "cross-sell",
    ]);

    expect(state.product).toBe("Verify");
    expect(state.phase).toBe("result");
    expect(state.answers.crossSellSource).toBeUndefined();
    expect(lastActiveQuestionKey).toBeNull();
    expect(lastReply).toContain("Type **cross-sell** to launch the guided mini-flow.");
  });

  test("Verify seller with an adaptive-only completed result launches MaaS360 after requesting cross-sell from result state", () => {
    const { state, lastReply, lastActiveQuestionKey } = runConversation([
      "Verify",
      "quote",
      "SSO,MFA,Adaptive",
      "1500",
      "12",
      "none",
      "1",
      "12-month",
      "cross-sell",
      "cross-sell",
    ]);

    expect(state.product).toBe("MaaS360");
    expect(state.phase).toBe("discovery");
    expect(state.answers.crossSellSource).toBe("Verify");
    expect(lastActiveQuestionKey).toBe("maas360Devices");
    expect(lastReply).toContain("Guided cross-sell mini-flow: IBM MaaS360");
  });

  test("Vault seller launches Verify mini-flow", () => {
    const { state, lastReply, lastActiveQuestionKey } = runConversation([
      "Vault",
      "quote",
      "2",        // installCount (vaultModel removed)
      "dynamic,ssh",
      "100",
      "yes",
      "cross-sell",
    ]);

    expect(state.product).toBe("Verify");
    expect(state.phase).toBe("discovery");
    expect(state.answers.crossSellSource).toBe("Vault");
    expect(lastActiveQuestionKey).toBe("verifyPopulation");
    expect(lastReply).toContain("Guided cross-sell mini-flow: IBM Security Verify");
  });

  test("Verify to Vault full seller flow reaches Vault result with Verify context", () => {
    const { state, lastReply, lastActiveQuestionKey } = runConversation([
      "Verify",
      "quote",
      "SSO,MFA,Adaptive,Lifecycle",
      "18000",
      "12",
      "9000",
      "none",
      "none",
      "1",
      "12-month",
      "cross-sell",
      // Vault cross-sell: vaultModel removed — new order: installCount → useCases → ...
      "2",            // installCount
      "static,dynamic,pki",
      "250",          // staticSecretCount
      "100",          // dynamicRoles
      "250",          // pkiCertsPerMonth
      "2160",         // pkiCertLifetime
      "yes",          // includeNonProd
      "machine-identity", // vaultCrossSellReason
    ]);

    expect(state.product).toBe("Vault");
    expect(state.phase).toBe("result");
    expect(lastActiveQuestionKey).toBeNull();
    expect(lastReply).toContain("<strong>Why this attach:</strong> This Vault quote was launched from <strong>IBM Security Verify</strong>");
    expect(lastReply).toContain("machine-identity controls to close the remaining trust gap");
  });

  test("Vault to Verify full seller flow reaches Verify result with Vault context", () => {
    const { state, lastReply, lastActiveQuestionKey } = runConversation([
      "Vault",
      "quote",
      "1",        // installCount (vaultModel removed)
      "dynamic,pki",
      "100",
      "250",
      "2160",
      "no",       // includeNonProd
      "cross-sell",
      "4000",
      "yes",
      "yes",
      "yes",
      "no",
      "privileged-access",
    ]);

    expect(state.product).toBe("Verify");
    expect(state.phase).toBe("result");
    expect(lastActiveQuestionKey).toBeNull();
    expect(lastReply).toContain("<strong>Why this attach:</strong> This Verify quote was launched from <strong>IBM HashiCorp Vault</strong>");
    expect(lastReply).toContain("privileged-access");
  });

  test("MaaS360 to Verify full seller flow reaches Verify result with MaaS360 context", () => {
    const { state, lastReply, lastActiveQuestionKey } = runConversation([
      "MaaS360",
      "quote",
      "3000",
      "yes",
      "yes",
      "yes",
      "no",
      "no",
      "cross-sell",
      "3000",
      "yes",
      "yes",
      "yes",
      "no",
      "device-trust",
    ]);

    expect(state.product).toBe("Verify");
    expect(state.phase).toBe("result");
    expect(lastActiveQuestionKey).toBeNull();
    expect(lastReply).toContain("<strong>Why this attach:</strong> This Verify quote was launched from <strong>IBM MaaS360</strong>");
    expect(lastReply).toContain("managed devices, endpoint posture, or mobile risk should feed directly into SSO, MFA, and adaptive access decisions");
  });
});
