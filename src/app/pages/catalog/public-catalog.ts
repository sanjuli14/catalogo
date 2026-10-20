import { Injectable, inject } from '@angular/core';
import { translate } from '@jsverse/transloco';

import { Auth } from '../../core/auth';
import { CatalogApi } from '../../core/catalog-api';
import { Customer } from '../../core/customer';
import { formatPrice } from '../../core/format';
import { Business, Category, Item, Variant } from '../../core/models';
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

/** Precio de una unidad: el de la variante si tiene uno propio, si no el del producto. */
export function unitPrice(item: Item, variant?: Variant | null): number | null {
  return variant?.price ?? item.price;
}

export function itemPrice(business: Business, item: Item, variant?: Variant | null): string {
  return formatPrice(unitPrice(item, variant), business.currency);
}

/** "Desde $5" si las variantes tienen precios distintos; si no, el precio de siempre. */
export function cardPrice(business: Business, item: Item): string {
  const prices = item.variants.map((v) => unitPrice(item, v)).filter((p) => p !== null);
  if (!prices.length) return itemPrice(business, item);
  const min = Math.min(...prices);
  const price = formatPrice(min, business.currency);
  return prices.every((p) => p === min) ? price : translate('price.from', { price });
}

/**
 * La oferta (precio anterior) es del producto: no aplica a una variante con precio propio.
 * Las variantes sin precio propio la comparten.
 */
function onSale(item: Item, variant?: Variant | null): boolean {
  return item.compare_at_price !== null && item.price !== null && variant?.price == null;
}

/** Precio anterior (tachado) si el producto está en oferta; null si no. */
export function itemCompareAtPrice(
  business: Business,
  item: Item,
  variant?: Variant | null,
): string | null {
  return onSale(item, variant) ? formatPrice(item.compare_at_price, business.currency) : null;
}

/** Descuento de la oferta en porcentaje entero (20 = "-20%"); null si no está en oferta. */
export function discountPercent(item: Item, variant?: Variant | null): number | null {
  if (!onSale(item, variant)) return null;
  return Math.round((1 - item.price! / item.compare_at_price!) * 100);
}

/** Se puede pedir: está disponible y, si tiene variantes, queda alguna disponible. */
export function isOrderable(item: Item): boolean {
  return item.is_available && (!item.variants.length || item.variants.some((v) => v.is_available));
}

/** Días que un producto recién agregado lleva la etiqueta "Nuevo". */
const NEW_DAYS = 14;

export function isNew(item: Item): boolean {
  return Date.now() - new Date(item.created_at).getTime() < NEW_DAYS * 24 * 60 * 60 * 1000;
}

/*
 * Mensajes de WhatsApp. Son la única forma en que el cliente le habla al negocio, así que
 * llevan todo lo necesario para atenderlo sin preguntar: qué quiere, cuánto, el precio,
 * el enlace para verlo y quién escribe y dónde está (sirve igual para una tienda, un
 * restaurante o un carpintero). *texto* sale en negrita en WhatsApp.
 * Van en el idioma del cliente (claves whatsapp.* de los archivos de traducción).
 */

/** Atajo para los textos de whatsapp.* */
function w(key: string, params?: Record<string, unknown>): string {
  return translate(`whatsapp.${key}`, params);
}

/** Un renglón del pedido: un producto con su cantidad, o un servicio (siempre 1). */
export interface OrderLine {
  item: Item;
  quantity: number;
  /** La talla, el sabor... elegido, si el producto tiene variantes. */
  variant?: Variant | null;
}

/** Pedir un solo producto o servicio por WhatsApp. null si no hay WhatsApp. */
export function orderUrl(
  business: Business,
  item: Item,
  customer: Customer | null,
  quantity = 1,
  variant: Variant | null = null,
): string | null {
  return cartOrderUrl(business, [{ item, quantity, variant }], customer);
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

  const intro = w(products.length ? 'introOrder' : single ? 'introService' : 'introServices');
  const message = [`${w('hello', { name: plain(business.name) })} ${intro}`];

  if (products.length) {
    message.push('', `*${w(services.length ? 'productsTitle' : 'orderTitle')}*`);
    for (const line of products) message.push(...productLines(business, line, withLinks));
  }
  if (services.length) {
    message.push('', `*${w(services.length === 1 ? 'serviceTitle' : 'servicesTitle')}*`);
    for (const line of services) message.push(...serviceLines(business, line, withLinks));
  }

  const total = linesTotal(lines);
  const unpriced = lines.some((l) => unitPrice(l.item, l.variant) === null);
  if (total !== null && (lines.length > 1 || lines[0].quantity > 1)) {
    const note = unpriced ? ` ${w('totalNote')}` : '';
    message.push('', `*${w('total', { total: formatPrice(total, business.currency) })}*${note}`);
  }
  if (!withLinks) message.push('', w('catalog', { url: catalogUrl(business) }));

  message.push(
    ...customerLines(customer),
    '',
    closingQuestion(products.length > 0, unpriced, single),
  );
  return message.join('\n');
}

