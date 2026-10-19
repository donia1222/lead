"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** La puerta. Fondo negro, el logo grande y nada mas: es la entrada al
 *  programa, no una pagina de la web. Igual que la del panel. */
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
      setError("Código incorrecto");
      setLoading(false);
    }
  }

  return (
    <main className="puerta">
      <div className="caja">
        <i aria-label="Lweb" />
        <p className="txt">Lead Prospector</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Código"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            required
          />
          {error && <p className="fallo">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="pie">Lweb · uso interno</p>
      </div>
    </main>
  );
}
