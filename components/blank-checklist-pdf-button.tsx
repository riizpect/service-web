"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { getChecklistForProductType, type ProductType } from "@/lib/checklistConfig";

type BlankChecklistPdfButtonProps = {
  productType: ProductType;
};

export function BlankChecklistPdfButton({ productType }: BlankChecklistPdfButtonProps) {
  const handleDownload = () => {
    const doc = new jsPDF();
    const sections = getChecklistForProductType(productType);
    const productLabel =
      productType === "VIPER_VLS" ? "VIPER + VLS" : productType;

    doc.setFontSize(16);
    doc.text("Serviceblankett - Manuell ifyllnad", 14, 16);
    doc.setFontSize(10);
    doc.text(`Produkttyp: ${productLabel}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Fält", "Att fylla i"]],
      body: [
        ["Kund", ""],
        ["Datum", ""],
        ["Plats", ""],
        ["Servicetekniker", ""],
        ["VIPER serienummer", ""],
        ["VLS serienummer", ""],
        ["Arbetsorder / referensnummer", ""]
      ],
      styles: { fontSize: 9, minCellHeight: 8 }
    });

    sections.forEach((section, index) => {
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
          ?.finalY
          ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6)
          : 90 + index * 10,
        head: [[section.title, "OK", "Åtgärdad", "Avvikelse", "Ej kontrollerad", "Kommentar"]],
        body: section.items.map((item) => [item.label, "☐", "☐", "☐", "☐", ""]),
        styles: { fontSize: 8, overflow: "linebreak", minCellHeight: 8, valign: "middle" },
        headStyles: { fillColor: [30, 64, 175] },
        columnStyles: {
          0: { cellWidth: 72 },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 28, halign: "center" },
          5: { cellWidth: 30 }
        }
      });
    });

    autoTable(doc, {
      startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY
        ? ((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8)
        : 250,
      head: [["Slutbedömning", "Att fylla i"]],
      body: [
        ["Godkänd", "[]"],
        ["Godkänd med anmärkning", "[]"],
        ["Ej godkänd", "[]"],
        ["Återbesök krävs", "[]"],
        ["Kommentar", ""]
      ],
      styles: { fontSize: 9, minCellHeight: 8 }
    });

    doc.save(`serviceblankett-${productLabel.replace(/\s+/g, "-")}.pdf`);
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
      Skriv ut tom checklista
    </Button>
  );
}
