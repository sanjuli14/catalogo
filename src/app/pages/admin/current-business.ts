import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Auth } from '../../core/auth';
import { CatalogApi } from '../../core/catalog-api';
import { errorMessage } from '../../core/format';
import { Business } from '../../core/models';

/**
 * El negocio que se está administrando. Lo comparten todas las pantallas del panel.
 * En /admin es el del dueño; en /superadmin/negocios/:businessId, el que eligió el superadmin.
 */
@Injectable()
export class CurrentBusiness {
  private readonly api = inject(CatalogApi);
  private readonly auth = inject(Auth);

  /** Negocio elegido por el superadmin en la ruta, si lo hay. */
  private readonly routeBusinessId = inject(ActivatedRoute).snapshot.paramMap.get('businessId');

  /** true si es el superadmin administrando el negocio de otro. */
  readonly managedBySuperadmin = this.routeBusinessId !== null;
  /** null si al dueño todavía no le asignaron un negocio. */
  readonly id = computed(() => this.routeBusinessId ?? this.auth.profile()?.business_id ?? null);
  readonly business = signal<Business | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    const id = this.id();
    if (!id) return;
    try {
      this.business.set(await this.api.getBusiness(id));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
