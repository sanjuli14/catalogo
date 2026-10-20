/**
 * Reduce una imagen a `maxSize` px por lado y la convierte a WebP. Así las fotos del celular
 * no superan los 5 MB del bucket.
 *
 * Si el navegador no sabe generar WebP (Safari devuelve PNG), las fotos se guardan en JPEG,
 * que pesa mucho menos que un PNG. Con `keepTransparency` se queda en PNG (para logos).
 */
export async function resizeImage(
  file: File,
  maxSize: number,
  keepTransparency = false,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, 'image/webp');
  if (webp.type === 'image/webp' || keepTransparency) return webp;

  // JPEG no tiene transparencia: se pinta sobre blanco para que no quede negro.
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const context = flat.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, flat.width, flat.height);
  context.drawImage(canvas, 0, 0);
  return toBlob(flat, 'image/jpeg');
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))),
      type,
      0.85,
    ),
  );
}
