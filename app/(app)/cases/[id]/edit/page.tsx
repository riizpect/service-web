"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientSupabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type EditableCase = {
  id: string;
  customer_name: string | null;
  location: string | null;
  service_date: string | null;
  technician_name: string | null;
  product_type: string | null;
  viper_serial_number: string | null;
  vls_serial_number: string | null;
  reference_number: string | null;
  final_status: string | null;
  final_comment: string | null;
  is_draft: boolean | null;
};

export default function EditCasePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditableCase | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClientSupabaseBrowser();
      const { data, error: loadError } = await supabase
        .from("service_cases")
        .select("*")
        .eq("id", params.id)
        .single();

      if (loadError || !data) {
        setError("Kunde inte läsa ärendet.");
      } else {
        setForm(data as EditableCase);
      }
      setLoading(false);
    };
    void load();
  }, [params.id]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    const supabase = createClientSupabaseBrowser();
    const { error: saveError } = await supabase
      .from("service_cases")
      .update({
        customer_name: form.customer_name,
        location: form.location,
        service_date: form.service_date,
        technician_name: form.technician_name,
        product_type: form.product_type,
        viper_serial_number: form.viper_serial_number,
        vls_serial_number: form.vls_serial_number,
        reference_number: form.reference_number,
        final_status: form.final_status,
        final_comment: form.final_comment,
        is_draft: form.is_draft
      })
      .eq("id", params.id);

    if (saveError) {
      setError("Kunde inte spara ändringar.");
      setSaving(false);
      return;
    }

    router.push(`/cases/${params.id}`);
  };

  if (loading) {
    return <div className="py-6 text-sm text-slate-500">Laddar ärende...</div>;
  }

  if (!form) {
    return <div className="py-6 text-sm text-red-600">{error ?? "Ärendet hittades inte."}</div>;
  }

  return (
    <main className="flex-1">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Redigera serviceärende</h1>

        <Card>
          <CardHeader>
            <CardTitle>Allmän information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Kundnamn"
              value={form.customer_name ?? ""}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, customer_name: event.target.value } : prev))
              }
            />
            <Input
              placeholder="Plats"
              value={form.location ?? ""}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, location: event.target.value } : prev))
              }
            />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input
                type="date"
                value={form.service_date ?? ""}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, service_date: event.target.value } : prev
                  )
                }
              />
              <Input
                placeholder="Servicetekniker"
                value={form.technician_name ?? ""}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, technician_name: event.target.value } : prev
                  )
                }
              />
            </div>
            <Input
              placeholder="Produkttyp"
              value={form.product_type ?? ""}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, product_type: event.target.value } : prev))
              }
            />
            <Input
              placeholder="VIPER serienummer"
              value={form.viper_serial_number ?? ""}
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, viper_serial_number: event.target.value } : prev
                )
              }
            />
            <Input
              placeholder="VLS serienummer"
              value={form.vls_serial_number ?? ""}
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, vls_serial_number: event.target.value } : prev
                )
              }
            />
            <Input
              placeholder="Arbetsorder / referensnummer"
              value={form.reference_number ?? ""}
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, reference_number: event.target.value } : prev
                )
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slutbedömning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={form.final_status ?? ""}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, final_status: event.target.value } : prev))
              }
            >
              <option value="">Välj status</option>
              <option value="Godkänd">Godkänd</option>
              <option value="Godkänd med anmärkning">Godkänd med anmärkning</option>
              <option value="Ej godkänd">Ej godkänd</option>
            </Select>
            <Textarea
              placeholder="Slutkommentar"
              value={form.final_comment ?? ""}
              onChange={(event) =>
                setForm((prev) => (prev ? { ...prev, final_comment: event.target.value } : prev))
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.is_draft)}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, is_draft: event.target.checked } : prev))
                }
              />
              Markera som utkast
            </label>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(`/cases/${params.id}`)}>
            Avbryt
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Sparar..." : "Spara ändringar"}
          </Button>
        </div>
      </div>
    </main>
  );
}

