/**
 * PDF generation helpers using pdfmake.
 */

// @ts-ignore — pdfmake has no built-in types for this path
import PdfMake from "pdfmake/build/pdfmake.js";

export function createPdfBuffer(
  docDefinition: any
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const printer = new (PdfMake as any)({});
    const doc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
