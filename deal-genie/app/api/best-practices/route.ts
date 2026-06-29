import { NextRequest, NextResponse } from "next/server";
import type { Product } from "@/lib/types";
import {
  generateBestPracticesIntro,
  continueBestPracticesChat,
  type BestPracticesMessage,
} from "@/lib/best-practices-ai";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const product: Product = body.product;
  const history: BestPracticesMessage[] = body.history ?? [];
  const userMessage: string | undefined = body.message;
  const clientMode: boolean = body.clientMode ?? false;

  if (!product || !["Verify", "NS1", "Vault"].includes(product)) {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }

  try {
    // First call — no message yet, generate the intro
    if (!userMessage) {
      const intro = await generateBestPracticesIntro(product, clientMode);
      return NextResponse.json({ reply: intro });
    }

    // Follow-up question — continue the conversation
    const reply = await continueBestPracticesChat(product, history, userMessage, clientMode);
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[best-practices] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
