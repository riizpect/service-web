"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientSupabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getChecklistForProductType, type ChecklistStatus, type ProductType } from "@/lib/checklistConfig";

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
  created_by: string | null;
};

type EditableChecklistItem = {
  id: string;
  section_key: string;
  item_key: string;
  item_label: string;
  item_status: ChecklistStatus;
  comment: string | null;
  part_replaced: boolean | null;
};

type EditablePart = {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  note: string | null;
  needs_order: boolean | null;
  order_status: "Ej beställd" | "Beställd" | "Mottagen" | "Monterad" | null;
  priority: "Låg" | "Medel" | "Hög" | null;
  reason: string | null;
};

type EditablePhoto = {
  id: string;
  image_url: string;
  caption: string | null;
};

export default function EditCasePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditableCase | null>(null);
  const [checklist, setChecklist] = useState<EditableChecklistItem[]>([]);
  const [parts, setParts] = useState<EditablePart[]>([]);
  const [photos, setPhotos] = useState<EditablePhoto[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClientSupabaseBrowser();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      const { data, error: loadError } = await supabase
        .from("service_cases")
        .select("*")
        .eq("id", params.id)
        .eq("created_by", user?.id ?? "")
        .single();

      if (loadError || !data) {
        setError("Kunde inte läsa ärendet.");
      } else {
        const loadedCase = data as EditableCase;
        setForm(loadedCase);

        const normalizedProductType: ProductType =
          loadedCase.product_type === "VIPER + VLS"
            ? "VIPER_VLS"
            : (loadedCase.product_type as ProductType);

        const expectedItems = getChecklistForProductType(normalizedProductType).flatMap(
          (section) =>
            section.items.map((item) => ({
              id: `${section.key}-${item.key}`,
              section_key: section.key,
              item_key: item.key,
              item_label: item.label,
              item_status: "EJ_KONTROLLERAD" as ChecklistStatus,
              comment: "",
              part_replaced: false
            }))
        );

        const { data: checklistData } = await supabase
          .from("service_checklist_items")
          .select("*")
          .eq("case_id", params.id);
        const checklistMap = new Map(
          (checklistData ?? []).map((item) => [
            `${item.section_key}-${item.item_key}`,
            item
          ])
        );
        setChecklist(
          expectedItems.map((item) => {
            const saved = checklistMap.get(`${item.section_key}-${item.item_key}`);
            return saved
              ? {
                  id: saved.id,
                  section_key: saved.section_key,
                  item_key: saved.item_key,
                  item_label: saved.item_label,
                  item_status: saved.item_status as ChecklistStatus,
                  comment: saved.comment,
                  part_replaced: saved.part_replaced
                }
              : item;
          })
        );

        const { data: partsData } = await supabase
          .from("service_parts")
          .select("*")
          .eq("case_id", params.id);
        setParts((partsData ?? []) as EditablePart[]);

        const { data: photosData } = await supabase
          .from("service_photos")
          .select("*")
          .eq("case_id", params.id);
        setPhotos((photosData ?? []) as EditablePhoto[]);
      }
      setLoading(false);
    };
    void load();
  }, [params.id]);

  const sections = useMemo(() => {
    if (!form?.product_type) return [];
    const type =
      form.product_type === "VIPER + VLS"
        ? "VIPER_VLS"
        : (form.product_type as ProductType);
    return getChecklistForProductType(type);
  }, [form?.product_type]);

  const addOrderPartFromDeviation = (sectionKey: string, itemKey: string, itemLabel: string) => {
    setChecklist((prev) =>
      prev.map((existing) =>
        existing.section_key === sectionKey && existing.item_key === itemKey
          ? { ...existing, item_status: "AVVIKELSE" }
          : existing
      )
    );
    setParts((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        part_name: "Defekt del (ej specificerad)",
        part_number: "",
        quantity: 1,
        note: "",
        needs_order: true,
        order_status: "Ej beställd",
        priority: "Medel",
        reason: `Avvikelse: ${itemLabel}`
      }
    ]);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    const supabase = createClientSupabaseBrowser();
    const validParts = parts.filter(
      (part) => Boolean(part.needs_order) || Boolean(part.part_name?.trim())
    );
    const requiresReturnVisit = validParts.some((part) => part.needs_order);
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
        is_draft: form.is_draft,
        requires_return_visit: requiresReturnVisit
      })
      .eq("id", params.id);

    if (saveError) {
      setError("Kunde inte spara ändringar.");
      setSaving(false);
      return;
    }

    await supabase.from("service_checklist_items").delete().eq("case_id", params.id);
    if (checklist.length > 0) {
      await supabase.from("service_checklist_items").insert(
        checklist.map((item) => ({
          case_id: params.id,
          section_key: item.section_key,
          item_key: item.item_key,
          item_label: item.item_label,
          item_status: item.item_status,
          comment: item.comment,
          part_replaced: item.part_replaced
        }))
      );
    }

    await supabase.from("service_parts").delete().eq("case_id", params.id);
    if (validParts.length > 0) {
      await supabase.from("service_parts").insert(
        validParts.map((part) => ({
          case_id: params.id,
          part_name: part.part_name?.trim() || "Defekt del (ej specificerad)",
          part_number: part.part_number,
          quantity: part.quantity,
          note: part.note,
          needs_order: part.needs_order,
          order_status: part.order_status,
          priority: part.priority,
          reason: part.reason
        }))
      );
    }

    await supabase.from("service_photos").delete().eq("case_id", params.id);
    const validPhotos = photos.filter((photo) => photo.image_url?.trim());
    if (validPhotos.length > 0) {
      await supabase.from("service_photos").insert(
        validPhotos.map((photo) => ({
          case_id: params.id,
          image_url: photo.image_url,
          caption: photo.caption
        }))
      );
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
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-slate-900">Redigera serviceärende</h1>
          <Link href={`/cases/${params.id}`}>
            <Button type="button" variant="outline" size="sm">
              Tillbaka
            </Button>
          </Link>
        </div>

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

        <Card>
          <CardHeader>
            <CardTitle>Checklista</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sections.map((section) => (
              <div key={section.key} className="space-y-2">
                <p className="text-sm font-semibold">{section.title}</p>
                {checklist
                  .filter((item) => item.section_key === section.key)
                  .map((item) => (
                    <div key={`${item.section_key}-${item.item_key}`} className="rounded-md border p-3 space-y-2">
                      <p className="text-sm">{item.item_label}</p>
                      <Select
                        value={item.item_status}
                        onChange={(event) =>
                          setChecklist((prev) =>
                            prev.map((existing) =>
                              existing.section_key === item.section_key &&
                              existing.item_key === item.item_key
                                ? {
                                    ...existing,
                                    item_status: event.target.value as ChecklistStatus
                                  }
                                : existing
                            )
                          )
                        }
                      >
                        <option value="OK">OK</option>
                        <option value="ATGÄRDAD">Åtgärdad</option>
                        <option value="AVVIKELSE">Avvikelse</option>
                        <option value="EJ_KONTROLLERAD">Ej kontrollerad</option>
                      </Select>
                      <Textarea
                        placeholder="Kommentar"
                        value={item.comment ?? ""}
                        onChange={(event) =>
                          setChecklist((prev) =>
                            prev.map((existing) =>
                              existing.section_key === item.section_key &&
                              existing.item_key === item.item_key
                                ? { ...existing, comment: event.target.value }
                                : existing
                            )
                          )
                        }
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(item.part_replaced)}
                          onChange={(event) =>
                            setChecklist((prev) =>
                              prev.map((existing) =>
                                existing.section_key === item.section_key &&
                                existing.item_key === item.item_key
                                  ? {
                                      ...existing,
                                      part_replaced: event.target.checked
                                    }
                                  : existing
                              )
                            )
                          }
                        />
                        Ersatt del
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          addOrderPartFromDeviation(item.section_key, item.item_key, item.item_label)
                        }
                      >
                        Kryssa defekt del (beställs senare)
                      </Button>
                    </div>
                  ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delar (bytta + att beställa)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Snabbt läge: klicka "Kryssa defekt del" i checklistan. Delen läggs till automatiskt
              utan artikelnummer.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setParts((prev) => [
                  ...prev,
                  {
                    id: `new-${Date.now()}`,
                    part_name: "",
                    part_number: "",
                    quantity: 1,
                    note: "",
                    needs_order: false,
                    order_status: "Ej beställd",
                    priority: "Medel",
                    reason: ""
                  }
                ])
              }
            >
              Lägg till del
            </Button>
            {parts.map((part, index) => (
              <div key={part.id} className="rounded-md border p-3 space-y-2">
                <Input
                  placeholder="Delnamn (valfritt)"
                  value={part.part_name}
                  onChange={(event) =>
                    setParts((prev) =>
                      prev.map((existing, partIndex) =>
                        partIndex === index
                          ? { ...existing, part_name: event.target.value }
                          : existing
                      )
                    )
                  }
                />
                <Input
                  placeholder="Artikelnummer (valfritt)"
                  value={part.part_number ?? ""}
                  onChange={(event) =>
                    setParts((prev) =>
                      prev.map((existing, partIndex) =>
                        partIndex === index
                          ? { ...existing, part_number: event.target.value }
                          : existing
                      )
                    )
                  }
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Antal"
                  value={part.quantity}
                  onChange={(event) =>
                    setParts((prev) =>
                      prev.map((existing, partIndex) =>
                        partIndex === index
                          ? {
                              ...existing,
                              quantity: Number(event.target.value || 1)
                            }
                          : existing
                      )
                    )
                  }
                />
                <Textarea
                  placeholder="Notering"
                  value={part.note ?? ""}
                  onChange={(event) =>
                    setParts((prev) =>
                      prev.map((existing, partIndex) =>
                        partIndex === index ? { ...existing, note: event.target.value } : existing
                      )
                    )
                  }
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(part.needs_order)}
                    onChange={(event) =>
                      setParts((prev) =>
                        prev.map((existing, partIndex) =>
                          partIndex === index
                            ? { ...existing, needs_order: event.target.checked }
                            : existing
                        )
                      )
                    }
                  />
                  Behöver beställas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={part.order_status ?? "Ej beställd"}
                    onChange={(event) =>
                      setParts((prev) =>
                        prev.map((existing, partIndex) =>
                          partIndex === index
                            ? {
                                ...existing,
                                order_status: event.target.value as
                                  | "Ej beställd"
                                  | "Beställd"
                                  | "Mottagen"
                                  | "Monterad"
                              }
                            : existing
                        )
                      )
                    }
                  >
                    <option value="Ej beställd">Ej beställd</option>
                    <option value="Beställd">Beställd</option>
                    <option value="Mottagen">Mottagen</option>
                    <option value="Monterad">Monterad</option>
                  </Select>
                  <Select
                    value={part.priority ?? "Medel"}
                    onChange={(event) =>
                      setParts((prev) =>
                        prev.map((existing, partIndex) =>
                          partIndex === index
                            ? {
                                ...existing,
                                priority: event.target.value as "Låg" | "Medel" | "Hög"
                              }
                            : existing
                        )
                      )
                    }
                  >
                    <option value="Låg">Låg prioritet</option>
                    <option value="Medel">Medel prioritet</option>
                    <option value="Hög">Hög prioritet</option>
                  </Select>
                </div>
                <Textarea
                  placeholder="Orsak / varför delen behövs"
                  value={part.reason ?? ""}
                  onChange={(event) =>
                    setParts((prev) =>
                      prev.map((existing, partIndex) =>
                        partIndex === index ? { ...existing, reason: event.target.value } : existing
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setParts((prev) => prev.filter((_, partIndex) => partIndex !== index))
                  }
                >
                  Ta bort
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bilder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setPhotos((prev) => [
                  ...prev,
                  { id: `new-${Date.now()}`, image_url: "", caption: "" }
                ])
              }
            >
              Lägg till bild
            </Button>
            {photos.map((photo, index) => (
              <div key={photo.id} className="rounded-md border p-3 space-y-2">
                <Input
                  placeholder="Bild-URL"
                  value={photo.image_url}
                  onChange={(event) =>
                    setPhotos((prev) =>
                      prev.map((existing, photoIndex) =>
                        photoIndex === index
                          ? { ...existing, image_url: event.target.value }
                          : existing
                      )
                    )
                  }
                />
                <Input
                  placeholder="Bildtext"
                  value={photo.caption ?? ""}
                  onChange={(event) =>
                    setPhotos((prev) =>
                      prev.map((existing, photoIndex) =>
                        photoIndex === index
                          ? { ...existing, caption: event.target.value }
                          : existing
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, photoIndex) => photoIndex !== index))
                  }
                >
                  Ta bort
                </Button>
              </div>
            ))}
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

