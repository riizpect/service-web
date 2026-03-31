import { cookies } from "next/headers";
import Link from "next/link";
import { createClientSupabaseServer } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getCases() {
  const cookieStore = cookies();
  const supabase = createClientSupabaseServer(cookieStore);

  const { data, error } = await supabase
    .from("service_cases")
    .select("*")
    .order("service_date", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

function statusVariant(status: string | null): "success" | "warning" | "danger" {
  switch (status) {
    case "Godkänd":
      return "success";
    case "Godkänd med anmärkning":
      return "warning";
    case "Ej godkänd":
      return "danger";
    default:
      return "warning";
  }
}

export default async function DashboardPage() {
  const cases = await getCases();

  return (
    <main className="flex-1">
      <div className="container py-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Serviceärenden</h1>
          <Link href="/cases/new">
            <Button size="lg">Nytt serviceärende</Button>
          </Link>
        </div>

        {/* TODO: filters/search in later iteration */}

        {cases.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Inga ärenden ännu. Skapa det första genom att klicka på{" "}
              <span className="font-semibold">"Nytt serviceärende"</span>.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}`}>
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {c.customer_name || "Okänd kund"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {c.location || "-"} •{" "}
                        {c.service_date
                          ? new Date(c.service_date).toLocaleDateString("sv-SE")
                          : "Okänt datum"}
                      </p>
                    </div>
                    <Badge variant={statusVariant(c.final_status)}>
                      {c.is_draft ? "Utkast" : c.final_status || "Ej satt"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs md:text-sm">
                    <p>
                      <span className="font-medium">Produkttyp:</span> {c.product_type}
                    </p>
                    <p>
                      <span className="font-medium">VIPER snr:</span>{" "}
                      {c.viper_serial_number || "-"}
                    </p>
                    <p>
                      <span className="font-medium">VLS snr:</span>{" "}
                      {c.vls_serial_number || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tekniker: {c.technician_name || "-"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

