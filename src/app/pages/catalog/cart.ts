import { Injectable, signal } from '@angular/core';

import { Item } from '../../core/models';
import { OrderLine } from './public-catalog';

const STORAGE_KEY = 'catalogo.carrito';
export const MAX_QUANTITY = 99;

/** Cantidades por negocio y producto: { [businessId]: { [itemId]: cantidad } }. */
type CartState = Record<string, Record<string, number>>;

/**
 * Pedido en armado: varios productos y servicios que se envían en un solo mensaje.
 * Cada negocio tiene el suyo y se guarda en el navegador, así no se pierde al recargar.
 */
@Injectable({ providedIn: 'root' })
export class Cart {
  private readonly state = signal<CartState>(readStored());
  /** La hoja del pedido está abierta. */
  readonly sheetOpen = signal(false);

  quantity(businessId: string, itemId: string): number {
    return this.state()[businessId]?.[itemId] ?? 0;
  }

  /**
   * Renglones del pedido en el orden en que se agregaron. Solo los que siguen en el catálogo
   * y disponibles: si el negocio quitó uno o lo marcó agotado, deja de contar.
   */
  lines(businessId: string, items: Item[]): OrderLine[] {
    const quantities = this.state()[businessId] ?? {};
    return Object.entries(quantities).flatMap(([id, quantity]) => {
      const item = items.find((i) => i.id === id);
      return item?.is_available ? [{ item, quantity }] : [];
    });
  }

  /** Un producto suma la cantidad; un servicio queda siempre en 1. */
  add(item: Item, quantity = 1): void {
    const current = this.quantity(item.business_id, item.id);
    const next = item.kind === 'service' ? 1 : Math.min(MAX_QUANTITY, current + quantity);
    this.set(item, next);
  }

  /** Cantidad exacta; 0 lo quita del pedido. */
  set(item: Item, quantity: number): void {
    this.update(item.business_id, (lines) => {
      const next = { ...lines };
      if (quantity > 0) next[item.id] = Math.min(MAX_QUANTITY, quantity);
      else delete next[item.id];
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      // Navegación privada o almacenamiento bloqueado: el pedido dura solo esta visita.
    }
  }
}

function readStored(): CartState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!value || typeof value !== 'object') return {};
    // Solo cantidades enteras válidas: un dato dañado no debe dar un total "NaN".
    const state: CartState = {};
    for (const [businessId, lines] of Object.entries(value)) {
      if (!lines || typeof lines !== 'object') continue;
      const valid = Object.entries(lines).filter((entry): entry is [string, number] =>
        isQuantity(entry[1]),
      );
      if (valid.length) state[businessId] = Object.fromEntries(valid);
    }
    return state;
  } catch {
    return {};
  }
}

function isQuantity(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_QUANTITY;
}
