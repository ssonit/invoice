import { writeFileSync } from "node:fs";

const lines = [
  "INVOICE",
  "Vendor: Acme Test Supplies Ltd",
  "Invoice number: E2E-0001",
  "Issue date: 2026-09-15",
  "Description: Office supplies",
  "Total due: 123.45 USD",
];
const text = lines.map((l, i) => `BT /F1 14 Tf 72 ${760 - i * 24} Td (${l}) Tj ET`).join("\n");
const objs = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
let pdf = "%PDF-1.4\n";
const offsets = [];
objs.forEach((o, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
offsets.forEach((o) => (pdf += `${String(o).padStart(10, "0")} 00000 n \n`));
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
writeFileSync(new URL("./invoice-sample.pdf", import.meta.url), pdf);
