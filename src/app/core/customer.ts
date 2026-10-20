import { Injectable, signal } from '@angular/core';

/** Quién escribe y dónde está: van al final de cada mensaje de WhatsApp. */
export interface Customer {
  name: string;
  address: string;
  /** Opcional: un punto de referencia para ubicar la dirección. */
  reference: string;
}

const STORAGE_KEY = 'catalogo.cliente';
/** Si el cliente dijo "Ahora no", no se le vuelve a preguntar al llegar hasta otra visita. */
const DISMISSED_KEY = 'catalogo.cliente.omitido';

/**
 * Datos del cliente que visita los catálogos. No tiene cuenta: se guardan en su navegador
 * (localStorage), así no los vuelve a escribir en cada pedido ni en otros catálogos.
 */
@Injectable({ providedIn: 'root' })
export class CustomerProfile {
  readonly data = signal<Customer | null>(readStored());
  /** La hoja para escribir los datos está abierta. */
  readonly sheetOpen = signal(false);
  /** Pedido que espera los datos: al guardarlos se abre WhatsApp con el mensaje completo. */
  private pendingOrder: (() => string | null) | null = null;

  /** Al llegar al catálogo: pide los datos si faltan y no los omitió en esta visita. */
  askOnArrival(): void {
    if (this.data() || readSession(DISMISSED_KEY)) return;
    this.pendingOrder = null;
    this.sheetOpen.set(true);
  }

  edit(): void {
    this.pendingOrder = null;
    this.sheetOpen.set(true);
  }

  /**
   * Para los botones de pedir (enlaces a WhatsApp): si ya hay datos, el enlace sigue su curso;
   * si no, se piden primero y luego se abre WhatsApp con `buildUrl`, que ya los incluye.
   */
  interceptOrder(event: Event, buildUrl: () => string | null): void {
    if (this.data()) return;
    event.preventDefault();
    this.pendingOrder = buildUrl;
    this.sheetOpen.set(true);
  }

  save(customer: Customer): void {
    this.data.set(customer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
    } catch {
      // Navegación privada o almacenamiento bloqueado: se usan solo en esta visita.
    }
    this.close();
  }

  /** ✕ o Esc: cierra sin abrir WhatsApp, aunque hubiera un pedido esperando. */
  cancel(): void {
    this.pendingOrder = null;
    this.dismiss();
  }

  /** "Ahora no": sigue sin datos (si había un pedido esperando, se abre igual). */
  dismiss(): void {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Sin almacenamiento: se volverá a preguntar al recargar, nada grave.
    }
    this.close();
  }

  /** El navegador cerró la hoja por su cuenta (por ejemplo, el botón atrás de Android). */
  closedByBrowser(): void {
    if (this.sheetOpen()) this.cancel();
  }

  private close(): void {
    this.sheetOpen.set(false);
    const url = this.pendingOrder?.();
    this.pendingOrder = null;
    if (url) window.open(url, '_blank', 'noopener');
  }
}

function readStored(): Customer | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Customer>;
    if (!value?.name || !value.address) return null;
    return { name: value.name, address: value.address, reference: value.reference ?? '' };
  } catch {
    return null;
  }
}

function readSession(key: string): boolean {
  try {
    return sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
