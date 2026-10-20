import { Injectable, computed, inject, signal } from '@angular/core';

import { Auth } from '../../core/auth';
import { CatalogApi } from '../../core/catalog-api';
import { errorMessage } from '../../core/format';
import { Business } from '../../core/models';

/** El negocio del dueño que está en el panel. Lo comparten todas las pantallas de /admin. */
@Injectable()
export class CurrentBusiness {
  private readonly api = inject(CatalogApi);
  private readonly auth = inject(Auth);

  /** null si al dueño todavía no le asignaron un negocio. */
  readonly id = computed(() => this.auth.profile()?.business_id ?? null);
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
