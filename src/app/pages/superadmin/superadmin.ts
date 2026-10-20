import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AdminApi, AdminBusiness } from '../../core/admin-api';
import { CatalogApi } from '../../core/catalog-api';
import { errorMessage } from '../../core/format';
import { BusinessStatus } from '../../core/models';
import { SLUG_PATTERN, toSlug } from '../../core/slug';
import { PanelHeader } from '../../shared/panel-header';

type Filter = BusinessStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'active', label: 'Activos' },
  { value: 'suspended', label: 'Suspendidos' },
  { value: 'all', label: 'Todos' },
];

const STATUS_LABELS: Record<BusinessStatus, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
};

@Component({
  selector: 'app-superadmin',
  imports: [PanelHeader, RouterLink, ReactiveFormsModule, FormsModule],
  template: `
    <app-panel-header title="Panel del superadmin" />
    <main class="panel">
      <section class="section-header">
        <div>
          <h2>Negocios</h2>
          <p class="muted">Aprueba los nuevos registros y gestiona todos los catálogos.</p>
        </div>
        <button type="button" class="button" (click)="toggleCreate()">
          {{ creating() ? 'Cancelar' : 'Nuevo negocio' }}
        </button>
      </section>

      @if (creating()) {
        <form class="card form-grid" [formGroup]="createForm" (ngSubmit)="create()">
          <label class="field">
            <span>Nombre del negocio</span>
            <input formControlName="name" maxlength="80" />
          </label>
          <label class="field">
            <span>Dirección web</span>
            <div class="input-prefix">
              <span>{{ origin }}/</span>
              <input formControlName="slug" maxlength="50" (input)="slugEdited = true" />
            </div>
          </label>
          <label class="field form-grid__full">
            <span>Correo del dueño (opcional)</span>
            <input type="email" formControlName="email" placeholder="dueno@correo.com" />
            <small>
              Si no tiene cuenta, le llega una invitación para definir su contraseña. Si ya tiene
              cuenta, solo se le asigna el negocio.
            </small>
          </label>
          <div class="form-actions form-grid__full">
            <button type="submit" class="button" [disabled]="createForm.invalid || busy()">
              {{ busy() ? 'Creando…' : 'Crear negocio' }}
            </button>
          </div>
        </form>
      }

      @if (notice(); as notice) {
        <p class="success">{{ notice }}</p>
      }
      @if (error(); as error) {
        <p class="alert">{{ error }}</p>
      }

      <div class="toolbar">
        <div class="filters-row" role="group" aria-label="Filtrar por estado">
          @for (option of filters; track option.value) {
            <button
              type="button"
              class="filter"
              [class.is-active]="filter() === option.value"
              (click)="filter.set(option.value)"
            >
              {{ option.label }} <span class="filter__count">{{ counts()[option.value] }}</span>
            </button>
          }
        </div>
        <input
          class="input toolbar__search"
          type="search"
          placeholder="Buscar por nombre o dirección"
          aria-label="Buscar negocio"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
        />
      </div>

      @if (loading()) {
        <p class="muted">Cargando…</p>
      } @else if (!visible().length) {
        <p class="empty">No hay negocios en esta lista.</p>
      } @else {
        <ul class="list">
          @for (business of visible(); track business.id) {
            <li class="list__row business-row">
              @if (business.logo_path) {
                <img class="thumb" [src]="catalog.imageUrl(business.logo_path)" alt="" />
              } @else {
                <span class="thumb thumb--empty" aria-hidden="true">{{
                  business.name.charAt(0)
                }}</span>
              }

              <div class="list__grow">
                <span class="list__title">{{ business.name }}</span>
                <div class="list__meta">
                  <span class="badge" [class]="'badge status--' + business.status">
                    {{ statusLabels[business.status] }}
                  </span>
                  <a [href]="'/' + business.slug" target="_blank" rel="noopener"
                    >/{{ business.slug }} ↗</a
                  >
                  <span>Creado el {{ formatDate(business.created_at) }}</span>
                </div>
                <div class="owners">
                  @for (owner of business.owners; track owner.user_id) {
                    <span class="owner">
                      {{ owner.email }}
                      <button
                        type="button"
                        class="owner__remove"
                        [disabled]="busy()"
                        (click)="removeOwner(business, owner)"
                        [attr.aria-label]="'Quitar a ' + owner.email"
                      >
                        ×
                      </button>
                    </span>
                  } @empty {
                    <span class="muted">Sin dueño</span>
                  }
                </div>

                @if (addingOwnerTo() === business.id) {
                  <form class="inline-form owner-form" (ngSubmit)="addOwner(business)">
                    <input
                      class="input"
                      type="email"
                      name="ownerEmail"
                      placeholder="Correo del dueño"
                      [(ngModel)]="ownerEmail"
                      required
                    />
                    <button type="submit" class="button" [disabled]="!ownerEmail.trim() || busy()">
                      Agregar
                    </button>
                    <button
                      type="button"
                      class="button button--ghost"
                      (click)="addingOwnerTo.set(null)"
                    >
                      Cancelar
                    </button>
                  </form>
                }
              </div>

              <div class="list__actions">
                @switch (business.status) {
                  @case ('pending') {
                    <button
                      type="button"
                      class="button button--sm"
                      [disabled]="busy()"
                      (click)="setStatus(business, 'active')"
                    >
                      Aprobar
                    </button>
                  }
                  @case ('active') {
                    <button
                      type="button"
                      class="button button--ghost button--sm"
                      [disabled]="busy()"
                      (click)="setStatus(business, 'suspended')"
                    >
                      Suspender
                    </button>
                  }
                  @case ('suspended') {
                    <button
                      type="button"
                      class="button button--sm"
                      [disabled]="busy()"
                      (click)="setStatus(business, 'active')"
                    >
                      Reactivar
                    </button>
                  }
                }
                <a class="button button--ghost button--sm" [routerLink]="['negocios', business.id]"
                  >Administrar</a
                >
                <button
                  type="button"
                  class="button button--ghost button--sm"
                  (click)="startAddOwner(business)"
                >
                  Agregar dueño
                </button>
                <button
                  type="button"
                  class="button button--danger button--sm"
                  [disabled]="busy()"
                  (click)="remove(business)"
                >
                  Eliminar
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </main>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    .toolbar__search {
      flex: 1 1 240px;
      max-width: 360px;
    }

    .filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .filter {
      font: inherit;
      font-size: 14px;
      padding: 8px 12px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
    }

    .filter.is-active {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-text);
      font-weight: 700;
    }

    .filter__count {
      opacity: 0.75;
    }

    .business-row {
      align-items: flex-start;
    }

    .owners {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
      font-size: 13px;
    }

    .owner {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 2px 4px 2px 10px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
    }

    .owner__remove {
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--color-muted);
      cursor: pointer;
    }

    .owner__remove:hover:not(:disabled) {
      background: var(--color-danger-bg);
      color: var(--color-danger-text);
    }

    .owner-form {
      margin-top: 10px;
    }

    .status--pending {
      background: var(--color-warn-bg);
      color: var(--color-warn-text);
    }

    .status--suspended {
      background: var(--color-danger-bg);
      color: var(--color-danger-text);
    }
  `,
})
export class Superadmin {
  private readonly api = inject(AdminApi);
  protected readonly catalog = inject(CatalogApi);

