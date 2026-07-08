import { NextRequest, NextResponse } from "next/server";
import {
  saveQuote,
  listQuotes,
  deleteQuote,
  buildQuoteLabel,
  extractSummary,
  type SavedQuote,
} from "@/lib/quote-history";

// GET /api/quotes — return all saved quotes newest first
export async function GET() {
  try {
    const quotes = await listQuotes();
    return NextResponse.json({ quotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[quotes GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/quotes — save a new quote
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, product, answers, chatSnapshot, name } = body;

    if (!id || !product || !answers) {
      return NextResponse.json({ error: "Missing id, product, or answers" }, { status: 400 });
    }

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "A quote name is required" }, { status: 400 });
    }

    // Uniqueness check — scan existing quotes for same name (case-insensitive)
    const existing = await listQuotes();
    const duplicate = existing.find(
      (q) => q.name && q.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: `A quote named "${duplicate.name}" already exists. Please choose a different name.` },
        { status: 409 }
      );
    }

    const lastAssistantMsg = [...(chatSnapshot ?? [])]
      .reverse()
      .find((m: { role: string }) => m.role === "assistant")?.content;

    const summary = extractSummary(product, answers, lastAssistantMsg);
    const label = buildQuoteLabel(product, summary);

    const quote: SavedQuote = {
      id,
      savedAt: Date.now(),
      name: trimmedName,
      label,
      product,
      answers,
      summary,
      chatSnapshot: chatSnapshot ?? [],
    };

    const saved = await saveQuote(quote);
    return NextResponse.json({ quote: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[quotes POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/quotes?id=...&rev=... — delete a quote
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const rev = searchParams.get("rev");
    if (!id || !rev) {
      return NextResponse.json({ error: "Missing id or rev" }, { status: 400 });
    }
    await deleteQuote(id, rev);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[quotes DELETE]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
