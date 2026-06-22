import { NextRequest, NextResponse } from "next/server";
import { processUserMessage } from "@/lib/conversation";
import type { ConversationState } from "@/lib/types";
import { initialState } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message: string = body.message ?? "";
  const state: ConversationState = body.state ?? initialState;

  const result = processUserMessage(state, message);

  return NextResponse.json({
    reply: result.reply,
    state: result.state,
    activeQuestion: result.activeQuestion,
  });
}
