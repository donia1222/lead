import { useState } from "react";
import { NextResponse } from "next/server";
import { getDomain } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { Loader } from "@/components/loader";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      setLoading(false);
      setError("Invalid code");
      return;
    }

    const data = await res.json();
    if (data.ok) {
      window.location.href = "/";
    } else {
      setLoading(false);
      setError("Failed to authenticate");
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Hey</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="code" className="sr-only">Code</label>
              <input
                id="code"
                name="code"
                type="text"
                autoComplete="code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Code"
              />
            </div>
            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {loading ? <Loader /> : "Login"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
