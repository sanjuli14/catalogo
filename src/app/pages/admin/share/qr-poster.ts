import { translate } from '@jsverse/transloco';

import { readableTextColor } from '../../../core/color';
import { Business } from '../../../core/models';

type Rgb = [number, number, number];

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const BAND_HEIGHT = 74;
const QR_SIZE = 130;
const TEXT: Rgb = [17, 16, 20];
const MUTED: Rgb = [107, 105, 117];

/**
 * Cartel A4 para imprimir y pegar en el local: nombre del negocio, el código QR grande y
 * cómo usarlo. jsPDF se carga solo cuando hace falta.
 */
export async function downloadQrPoster(
  business: Business,
  qr: HTMLCanvasElement,
  url: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const brand = hexToRgb(business.primary_color);
  const onBrand = hexToRgb(readableTextColor(business.primary_color));
  const center = PAGE_WIDTH / 2;

  // Franja con el color del negocio y su nombre (se achica si es largo).
  doc.setFillColor(...brand);
  doc.rect(0, 0, PAGE_WIDTH, BAND_HEIGHT, 'F');
  doc.setTextColor(...onBrand);
  doc.setFont('helvetica', 'bold');
  let size = 44;
  doc.setFontSize(size);
  while (size > 22 && doc.getTextWidth(business.name) > PAGE_WIDTH - MARGIN * 2) {
    doc.setFontSize(--size);
  }
  const name = doc.splitTextToSize(business.name, PAGE_WIDTH - MARGIN * 2).slice(0, 2);
  doc.text(name, center, BAND_HEIGHT / 2 + (name.length > 1 ? -2 : 4), {
    align: 'center',
    baseline: 'middle',
  });

  // El código, con un borde fino del color del negocio.
  const qrY = BAND_HEIGHT + 22;
  const qrX = center - QR_SIZE / 2;
  doc.setDrawColor(...brand);
  doc.setLineWidth(0.8);
  doc.roundedRect(qrX - 6, qrY - 6, QR_SIZE + 12, QR_SIZE + 12, 6, 6, 'S');
  doc.addImage(qr.toDataURL('image/png'), 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);

  // Cómo usarlo.
  let y = qrY + QR_SIZE + 24;
  doc.setTextColor(...TEXT);
  doc.setFontSize(26);
  doc.text(translate('share.posterTitle'), center, y, { align: 'center' });
  y += 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(...MUTED);
  doc.text(translate('share.posterSubtitle'), center, y, { align: 'center' });

  // El enlace escrito, para quien no tenga cámara a mano.
  doc.setFontSize(12);
  doc.setTextColor(...brand);
  doc.text(url.replace(/^https?:\/\//, ''), center, PAGE_HEIGHT - MARGIN, { align: 'center' });

  doc.save(`${business.slug}-qr.pdf`);
}

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}
