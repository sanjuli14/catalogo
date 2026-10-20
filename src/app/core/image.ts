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
  const source = await decodeImage(file);
  const { width, height } = source;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  source.release();

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

interface DecodedImage {
  image: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  /** Libera la memoria o la URL temporal; se llama después de dibujar. */
  release: () => void;
}

/**
 * Algunos JPEG (por ejemplo truncados o con datos dañados al final) los rechaza
 * `createImageBitmap` con "The source image could not be decoded", pero un <img> sí los abre.
 * Por eso, si falla, se intenta con un <img> antes de rendirse.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch (bitmapError) {
    console.warn('createImageBitmap no pudo leer la imagen; se intenta con <img>', bitmapError);
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (imageError) {
    URL.revokeObjectURL(url);
    console.warn('<img> tampoco pudo leer la imagen', imageError);
    throw Object.assign(new Error('No se pudo leer la imagen'), { code: 'image_decode' });
  }
  return {
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
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
