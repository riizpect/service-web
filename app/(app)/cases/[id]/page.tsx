import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClientSupabaseServer } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CaseExportPdfButton } from "@/components/case-export-pdf-button";

interface CasePageProps {
  params: { id: string };
}

type ChecklistItemRow = {
  id: string;
  section_key: string;
  item_key: string;
  item_label: string;
  item_status: string;
  comment: string | null;
  part_replaced: boolean | null;
};

type ServicePartRow = {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  note: string | null;
};

type ServicePhotoRow = {
  id: string;
  image_url: string;
  caption: string | null;
};

export default async function CasePage({ params }: CasePageProps) {
  const cookieStore = cookies();
  const supabase = createClientSupabaseServer(cookieStore);

  const { data: serviceCase } = await supabase
    .from("service_cases")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!serviceCase) notFound();

  const { data: items } = await supabase
    .from("service_checklist_items")
    .select("*")
    .eq("case_id", params.id)
    .order("section_key")
    .order("item_key");

  const { data: parts } = await supabase
    .from("service_parts")
    .select("*")
    .eq("case_id", params.id);

  const { data: photos } = await supabase
    .from("service_photos")
    .select("*")
    .eq("case_id", params.id);

  const typedItems: ChecklistItemRow[] = (items ?? []) as ChecklistItemRow[];
  const typedParts: ServicePartRow[] = (parts ?? []) as ServicePartRow[];
  const typedPhotos: ServicePhotoRow[] = (photos ?? []) as ServicePhotoRow[];
  const serialPhotos = typedPhotos.filter((photo) =>
    (photo.caption ?? "").startsWith("SERIAL|")
  );
  const checklistPhotos = typedPhotos.filter((photo) =>
    (photo.caption ?? "").startsWith("ITEM|")
  );
  const generalPhotos = typedPhotos.filter(
    (photo) =>
      !(photo.caption ?? "").startsWith("SERIAL|") &&
      !(photo.caption ?? "").startsWith("ITEM|")
  );

  const itemsBySection = typedItems.reduce<Record<string, ChecklistItemRow[]>>(
    (acc: Record<string, ChecklistItemRow[]>, item: ChecklistItemRow) => {
      if (!item) return acc;
      if (!acc[item.section_key]) acc[item.section_key] = [];
      acc[item.section_key]?.push(item);
      return acc;
    },
    {}
  );

  const statusVariant =
    serviceCase.final_status === "Godkänd"
      ? "success"
      : serviceCase.final_status === "Ej godkänd"
      ? "danger"
      : "warning";

  return (
    <main className="flex-1">
      <div className="container py-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">
              {serviceCase.customer_name || "Serviceärende"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {serviceCase.location} •{" "}
              {serviceCase.service_date
                ? new Date(serviceCase.service_date).toLocaleDateString("sv-SE")
                : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant={statusVariant as any}>
              {serviceCase.is_draft
                ? "Utkast"
                : serviceCase.final_status || "Status ej satt"}
            </Badge>
            <Link href={`/cases/${serviceCase.id}/edit`}>
              <Button variant="outline" size="sm">
                Redigera
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Allmän information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs md:text-sm">
              <p>
                <span className="font-medium">Kund:</span> {serviceCase.customer_name}
              </p>
              <p>
                <span className="font-medium">Plats:</span> {serviceCase.location}
              </p>
              <p>
                <span className="font-medium">Tekniker:</span>{" "}
                {serviceCase.technician_name}
              </p>
              <p>
                <span className="font-medium">Produkttyp:</span>{" "}
                {serviceCase.product_type}
              </p>
              <p>
                <span className="font-medium">VIPER snr:</span>{" "}
                {serviceCase.viper_serial_number || "-"}
              </p>
              <p>
                <span className="font-medium">VLS snr:</span>{" "}
                {serviceCase.vls_serial_number || "-"}
              </p>
              <p>
                <span className="font-medium">Arbetsorder/ref:</span>{" "}
                {serviceCase.reference_number || "-"}
              </p>
              <div className="md:col-span-2 space-y-1">
                <p>
                  <span className="font-medium">Serienummerbilder:</span>
                </p>
                {serialPhotos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Inga serienummerbilder.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {serialPhotos.map((photo) => (
                      <div key={photo.id} className="space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.image_url}
                          alt={photo.caption ?? "Serienummerbild"}
                          className="h-24 w-full rounded-md object-cover"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {(photo.caption ?? "").replace("SERIAL|", "")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slutbedömning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Status:</span>{" "}
                {serviceCase.final_status || "Ej satt"}
              </p>
              {serviceCase.final_comment && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {serviceCase.final_comment}
                </p>
              )}
              <CaseExportPdfButton
                caseId={serviceCase.id}
                customerName={serviceCase.customer_name}
                serviceDate={serviceCase.service_date}
                location={serviceCase.location}
                technicianName={serviceCase.technician_name}
                productType={serviceCase.product_type}
                viperSerial={serviceCase.viper_serial_number}
                vlsSerial={serviceCase.vls_serial_number}
                referenceNumber={serviceCase.reference_number}
                finalStatus={serviceCase.final_status}
                finalComment={serviceCase.final_comment}
                checklistItems={typedItems.map((item) => ({
                  section: item.section_key,
                  label: item.item_label,
                  status: item.item_status,
                  comment: item.comment,
                  partReplaced: Boolean(item.part_replaced)
                }))}
                parts={typedParts}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Checklista</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(itemsBySection).map(([sectionKey, sectionItems]) => (
              <div key={sectionKey} className="space-y-1">
                <h2 className="text-sm font-semibold">
                  {sectionItems?.[0]?.section_key ?? sectionKey}
                </h2>
                <div className="space-y-1">
                  {sectionItems?.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 rounded-md border px-3 py-2 text-xs md:text-sm"
                    >
                      <span>{item.item_label}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            item.item_status === "OK"
                              ? "success"
                              : item.item_status === "ATGÄRDAD"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {item.item_status === "ATGÄRDAD"
                            ? "Åtgärdad"
                            : item.item_status === "AVVIKELSE"
                            ? "Avvikelse"
                            : item.item_status === "EJ_KONTROLLERAD"
                            ? "Ej kontrollerad"
                            : "OK"}
                        </Badge>
                        {item.part_replaced && (
                          <Badge variant="outline">Ersatt del</Badge>
                        )}
                        {checklistPhotos.filter((photo) =>
                          (photo.caption ?? "").startsWith(
                            `ITEM|${item.section_key}|${item.item_key}|`
                          )
                        ).length > 0 && (
                          <Badge variant="outline">
                            Foto:{" "}
                            {
                              checklistPhotos.filter((photo) =>
                                (photo.caption ?? "").startsWith(
                                  `ITEM|${item.section_key}|${item.item_key}|`
                                )
                              ).length
                            }
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ersatta delar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs md:text-sm">
              {typedParts.length === 0 ? (
                <p className="text-muted-foreground">Inga ersatta delar registrerade.</p>
              ) : (
                typedParts.map((p: ServicePartRow) => (
                  <div
                    key={p.id}
                    className="flex flex-col rounded-md border px-3 py-2"
                  >
                    <span className="font-medium">{p.part_name}</span>
                    <span>
                      Antal: {p.quantity}{" "}
                      {p.part_number ? `• Art.nr: ${p.part_number}` : ""}
                    </span>
                    {p.note && (
                      <span className="text-xs text-muted-foreground">
                        Notering: {p.note}
                      </span>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bilder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {generalPhotos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Inga bilder uppladdade i detta ärende.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {generalPhotos.map((photo: ServicePhotoRow) => (
                    <div key={photo.id} className="space-y-1">
                      {/* For MVP we just render img from URL */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.image_url}
                        alt={photo.caption ?? "Servicebild"}
                        className="h-32 w-full rounded-md object-cover"
                      />
                      {photo.caption && (
                        <p className="text-[11px] text-muted-foreground">
                          {photo.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

