import { Injectable, inject } from '@angular/core';

import { Auth } from '../../core/auth';
import { CatalogApi } from '../../core/catalog-api';
import { formatPrice } from '../../core/format';
import { Business, Category, Item } from '../../core/models';
import { whatsappChatUrl } from '../../core/whatsapp';

export interface PublicCatalogData {
  business: Business;
  categories: Category[];
  /** Solo los visibles: el dueño también recibe los ocultos (por la RLS), pero aquí no se muestran. */
  items: Item[];
}

/**
 * Datos del catálogo público, guardados en memoria por slug: ir del catálogo al detalle de
 * un producto y volver no repite las consultas.
 */
@Injectable({ providedIn: 'root' })
export class PublicCatalog {
  private readonly api = inject(CatalogApi);
  private readonly auth = inject(Auth);
  private readonly cache = new Map<string, Promise<PublicCatalogData | null>>();

  /** null si no existe o si el visitante no puede verlo (no está activo y no es su dueño). */
  load(slug: string): Promise<PublicCatalogData | null> {
    let entry = this.cache.get(slug);
    if (!entry) {
      entry = this.fetch(slug);
      this.cache.set(slug, entry);
      // Si falla (por ejemplo, sin conexión), el próximo intento vuelve a consultar.
      entry.catch(() => this.cache.delete(slug));
    }
    return entry;
  }

  imageUrl(path: string): string {
    return this.api.imageUrl(path);
  }

  private async fetch(slug: string): Promise<PublicCatalogData | null> {
    // Con sesión, la RLS deja ver al dueño su catálogo aunque esté pendiente.
    await this.auth.ready;
    const business = await this.api.getBusinessBySlug(slug);
    if (!business) return null;

    const [categories, items] = await Promise.all([
      this.api.listCategories(business.id),
      this.api.listItems(business.id),
    ]);
    return { business, categories, items: items.filter((i) => i.is_visible) };
  }
}

export function catalogUrl(business: Business): string {
  return `${location.origin}/${business.slug}`;
}

export function productUrl(business: Business, item: Item): string {
  return `${catalogUrl(business)}/${item.id}`;
}

export function itemPrice(business: Business, item: Item): string {
  return formatPrice(item.price, business.currency);
}

/**
 * "Pedir por WhatsApp" con el mensaje ya escrito y el enlace al producto. null si no hay WhatsApp.
 * Con cantidad mayor a 1, el mensaje la incluye junto al total.
 */
export function orderUrl(business: Business, item: Item, quantity = 1): string | null {
  if (!business.whatsapp) return null;
  const detail =
    quantity > 1
      ? `${quantity} × *${item.name}* (${orderTotal(business, item, quantity)} en total)`
      : `*${item.name}* (${itemPrice(business, item)})`;
  const message = `¡Hola ${business.name}! Me interesa ${detail}.\n${productUrl(business, item)}`;
  return whatsappChatUrl(business.whatsapp, message);
}

/** Precio por la cantidad; "Precio a consultar" si el producto no tiene precio. */
export function orderTotal(business: Business, item: Item, quantity: number): string {
  return formatPrice(item.price === null ? null : item.price * quantity, business.currency);
}

/** Escribirle al negocio sin un producto concreto. null si no hay WhatsApp. */
export function contactUrl(business: Business, message?: string): string | null {
  if (!business.whatsapp) return null;
  return whatsappChatUrl(
    business.whatsapp,
    message ?? `¡Hola ${business.name}! Vi su catálogo y quiero hacer una consulta.`,
  );
}
