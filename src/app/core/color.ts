/** Blanco o casi negro: el que se lea mejor sobre el color de fondo `hex` (#rrggbb). */
export function readableTextColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contraste contra blanco vs. contra #111: se queda con el mayor.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.056 ? '#ffffff' : '#111111';
}
