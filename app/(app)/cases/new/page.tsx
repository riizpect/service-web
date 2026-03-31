"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClientSupabaseBrowser } from "@/lib/supabaseClient";
import {
  ChecklistSectionConfig,
  ChecklistStatus,
  ProductType,
  getChecklistForProductType
} from "@/lib/checklistConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const checklistItemSchema = z.object({
  section_key: z.string(),
  item_key: z.string(),
  item_label: z.string(),
  status: z.enum(["OK", "ATGÄRDAD", "AVVIKELSE", "EJ_KONTROLLERAD"]),
  comment: z.string().optional(),
  part_replaced: z.boolean().optional()
});

const partSchema = z.object({
  part_name: z.string().min(1, "Delnamn krävs"),
  part_number: z.string().optional(),
  quantity: z.coerce.number().min(1).default(1),
  note: z.string().optional()
});

const formSchema = z.object({
  step: z.number().default(1),
  customer_name: z.string().min(1, "Kundnamn krävs"),
  location: z.string().min(1, "Plats krävs"),
  service_date: z.string().min(1, "Datum krävs"),
  technician_name: z.string().min(1, "Servicetekniker krävs"),
  product_type: z.enum(["VIPER", "VLS", "VIPER_VLS"]),
  viper_serial_number: z.string().optional(),
  vls_serial_number: z.string().optional(),
  reference_number: z.string().optional(),
  checklist_items: z.array(checklistItemSchema),
  photos: z
    .array(
      z.object({
        image_url: z.string(),
        caption: z.string().optional()
      })
    )
    .default([]),
  parts: z.array(partSchema).default([]),
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

  const methods = useForm<ServiceCaseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      step: 1,
      service_date: new Date().toISOString().slice(0, 10),
      product_type: "VIPER"
    } as Partial<ServiceCaseFormValues>
  });

  const {
    register,
    watch,
    handleSubmit,
    setValue,
    control,
    formState: { errors }
  } = methods;

  const watchedProductType = watch("product_type") as ProductType | undefined;

  const sections: ChecklistSectionConfig[] = useMemo(() => {
    if (!watchedProductType) return [];
    return getChecklistForProductType(watchedProductType);
  }, [watchedProductType]);

  const checklistArray = useFieldArray({
    control,
    name: "checklist_items"
  });

  // initialize checklist when product type changes
  useMemo(() => {
    if (!watchedProductType) return;
    const newSections = getChecklistForProductType(watchedProductType);
    const flatItems = newSections.flatMap((section) =>
      section.items.map((item) => ({
        section_key: section.key,
        item_key: item.key,
        item_label: item.label,
        status: "OK" as ChecklistStatus,
        comment: "",
        part_replaced: false
      }))
    );
    setValue("checklist_items", flatItems, { shouldValidate: false });
  }, [watchedProductType, setValue]);

  const { fields: partFields, append: appendPart, remove: removePart } = useFieldArray({
    control,
    name: "parts"
  });

  const currentStep = watch("step") ?? 1;

  const handleNext = () => setValue("step", Math.min(4, currentStep + 1));
  const handlePrev = () => setValue("step", Math.max(1, currentStep - 1));

  const deviations = watch("checklist_items")?.filter(
    (i) => i.status === "AVVIKELSE" || i.status === "EJ_KONTROLLERAD"
  );

  const onSubmit = async (values: ServiceCaseFormValues) => {
    if (!saving) return;
    setError(null);
    try {
      const supabase = createClientSupabaseBrowser();
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("Kunde inte hämta inloggad användare.");
        return;
      }

      const { data: caseData, error: insertError } = await supabase
        .from("service_cases")
        .insert({
          customer_name: values.customer_name,
          location: values.location,
          service_date: values.service_date,
          technician_name: values.technician_name,
          product_type:
            values.product_type === "VIPER_VLS" ? "VIPER + VLS" : values.product_type,
          viper_serial_number: values.viper_serial_number,
          vls_serial_number: values.vls_serial_number,
          reference_number: values.reference_number,
          final_status: saving === "complete" ? values.final_status : null,
          final_comment: saving === "complete" ? values.final_comment : null,
          is_draft: saving === "draft",
          created_by: user.id
        })
        .select("id")
        .single();

      if (insertError || !caseData) {
        setError(insertError?.message ?? "Kunde inte spara ärendet.");
        return;
      }

      const caseId = caseData.id;

      const { error: checklistError } = await supabase
        .from("service_checklist_items")
        .insert(
          values.checklist_items.map((i) => ({
            case_id: caseId,
            section_key: i.section_key,
            item_key: i.item_key,
            item_label: i.item_label,
            item_status: i.status,
            comment: i.comment,
            part_replaced: i.part_replaced
          }))
        );

      if (checklistError) {
        setError("Kunde inte spara checklistan.");
        return;
      }

      if (values.parts?.length) {
        const { error: partsError } = await supabase.from("service_parts").insert(
          values.parts.map((p) => ({
            case_id: caseId,
            part_name: p.part_name,
            part_number: p.part_number,
            quantity: p.quantity,
            note: p.note
          }))
        );
        if (partsError) {
          setError("Kunde inte spara ersatta delar.");
          return;
        }
      }

      if (values.photos?.length) {
        const { error: photosError } = await supabase
          .from("service_photos")
          .insert(
            values.photos.map((p) => ({
              case_id: caseId,
              image_url: p.image_url,
              caption: p.caption
            }))
          );
        if (photosError) {
          setError("Kunde inte spara bilder.");
          return;
        }
      }

      router.push(`/cases/${caseId}`);
    } catch {
      setError("Ett oväntat fel inträffade vid sparande.");
    } finally {
      setSaving(null);
    }
  };

  const handleSave = (mode: "draft" | "complete") => {
    setSaving(mode);
    handleSubmit(onSubmit)();
  };

  return (
    <main className="flex-1">
      <div className="container py-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Nytt serviceärende</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between text-xs md:text-sm">
          {["Allmänt", "Checklista", "Bilder & delar", "Sammanfattning"].map(
            (label, idx) => {
              const stepNumber = idx + 1;
              const active = currentStep === stepNumber;
              const done = currentStep > stepNumber;
              return (
                <div key={label} className="flex-1 flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                      active
                        ? "border-primary bg-primary text-white"
                        : done
                        ? "border-primary text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {stepNumber}
                  </div>
                  <span
                    className={
                      active || done ? "font-medium text-foreground" : "text-muted-foreground"
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            }
          )}
        </div>

        <FormProvider {...methods}>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(onSubmit)}
          >
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Allmän information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Kundnamn</label>
                    <Input {...register("customer_name")} />
                    {errors.customer_name && (
                      <p className="text-xs text-red-600">
                        {errors.customer_name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Plats</label>
                    <Input {...register("location")} />
                    {errors.location && (
                      <p className="text-xs text-red-600">{errors.location.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Datum</label>
                      <Input type="date" {...register("service_date")} />
                      {errors.service_date && (
                        <p className="text-xs text-red-600">
                          {errors.service_date.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Servicetekniker</label>
                      <Input {...register("technician_name")} />
                      {errors.technician_name && (
                        <p className="text-xs text-red-600">
                          {errors.technician_name.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Produkttyp</label>
                    <Select
                      value={watchedProductType}
                      onChange={(e) =>
                        setValue("product_type", e.target.value as ProductType)
                      }
                    >
                      <option value="VIPER">VIPER</option>
                      <option value="VLS">VLS</option>
                      <option value="VIPER_VLS">VIPER + VLS</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">VIPER serienummer</label>
                      <Input {...register("viper_serial_number")} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">VLS serienummer</label>
                      <Input {...register("vls_serial_number")} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Arbetsorder / referensnummer (valfritt)
                    </label>
                    <Input {...register("reference_number")} />
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <div className="space-y-3">
                {sections.map((section) => (
                  <Card key={section.key}>
                    <CardHeader>
                      <CardTitle>{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {checklistArray.fields
                        .filter((f) => f.section_key === section.key)
                        .map((field, idx) => {
                          const index = checklistArray.fields.findIndex(
                            (f) => f.id === field.id
                          );
                          const itemError = errors.checklist_items?.[index];
                          const statusValue = watch(
                            `checklist_items.${index}.status`
                          ) as ChecklistStatus;
                          const isDeviation =
                            statusValue === "AVVIKELSE" ||
                            statusValue === "EJ_KONTROLLERAD";
                          return (
                            <div
                              key={field.id}
                              className={`rounded-md border p-3 space-y-2 ${
                                isDeviation ? "border-red-400 bg-red-50" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm">{field.item_label}</p>
                                <Select
                                  value={statusValue}
                                  onChange={(e) =>
                                    setValue(
                                      `checklist_items.${index}.status`,
                                      e.target.value as ChecklistStatus
                                    )
                                  }
                                  className="w-32"
                                >
                                  {statusOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    {...register(
                                      `checklist_items.${index}.part_replaced`
                                    )}
                                  />
                                  Ersatt del
                                </label>
                                <button
                                  type="button"
                                  className="text-xs text-primary underline"
                                  onClick={() => {
                                    const current =
                                      watch(`checklist_items.${index}.comment`) ?? "";
                                    if (!current) {
                                      setValue(
                                        `checklist_items.${index}.comment`,
                                        "",
                                        { shouldTouch: true }
                                      );
                                    }
                                  }}
                                >
                                  Kommentar
                                </button>
                              </div>
                              <Textarea
                                placeholder="Kommentar (valfritt)"
                                {...register(`checklist_items.${index}.comment`)}
                              />
                              {itemError && (
                                <p className="text-xs text-red-600">
                                  Kontrollera denna rad.
                                </p>
                              )}
                            </div>
                          );
                        })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Bilder och ersatta delar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Bilduppladdning (MVP: klistra in URL)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      I en framtida version kan detta kopplas till Supabase Storage eller direkt
                      bilduppladdning. För MVP kan du klistra in bild-URL:er.
                    </p>
                    {/* Simple photo URL list for MVP */}
                    {/* Could be implemented with useFieldArray similar to parts */}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Ersatta delar</h2>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          appendPart({ part_name: "", part_number: "", quantity: 1 })
                        }
                      >
                        Lägg till del
                      </Button>
                    </div>
                    {partFields.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Inga ersatta delar tillagda.
                      </p>
                    )}
                    <div className="space-y-3">
                      {partFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="rounded-md border p-3 space-y-2"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-xs font-medium">Delnamn</label>
                              <Input {...register(`parts.${index}.part_name`)} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium">Artikelnummer</label>
                              <Input {...register(`parts.${index}.part_number`)} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium">Antal</label>
                              <Input
                                type="number"
                                min={1}
                                {...register(`parts.${index}.quantity`, {
                                  valueAsNumber: true
                                })}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Notering</label>
                            <Textarea {...register(`parts.${index}.note`)} />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePart(index)}
                            >
                              Ta bort
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Sammanfattning och slutbedömning</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Slutkommentar</label>
                    <Textarea {...register("final_comment")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Slutbedömning</label>
                    <Select
                      value={watch("final_status")}
                      onChange={(e) =>
                        setValue("final_status", e.target.value as any, {
                          shouldValidate: true
                        })
                      }
                    >
                      <option value="">Välj status</option>
                      <option value="Godkänd">Godkänd</option>
                      <option value="Godkänd med anmärkning">
                        Godkänd med anmärkning
                      </option>
                      <option value="Ej godkänd">Ej godkänd</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold">
                      Avvikelser och ej kontrollerat
                    </h2>
                    {deviations && deviations.length > 0 ? (
                      <div className="space-y-1">
                        {deviations.map((d) => (
                          <div
                            key={`${d.section_key}-${d.item_key}`}
                            className="flex items-center justify-between rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs"
                          >
                            <span>{d.item_label}</span>
                            <Badge variant="danger">
                              {d.status === "AVVIKELSE"
                                ? "Avvikelse"
                                : "Ej kontrollerad"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Inga avvikelser eller ej kontrollerade punkter markerade.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrev}
                  >
                    Föregående
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep < 4 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleNext}
                  >
                    Nästa steg
                  </Button>
                )}
                {currentStep === 4 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!saving}
                      onClick={() => handleSave("draft")}
                    >
                      {saving === "draft" ? "Sparar..." : "Spara utkast"}
                    </Button>
                    <Button
                      type="button"
                      disabled={!!saving}
                      onClick={() => handleSave("complete")}
                    >
                      {saving === "complete" ? "Sparar..." : "Slutför ärende"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </FormProvider>
      </div>
    </main>
  );
}

