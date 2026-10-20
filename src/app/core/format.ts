/**
 * "$12.50", "€12.50", "Q 12.50"... según la moneda del negocio. null = "Precio a consultar".
 * Los precios enteros van sin ".00" ("$1,250,000"), que en las tarjetas ocupa mucho.
 */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Precio a consultar';
  const decimals = Number.isInteger(price) ? 0 : 2;
  return new Intl.NumberFormat('es-419', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

/** Convierte un error de Supabase en un mensaje para el usuario. */
export function errorMessage(error: unknown): string {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  switch (code) {
    case '23505':
      return 'Esa dirección web ya la usa otro negocio. Elige otra.';
    case '23514':
      return 'Algún dato no tiene el formato correcto. Revisa el formulario.';
    case '42501':
      return 'No tienes permiso para hacer esto.';
    case 'owner_taken':
      return 'Ese correo ya administra otro negocio.';
    case 'invalid_email':
      return 'El correo no es válido.';
    case 'same_password':
      return 'La contraseña nueva tiene que ser distinta de la anterior.';
    case 'CT001':
      return 'Tu cuenta ya tiene un negocio.';
    case 'user_already_exists':
      return 'Ya existe una cuenta con ese correo. Inicia sesión.';
    case 'weak_password':
      return 'La contraseña es muy débil. Usa al menos 8 caracteres.';
    case 'over_email_send_rate_limit':
      return 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.';
    case 'captcha_failed':
      return 'No pudimos verificar que eres una persona. Inténtalo de nuevo.';
    case 'image_decode':
      return 'No se pudo leer una de las fotos. Puede estar dañada o en un formato que el navegador no abre (por ejemplo una foto HEIC con extensión .jpg). Ábrela y guárdala de nuevo como JPG o PNG.';
    case 'signup_disabled':
      return 'El registro de cuentas nuevas está desactivado.';
    default:
      return message ? `Algo salió mal: ${message}` : 'Algo salió mal. Inténtalo de nuevo.';
  }
}
