"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const from = searchParams.get("from") ?? "/";
        router.push(from);
        router.refresh();
      } else {
        setError("Incorrect password. Try again.");
        setPassword("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-xs font-semibold"
          style={{ color: "rgba(147,180,253,0.7)" }}
        >
          Password
        </label>
        <input
          ref={inputRef}
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          placeholder="Enter password"
          className="input-glass px-4 py-3 text-sm rounded-xl w-full"
          style={{ color: "#e8eaed" }}
        />
      </div>

      {error && (
        <p
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.25)",
            color: "#f87171",
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password.trim()}
        className="btn-primary w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
            />
            Checking…
          </>
        ) : (
          "Enter →"
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <>
      {/* Same dark background as the main app */}
      <div className="app-bg" />

      <div
        className="relative flex min-h-screen items-center justify-center px-4"
        style={{ zIndex: 1 }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8"
          style={{
            background: "rgba(10,15,30,0.92)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Logo + title */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <img
              src="/dealgenie-icon.png"
              alt="Deal Genie"
              className="w-12 h-12 rounded-xl"
              style={{ objectFit: "contain" }}
            />
            <div className="text-center">
              <h1 className="font-bold text-lg" style={{ color: "#e8eaed" }}>
                Deal Genie
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.55)" }}>
                Internal tool — authorised users only
              </p>
            </div>
          </div>

          {/* Wrap in Suspense — required by Next.js for useSearchParams */}
          <Suspense>
            <LoginForm />
          </Suspense>

          <p
            className="text-center text-[10px] mt-6"
            style={{ color: "rgba(147,180,253,0.25)" }}
          >
            Session lasts 7 days
          </p>
        </div>
      </div>
    </>
  );
}
