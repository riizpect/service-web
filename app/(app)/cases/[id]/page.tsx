import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClientSupabaseServer } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CasePageProps {
  params: { id: string };
}

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

  const itemsBySection = (items ?? []).reduce<Record<string, typeof items>>(
    (acc, item) => {
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
              <Button variant="outline" size="sm" disabled>
                Exportera PDF (kommer senare)
              </Button>
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
              {!parts || parts.length === 0 ? (
                <p className="text-muted-foreground">Inga ersatta delar registrerade.</p>
              ) : (
                parts.map((p) => (
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
              {!photos || photos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Inga bilder uppladdade i detta ärende.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo) => (
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

