"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClientSupabaseBrowser } from "@/lib/supabaseClient";
import { ChecklistStatus, ProductType, getChecklistForProductType } from "@/lib/checklistConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  step: z.number().default(1),
  customer_name: z.string().min(1),
  location: z.string().min(1),
  service_date: z.string().min(1),
  technician_name: z.string().min(1),
  product_type: z.enum(["VIPER", "VLS", "VIPER_VLS"]),
  viper_serial_number: z.string().optional(),
  vls_serial_number: z.string().optional(),
  reference_number: z.string().optional(),
  checklist_items: z.array(
    z.object({
      section_key: z.string(),
      item_key: z.string(),
      item_label: z.string(),
      status: z.enum(["OK", "ATGÄRDAD", "AVVIKELSE", "EJ_KONTROLLERAD"]),
      comment: z.string().optional(),
      part_replaced: z.boolean().optional()
    })
  ),
  photos: z.array(z.object({ image_url: z.string(), caption: z.string().optional() })).default([]),
  parts: z
    .array(
      z.object({
        part_name: z.string().min(1),
        part_number: z.string().optional(),
        quantity: z.coerce.number().min(1).default(1),
        note: z.string().optional()
      })
    )
    .default([]),
  final_comment: z.string().optional(),
  final_status: z.enum(["Godkänd", "Godkänd med anmärkning", "Ej godkänd"]).optional()
});

type ServiceCaseFormValues = z.infer<typeof formSchema>;

const statusOptions: { value: ChecklistStatus; label: string }[] = [
  { value: "OK", label: "OK" },
  { value: "ATGÄRDAD", label: "Åtgärdad" },
  { value: "AVVIKELSE", label: "Avvikelse" },
  { value: "EJ_KONTROLLERAD", label: "Ej kontrollerad" }
];

