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
      head: [["Sektion", "Punkt", "Status", "Kommentar", "Ersatt del"]],
      body: props.checklistItems.map((item) => [
        item.section,
        item.label,
        item.status,
        item.comment ?? "-",
        item.partReplaced ? "Ja" : "Nej"
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] }
    });

    if (props.parts.length > 0) {
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
          ?.finalY
          ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
              6)
          : 160,
        head: [["Del", "Art.nr", "Antal", "Notering"]],
        body: props.parts.map((part) => [
          part.part_name,
          part.part_number ?? "-",
          String(part.quantity),
          part.note ?? "-"
        ]),
        styles: { fontSize: 8 }
      });
    }

    const verdictY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY
      ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14)
      : 250;

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

