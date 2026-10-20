import { readableTextColor } from './color';

export interface QrOptions {
  /** Color del negocio: se usa si es lo bastante oscuro para leerse sobre blanco. */
  color: string;
  /** Logo en el centro (URL pública); null = sin logo. */
  logoUrl: string | null;
  /** Lado en px del PNG. */
  size?: number;
}

/**
 * Código QR del enlace, con el color y el logo del negocio. Usa la corrección de errores
 * más alta (H): soporta tapar hasta ~30% del código, así que el logo del centro no lo rompe.
 * La librería se carga solo cuando hace falta.
 */
export async function renderQr(url: string, options: QrOptions): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import('qrcode');
  const size = options.size ?? 1024;
  // Un color claro sobre blanco no lo leen las cámaras: entonces va en casi negro.
  const dark = readableTextColor(options.color) === '#ffffff' ? options.color : '#111111';

  const canvas = document.createElement('canvas');
  await toCanvas(canvas, url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: size,
    color: { dark, light: '#ffffff' },
  });

  const logo = options.logoUrl ? await loadBitmap(options.logoUrl) : null;
  if (logo) {
    // Logo dentro de un cuadrado blanco redondeado, ~22% del código.
    const context = canvas.getContext('2d')!;
    const box = Math.round(canvas.width * 0.22);
    const x = (canvas.width - box) / 2;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.roundRect(x, x, box, box, box * 0.18);
    context.fill();

    const padding = box * 0.1;
    const inner = box - padding * 2;
    const scale = Math.min(inner / logo.width, inner / logo.height);
    const width = logo.width * scale;
    const height = logo.height * scale;
    context.drawImage(logo, x + (box - width) / 2, x + (box - height) / 2, width, height);
    logo.close();
  }
  return canvas;
}

/** Si el logo no carga, el código sale sin logo (sigue sirviendo). */
async function loadBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(url);
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}
