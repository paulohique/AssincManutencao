import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminPermissionsClient } from "@/components/admin/AdminPermissionsClient";
import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/" aria-label="Voltar para a página principal" title="Voltar">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="ml-2">Voltar</span>
          </Link>
        </Button>
      </div>
      <AdminSettingsClient />
      <AdminPermissionsClient />
    </div>
  );
}
