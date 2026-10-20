import { Injectable, inject } from '@angular/core';

import { Auth } from '../../core/auth';
import { CatalogApi } from '../../core/catalog-api';
import { Customer } from '../../core/customer';
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

/*
 * Mensajes de WhatsApp. Son la única forma en que el cliente le habla al negocio, así que
 * llevan todo lo necesario para atenderlo sin preguntar: qué quiere, cuánto, el precio,
 * el enlace para verlo y quién escribe y dónde está (sirve igual para una tienda, un
 * restaurante o un carpintero). *texto* sale en negrita en WhatsApp.
 */

/** Un renglón del pedido: un producto con su cantidad, o un servicio (siempre 1). */
export interface OrderLine {
  item: Item;
  quantity: number;
}

/** Pedir un solo producto o servicio por WhatsApp. null si no hay WhatsApp. */
export function orderUrl(
  business: Business,
  item: Item,
  customer: Customer | null,
  quantity = 1,
): string | null {
  return cartOrderUrl(business, [{ item, quantity }], customer);
}

/** Enviar el pedido completo (uno o varios renglones) en un solo mensaje. */
export function cartOrderUrl(
  business: Business,
  lines: OrderLine[],
  customer: Customer | null,
): string | null {
  if (!business.whatsapp || !lines.length) return null;
  return whatsappChatUrl(business.whatsapp, orderMessage(business, lines, customer));
}

/**
 * Con muchos renglones, el enlace "Ver" de cada uno haría la URL de WhatsApp tan larga que
 * algunos navegadores o teléfonos no la abren; entonces va solo el enlace al catálogo.
 */
const MAX_LINES_WITH_LINKS = 8;

function orderMessage(business: Business, lines: OrderLine[], customer: Customer | null): string {
  const withLinks = lines.length <= MAX_LINES_WITH_LINKS;
  const products = lines.filter((l) => l.item.kind === 'product');
  const services = lines.filter((l) => l.item.kind === 'service');
  const single = lines.length === 1;

  const intro = products.length
    ? 'Quiero hacer este pedido desde su catálogo:'
    : single
      ? 'Me interesa este servicio de su catálogo:'
      : 'Me interesan estos servicios de su catálogo:';
  const message = [`¡Hola, ${plain(business.name)}! ${intro}`];

  if (products.length) {
    message.push('', services.length ? '*PRODUCTOS*' : '*PEDIDO*');
    for (const line of products) message.push(...productLines(business, line, withLinks));
  }
  if (services.length) {
    message.push('', services.length === 1 ? '*SERVICIO*' : '*SERVICIOS*');
    for (const line of services) message.push(...serviceLines(business, line, withLinks));
  }

  const total = linesTotal(lines);
  const unpriced = lines.some((l) => l.item.price === null);
  if (total !== null && (lines.length > 1 || lines[0].quantity > 1)) {
    const note = unpriced ? ' (más lo que tiene precio a consultar)' : '';
    message.push('', `*TOTAL: ${formatPrice(total, business.currency)}*${note}`);
  }
  if (!withLinks) message.push('', `Catálogo: ${catalogUrl(business)}`);

  message.push(
    ...customerLines(customer),
    '',
    closingQuestion(products.length > 0, unpriced, single),
  );
  return message.join('\n');
}

function productLines(
  business: Business,
  { item, quantity }: OrderLine,
  withLink: boolean,
): string[] {
  let price: string;
  if (item.price === null) price = 'precio a consultar';
  else if (quantity > 1)
    price = `${itemPrice(business, item)} c/u = *${orderTotal(business, item, quantity)}*`;
  else price = `*${itemPrice(business, item)}*`;
  const lines = [`• *${plain(item.name)}*`, `   Cantidad: ${quantity} · ${price}`];
  if (withLink) lines.push(`   Ver: ${productUrl(business, item)}`);
  return lines;
}

