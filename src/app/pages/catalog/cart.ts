import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { Item, Variant } from '../../core/models';
import { OrderLine } from './public-catalog';

const STORAGE_KEY = 'catalogo.carrito';
/** Último pedido enviado de cada negocio, para recuperarlo si WhatsApp no llegó a abrirse. */
const SENT_KEY = 'catalogo.carrito.enviado';
/** Pasado este tiempo ya no se ofrece recuperar el pedido enviado. */
const SENT_TTL_MS = 12 * 60 * 60 * 1000;

interface SentOrder {
  lines: Record<string, number>;
  /** Cuándo se envió (ms), para que el aviso caduque. */
  at: number;
}
export const MAX_QUANTITY = 99;

/**
 * Cantidades por negocio y renglón: { [businessId]: { [clave]: cantidad } }.
 * La clave es el id del producto, o "producto:variante" si se eligió una talla, sabor...
 */
type CartState = Record<string, Record<string, number>>;

/**
 * Pedido en armado: varios productos y servicios que se envían en un solo mensaje.
 * Cada negocio tiene el suyo y se guarda en el navegador, así no se pierde al recargar.
 */
@Injectable({ providedIn: 'root' })
export class Cart {
  private readonly state = signal<CartState>(readStored(STORAGE_KEY));
  private readonly sent = signal<Record<string, SentOrder>>(readSent());
  /** Hora actual, refrescada cada minuto: así el aviso del pedido enviado caduca solo. */
  private readonly now = signal(Date.now());

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  /** La hoja del pedido está abierta. */
  readonly sheetOpen = signal(false);

  quantity(businessId: string, itemId: string, variant?: Variant | null): number {
    return this.state()[businessId]?.[lineKey(itemId, variant)] ?? 0;
  }

  /** Total de un producto en el pedido, sumando todas sus variantes. */
  itemQuantity(businessId: string, itemId: string): number {
    return Object.entries(this.state()[businessId] ?? {})
      .filter(([key]) => key.split(':')[0] === itemId)
      .reduce((total, [, quantity]) => total + quantity, 0);
  }

  /**
   * Renglones del pedido en el orden en que se agregaron. Solo los que siguen en el catálogo
   * y disponibles: si el negocio quitó uno (o su variante) o lo marcó agotado, deja de contar.
   */
  lines(businessId: string, items: Item[]): OrderLine[] {
    const quantities = this.state()[businessId] ?? {};
    return Object.entries(quantities).flatMap(([key, quantity]) => {
      const [id, variantId] = key.split(':');
      const item = items.find((i) => i.id === id);
      if (!item?.is_available) return [];
      // Un producto con variantes solo se pide con una elegida (y que siga disponible).
      if (!item.variants.length) return variantId ? [] : [{ item, quantity }];
      const variant = item.variants.find((v) => v.id === variantId);
      return variant?.is_available ? [{ item, quantity, variant }] : [];
    });
  }

  /** Hay un pedido enviado que todavía se puede recuperar. */
  hasSent(businessId: string): boolean {
    const order = this.sent()[businessId];
    return !!order && this.now() - order.at < SENT_TTL_MS;
  }

  /**
   * Al enviar por WhatsApp el pedido se vacía (si no, al volver a la app seguiría lleno),
   * pero se guarda una copia por si WhatsApp no se abrió y hay que recuperarlo.
   */
  markSent(businessId: string): void {
    const lines = this.state()[businessId];
    if (!lines) return;
    this.sent.update((sent) => ({ ...sent, [businessId]: { lines, at: Date.now() } }));
    save(SENT_KEY, this.sent());
    this.clear(businessId);
  }

  /** Vuelve a poner en el pedido lo último que se envió, sumándolo a lo que ya haya. */
  restoreSent(businessId: string): void {
    if (!this.hasSent(businessId)) return;
    const sent = this.sent()[businessId].lines;
    this.update(businessId, (lines) => {
      const next = { ...lines };
      for (const [id, quantity] of Object.entries(sent)) {
        next[id] = Math.min(MAX_QUANTITY, (next[id] ?? 0) + quantity);
      }
      return next;
    });
    this.forgetSent(businessId);
  }

  forgetSent(businessId: string): void {
    if (!this.sent()[businessId]) return;
    this.sent.update((sent) => {
      const next = { ...sent };
      delete next[businessId];
      return next;
    });
    save(SENT_KEY, this.sent());
  }

  /** Un producto suma la cantidad; un servicio queda siempre en 1. */
  add(item: Item, quantity = 1, variant: Variant | null = null): void {
    // Se empezó un pedido nuevo: el anterior ya no se ofrece para recuperar.
    this.forgetSent(item.business_id);
    const current = this.quantity(item.business_id, item.id, variant);
    const next = item.kind === 'service' ? 1 : Math.min(MAX_QUANTITY, current + quantity);
    this.set(item, next, variant);
  }

  /** Cantidad exacta; 0 lo quita del pedido. */
  set(item: Item, quantity: number, variant: Variant | null = null): void {
    const key = lineKey(item.id, variant);
    this.update(item.business_id, (lines) => {
      const next = { ...lines };
      if (quantity > 0) next[key] = Math.min(MAX_QUANTITY, quantity);
      else delete next[key];
      return next;
    });
  }

  clear(businessId: string): void {
    this.update(businessId, () => ({}));
  }

  private update(
    businessId: string,
    change: (lines: Record<string, number>) => Record<string, number>,
  ): void {
    this.state.update((state) => {
      const next = { ...state, [businessId]: change(state[businessId] ?? {}) };
      if (!Object.keys(next[businessId]).length) delete next[businessId];
      return next;
    });
    save(STORAGE_KEY, this.state());
  }
}

function lineKey(itemId: string, variant?: Variant | null): string {
  return variant ? `${itemId}:${variant.id}` : itemId;
}

function save(key: string, state: CartState | Record<string, SentOrder>): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Navegación privada o almacenamiento bloqueado: el pedido dura solo esta visita.
  }
}

function readStored(key: string): CartState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (!value || typeof value !== 'object') return {};
    const state: CartState = {};
    for (const [businessId, lines] of Object.entries(value)) {
      if (!lines || typeof lines !== 'object') continue;
      const valid = validLines(lines);
      if (valid) state[businessId] = valid;
    }
    return state;
  } catch {
    return {};
  }
}

/** Solo cantidades enteras válidas (un dato dañado no debe dar un total "NaN"); null si no queda ninguna. */
function validLines(value: object): Record<string, number> | null {
  const lines = Object.entries(value).filter((entry): entry is [string, number] =>
    isQuantity(entry[1]),
  );
  return lines.length ? Object.fromEntries(lines) : null;
}

function isQuantity(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_QUANTITY;
}

/** Pedidos enviados que todavía no caducaron. */
function readSent(): Record<string, SentOrder> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}');
    if (!value || typeof value !== 'object') return {};
    const sent: Record<string, SentOrder> = {};
    for (const [businessId, order] of Object.entries(value as Record<string, Partial<SentOrder>>)) {
      if (!order?.lines || typeof order.at !== 'number' || Date.now() - order.at >= SENT_TTL_MS)
        continue;
      const lines = validLines(order.lines);
      if (lines) sent[businessId] = { lines, at: order.at };
    }
    return sent;
  } catch {
    return {};
  }
}
