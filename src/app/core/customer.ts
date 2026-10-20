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
  /** La hoja se abrió al tocar un botón de WhatsApp: después de guardar hay que tocarlo otra vez. */
  readonly forOrder = signal(false);
  /** Ya se le pidieron los datos al tocar un botón de WhatsApp en esta visita. */
  private askedForOrder = false;

  /** Al llegar al catálogo: pide los datos si faltan y no los omitió en esta visita. */
  askOnArrival(): void {
    if (this.data() || readSession(DISMISSED_KEY)) return;
    this.open(false);
  }

  edit(): void {
    this.open(false);
  }

  /**
   * Para los botones de WhatsApp (enlaces): si faltan los datos, la primera vez se piden en
   * lugar de abrir WhatsApp; luego el cliente vuelve a tocar el botón, que ya los incluye.
   * WhatsApp se abre siempre con el enlace, nunca con window.open: los navegadores de apps
   * como Instagram o Facebook a veces lo bloquean.
   */
  interceptOrder(event: Event): void {
    if (this.data() || this.askedForOrder) return;
    event.preventDefault();
    this.askedForOrder = true;
    this.open(true);
  }

  save(customer: Customer): void {
    this.data.set(customer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
    } catch {
      // Navegación privada o almacenamiento bloqueado: se usan solo en esta visita.
    }
    this.sheetOpen.set(false);
  }

  /** "Ahora no", ✕ o Esc: sigue sin datos y no se vuelve a preguntar al llegar en esta visita. */
  dismiss(): void {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Sin almacenamiento: se volverá a preguntar al recargar, nada grave.
    }
    this.sheetOpen.set(false);
  }

  /** El navegador cerró la hoja por su cuenta (por ejemplo, el botón atrás de Android). */
  closedByBrowser(): void {
    if (this.sheetOpen()) this.dismiss();
  }

  private open(forOrder: boolean): void {
    this.forOrder.set(forOrder);
    this.sheetOpen.set(true);
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