function serviceLines(business: Business, { item }: OrderLine, withLink: boolean): string[] {
  const price = item.price === null ? 'a consultar' : `*${itemPrice(business, item)}*`;
  const lines = [`• *${plain(item.name)}*`, `   Precio: ${price}`];
  if (withLink) lines.push(`   Ver: ${productUrl(business, item)}`);
  return lines;
}

function closingQuestion(hasProducts: boolean, unpriced: boolean, single: boolean): string {
  if (!hasProducts) {
    return '¿Qué disponibilidad tienen y qué necesitan saber para coordinarlo? ¡Gracias!';
  }
  const available = single ? 'si está disponible' : 'si está todo disponible';
  return unpriced
    ? `¿Me dicen los precios que faltan, ${available} y cómo lo coordinamos? ¡Gracias!`
    : `¿Me confirman ${available} y cómo lo coordinamos? ¡Gracias!`;
}

/** Suma de los renglones con precio; null si ninguno tiene precio. */
export function linesTotal(lines: OrderLine[]): number | null {
  const priced = lines.filter((l) => l.item.price !== null);
  if (!priced.length) return null;
  return priced.reduce((sum, l) => sum + l.item.price! * l.quantity, 0);
}

/** Para un producto agotado: preguntar cuándo vuelve y dejarlo apartado. */
export function askAvailabilityUrl(
  business: Business,
  item: Item,
  customer: Customer | null,
): string | null {
  if (!business.whatsapp) return null;
  const lines = [
    `¡Hola, ${plain(business.name)}! Vi *${plain(item.name)}* en su catálogo, pero aparece agotado.`,
    productUrl(business, item),
    '',
    '¿Saben cuándo vuelve a estar disponible? Si se puede, me gustaría apartarlo.',
    ...customerLines(customer),
  ];
  return whatsappChatUrl(business.whatsapp, lines.join('\n'));
}

/** Precio por la cantidad; "Precio a consultar" si el producto no tiene precio. */
export function orderTotal(business: Business, item: Item, quantity: number): string {
  return formatPrice(item.price === null ? null : item.price * quantity, business.currency);
}

/** Escribirle al negocio sin un producto concreto: el cliente escribe su consulta al final. */
export function contactUrl(business: Business, customer: Customer | null): string | null {
  if (!business.whatsapp) return null;
  const lines = [
    `¡Hola, ${plain(business.name)}! Estoy viendo su catálogo (${catalogUrl(business)}).`,
    ...customerLines(customer),
    '',
    'Mi consulta: ',
  ];
  return whatsappChatUrl(business.whatsapp, lines.join('\n'));
}

/** Recomendar el catálogo a un amigo. */
export function shareCatalogMessage(business: Business): string {
  const lines = [`Te recomiendo *${plain(business.name)}*. Mira su catálogo y pide por WhatsApp:`];
  // En un solo renglón: con saltos de línea, la cursiva de WhatsApp no funciona.
  const description = business.description?.replace(/\s+/g, ' ').trim();
  if (description) lines.push(`_${plain(description)}_`);
  lines.push(catalogUrl(business));
  return lines.join('\n');
}

/** Bloque con los datos del cliente; vacío si no los dio. */
function customerLines(customer: Customer | null): string[] {
  if (!customer) return [];
  const lines = [
    '',
    '*MIS DATOS*',
    `• Nombre: ${plain(customer.name)}`,
    `• Dirección: ${plain(customer.address)}`,
  ];
  if (customer.reference) lines.push(`• Referencia: ${plain(customer.reference)}`);
  return lines;
}

/**
 * WhatsApp no deja escapar * _ ~ `: en textos escritos por personas (nombres, direcciones)
 * se cambian por caracteres parecidos para que no abran negritas o cursivas sin querer.
 */
function plain(text: string): string {
  return text.replace(/[*_~`]/g, (c) => ({ '*': '∗', _: '‗', '~': '∼', '`': 'ˋ' })[c]!);
}
