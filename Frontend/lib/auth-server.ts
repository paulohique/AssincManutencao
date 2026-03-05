import { cookies } from "next/headers";

const TOKEN_COOKIE = "glpi_manutencao_token";

export function getServerToken(): string | null {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return token ? String(token) : null;
}

export function serverAuthHeaders(): HeadersInit {
  const token = getServerToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