  protected readonly origin = location.origin;
  protected readonly filters = FILTERS;
  protected readonly statusLabels = STATUS_LABELS;

  private readonly businesses = signal<AdminBusiness[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly filter = signal<Filter>('all');
  protected readonly search = signal('');
  protected readonly creating = signal(false);
  protected readonly addingOwnerTo = signal<string | null>(null);
  protected ownerEmail = '';
  protected slugEdited = false;

  protected readonly counts = computed(() => {
    const counts: Record<Filter, number> = { pending: 0, active: 0, suspended: 0, all: 0 };
    for (const business of this.businesses()) {
      counts[business.status]++;
      counts.all++;
    }
    return counts;
  });

  protected readonly visible = computed(() => {
    const filter = this.filter();
    const query = this.search().trim().toLowerCase();
    return this.businesses().filter(
      (b) =>
        (filter === 'all' || b.status === filter) &&
        (!query || b.name.toLowerCase().includes(query) || b.slug.includes(query)),
    );
  });

  protected readonly createForm = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    slug: ['', [Validators.required, Validators.minLength(3), Validators.pattern(SLUG_PATTERN)]],
    email: ['', Validators.email],
  });

  constructor() {
    this.createForm.controls.name.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      if (!this.slugEdited) this.createForm.controls.slug.setValue(toSlug(name));
    });
    void this.run(async () => {
      await this.reload();
      // Al entrar, lo primero son los pendientes de aprobar (si hay).
      if (this.counts().pending) this.filter.set('pending');
    });
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  protected toggleCreate(): void {
    this.creating.update((open) => !open);
    this.createForm.reset();
    this.slugEdited = false;
  }

  protected create(): Promise<void> {
    return this.run(async () => {
      const { name, slug, email } = this.createForm.getRawValue();
      const business = { name: name.trim(), slug: toSlug(slug) };
      if (email.trim()) {
        const invited = await this.api.inviteOwner({ ...business, email: email.trim() });
        this.notice.set(
          invited
            ? `Negocio creado. Enviamos una invitación a ${email.trim()}.`
            : `Negocio creado y asignado a ${email.trim()}, que ya tenía cuenta.`,
        );
      } else {
        await this.api.createBusiness(business.name, business.slug);
        this.notice.set('Negocio creado. Puedes agregarle un dueño cuando quieras.');
      }
      this.creating.set(false);
      this.filter.set('all');
      await this.reload();
    });
  }

  protected setStatus(business: AdminBusiness, status: BusinessStatus): Promise<void> {
    if (
      status === 'suspended' &&
      !confirm(`¿Suspender "${business.name}"? El público dejará de verlo.`)
    ) {
      return Promise.resolve();
    }
    return this.run(async () => {
      await this.api.setStatus(business.id, status);
      this.businesses.update((list) =>
        list.map((b) => (b.id === business.id ? { ...b, status } : b)),
      );
      this.notice.set(`"${business.name}" ahora está ${STATUS_LABELS[status].toLowerCase()}.`);
    });
  }

  protected startAddOwner(business: AdminBusiness): void {
    this.ownerEmail = '';
    this.addingOwnerTo.set(business.id);
  }

  protected addOwner(business: AdminBusiness): Promise<void> {
    return this.run(async () => {
      const email = this.ownerEmail.trim();
      const invited = await this.api.inviteOwner({ businessId: business.id, email });
      this.notice.set(
        invited
          ? `Enviamos una invitación a ${email} para administrar "${business.name}".`
          : `${email} ya tenía cuenta: ahora administra "${business.name}".`,
      );
      this.addingOwnerTo.set(null);
      await this.reload();
    });
  }

  protected removeOwner(
    business: AdminBusiness,
    owner: { user_id: string; email: string },
  ): Promise<void> {
    if (!confirm(`¿Quitar a ${owner.email} de "${business.name}"? Su cuenta no se borra.`)) {
      return Promise.resolve();
    }
    return this.run(async () => {
      await this.api.removeOwner(owner.user_id);
      await this.reload();
    });
  }

  protected remove(business: AdminBusiness): Promise<void> {
    const typed = prompt(
      `Esto borra "${business.name}" con todos sus productos y fotos, y no se puede deshacer.\n` +
        `Escribe ${business.slug} para confirmar:`,
    );
    if (typed?.trim() !== business.slug) return Promise.resolve();
    return this.run(async () => {
      await this.api.deleteBusiness(business.id);
      this.businesses.update((list) => list.filter((b) => b.id !== business.id));
      this.notice.set(`"${business.name}" fue eliminado.`);
    });
  }

  private async reload(): Promise<void> {
    this.businesses.set(await this.api.listBusinesses());
    this.loading.set(false);
  }

  /** Ejecuta una acción mostrando el estado "ocupado" y el error si falla. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.loading.set(false);
    } finally {
      this.busy.set(false);
    }
  }
}
