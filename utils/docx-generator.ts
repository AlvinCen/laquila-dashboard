// utils/docx-generator.ts
// Robust DOCX generator: works with either a <script> CDN (window.docx) or ESM (import('docx')).
// If you rely on the fallback import, run:  npm i docx

// ---------- Types ----------
export interface ReportData {
  period: string;
  salesData: { name: string; value: number }[];
  cogsData: { name: string; value: number }[];
  opExData: { name: string; value: number }[];
  totalSales: number;
}

// ---------- Helpers ----------
const formatIDR = (n: number): string => {
  const abs = new Intl.NumberFormat('id-ID').format(Math.abs(Math.round(n)));
  return n < 0 ? `(Rp ${abs})` : `Rp ${abs}`;
};

const formatPercentID = (value: number, total: number): string => {
  if (!total) return '0,00%';
  return `${((value / total) * 100).toFixed(2).replace('.', ',')}%`;
};


// Load docx namespace from window (CDN) or fall back to ESM import
type DocxNS = typeof import('docx');
async function getDocx(): Promise<DocxNS> {
  if (typeof window !== 'undefined' && (window as any).docx) {
    // Loaded via <script src="https://unpkg.com/docx@.../build/index.js"></script>
    return (window as any).docx as DocxNS;
  }
  // Fallback to ESM (requires: npm i docx)
  const mod = await import('docx');
  return mod;
}

// A4 page content width is roughly 9500-9800 twips with standard margins.
const COLUMN_WIDTHS_DXA: [number, number, number] = [6200, 2000, 1800];

// Helper to create a table cell with consistent properties
const createCell = (
  d: DocxNS,
  {
    text,
    bold = false,
    width,
    alignment = d.AlignmentType.LEFT,
  }: {
    text: string;
    bold?: boolean;
    width: { size: number; type: DocxNS['WidthType'] };
    alignment?: DocxNS['AlignmentType'];
  }
) => {
  return new d.TableCell({
    width: width,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    verticalAlign: d.VerticalAlign.CENTER,
    children: [
      new d.Paragraph({
        children: [new d.TextRun({ text, bold })],
        alignment: alignment,
        spacing: { after: 0 },
        keepLines: true, // Prevents breaking single words
      }),
    ],
  });
};

// Reusable section table (title + rows + total row with %)
const createSection = (
  d: DocxNS,
  title: string,
  items: { name: string; value: number }[],
  totalLabel: string,
  totalValue: number,
  totalSales: number
) => {
  const rows = items.map(
    (item) =>
      new d.TableRow({
        children: [
          createCell(d, { text: item.name, width: { size: COLUMN_WIDTHS_DXA[0], type: d.WidthType.DXA } }),
          createCell(d, {
            text: formatIDR(item.value),
            width: { size: COLUMN_WIDTHS_DXA[1], type: d.WidthType.DXA },
            alignment: d.AlignmentType.RIGHT,
          }),
          createCell(d, {
            text: formatPercentID(item.value, totalSales),
            width: { size: COLUMN_WIDTHS_DXA[2], type: d.WidthType.DXA },
            alignment: d.AlignmentType.RIGHT,
          }),
        ],
      })
  );

  if (totalLabel) {
    rows.push(
      new d.TableRow({
        children: [
          createCell(d, {
            text: totalLabel,
            bold: true,
            width: { size: COLUMN_WIDTHS_DXA[0], type: d.WidthType.DXA },
          }),
          createCell(d, {
            text: formatIDR(totalValue),
            bold: true,
            width: { size: COLUMN_WIDTHS_DXA[1], type: d.WidthType.DXA },
            alignment: d.AlignmentType.RIGHT,
          }),
          createCell(d, {
            text: formatPercentID(totalValue, totalSales),
            bold: true,
            width: { size: COLUMN_WIDTHS_DXA[2], type: d.WidthType.DXA },
            alignment: d.AlignmentType.RIGHT,
          }),
        ],
      })
    );
  }

  return [
    new d.Paragraph({
      children: [new d.TextRun({ text: title, bold: true })],
      spacing: { before: 200, after: 100 },
    }),
    new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      layout: d.TableLayoutType.FIXED,
      columnWidths: COLUMN_WIDTHS_DXA,
      rows,
    }),
  ];
};


