"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  defaultNextDueDays?: number;
};

export function MaintenanceModal({ defaultNextDueDays = 365 }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"Preventiva" | "Corretiva">("Preventiva");
  const [description, setDescription] = useState("");
  const [performedAt, setPerformedAt] = useState("");
  const [nextDueDays, setNextDueDays] = useState(defaultNextDueDays);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextDueDisabled = useMemo(() => type !== "Preventiva", [type]);

  async function onSubmit() {
    setIsSaving(true);
    setError(null);
    try {
      // No MVP do front: apenas simula o envio.
      // Quando a Python API estiver rodando, você pode chamar um endpoint real aqui.
      const payload = {
        maintenance_type: type,
        maintenance_description: description,
        performed_at: performedAt,
        next_due_days: nextDueDisabled ? null : nextDueDays
      };

      // eslint-disable-next-line no-console
      console.log("submitMaintenance", payload);

      setOpen(false);
      setDescription("");
      setPerformedAt("");
      setNextDueDays(defaultNextDueDays);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" className="shadow-lg hover:shadow-xl transition-shadow">
          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Adicionar Manutenção
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Adicionar Manutenção</DialogTitle>
          <DialogDescription className="text-base">
            Preencha os campos abaixo para registrar uma manutenção.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Tipo de Manutenção</label>
            <div className="mt-2">
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preventiva">Preventiva</SelectItem>
                  <SelectItem value="Corretiva">Corretiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Descrição</label>
            <div className="mt-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva a manutenção realizada..."
                className="min-h-[100px] resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-extrabold">Data Realizada</label>
              <div className="mt-2">
                <Input
                  type="date"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-extrabold">Próxima Manutenção (dias)</label>
              <div className="mt-2">
                <Input
                  type="number"
                  min={1}
                  disabled={nextDueDisabled}
                  value={nextDueDays}
                  onChange={(e) => setNextDueDays(Number(e.target.value))}
                />
              </div>
              {nextDueDisabled ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Para corretiva, a próxima manutenção fica “a agendar”.
                </p>
              ) : null}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">Erro: {error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button variant="primary" type="button" onClick={onSubmit} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
