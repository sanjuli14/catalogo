import { translate } from '@jsverse/transloco';

/** Locale de Intl del idioma activo ("es-419", "en-US"): va en cada archivo de traducción. */
export function intlLocale(): string {
  return translate('locale');
}

/**
 * "$12.50", "€12.50", "Q 12.50"... según la moneda del negocio. null = "Precio a consultar".
 * Los precios enteros van sin ".00" ("$1,250,000"), que en las tarjetas ocupa mucho.
 */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return translate('price.onRequest');
  const decimals = Number.isInteger(price) ? 0 : 2;
  return new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

/** Códigos de error con mensaje propio (en errors.* de los archivos de traducción). */
const KNOWN_ERRORS = new Set([
  '23505',
  '23514',
  '42501',
  'owner_taken',
  'invalid_email',
  'same_password',
  'CT001',
  'user_already_exists',
  'weak_password',
  'over_email_send_rate_limit',
  'captcha_failed',
  'image_decode',
  'signup_disabled',
]);

/** Convierte un error de Supabase en un mensaje para el usuario. */
export function errorMessage(error: unknown): string {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  if (code && KNOWN_ERRORS.has(code)) return translate(`errors.${code}`);
  return message ? translate('errors.withMessage', { message }) : translate('errors.generic');
}
