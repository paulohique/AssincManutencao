import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { UserNav } from "@/components/auth/UserNav";
import { IdleAutoRefresh } from "@/components/IdleAutoRefresh";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "Assinc Manutenções",
  description: "Controle de manutenção preventiva e corretiva (GLPI)"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <IdleAutoRefresh idleMinutes={5} />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
            <div className="mx-auto max-w-7xl px-6 py-7">
              <div className="flex items-start justify-between gap-6">
                <Link href="/" className="flex items-center gap-3" aria-label="Ir para a tela principal">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl">
                  <svg className="h-7 w-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894c.07.424.37.77.78.916.382.136.743.3 1.079.49.37.21.82.18 1.13-.095l.654-.588a1.125 1.125 0 011.547 0l.773.773c.42.42.42 1.127 0 1.547l-.588.654c-.275.31-.305.76-.095 1.13.19.336.354.697.49 1.079.146.41.492.71.916.78l.894.149c.542.09.94.56.94 1.11v1.094c0 .55-.398 1.02-.94 1.11l-.894.149c-.424.07-.77.37-.916.78a6.98 6.98 0 01-.49 1.079c-.21.37-.18.82.095 1.13l.588.654c.42.42.42 1.127 0 1.547l-.773.773a1.125 1.125 0 01-1.547 0l-.654-.588c-.31-.275-.76-.305-1.13-.095a6.98 6.98 0 01-1.079.49c-.41.146-.71.492-.78.916l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.07-.424-.37-.77-.78-.916a6.98 6.98 0 01-1.079-.49c-.37-.21-.82-.18-1.13.095l-.654.588a1.125 1.125 0 01-1.547 0l-.773-.773a1.125 1.125 0 010-1.547l.588-.654c.275-.31.305-.76.095-1.13a6.98 6.98 0 01-.49-1.079c-.146-.41-.492-.71-.916-.78l-.894-.149C3.398 14.114 3 13.644 3 13.094v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.77-.37.916-.78.136-.382.3-.743.49-1.079.21-.37.18-.82-.095-1.13l-.588-.654a1.125 1.125 0 010-1.547l.773-.773a1.125 1.125 0 011.547 0l.654.588c.31.275.76.305 1.13.095.336-.19.697-.354 1.079-.49.41-.146.71-.492.78-.916l.149-.894z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      Assinc Manutenções
                    </h1>
                    <p className="mt-1 text-sm text-blue-100">
                      Controle de manutenção preventiva e corretiva dos dispositivos integrados ao GLPI
                    </p>
                  </div>
                </Link>

                <div className="pt-1">
                  <UserNav />
                </div>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
