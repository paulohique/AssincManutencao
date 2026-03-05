const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#111827"/>
  <path d="M18 42V22h10.5c6.2 0 10.1 3.2 10.1 8.4 0 5.1-3.9 8.6-10.1 8.6H24v3.9H18zm6-9h4.3c3 0 4.8-1.2 4.8-3.7 0-2.2-1.8-3.5-4.8-3.5H24v7.2z" fill="#ffffff"/>
</svg>`;

export async function GET() {
  return new Response(svg, {
    headers: {
      // Muitos browsers pedem /favicon.ico por padrão; servir SVG aqui evita 404.
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
