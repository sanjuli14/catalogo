import { translate } from '@jsverse/transloco';

import { readableTextColor } from '../../core/color';
import { Business } from '../../core/models';
import { ItemGroup } from './group-items';
import { cardPrice, isOrderable } from './public-catalog';

interface CatalogPdfInput {
  business: Business;
  groups: ItemGroup[];
  catalogUrl: string;
  imageUrl: (path: string) => string;
}

type Rgb = [number, number, number];

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const HEADER_HEIGHT = 42;
const ROW_HEIGHT = 30;
const THUMB = 24;
const TEXT: Rgb = [28, 22, 51];
const MUTED: Rgb = [91, 86, 117];

/** Genera y descarga el catálogo en PDF (A4). jsPDF se carga solo cuando hace falta. */
export async function downloadCatalogPdf(input: CatalogPdfInput): Promise<void> {
  const { business, groups, catalogUrl, imageUrl } = input;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Todas las imágenes en paralelo; si alguna falla, el producto sale sin foto.
  const items = groups.flatMap((g) => g.items);
  const [logo, ...thumbs] = await Promise.all([
    business.logo_path ? loadImage(imageUrl(business.logo_path), 'contain') : null,
    ...items.map((item) => (item.photos[0] ? loadImage(imageUrl(item.photos[0]), 'cover') : null)),
  ]);
  const thumbByItem = new Map(items.map((item, i) => [item.id, thumbs[i]]));

  const brand = hexToRgb(business.primary_color);
  const onBrand = hexToRgb(readableTextColor(business.primary_color));
  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  // Encabezado con el color del negocio.
  doc.setFillColor(...brand);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, 'F');
  let textX = MARGIN;
  if (logo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, 9, 24, 24, 3, 3, 'F');
    doc.addImage(logo, 'JPEG', MARGIN + 1, 10, 22, 22);
    textX = MARGIN + 30;
  }
  doc.setTextColor(...onBrand);
  doc.setFont('helvetica', 'bold');
  // El nombre va en una sola línea: se achica hasta 14 pt y, si aún no cabe, se recorta.
  const nameWidth = PAGE_WIDTH - textX - MARGIN;
  let nameSize = 20;
  doc.setFontSize(nameSize);
  while (nameSize > 14 && doc.getTextWidth(business.name) > nameWidth) {
    doc.setFontSize(--nameSize);
  }
  let name = business.name;
  if (doc.getTextWidth(name) > nameWidth) {
    while (name && doc.getTextWidth(`${name}…`) > nameWidth) name = name.slice(0, -1);
    name = `${name.trimEnd()}…`;
  }
  doc.text(name, textX, 19);
  if (business.description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(business.description, PAGE_WIDTH - textX - MARGIN);
    doc.text(lines.slice(0, 2), textX, 26);
  }

  // Contacto y enlace al catálogo.
  let y = HEADER_HEIGHT + 8;
  const contact = [
    business.whatsapp && `WhatsApp: +${business.whatsapp}`,
    business.phone && translate('pdf.phone', { phone: business.phone }),
    business.email,
    business.address,
    business.schedule?.replace(/\s*\n\s*/g, ', '),
  ].filter(Boolean) as string[];
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  if (contact.length) {
    const lines = doc.splitTextToSize(contact.join('   ·   '), contentWidth);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4.5;
  }
  doc.setTextColor(...brand);
  doc.textWithLink(catalogUrl, MARGIN, y, { url: catalogUrl });
  y += 10;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN - 6) {
      doc.addPage();
      y = MARGIN + 4;
    }
  };

  for (const group of groups) {
    ensureSpace(10 + ROW_HEIGHT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...brand);
    doc.text(group.name, MARGIN, y);
    doc.setDrawColor(...brand);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y + 2, PAGE_WIDTH - MARGIN, y + 2);
    y += 8;

    for (const item of group.items) {
      ensureSpace(ROW_HEIGHT);
      const thumb = thumbByItem.get(item.id);
      if (thumb) {
        doc.addImage(thumb, 'JPEG', MARGIN, y, THUMB, THUMB);
      } else {
        doc.setFillColor(240, 238, 248);
        doc.roundedRect(MARGIN, y, THUMB, THUMB, 2, 2, 'F');
      }

      const x = MARGIN + THUMB + 5;
      const price = cardPrice(business, item);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...brand);
      doc.text(price, PAGE_WIDTH - MARGIN, y + 5, { align: 'right' });
      const priceWidth = doc.getTextWidth(price) + 4;

      doc.setFontSize(11);
      doc.setTextColor(...TEXT);
      const name = doc.splitTextToSize(item.name, PAGE_WIDTH - MARGIN - x - priceWidth)[0];
      doc.text(name, x, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      // Con variantes, la descripción deja un renglón para "Talla: S, M, L".
      let textY = y + 10.5;
      if (item.description) {
        const lines = doc
          .splitTextToSize(item.description, PAGE_WIDTH - MARGIN - x)
          .slice(0, item.variants.length ? 2 : 3);
        doc.text(lines, x, textY);
        textY += lines.length * 3.8;
      }
      if (item.variants.length) {
        const names = item.variants.map((v) => v.name).join(', ');
        const text = item.variant_label ? `${item.variant_label}: ${names}` : names;
        doc.text(doc.splitTextToSize(text, PAGE_WIDTH - MARGIN - x)[0], x, textY);
      }
      if (!isOrderable(item)) {
        doc.setTextColor(164, 22, 26);
        doc.text(translate('items.unavailable'), x, y + THUMB - 0.5);
      }
      y += ROW_HEIGHT;
    }
    y += 4;
  }

  // Pie con número de página.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${business.name} · ${page} / ${pages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, {
      align: 'center',
    });
  }

  doc.save(`${business.slug}.pdf`);
}

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

/**
 * Descarga una imagen y la convierte a JPEG cuadrado de 300 px (jsPDF no lee WebP).
 * cover: recorta para llenar el cuadrado; contain: la encaja completa sobre fondo blanco.
 */
async function loadImage(url: string, fit: 'cover' | 'contain'): Promise<string | null> {
  try {
    const response = await fetch(url);
    const bitmap = await createImageBitmap(await response.blob());
    const size = 300;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);

    const pick = fit === 'cover' ? Math.max : Math.min;
    const scale = pick(size / bitmap.width, size / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}
