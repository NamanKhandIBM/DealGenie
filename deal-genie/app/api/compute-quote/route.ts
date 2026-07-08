import { NextRequest, NextResponse } from "next/server";
import { computeResult } from "@/lib/conversation";
import type { ConversationState } from "@/lib/types";
import { initialState } from "@/lib/types";

/**
 * POST /api/compute-quote
 *
 * Runs computeResult() directly on an already-complete set of answers.
 * Used by the scenario builder "Build quote with these settings" button —
 * skips the full question flow since all answers are already known.
 *
 * Body: { state: ConversationState }
 * Returns: { reply: string, state: ConversationState }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const state: ConversationState = body.state ?? initialState;

  if (!state.product) {
    return NextResponse.json({ error: "No product set on state" }, { status: 400 });
  }

  const reply = computeResult(state);
  const resultState: ConversationState = { ...state, phase: "result" };

  return NextResponse.json({ reply, state: resultState });
}
