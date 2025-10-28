export type PaperSize = '58' | '80' | '100x150';

// Helper to ensure correct data URL prefix
const asDataUrl = (raw: string|undefined, mime = 'image/png') =>
  !raw ? '' : (raw.startsWith('data:') ? raw : `data:${mime};base64,${raw}`);

const css = (paper: PaperSize) => `
  <style>
    @page { 
      size: ${paper === '100x150' ? '100mm 150mm' : (paper === '58' ? '58mm' : '80mm')} auto; 
      margin: 0; 
    }
    body { margin: 0; font-family: sans-serif; }
    .wrap { 
      width: ${paper === '100x150' ? '378px' : (paper === '58' ? '219px' : '302px')}; 
      padding: ${paper === '100x150' ? '5mm' : '0'};
      box-sizing: border-box;
    }
    .img { 
      width: 100%; 
      image-rendering: -webkit-optimize-contrast; 
      display: block; 
    }
    .hide-print { display: none !important; }
    @media print { .no-print { display: none !important; } }
  </style>
`;

const getPrintScript = () => `
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const checkImagesReady = () => {
        if (document.images.length === 0) return true;
        return Array.from(document.images).every(img => img.complete);
      };

      let attempts = 0;
      const maxAttempts = 50; // 5 second timeout

      const attemptPrint = () => {
        if (checkImagesReady()) {
          window.focus();
          window.print();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(attemptPrint, 100);
        } else {
          console.error("Printing timed out: Images did not load in time.");
        }
      };

      attemptPrint();
    });
  </script>
`;


export function printHtmlViaIframe(html: string) {
  // Clean up old iframe if it exists
  const id = '__print_iframe__';
  document.getElementById(id)?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = id;
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.left = '-9999px'; // Move it off-screen
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();

  // The script inside the iframe will handle printing.
  // We just clean up the iframe after a while.
  setTimeout(() => iframe.remove(), 5000);
}


type KelengkapanItem = {
    productName: string;
    sku?: string;
    color?: string;
    qty?: number;
    kelengkapanImage?: string;
    kelengkapanMime?: string;
}

export function buildKelengkapanHTML(opts: {
  paper?: PaperSize;
  title: string;
  productName: string;
  sku?: string;
  color?: string;
  qty?: number;
  kelengkapanImage?: string;
  kelengkapanMime?: string;
}) {
  const p = opts.paper ?? '80';
  const header = css(p);
  const content = opts.kelengkapanMime?.startsWith('image/')
    ? `<img class="img" src="${opts.kelengkapanImage || ''}" alt="kelengkapan">`
    : `<div>File kelengkapan bertipe PDF. Silakan buka file PDF dari Master Produk untuk dicetak.</div>`;

  const printScript = getPrintScript();

  return `
    <html><head><meta charset="utf-8" /><title>${opts.title}</title>${header}</head>
    <body>
      <div class="wrap">
        ${content}
      </div>
      ${printScript}
    </body></html>
  `;
}

export function printKelengkapanProduct(paper: PaperSize, data: KelengkapanItem) {
  const html = buildKelengkapanHTML({
    paper,
    title: 'Print Kelengkapan Produk',
    ...data,
    // Ensure dataURL is valid
    kelengkapanImage: asDataUrl(data.kelengkapanImage, data.kelengkapanMime?.startsWith('image/') ? data.kelengkapanMime! : 'image/png'),
  });
  printHtmlViaIframe(html);
}

export function buildMultiKelengkapanHTML(opts: {
    paper?: PaperSize;
    title: string;
    items: KelengkapanItem[]
}) {
    const p = opts.paper ?? '80';
    const header = css(p) + `<style>.item { border-top: 1px dashed #333; padding-top: 5px; margin-top: 5px; page-break-inside: avoid; } .item:first-child { border-top: none; padding-top: 0; margin-top: 0; }</style>`;

    const itemsHTML = opts.items.map(item => {
        // Ensure dataURL is valid for each item
        const validImageUrl = asDataUrl(item.kelengkapanImage, item.kelengkapanMime?.startsWith('image/') ? item.kelengkapanMime! : 'image/png');
        const content = item.kelengkapanMime?.startsWith('image/')
            ? `<img class="img" src="${validImageUrl}" alt="kelengkapan">`
            : `<div>File kelengkapan bertipe PDF. Silakan buka file PDF dari Master Produk untuk dicetak.</div>`;

        return `<div class="item">${content}</div>`;
    }).join('');

    const printScript = getPrintScript();

    return `
      <html><head><meta charset="utf-8" /><title>${opts.title}</title>${header}</head>
      <body>
        <div class="wrap">
          ${itemsHTML}
        </div>
        ${printScript}
      </body></html>
    `;
}

export function printMultiKelengkapan(paper: PaperSize, title: string, items: KelengkapanItem[]) {
    const html = buildMultiKelengkapanHTML({ paper, title, items });
    printHtmlViaIframe(html);
}