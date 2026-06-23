/**
 * Thin watsonx.ai wrapper.
 *
 * Handles:
 *  1. Exchanging an IBM Cloud API key for a short-lived IAM bearer token (cached until 80% of TTL)
 *  2. Calling the watsonx.ai text-generation endpoint
 *
 * Nothing in here knows about quoting logic — that lives in extractor.ts.
 */

const IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token";
const MODEL_ID = "ibm/granite-3-3-8b-instruct";

// ─── IAM token cache ──────────────────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number; // ms epoch
}

let tokenCache: TokenCache | null = null;

async function getIAMToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still has >20% of its life left
  if (tokenCache && now < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const apiKey = process.env.WATSONX_API_KEY;
  if (!apiKey) throw new Error("WATSONX_API_KEY is not set");

  const res = await fetch(IAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: apiKey,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IAM token fetch failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const ttlMs = (json.expires_in ?? 3600) * 1000;

  tokenCache = {
    token: json.access_token,
    expiresAt: now + ttlMs * 0.8, // refresh at 80% of TTL
  };

  return tokenCache.token;
}

// ─── Text generation ──────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** System-level instruction to the model */
  systemPrompt: string;
  /** The user turn to send */
  userMessage: string;
  /** Max tokens to generate (default 512) */
  maxNewTokens?: number;
}

export interface GenerateResult {
  text: string;
  /** True if the model stopped because it hit the token limit */
  truncated: boolean;
}

export async function watsonxGenerate(opts: GenerateOptions): Promise<GenerateResult> {
  const { systemPrompt, userMessage, maxNewTokens = 512 } = opts;

  const url = process.env.WATSONX_URL;
  const projectId = process.env.WATSONX_PROJECT_ID;
  if (!url) throw new Error("WATSONX_URL is not set");
  if (!projectId) throw new Error("WATSONX_PROJECT_ID is not set");

  const token = await getIAMToken();

  // Granite uses a simple <|system|> / <|user|> / <|assistant|> chat template
  const prompt =
    `<|system|>\n${systemPrompt}\n<|user|>\n${userMessage}\n<|assistant|>\n`;

  const body = {
    model_id: MODEL_ID,
    input: prompt,
    parameters: {
      decoding_method: "greedy",
      max_new_tokens: maxNewTokens,
      stop_sequences: ["<|user|>", "<|system|>"],
      repetition_penalty: 1.05,
    },
    project_id: projectId,
  };

  const res = await fetch(`${url}/ml/v1/text/generation?version=2023-05-29`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`watsonx generation failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const result = json.results?.[0];
  return {
    text: (result?.generated_text ?? "").trim(),
    truncated: result?.stop_reason === "max_tokens",
  };
}
