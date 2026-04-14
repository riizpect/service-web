import { cookies } from "next/headers";
import Link from "next/link";
import { createClientSupabaseServer } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ServiceCaseRow = {
  id: string;
  customer_name: string | null;
  location: string | null;
  service_date: string | null;
  technician_name: string | null;
  product_type: string | null;
  viper_serial_number: string | null;
  vls_serial_number: string | null;
  final_status: string | null;
  is_draft: boolean | null;
  requires_return_visit: boolean | null;
};

function translateDemoText(value: string | null): string | null {
  if (!value) return value;
  const hasSwedishMarkers = /[åäöÅÄÖ]|(?:\b(?:och|med|utan|krävs|återbesök|anmärkning|kontrollerad|serviceplan)\b)/i.test(
    value
  );
  const replacements: Array<[string, string]> = [
    ["Demo tekniker", "Demo Technician"],
    ["Visuell kontroll utan anmärkning.", "Visual inspection completed without remarks."],
    ["Funktionstest godkänt.", "Function test passed."],
    ["Kontrollerad enligt rutin.", "Checked according to routine."],
    ["Delvis åtgärdad på plats, ny kontroll rekommenderas.", "Partly fixed on site, follow-up check recommended."],
    ["Komponent justerad och verifierad efter åtgärd.", "Component adjusted and verified after action."],
    ["Slitage åtgärdat vid servicebesöket.", "Wear issue fixed during service visit."],
    ["Avvikelse upptäckt vid belastningstest, åtgärd behövs.", "Deviation detected during load test, action required."],
    ["Fel upptäckt under funktionskontroll.", "Fault detected during function control."],
    ["Ej godkänd punkt, kräver uppföljning.", "Item not approved, follow-up required."],
    ["Punkt ej kontrollerad vid detta besök.", "Item not checked during this visit."],
    ["Ej kontrollerad på grund av tidsbrist.", "Not checked due to time constraints."],
    ["Behöver följas upp vid återbesök.", "Needs follow-up at return visit."],
    ["Luftfilter har bytts enligt serviceplan", "Air filter replaced according to service plan"],
    ["Luftfilter har bytts neligt serviceplan", "Air filter replaced according to service plan"],
    ["har bytts enligt serviceplan", "replaced according to service plan"],
    ["Identifierad under testkörning", "Identified during test run"],
    ["Bytt på plats", "Replaced on site"],
    ["Avvikelse:", "Deviation:"],
    ["Samtliga kontroller genomförda utan kritiska anmärkningar.", "All checks completed without critical remarks."],
    ["Ärendet godkänt med anmärkning. Uppföljning rekommenderas.", "Case approved with remarks. Follow-up is recommended."],
    ["Ärendet ej godkänt. Åtgärd och återbesök krävs.", "Case not approved. Action and return visit required."]
  ];
  const translated = replacements.reduce((acc, [from, to]) => acc.replaceAll(from, to), value);
  if (translated !== value) return translated;
  if (hasSwedishMarkers) {
    return "Demo note (translated): action recorded during service.";
  }
  return translated;
}

async function normalizeDemoData(
  supabase: ReturnType<typeof createClientSupabaseServer>,
  userId: string
) {
  const { data: casesData } = await supabase
    .from("service_cases")
    .select("id, technician_name, final_comment")
    .eq("created_by", userId);
  const caseRows = (casesData ?? []) as Array<{
    id: string;
    technician_name: string | null;
    final_comment: string | null;
  }>;
  for (const row of caseRows) {
    const nextTechnician = row.technician_name === "Demo tekniker" ? "Demo Technician" : row.technician_name;
    const nextFinalComment = translateDemoText(row.final_comment);
    if (nextTechnician !== row.technician_name || nextFinalComment !== row.final_comment) {
      await supabase
        .from("service_cases")
        .update({
          technician_name: nextTechnician,
          final_comment: nextFinalComment
        })
        .eq("id", row.id)
        .eq("created_by", userId);
    }
  }

  const caseIds = caseRows.map((row) => row.id);
  if (caseIds.length === 0) return;

  const { data: checklistData } = await supabase
    .from("service_checklist_items")
    .select("id, comment, item_status")
    .in("case_id", caseIds);
  const checklistRows = (checklistData ?? []) as Array<{
    id: string;
    comment: string | null;
    item_status: string | null;
  }>;
  for (const row of checklistRows) {
    const translated = translateDemoText(row.comment);
    const nextComment =
      translated === "Demo note (translated): action recorded during service."
        ? row.item_status === "OK"
          ? "Checked and approved."
          : row.item_status === "ATGÄRDAD"
          ? "Adjusted/repaired during service."
          : row.item_status === "AVVIKELSE"
          ? "Deviation detected, action required."
          : "Not checked during this visit."
        : translated;
    if (nextComment !== row.comment) {
      await supabase
        .from("service_checklist_items")
        .update({ comment: nextComment })
        .eq("id", row.id);
    }
  }

  const { data: partsData } = await supabase
    .from("service_parts")
    .select("id, part_name, note, reason")
    .in("case_id", caseIds);
  const partRows = (partsData ?? []) as Array<{
    id: string;
    part_name: string | null;
    note: string | null;
    reason: string | null;
  }>;
  for (const row of partRows) {
    const nextPartName =
      row.part_name === "Defekt del (ej specificerad)"
        ? "Defective part (unspecified)"
        : row.part_name === "Låssprint"
        ? "Locking pin"
        : row.part_name === "Fästdetalj"
        ? "Mounting bracket"
        : row.part_name;
    const nextNote = translateDemoText(row.note);
    const nextReason = translateDemoText(row.reason);
    if (
      nextPartName !== row.part_name ||
      nextNote !== row.note ||
      nextReason !== row.reason
    ) {
      await supabase
        .from("service_parts")
        .update({
          part_name: nextPartName,
          note: nextNote,
          reason: nextReason
        })
        .eq("id", row.id);
    }
  }
}

async function getCases(): Promise<ServiceCaseRow[]> {
  const cookieStore = cookies();
  const supabase = createClientSupabaseServer(cookieStore);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return [];
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL;
  if (demoEmail && user.email?.toLowerCase() === demoEmail.toLowerCase()) {
    await normalizeDemoData(supabase, user.id);
  }

  const { data, error } = await supabase
    .from("service_cases")
    .select("*")
    .eq("created_by", user.id)
    .order("service_date", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []) as ServiceCaseRow[];
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
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_EMAIL ? true : false;

  return (
    <main className="flex-1">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Serviceärenden</h1>
          <Link href="/cases/new">
            <Button>Nytt serviceärende</Button>
          </Link>
        </div>
        {isDemoMode && (
          <Card>
            <CardContent className="py-3 text-sm text-muted-foreground">
              Testkonto är aktivt i appen. Testärenden sparas separat från vanliga användare.
            </CardContent>
          </Card>
        )}

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
            {cases.map((c: ServiceCaseRow) => (
              <Link key={c.id} href={`/cases/${c.id}`}>
                <Card className="h-full border-slate-200 hover:border-slate-300 transition-colors">
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
                    {c.requires_return_visit && (
                      <Badge variant="warning">Återbesök krävs</Badge>
                    )}
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

