import { NextRequest, NextResponse } from "next/server";
import { processUserMessage } from "@/lib/conversation";
import type { ConversationState } from "@/lib/types";
import { initialState } from "@/lib/types";
import { extractEntities } from "@/lib/extractor";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message: string = body.message ?? "";
  const state: ConversationState = body.state ?? initialState;

  // Run watsonx entity extraction in parallel with state prep.
  // If extraction fails (network error, bad JSON, etc.) it returns {} and
  // the conversation engine falls back to its normal question-by-question flow.
  const entities = await extractEntities(message);

  const result = processUserMessage(state, message, entities);

  return NextResponse.json({
    reply: result.reply,
    state: result.state,
    activeQuestion: result.activeQuestion,
  });
}
