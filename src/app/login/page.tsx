"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (data.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Falscher Zugangscode");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm border border-slate-200 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center font-bold text-xl shadow-sm mx-auto mb-4">L</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">
          Lead Prospector
        </h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          Zugangscode eingeben
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-slate-50 text-slate-900 px-4 py-3 rounded-lg text-center text-lg tracking-widest border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
            required
          />

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? "..." : "Zugang"}
          </button>
        </form>

        <p className="text-slate-400 text-xs text-center mt-6">Lweb</p>
      </div>
    </main>
  );
}