// ---------- Main ----------
export const generateProfitLossDocx = async (data: ReportData) => {
  const d = await getDocx();

  const { period, salesData, cogsData, opExData, totalSales } = data;

  // --- CALCULATIONS ---
  const totalCogs = cogsData.reduce((sum, item) => sum + item.value, 0);
  const grossProfit = totalSales - totalCogs;

  const totalOpEx = opExData.reduce((sum, item) => sum + item.value, 0);
  const operatingProfit = grossProfit - totalOpEx;

  // --- DOCUMENT STRUCTURE ---
  const doc = new d.Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new d.Paragraph({
            text: 'LAPORAN LABA RUGI LAQUILA MANUFACTURE',
            heading: d.HeadingLevel.HEADING_1,
            alignment: d.AlignmentType.CENTER,
            style: 'strong',
          }),
          new d.Paragraph({
            text: `PERIODE ${period}`,
            heading: d.HeadingLevel.HEADING_2,
            alignment: d.AlignmentType.CENTER,
          }),
          new d.Paragraph({ text: '', spacing: { after: 300 } }), // spacer

          // A. Penjualan
          new d.Paragraph({
            children: [new d.TextRun({ text: 'A. Penjualan', bold: true })],
            spacing: { before: 200, after: 100 },
          }),
          new d.Table({
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            layout: d.TableLayoutType.FIXED,
            columnWidths: COLUMN_WIDTHS_DXA,
            rows: [
              ...salesData.map(
                (item) =>
                  new d.TableRow({
                    children: [
                      createCell(d, { text: item.name, width: { size: COLUMN_WIDTHS_DXA[0], type: d.WidthType.DXA } }),
                      createCell(d, {
                        text: formatIDR(item.value),
                        width: { size: COLUMN_WIDTHS_DXA[1], type: d.WidthType.DXA },
                        alignment: d.AlignmentType.RIGHT,
                      }),
                      createCell(d, {
                        text: formatPercentID(item.value, totalSales),
                        width: { size: COLUMN_WIDTHS_DXA[2], type: d.WidthType.DXA },
                        alignment: d.AlignmentType.RIGHT,
                      }),
                    ],
                  })
              ),
              new d.TableRow({
                children: [
                    createCell(d, { text: 'Total Penjualan', bold: true, width: { size: COLUMN_WIDTHS_DXA[0], type: d.WidthType.DXA } }),
                    createCell(d, { text: formatIDR(totalSales), bold: true, width: { size: COLUMN_WIDTHS_DXA[1], type: d.WidthType.DXA }, alignment: d.AlignmentType.RIGHT }),
                    createCell(d, { text: formatPercentID(totalSales, totalSales), bold: true, width: { size: COLUMN_WIDTHS_DXA[2], type: d.WidthType.DXA }, alignment: d.AlignmentType.RIGHT }),
                ],
              }),
            ],
          }),

          // B. Harga Pokok Penjualan (HPP)
          ...createSection(
            d,
            'B. Harga Pokok Penjualan (HPP)',
            cogsData,
            'Subtotal HPP',
            totalCogs,
            totalSales
          ),

          // Laba Bruto
          new d.Paragraph({ spacing: { before: 100, after: 100 } }),
          new d.Table({
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            layout: d.TableLayoutType.FIXED,
            columnWidths: COLUMN_WIDTHS_DXA,
            rows: [
              new d.TableRow({
                children: [
                  createCell(d, { text: 'LABA BRUTO', bold: true, width: { size: COLUMN_WIDTHS_DXA[0], type: d.WidthType.DXA } }),
                  createCell(d, { text: formatIDR(grossProfit), bold: true, width: { size: COLUMN_WIDTHS_DXA[1], type: d.WidthType.DXA }, alignment: d.AlignmentType.RIGHT }),
                  createCell(d, { text: formatPercentID(grossProfit, totalSales), bold: true, width: { size: COLUMN_WIDTHS_DXA[2], type: d.WidthType.DXA }, alignment: d.AlignmentType.RIGHT }),
                ],
              }),
            ],
          }),

          // C. Beban Operasi
          ...createSection(
            d,
            'C. Beban Operasi',
            opExData,
            'Total Beban Operasi',
            totalOpEx,
            totalSales
          ),

          // Laba Operasi (Nett)
          new d.Paragraph({ spacing: { before: 100, after: 100 } }),
          new d.Table({
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            layout: d.TableLayoutType.FIXED,
            columnWidths: COLUMN_WIDTHS_DXA,
            rows: [
              new d.TableRow({
                children: [
                  createCell(d, { text: 'LABA OPERASI (Nett)', bold: true, width: { size: COLUMN_WIDTHS_DXA[0], type: d.WidthType.DXA } }),
                  createCell(d, { text: formatIDR(operatingProfit), bold: true, width: { size: COLUMN_WIDTHS_DXA[1], type: d.WidthType.DXA }, alignment: d.AlignmentType.RIGHT }),
                  createCell(d, { text: formatPercentID(operatingProfit, totalSales), bold: true, width: { size: COLUMN_WIDTHS_DXA[2], type: d.WidthType.DXA }, alignment: d.AlignmentType.RIGHT }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
    styles: {
      paragraphStyles: [
        {
          id: 'strong',
          name: 'Strong',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { bold: true },
        },
      ],
    },
  });

  // Return a Blob so caller can save with FileSaver's saveAs()
  return d.Packer.toBlob(doc);
};