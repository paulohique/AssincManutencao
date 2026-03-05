import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DeviceDetailClient } from "@/components/device/DeviceDetailClient";
import { getMeServer } from "@/services/meServerService";

type Props = {
  params: { id: string };
};

export default async function DeviceDetailPage({ params }: Props) {
  const { id } = params;

  const me = await getMeServer();
  const permissions = me?.permissions ?? {};
  const technicianName = me?.display_name || me?.username || "";
  const role = me?.role;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </Link>
            </Button>
            <h2 className="text-2xl font-bold text-gray-900">Detalhes do Dispositivo</h2>
          </div>
          <p className="mt-2 text-sm text-gray-600">ID: {id}</p>
        </div>
      </div>

      <DeviceDetailClient
        deviceId={id}
        permissions={permissions as any}
        technicianName={technicianName}
        role={role as any}
      />
    </div>
  );
}
