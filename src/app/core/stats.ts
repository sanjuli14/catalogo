import { Injectable, inject } from '@angular/core';

import { Supabase } from './supabase';

export type EventKind = 'catalog_view' | 'item_view' | 'whatsapp_click';

export interface BusinessStats {
  catalog_views: number;
  item_views: number;
  whatsapp_clicks: number;
  /** Solo los días con actividad, en orden ("2026-10-20", hora local). */
  daily: { day: string; views: number; clicks: number }[];
  /** Los 20 productos más vistos. */
  items: { item_id: string; views: number; clicks: number }[];
}

const SEEN_KEY = 'catalogo.visto';

/** Visitas y clics del catálogo público (tabla events, ver la migración de estadísticas). */
@Injectable({ providedIn: 'root' })
export class Stats {
  private readonly supabase = inject(Supabase).client;
  /** Lo ya contado en esta visita: recargar o volver atrás no suma otra visita. */
  private readonly seen = new Set<string>(readSeen());

  /** Una visita al catálogo o a un producto: cuenta una vez por pestaña. */
  view(businessId: string, itemId?: string): void {
    const key = itemId ?? businessId;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...this.seen]));
    } catch {
      // Sin almacenamiento: al recargar se vuelve a contar, nada grave.
    }
    this.track(businessId, itemId ? 'item_view' : 'catalog_view', itemId);
  }

  /** Clic a un botón de WhatsApp (con el producto si se pidió uno solo). */
  whatsappClick(businessId: string, itemId?: string): void {
    this.track(businessId, 'whatsapp_click', itemId);
  }

  async get(businessId: string, since: Date): Promise<BusinessStats> {
    const { data, error } = await this.supabase.rpc('business_stats', {
      target_business: businessId,
      since: since.toISOString(),
      // Los días se agrupan en la hora local de quien mira, no en la del servidor.
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (error) throw error;
    return data as BusinessStats;
  }

  /** Sin esperar ni avisar errores: una estadística perdida no debe molestar al cliente. */
  private track(businessId: string, kind: EventKind, itemId?: string): void {
    void this.supabase
      .rpc('track_event', {
        target_business: businessId,
        event_kind: kind,
        target_item: itemId ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn('No se pudo registrar la estadística', error);
      });
  }
}

function readSeen(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
