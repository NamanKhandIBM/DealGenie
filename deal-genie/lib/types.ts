// Shared types for the conversational quoting assistant.

export type Product = "Verify" | "NS1" | "Vault";

export type ConversationPhase =
  | "welcome"
  | "product-select"
  | "discovery"
  | "computing"
  | "result"
  | "best-practices";

export interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

export interface ConversationState {
  phase: ConversationPhase;
  product: Product | null;
  // Collected answers keyed by question index
  answers: Record<string, string | number | boolean | string[]>;
  // Which discovery question step we're on
  discoveryStep: number;
  messages: Message[];
  // When true, AI SME speaks directly to the client (customer-facing language)
  clientMode?: boolean;
}

export const initialState: ConversationState = {
  phase: "welcome",
  product: null,
  answers: {},
  discoveryStep: 0,
  messages: [],
  clientMode: false,
};
