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
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          Lead Prospector
        </h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          Zugangscode eingeben
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600"
            autoFocus
            required
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "..." : "Zugang"}
          </button>
        </form>

        <p className="text-gray-600 text-xs text-center mt-6">Lweb</p>
      </div>
    </main>
  );
}
