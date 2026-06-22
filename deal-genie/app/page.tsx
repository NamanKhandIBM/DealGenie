"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ConversationState, Message } from "@/lib/types";
import { initialState } from "@/lib/types";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Welcome to the **IBM Quoting Assistant**.\n\nI turn client requirements into **part numbers + quantities** ready to paste into CPQ.\n\nWhich product would you like to quote?\n\n1. **IBM Security Verify**\n2. **NS1 Connect**\n3. **IBM HashiCorp Vault**\n\nReply with the name or number.",
  timestamp: Date.now(),
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [state, setState] = useState<ConversationState>(initialState);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, state }),
        });
        const json = await res.json();
        const reply: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: json.reply,
          timestamp: Date.now(),
        };
        setMessages((m) => [...m, reply]);
        setState(json.state);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "⚠️ Something went wrong. Please try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, state]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const quickPicks = ["IBM Security Verify", "NS1 Connect", "IBM HashiCorp Vault"];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0f62fe] text-white px-6 py-4 flex items-center gap-3 shadow-md flex-shrink-0">
        <div className="w-8 h-8 bg-white rounded-sm flex items-center justify-center">
          <span className="text-[#0f62fe] font-bold text-xs">IBM</span>
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">Quoting Assistant</h1>
          <p className="text-blue-200 text-xs">Requirements → Part Numbers → CPQ</p>
        </div>
        <button
          onClick={() => {
            setMessages([WELCOME_MESSAGE]);
            setState(initialState);
            setInput("");
          }}
          className="ml-auto text-xs text-blue-200 hover:text-white border border-blue-300 hover:border-white px-3 py-1 rounded transition-colors"
        >
          New Quote
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm pl-2">
              <span className="animate-pulse">●</span>
              <span className="animate-pulse delay-75">●</span>
              <span className="animate-pulse delay-150">●</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick picks — only show at product-select phase */}
      {(state.phase === "welcome" || state.phase === "product-select") && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto flex gap-2 flex-wrap">
            {quickPicks.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={loading}
                className="text-sm bg-white border border-gray-300 hover:border-[#0f62fe] hover:text-[#0f62fe] px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer and press Enter…"
            disabled={loading}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f62fe] focus:border-transparent disabled:opacity-50 bg-white"
            style={{ minHeight: "44px", maxHeight: "200px" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${t.scrollHeight}px`;
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="bg-[#0f62fe] hover:bg-[#0353e9] text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            Send
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          All prices are LIST — confirm exact pricing and discounts in CPQ
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#0f62fe] text-white text-xs flex items-center justify-center font-bold flex-shrink-0 mr-2 mt-1">
          Q
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[#0f62fe] text-white rounded-br-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="prose prose-sm max-w-none prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-[#0f62fe] prose-table:text-xs">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
