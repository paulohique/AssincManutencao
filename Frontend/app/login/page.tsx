"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setToken } from "@/lib/auth";
import { getPyApiBaseUrl } from "@/lib/py-api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let base: string;
    try {
      base = getPyApiBaseUrl();
    } catch {
      setError("NEXT_PUBLIC_PY_API_URL não configurada");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const msg = res.status === 401 ? "Usuário ou senha inválidos" : `Falha no login: ${res.status}`;
        throw new Error(msg);
      }

      const data = await res.json();
      const token = String(data?.access_token ?? "");
      if (!token) throw new Error("Resposta inválida do servidor");

      setToken(token);
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Falha no login");
    } finally {
      setLoading(false);
      setPassword("");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
        <p className="mt-2 text-sm text-gray-600">
          Seja bem vindo ao Assinc Manutenções!
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Usuário</label>
            <div className="mt-2">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: joao.silva"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Senha</label>
            <div className="mt-2">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">Erro: {error}</p> : null}

          <Button variant="primary" type="submit" disabled={loading || !username || !password} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-gray-500">
          Dica: você pode usar <span className="font-mono">usuario@dominio</span> ou <span className="font-mono">DOMINIO\\usuario</span>.
        </p>
      </div>
    </div>
  );
}
