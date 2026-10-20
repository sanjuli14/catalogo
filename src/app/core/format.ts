/** "$12.50", "12,50 €"... según la moneda del negocio. null = "Precio a consultar". */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Precio a consultar';
  return new Intl.NumberFormat('es', { style: 'currency', currency }).format(price);
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
    case 'user_already_exists':
      return 'Ya existe una cuenta con ese correo. Inicia sesión.';
    case 'weak_password':
      return 'La contraseña es muy débil. Usa al menos 8 caracteres.';
    case 'over_email_send_rate_limit':
      return 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.';
    case 'captcha_failed':
      return 'No pudimos verificar que eres una persona. Inténtalo de nuevo.';
    case 'signup_disabled':
      return 'El registro de cuentas nuevas está desactivado.';
    default:
      return message ? `Algo salió mal: ${message}` : 'Algo salió mal. Inténtalo de nuevo.';
  }
}
