const TOKEN_KEY = "glpi_manutencao_token";

function getCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )glpi_manutencao_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookieToken(token: string) {
  if (typeof document === "undefined") return;
  document.cookie = `glpi_manutencao_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
}

function clearCookieToken() {
  if (typeof document === "undefined") return;
  document.cookie = "glpi_manutencao_token=; Path=/; Max-Age=0; SameSite=Lax";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY) || getCookieToken();
  } catch {
    return getCookieToken();
  }
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  setCookieToken(token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  clearCookieToken();
}