export default function NewCasePage() {
  const router = useRouter();
  const [saving, setSaving] = useState<"draft" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checklistSectionIndex, setChecklistSectionIndex] = useState(0);
  const [tab, setTab] = useState<"photos" | "parts">("photos");

  const methods = useForm<ServiceCaseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      step: 1,
      service_date: new Date().toISOString().slice(0, 10),
      product_type: "VIPER",
      checklist_items: [],
      photos: [],
      parts: []
    }
  });

  const { register, watch, handleSubmit, setValue, control } = methods;
  const currentStep = watch("step") ?? 1;
  const productType = watch("product_type") as ProductType;
  const sections = useMemo(() => getChecklistForProductType(productType), [productType]);
  const currentSection = sections[checklistSectionIndex];
  const isLastChecklistSection = checklistSectionIndex === sections.length - 1;

  const checklistArray = useFieldArray({ control, name: "checklist_items" });
  const partsArray = useFieldArray({ control, name: "parts" });
  const photosArray = useFieldArray({ control, name: "photos" });

  useEffect(() => {
    const flatItems = sections.flatMap((section) =>
      section.items.map((item) => ({
        section_key: section.key,
        item_key: item.key,
        item_label: item.label,
        status: "EJ_KONTROLLERAD" as ChecklistStatus,
        comment: "",
        part_replaced: false
      }))
    );
    setValue("checklist_items", flatItems);
    setChecklistSectionIndex(0);
  }, [sections, setValue]);

  const deviations = watch("checklist_items").filter(
    (item) => item.status === "AVVIKELSE" || item.status === "EJ_KONTROLLERAD"
  );

  const onSubmit = async (values: ServiceCaseFormValues) => {
    if (!saving) return;
    setError(null);
    const supabase = createClientSupabaseBrowser();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("Kunde inte läsa inloggad användare.");
      setSaving(null);
      return;
    }

    const { data: caseData, error: caseError } = await supabase
      .from("service_cases")
      .insert({
        created_by: userId,
        customer_name: values.customer_name,
        location: values.location,
        service_date: values.service_date,
        technician_name: values.technician_name,
        product_type: values.product_type === "VIPER_VLS" ? "VIPER + VLS" : values.product_type,
        viper_serial_number: values.viper_serial_number,
        vls_serial_number: values.vls_serial_number,
        reference_number: values.reference_number,
        final_status: saving === "complete" ? values.final_status : null,
        final_comment: saving === "complete" ? values.final_comment : null,
        is_draft: saving === "draft"
      })
      .select("id")
      .single();

    if (caseError || !caseData) {
      setError("Kunde inte spara ärendet.");
      setSaving(null);
      return;
    }

    const caseId = caseData.id;
    await supabase.from("service_checklist_items").insert(
      values.checklist_items.map((item) => ({
        case_id: caseId,
        section_key: item.section_key,
        item_key: item.item_key,
        item_label: item.item_label,
        item_status: item.status,
        comment: item.comment,
        part_replaced: item.part_replaced
      }))
    );
    if (values.parts.length > 0) {
      await supabase.from("service_parts").insert(
        values.parts.map((part) => ({
          case_id: caseId,
          part_name: part.part_name,
          part_number: part.part_number,
          quantity: part.quantity,
          note: part.note
        }))
      );
    }
    if (values.photos.length > 0) {
      await supabase.from("service_photos").insert(
        values.photos.map((photo) => ({
          case_id: caseId,
          image_url: photo.image_url,
          caption: photo.caption
        }))
      );
    }

    router.push(`/cases/${caseId}`);
  };

  return (
    <main className="flex-1">
      <div className="container py-4 space-y-4">
        <h1 className="text-xl font-semibold">Nytt serviceärende</h1>
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{
              width: `${Math.round(
                ((currentStep - 1 + (currentStep === 2 ? (checklistSectionIndex + 1) / Math.max(sections.length, 1) : 1)) / 4) *
                  100
              )}%`
            }}
          />
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-24">
            {currentStep === 1 && (
              <Card>
                <CardHeader><CardTitle>Allmän information</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Kundnamn" {...register("customer_name")} />
                  <Input placeholder="Plats" {...register("location")} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" {...register("service_date")} />
                    <Input placeholder="Servicetekniker" {...register("technician_name")} />
                  </div>
                  <Select value={productType} onChange={(e) => setValue("product_type", e.target.value as ProductType)}>
                    <option value="VIPER">VIPER</option>
                    <option value="VLS">VLS</option>
                    <option value="VIPER_VLS">VIPER + VLS</option>
                  </Select>
                  <Input placeholder="VIPER serienummer" {...register("viper_serial_number")} />
                  <Input placeholder="VLS serienummer" {...register("vls_serial_number")} />
                  <Input placeholder="Arbetsorder / referensnummer" {...register("reference_number")} />
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && currentSection && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{currentSection.title}</CardTitle>
                    <Badge variant="outline">Sektion {checklistSectionIndex + 1}/{sections.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {checklistArray.fields
                    .filter((field) => field.section_key === currentSection.key)
                    .map((field) => {
                      const index = checklistArray.fields.findIndex((f) => f.id === field.id);
                      const statusValue = watch(`checklist_items.${index}.status`) as ChecklistStatus;
                      const isDeviation = statusValue === "AVVIKELSE" || statusValue === "EJ_KONTROLLERAD";
                      return (
                        <div key={field.id} className={`rounded-md border p-3 space-y-2 ${isDeviation ? "border-red-400 bg-red-50" : ""}`}>
                          <p className="text-sm font-medium">{field.item_label}</p>
                          <label className="flex items-center gap-2 rounded-md border bg-background px-2 py-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-5 w-5"
                              checked={statusValue === "OK"}
                              onChange={(event) =>
                                setValue(
                                  `checklist_items.${index}.status`,
                                  event.target.checked ? "OK" : "EJ_KONTROLLERAD"
                                )
                              }
                            />
                            Kontrollerad och OK
                          </label>
                          <Select
                            value={statusValue}
                            onChange={(e) => setValue(`checklist_items.${index}.status`, e.target.value as ChecklistStatus)}
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </Select>
                          <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" className="h-4 w-4" {...register(`checklist_items.${index}.part_replaced`)} />
                            Ersatt del
                          </label>
                          <Textarea placeholder="Kommentar (valfritt)" {...register(`checklist_items.${index}.comment`)} />
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card>
                <CardHeader><CardTitle>Bilder och ersatta delar</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={tab === "photos" ? "default" : "outline"} onClick={() => setTab("photos")}>Bilder</Button>
                    <Button type="button" variant={tab === "parts" ? "default" : "outline"} onClick={() => setTab("parts")}>Ersatta delar</Button>
                  </div>
                  {tab === "photos" && (
                    <div className="space-y-2">
                      <Button type="button" variant="outline" onClick={() => photosArray.append({ image_url: "", caption: "" })}>Lägg till bild</Button>
                      {photosArray.fields.map((field, index) => (
                        <div key={field.id} className="rounded-md border p-3 space-y-2">
                          <Input placeholder="Bild-URL" {...register(`photos.${index}.image_url`)} />
                          <Input placeholder="Bildtext" {...register(`photos.${index}.caption`)} />
                          <Button type="button" variant="ghost" size="sm" onClick={() => photosArray.remove(index)}>Ta bort</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {tab === "parts" && (
                    <div className="space-y-2">
                      <Button type="button" variant="outline" onClick={() => partsArray.append({ part_name: "", part_number: "", quantity: 1 })}>Lägg till del</Button>
                      {partsArray.fields.map((field, index) => (
                        <div key={field.id} className="rounded-md border p-3 space-y-2">
                          <Input placeholder="Delnamn" {...register(`parts.${index}.part_name`)} />
                          <Input placeholder="Artikelnummer" {...register(`parts.${index}.part_number`)} />
                          <Input type="number" min={1} placeholder="Antal" {...register(`parts.${index}.quantity`, { valueAsNumber: true })} />
                          <Textarea placeholder="Notering" {...register(`parts.${index}.note`)} />
                          <Button type="button" variant="ghost" size="sm" onClick={() => partsArray.remove(index)}>Ta bort</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card>
                <CardHeader><CardTitle>Sammanfattning och slutbedömning</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Textarea placeholder="Slutkommentar" {...register("final_comment")} />
                  <Select value={watch("final_status") ?? ""} onChange={(e) => setValue("final_status", e.target.value as ServiceCaseFormValues["final_status"])}>
                    <option value="">Välj status</option>
                    <option value="Godkänd">Godkänd</option>
                    <option value="Godkänd med anmärkning">Godkänd med anmärkning</option>
                    <option value="Ej godkänd">Ej godkänd</option>
                  </Select>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Avvikelser och ej kontrollerat</p>
                    {deviations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Inga avvikelser markerade.</p>
                    ) : (
                      deviations.map((item) => (
                        <div key={`${item.section_key}-${item.item_key}`} className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs">
                          {item.item_label}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 p-3 backdrop-blur">
              <div className="container flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  {currentStep === 2 && checklistSectionIndex > 0 ? (
                    <Button type="button" variant="outline" onClick={() => setChecklistSectionIndex((prev) => prev - 1)}>Föregående sektion</Button>
                  ) : currentStep > 1 ? (
                    <Button type="button" variant="outline" onClick={() => setValue("step", currentStep - 1)}>Föregående</Button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {currentStep === 2 && !isLastChecklistSection ? (
                    <Button type="button" variant="secondary" onClick={() => setChecklistSectionIndex((prev) => prev + 1)}>Nästa sektion</Button>
                  ) : currentStep < 4 ? (
                    <Button type="button" variant="secondary" onClick={() => setValue("step", currentStep + 1)}>Nästa steg</Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" disabled={!!saving} onClick={() => { setSaving("draft"); handleSubmit(onSubmit)(); }}>
                        {saving === "draft" ? "Sparar..." : "Spara utkast"}
                      </Button>
                      <Button type="button" disabled={!!saving} onClick={() => { setSaving("complete"); handleSubmit(onSubmit)(); }}>
                        {saving === "complete" ? "Sparar..." : "Slutför ärende"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </form>
        </FormProvider>
      </div>
    </main>
  );
}

