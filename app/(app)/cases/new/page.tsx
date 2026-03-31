"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import { Camera } from "lucide-react";

const LOCAL_DRAFT_STORAGE_KEY = "service-case-local-draft-v1";

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
        part_name: z.string().optional().default(""),
        part_number: z.string().optional(),
        quantity: z.coerce.number().min(1).default(1),
        note: z.string().optional(),
        needs_order: z.boolean().default(false),
        order_status: z
          .enum(["Ej beställd", "Beställd", "Mottagen", "Monterad"])
          .default("Ej beställd"),
        priority: z.enum(["Låg", "Medel", "Hög"]).default("Medel"),
        reason: z.string().optional()
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
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const viperSerialInputRef = useRef<HTMLInputElement | null>(null);
  const vlsSerialInputRef = useRef<HTMLInputElement | null>(null);
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const restoredDraftRef = useRef(false);

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

  const { register, watch, handleSubmit, setValue, control, getValues, reset } = methods;
  const currentStep = watch("step") ?? 1;
  const productType = watch("product_type") as ProductType;
  const sections = useMemo(() => getChecklistForProductType(productType), [productType]);
  const currentSection = sections[checklistSectionIndex];
  const isLastChecklistSection = checklistSectionIndex === sections.length - 1;

  const checklistArray = useFieldArray({ control, name: "checklist_items" });
  const partsArray = useFieldArray({ control, name: "parts" });
  const photosArray = useFieldArray({ control, name: "photos" });

  useEffect(() => {
    if (restoredDraftRef.current) {
      restoredDraftRef.current = false;
      return;
    }
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedDraftRaw = window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
    if (!savedDraftRaw) return;
    try {
      const parsed = JSON.parse(savedDraftRaw) as ServiceCaseFormValues;
      restoredDraftRef.current = Boolean(parsed.checklist_items?.length);
      reset(parsed);
      setChecklistSectionIndex(0);
      setError("Lokalt utkast återställt.");
    } catch {
      window.localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
    }
  }, [reset]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (typeof window === "undefined") return;
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        window.localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify(value));
        setDraftSavedAt(new Date().toISOString());
      }, 500);
    });
    return () => {
      subscription.unsubscribe();
      if (typeof window !== "undefined" && saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [watch]);

  useEffect(() => {
    if (currentStep === 2) {
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [checklistSectionIndex, currentStep]);

  const deviations = watch("checklist_items").filter(
    (item) => item.status === "AVVIKELSE" || item.status === "EJ_KONTROLLERAD"
  );
  const checklistItems = watch("checklist_items");
  const checkedCount = checklistItems.filter((item) => item.status === "OK").length;
  const deviationCount = checklistItems.filter((item) => item.status === "AVVIKELSE").length;
  const notCheckedCount = checklistItems.filter(
    (item) => item.status === "EJ_KONTROLLERAD"
  ).length;

  const saveCase = async (
    values: ServiceCaseFormValues,
    mode: "draft" | "complete",
    useFallbacks: boolean
  ) => {
    setError(null);
    try {
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
          customer_name: values.customer_name || (useFallbacks ? "Ej ifyllt" : null),
          location: values.location || (useFallbacks ? "Ej ifyllt" : null),
          service_date:
            values.service_date || (useFallbacks ? new Date().toISOString().slice(0, 10) : null),
          technician_name: values.technician_name || (useFallbacks ? "Ej ifyllt" : null),
          product_type:
            values.product_type === "VIPER_VLS" ? "VIPER + VLS" : values.product_type,
          viper_serial_number: values.viper_serial_number || (useFallbacks ? "Ej ifyllt" : null),
          vls_serial_number: values.vls_serial_number || (useFallbacks ? "Ej ifyllt" : null),
          reference_number: values.reference_number || (useFallbacks ? "Ej ifyllt" : null),
          final_status:
            mode === "complete" ? values.final_status || (useFallbacks ? "Ej ifyllt" : null) : null,
          final_comment:
            mode === "complete"
              ? values.final_comment || (useFallbacks ? "Ej ifyllt" : null)
              : null,
          is_draft: mode === "draft"
        })
        .select("id")
        .single();

      if (caseError || !caseData) {
        setError("Kunde inte spara ärendet.");
        setSaving(null);
        return;
      }

      const caseId = caseData.id;
      const { error: checklistError } = await supabase.from("service_checklist_items").insert(
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
      if (checklistError) {
        await supabase.from("service_cases").delete().eq("id", caseId);
        setError("Kunde inte spara checklista. Ärendet sparades inte.");
        setSaving(null);
        return;
      }
      const partsToSave = values.parts.filter(
        (part) => Boolean(part.needs_order) || Boolean(part.part_name?.trim())
      );
      const requiresReturnVisit = partsToSave.some((part) => part.needs_order);
      const { error: caseFlagError } = await supabase
        .from("service_cases")
        .update({ requires_return_visit: requiresReturnVisit })
        .eq("id", caseId);
      if (caseFlagError) {
        await supabase.from("service_cases").delete().eq("id", caseId);
        setError("Kunde inte sätta återbesök-status. Ärendet sparades inte.");
        setSaving(null);
        return;
      }
      if (partsToSave.length > 0) {
        const { error: partsError } = await supabase.from("service_parts").insert(
          partsToSave.map((part) => ({
            case_id: caseId,
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
        if (partsError) {
          await supabase.from("service_cases").delete().eq("id", caseId);
          setError("Kunde inte spara ersatta delar. Ärendet sparades inte.");
          setSaving(null);
          return;
        }
      }
      const photosToSave = values.photos.filter((photo) => photo.image_url?.trim());
      if (photosToSave.length > 0) {
        const { error: photosError } = await supabase.from("service_photos").insert(
          photosToSave.map((photo) => ({
            case_id: caseId,
            image_url: photo.image_url,
            caption: photo.caption
          }))
        );
        if (photosError) {
          await supabase.from("service_cases").delete().eq("id", caseId);
          setError("Kunde inte spara bilder. Ärendet sparades inte.");
          setSaving(null);
          return;
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
      }
      router.push(`/cases/${caseId}`);
    } catch {
      setError("Något gick fel vid sparning. Försök igen.");
      setSaving(null);
    }
  };

  const onSubmit = async (values: ServiceCaseFormValues) => {
    if (!saving) return;
    await saveCase(values, saving, false);
  };

  const onInvalidSubmit = () => {
    setSaving(null);
    setError("Formuläret är inte komplett. Kontrollera obligatoriska fält.");
  };

  const addOrderPartFromDeviation = (itemLabel: string, checklistIndex: number) => {
    setValue(`checklist_items.${checklistIndex}.status`, "AVVIKELSE");
    partsArray.append({
      part_name: "Defekt del (ej specificerad)",
      part_number: "",
      quantity: 1,
      note: "",
      needs_order: true,
      order_status: "Ej beställd",
      priority: "Medel",
      reason: `Avvikelse: ${itemLabel}`
    });
    setValue("step", 3);
    setTab("parts");
  };

  const handlePreviewComplete = async () => {
    setSaving("complete");
    const values = getValues();
    await saveCase(values, "complete", true);
  };

  const uploadImage = async (file: File, caption: string) => {
    const supabase = createClientSupabaseBrowser();
    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "service-photos";
    const extension = file.name.split(".").pop() || "jpg";
    const filePath = `cases/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: false });
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    photosArray.append({
      image_url: data.publicUrl,
      caption
    });
  };

  const handleImageCapture = async (
    file: File | null,
    caption: string,
    target: string
  ) => {
    if (!file) return;
    setError(null);
    setUploadingTarget(target);
    try {
      await uploadImage(file, caption);
    } catch {
      setError(
        "Kunde inte ladda upp bilden. Kontrollera att Storage bucket finns i Supabase."
      );
    } finally {
      setUploadingTarget(null);
    }
  };

  return (
    <main className="flex-1">
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_8px_28px_-20px_rgba(15,23,42,0.45)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Serviceflöde</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">Nytt serviceärende</h1>
          {currentStep >= 2 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="success">OK: {checkedCount}</Badge>
              <Badge variant="danger">Avvikelse: {deviationCount}</Badge>
              <Badge variant="outline">Ej kontrollerad: {notCheckedCount}</Badge>
            </div>
          )}
        </div>
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-6">
            <div ref={formTopRef} />
            {currentStep === 1 && (
              <Card>
                <CardHeader><CardTitle>Allmän information</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Kundnamn" {...register("customer_name")} />
                  <Input placeholder="Plats" {...register("location")} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      className="h-10 min-w-0 w-full rounded-lg appearance-none"
                      {...register("service_date")}
                    />
                    <Input
                      placeholder="Servicetekniker"
                      className="h-10 min-w-0 w-full rounded-lg"
                      {...register("technician_name")}
                    />
                  </div>
                  <Select value={productType} onChange={(e) => setValue("product_type", e.target.value as ProductType)}>
                    <option value="VIPER">VIPER</option>
                    <option value="VLS">VLS</option>
                    <option value="VIPER_VLS">VIPER + VLS</option>
                  </Select>
                  <div className="space-y-2">
                    <Input placeholder="VIPER serienummer" {...register("viper_serial_number")} />
                    <div className="flex items-center gap-2">
                      <input
                        ref={viperSerialInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) =>
                          handleImageCapture(
                            event.target.files?.[0] ?? null,
                            "SERIAL|VIPER",
                            "serial-viper"
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => viperSerialInputRef.current?.click()}
                        disabled={uploadingTarget === "serial-viper"}
                      >
                        <Camera className="mr-1 h-4 w-4" />
                        {uploadingTarget === "serial-viper"
                          ? "Laddar upp..."
                          : "Foto serienummer VIPER"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Input placeholder="VLS serienummer" {...register("vls_serial_number")} />
                    <div className="flex items-center gap-2">
                      <input
                        ref={vlsSerialInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) =>
                          handleImageCapture(
                            event.target.files?.[0] ?? null,
                            "SERIAL|VLS",
                            "serial-vls"
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => vlsSerialInputRef.current?.click()}
                        disabled={uploadingTarget === "serial-vls"}
                      >
                        <Camera className="mr-1 h-4 w-4" />
                        {uploadingTarget === "serial-vls"
                          ? "Laddar upp..."
                          : "Foto serienummer VLS"}
                      </Button>
                    </div>
                  </div>
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
                      const itemPhotoCount = watch("photos").filter((photo) =>
                        (photo.caption ?? "").startsWith(
                          `ITEM|${field.section_key}|${field.item_key}|`
                        )
                      ).length;
                      return (
                        <div key={field.id} className={`rounded-md border p-3 space-y-2 ${isDeviation ? "border-red-400 bg-red-50" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{field.item_label}</p>
                            <div>
                              <input
                                id={`item-photo-${field.id}`}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(event) =>
                                  handleImageCapture(
                                    event.target.files?.[0] ?? null,
                                    `ITEM|${field.section_key}|${field.item_key}|${field.item_label}`,
                                    `item-${field.id}`
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  document
                                    .getElementById(`item-photo-${field.id}`)
                                    ?.click()
                                }
                                disabled={uploadingTarget === `item-${field.id}`}
                                className="h-8 px-2"
                                title="Ta bild på denna punkt"
                              >
                                <Camera className="h-4 w-4" />
                                <span className="ml-1 text-xs">
                                  {uploadingTarget === `item-${field.id}`
                                    ? "..."
                                    : itemPhotoCount > 0
                                    ? itemPhotoCount
                                    : ""}
                                </span>
                              </Button>
                            </div>
                          </div>
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOrderPartFromDeviation(field.item_label, index)}
                          >
                            Kryssa defekt del (beställs senare)
                          </Button>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card>
                <CardHeader><CardTitle>Bilder och delar (bytta + att beställa)</CardTitle></CardHeader>
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
                      <p className="text-xs text-muted-foreground">
                        Snabbt läge: klicka "Kryssa defekt del" i checklistan. Delen läggs till
                        automatiskt utan artikelnummer.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          partsArray.append({
                            part_name: "",
                            part_number: "",
                            quantity: 1,
                            note: "",
                            needs_order: false,
                            order_status: "Ej beställd",
                            priority: "Medel",
                            reason: ""
                          })
                        }
                      >
                        Lägg till del
                      </Button>
                      {partsArray.fields.map((field, index) => (
                        <div key={field.id} className="rounded-md border p-3 space-y-2">
                          <Input placeholder="Delnamn (valfritt)" {...register(`parts.${index}.part_name`)} />
                          <Input placeholder="Artikelnummer (valfritt)" {...register(`parts.${index}.part_number`)} />
                          <Input type="number" min={1} placeholder="Antal" {...register(`parts.${index}.quantity`, { valueAsNumber: true })} />
                          <Textarea placeholder="Notering" {...register(`parts.${index}.note`)} />
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              {...register(`parts.${index}.needs_order`)}
                            />
                            Behöver beställas
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <Select {...register(`parts.${index}.order_status`)}>
                              <option value="Ej beställd">Ej beställd</option>
                              <option value="Beställd">Beställd</option>
                              <option value="Mottagen">Mottagen</option>
                              <option value="Monterad">Monterad</option>
                            </Select>
                            <Select {...register(`parts.${index}.priority`)}>
                              <option value="Låg">Låg prioritet</option>
                              <option value="Medel">Medel prioritet</option>
                              <option value="Hög">Hög prioritet</option>
                            </Select>
                          </div>
                          <Textarea
                            placeholder="Orsak / varför delen behövs"
                            {...register(`parts.${index}.reason`)}
                          />
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
            {draftSavedAt && (
              <p className="text-xs text-muted-foreground">
                Autosparat lokalt: {new Date(draftSavedAt).toLocaleTimeString("sv-SE")}
              </p>
            )}

            <div className="sticky bottom-16 z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur md:bottom-4">
              <div className="flex items-center justify-between gap-2">
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
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!!saving}
                        onClick={() => {
                          setSaving("draft");
                          handleSubmit(onSubmit, onInvalidSubmit)();
                        }}
                      >
                        {saving === "draft" ? "Sparar..." : "Spara utkast"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!!saving}
                        onClick={handlePreviewComplete}
                      >
                        {saving === "complete" ? "Skapar..." : "Förhandsvisa färdigt ärende"}
                      </Button>
                      <Button
                        type="button"
                        disabled={!!saving}
                        onClick={() => {
                          setSaving("complete");
                          void saveCase(getValues(), "complete", true);
                        }}
                      >
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

