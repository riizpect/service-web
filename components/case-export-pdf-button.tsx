"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";

type ChecklistItem = {
  section: string;
  label: string;
  status: string;
  comment: string | null;
  partReplaced: boolean;
};

type ServicePart = {
  part_name: string;
  part_number: string | null;
  quantity: number;
  note: string | null;
  needs_order?: boolean | null;
  order_status?: string | null;
  priority?: string | null;
  reason?: string | null;
};

interface CaseExportPdfButtonProps {
  caseId: string;
  customerName: string | null;
  serviceDate: string | null;
  location: string | null;
  technicianName: string | null;
  productType: string | null;
  viperSerial: string | null;
  vlsSerial: string | null;
  referenceNumber: string | null;
  finalStatus: string | null;
  finalComment: string | null;
  checklistItems: ChecklistItem[];
  parts: ServicePart[];
}

export function CaseExportPdfButton(props: CaseExportPdfButtonProps) {
  const handleDownload = () => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ensureSpace = (neededHeight: number): number => {
      const lastY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? 20;
      const nextY = lastY + 6;
      if (nextY + neededHeight > pageHeight - 10) {
        doc.addPage();
        return 16;
      }
      return nextY;
    };
    const formatChecklistStatus = (status: string) => {
      if (status === "ATGÄRDAD") return "Åtgärdad";
      if (status === "AVVIKELSE") return "Avvikelse";
      if (status === "EJ_KONTROLLERAD") return "Ej kontrollerad";
      return status;
    };
    const orderParts = props.parts.filter((part) => part.needs_order);
    const requiresReturnVisit = orderParts.length > 0;
    const normalizedFinalStatus = props.finalStatus ?? "Ej ifyllt";
    const verdictLabel =
      normalizedFinalStatus === "Godkänd"
        ? "Fordon/utrustning godkänd för drift"
        : normalizedFinalStatus === "Godkänd med anmärkning"
        ? "Godkänd med anmärkning - åtgärd rekommenderas"
        : normalizedFinalStatus === "Ej godkänd"
        ? "Ej godkänd - åtgärd krävs innan drift"
        : "Ej ifyllt";

    doc.setFontSize(16);
    doc.text("Servicerapport - Ferno", 14, 16);
    doc.setFontSize(10);
    doc.text(`Ärende-ID: ${props.caseId}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Fält", "Värde"]],
      body: [
        ["Kund", props.customerName ?? "-"],
        ["Datum", props.serviceDate ?? "-"],
        ["Plats", props.location ?? "-"],
        ["Tekniker", props.technicianName ?? "-"],
        ["Produkttyp", props.productType ?? "-"],
        ["VIPER serienummer", props.viperSerial ?? "-"],
        ["VLS serienummer", props.vlsSerial ?? "-"],
        ["Referensnummer", props.referenceNumber ?? "-"],
        ["Återbesök krävs", requiresReturnVisit ? "Ja" : "Nej"],
        ["Slutstatus", normalizedFinalStatus],
        ["Slutkommentar", props.finalComment ?? "-"]
      ],
      styles: { fontSize: 9 }
    });

    autoTable(doc, {
      startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY
        ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6)
        : 80,
      head: [["Checklista", "Statusöversikt"]],
      body: [[
        `${props.checklistItems.length} kontrollpunkter`,
        `${props.checklistItems.filter((i) => i.status === "OK").length} OK, ${props.checklistItems.filter((i) => i.status === "AVVIKELSE").length} avvikelse, ${props.checklistItems.filter((i) => i.status === "EJ_KONTROLLERAD").length} ej kontrollerad`
      ]],
      styles: { fontSize: 9 }
    });

    const groupedBySection = props.checklistItems.reduce<Record<string, ChecklistItem[]>>(
      (acc, item) => {
        if (!acc[item.section]) acc[item.section] = [];
        acc[item.section].push(item);
        return acc;
      },
      {}
    );

    Object.entries(groupedBySection).forEach(([section, sectionItems], sectionIndex) => {
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
          ?.finalY
          ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6)
          : 100 + sectionIndex * 14,
        head: [[section, "Status", "Kommentar", "Ersatt del"]],
        body: sectionItems.map((item) => [
          item.label,
          formatChecklistStatus(item.status),
          item.comment?.trim() || "-",
          item.partReplaced ? "Ja" : "Nej"
        ]),
        styles: { fontSize: 8, overflow: "linebreak", cellPadding: 2.2, valign: "top" },
        headStyles: { fillColor: [30, 64, 175] },
        columnStyles: {
          0: { cellWidth: 76 },
          1: { cellWidth: 24 },
          2: { cellWidth: 62 },
          3: { cellWidth: 24 }
        }
      });
    });

    if (props.parts.length > 0) {
      const replacedParts = props.parts.filter((part) => !part.needs_order);

      if (replacedParts.length > 0) {
        autoTable(doc, {
          startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
            ?.finalY
            ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
                6)
            : 160,
          head: [["Ersatta delar", "Art.nr", "Antal", "Notering"]],
          body: replacedParts.map((part) => [
            part.part_name,
            part.part_number ?? "-",
            String(part.quantity),
            part.note ?? "-"
          ]),
          styles: { fontSize: 8 }
        });
      }

      if (orderParts.length > 0) {
        autoTable(doc, {
          startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
            ?.finalY
            ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
                6)
            : 180,
          head: [["Reservdel att beställa", "Art.nr", "Antal", "Status", "Prio", "Orsak"]],
          body: orderParts.map((part) => [
            part.part_name || "Del ej ifylld",
            part.part_number ?? "-",
            String(part.quantity),
            part.order_status ?? "Ej beställd",
            part.priority ?? "Medel",
            part.reason || part.note || "-"
          ]),
          styles: { fontSize: 8 }
        });
      }
    }

    if (requiresReturnVisit) {
      const revisitY = ensureSpace(22);
      doc.setFontSize(11);
      doc.text("Återbesök", 14, revisitY);
      doc.setFontSize(10);
      doc.text(
        `Återbesök krävs för ${orderParts.length} reservdel(ar) som behöver beställas/monteras.`,
        14,
        revisitY + 6
      );
    }

    const verdictY = ensureSpace(24);

    doc.setFontSize(12);
    doc.text("Slutbedömning", 14, verdictY);
    doc.setFontSize(11);
    doc.text(`Status: ${normalizedFinalStatus}`, 14, verdictY + 8);
    doc.setFontSize(10);
    doc.text(`Bedömning: ${verdictLabel}`, 14, verdictY + 14);

    const safeCustomer = (props.customerName ?? "kund").replace(/\s+/g, "-");
    const safeDate = props.serviceDate ?? "datum";
    doc.save(`servicerapport-${safeCustomer}-${safeDate}.pdf`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      Exportera PDF
    </Button>
  );
}