function productLines(
  business: Business,
  { item, quantity, variant }: OrderLine,
  withLink: boolean,
): string[] {
  let price: string;
  if (unitPrice(item, variant) === null) price = w('priceOnRequest');
  else if (quantity > 1) {
    const each = w('each', { price: itemPrice(business, item, variant) });
    price = `${each} = *${orderTotal(business, item, quantity, variant)}*`;
  } else price = `*${itemPrice(business, item, variant)}*`;
  // El precio anterior: el negocio ve que se pidió en oferta.
  const before = itemCompareAtPrice(business, item, variant);
  if (before) price += ` ${w('before', { price: before })}`;
  const lines = [...nameLines(item, variant), `   ${w('quantity', { quantity })} · ${price}`];
  if (withLink) lines.push(`   ${w('view', { url: productUrl(business, item) })}`);
  return lines;
}

function serviceLines(
  business: Business,
  { item, variant }: OrderLine,
  withLink: boolean,
): string[] {
  const price =
    unitPrice(item, variant) === null ? w('onRequest') : `*${itemPrice(business, item, variant)}*`;
  const lines = [...nameLines(item, variant), `   ${w('price', { price })}`];
  if (withLink) lines.push(`   ${w('view', { url: productUrl(business, item) })}`);
  return lines;
}

/** "• *Camisa*" y, si eligió una variante, "Talla: M" debajo. */
function nameLines(item: Item, variant?: Variant | null): string[] {
  const lines = [`• *${plain(item.name)}*`];
  if (variant) lines.push(`   ${variantText(item, variant)}`);
  return lines;
}

/** "Talla: M" (o solo "M" si el dueño no le puso nombre al tipo de variante). */
export function variantText(item: Item, variant: Variant): string {
  const label = item.variant_label?.trim();
  return label ? `${plain(label)}: ${plain(variant.name)}` : plain(variant.name);
}

function closingQuestion(hasProducts: boolean, unpriced: boolean, single: boolean): string {
  if (!hasProducts) return w('closingServices');
  const available = w(single ? 'available' : 'allAvailable');
  return w(unpriced ? 'closingUnpriced' : 'closing', { available });
}

/** Suma de los renglones con precio; null si ninguno tiene precio. */
export function linesTotal(lines: OrderLine[]): number | null {
  const priced = lines.filter((l) => unitPrice(l.item, l.variant) !== null);
  if (!priced.length) return null;
  return priced.reduce((sum, l) => sum + unitPrice(l.item, l.variant)! * l.quantity, 0);
}

/** Para un producto agotado: preguntar cuándo vuelve y dejarlo apartado. */
export function askAvailabilityUrl(
  business: Business,
  item: Item,
  customer: Customer | null,
): string | null {
  if (!business.whatsapp) return null;
  const lines = [
    `${w('hello', { name: plain(business.name) })} ${w('soldOut', { item: plain(item.name) })}`,
    productUrl(business, item),
    '',
    w('soldOutQuestion'),
    ...customerLines(customer),
  ];
  return whatsappChatUrl(business.whatsapp, lines.join('\n'));
}

/** Precio por la cantidad; "Precio a consultar" si el producto no tiene precio. */
export function orderTotal(
  business: Business,
  item: Item,
  quantity: number,
  variant?: Variant | null,
): string {
  const price = unitPrice(item, variant);
  return formatPrice(price === null ? null : price * quantity, business.currency);
}

/** Escribirle al negocio sin un producto concreto: el cliente escribe su consulta al final. */
export function contactUrl(business: Business, customer: Customer | null): string | null {
  if (!business.whatsapp) return null;
  const lines = [
    `${w('hello', { name: plain(business.name) })} ${w('browsing', { url: catalogUrl(business) })}`,
    ...customerLines(customer),
    '',
    `${w('question')} `,
  ];
  return whatsappChatUrl(business.whatsapp, lines.join('\n'));
}

/** Recomendar el catálogo a un amigo. */
export function shareCatalogMessage(business: Business): string {
  const lines = [w('recommend', { name: plain(business.name) })];
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
    `*${w('myDetails')}*`,
    `• ${w('name', { name: plain(customer.name) })}`,
    `• ${w('address', { address: plain(customer.address) })}`,
  ];
  if (customer.reference) {
    lines.push(`• ${w('reference', { reference: plain(customer.reference) })}`);
  }
  return lines;
}

/**
 * WhatsApp no deja escapar * _ ~ `: en textos escritos por personas (nombres, direcciones)
 * se cambian por caracteres parecidos para que no abran negritas o cursivas sin querer.
 */
function plain(text: string): string {
  return text.replace(/[*_~`]/g, (c) => ({ '*': '∗', _: '‗', '~': '∼', '`': 'ˋ' })[c]!);
}
