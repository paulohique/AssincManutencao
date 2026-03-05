export function getPyApiBaseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_PY_API_URL;

  // Dentro de containers, código server-side do Next precisa falar com o serviço
  // usando o hostname da rede docker (ex.: http://api:8000).
  const internalUrl = process.env.PY_API_INTERNAL_URL;

  const base = typeof window === "undefined" ? (internalUrl || publicUrl) : publicUrl;

  if (!base) {
    throw new Error("NEXT_PUBLIC_PY_API_URL não configurada");
  }

  return base.replace(/\/$/, "");
}
