import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, translate } from '@jsverse/transloco';

import { AdminApi, AdminBusiness } from '../../core/admin-api';
import { CatalogApi } from '../../core/catalog-api';
import { errorMessage, intlLocale } from '../../core/format';
import { BusinessStatus } from '../../core/models';
import { SLUG_PATTERN, toSlug } from '../../core/slug';
import { PanelHeader } from '../../shared/panel-header';

type Filter = BusinessStatus | 'all';

/** Cada filtro lleva su título en superadmin.filters.{filtro}. */
const FILTERS: Filter[] = ['pending', 'active', 'suspended', 'all'];

@Component({
  selector: 'app-superadmin',
  imports: [PanelHeader, RouterLink, ReactiveFormsModule, FormsModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <app-panel-header [title]="t('superadmin.title')" />
      <main class="panel">
        <section class="section-header">
          <div>
            <h2>{{ t('superadmin.businesses') }}</h2>
            <p class="muted">{{ t('superadmin.lead') }}</p>
          </div>
          <button type="button" class="button" (click)="toggleCreate()">
            {{ creating() ? t('common.cancel') : t('superadmin.new') }}
          </button>
        </section>

        @if (creating()) {
          <form class="card form-grid" [formGroup]="createForm" (ngSubmit)="create()">
            <label class="field">
              <span>{{ t('register.businessName') }}</span>
              <input formControlName="name" maxlength="80" />
            </label>
            <label class="field">
              <span>{{ t('register.slug') }}</span>
              <div class="input-prefix">
                <span>{{ origin }}/</span>
                <input formControlName="slug" maxlength="50" (input)="slugEdited = true" />
              </div>
            </label>
            <label class="field form-grid__full">
              <span>{{ t('superadmin.ownerEmailOptional') }}</span>
              <input
                type="email"
                formControlName="email"
                [placeholder]="t('superadmin.ownerEmailPlaceholder')"
              />
              <small>{{ t('superadmin.ownerHint') }}</small>
            </label>
            <div class="form-actions form-grid__full">
              <button type="submit" class="button" [disabled]="createForm.invalid || busy()">
                {{ busy() ? t('register.creating') : t('superadmin.create') }}
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

        <!-- Tablero de cifras: cada tile también filtra la lista por ese estado. -->
        <div class="stats" role="group" [attr.aria-label]="t('superadmin.filterLabel')">
          @for (option of filters; track option) {
            <button
              type="button"
              class="stat filter"
              [class.stat--accent]="option === 'pending'"
              [class.stat--wide]="option === 'pending'"
              [class.is-active]="filter() === option"
              [attr.aria-pressed]="filter() === option"
              (click)="filter.set(option)"
            >
              <span class="kicker">{{ t('superadmin.filters.' + option) }}</span>
              <span class="stat__value">{{ counts()[option] }}</span>
            </button>
          }
        </div>

        <div class="toolbar">
          <input
            class="input toolbar__search"
            type="search"
            [placeholder]="t('superadmin.searchPlaceholder')"
            [attr.aria-label]="t('superadmin.searchLabel')"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
          />
          <span class="kicker">{{ t('superadmin.inList', { count: visible().length }) }}</span>
        </div>

        @if (loading()) {
          <p class="muted">{{ t('common.loading') }}</p>
        } @else if (!visible().length) {
          <p class="empty">{{ t('superadmin.empty') }}</p>
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
                      {{ t('superadmin.status.' + business.status) }}
                    </span>
                    <a [href]="'/' + business.slug" target="_blank" rel="noopener"
                      >/{{ business.slug }} ↗</a
                    >
                    <span>{{
                      t('superadmin.createdOn', { date: formatDate(business.created_at) })
                    }}</span>
                  </div>
                  <div class="owners">
                    @for (owner of business.owners; track owner.user_id) {
                      <span class="owner">
                        <span class="owner__email">{{ owner.email }}</span>
                        <button
                          type="button"
                          class="owner__remove"
                          [disabled]="busy()"
                          (click)="removeOwner(business, owner)"
                          [attr.aria-label]="
                            t('superadmin.removeOwnerLabel', { email: owner.email })
                          "
                        >
                          ×
                        </button>
                      </span>
                    } @empty {
                      <span class="muted">{{ t('superadmin.noOwner') }}</span>
                    }
                  </div>

                  @if (addingOwnerTo() === business.id) {
                    <form class="inline-form owner-form" (ngSubmit)="addOwner(business)">
                      <input
                        class="input"
                        type="email"
                        name="ownerEmail"
                        [placeholder]="t('superadmin.ownerEmail')"
                        [(ngModel)]="ownerEmail"
                        required
                      />
                      <button
                        type="submit"
                        class="button"
                        [disabled]="!ownerEmail.trim() || busy()"
                      >
                        {{ t('categories.add') }}
                      </button>
                      <button
                        type="button"
                        class="button button--ghost"
                        (click)="addingOwnerTo.set(null)"
                      >
                        {{ t('common.cancel') }}
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
                        {{ t('superadmin.approve') }}
                      </button>
                    }
                    @case ('active') {
                      <button
                        type="button"
                        class="button button--ghost button--sm"
                        [disabled]="busy()"
                        (click)="setStatus(business, 'suspended')"
                      >
                        {{ t('superadmin.suspend') }}
                      </button>
                    }
                    @case ('suspended') {
                      <button
                        type="button"
                        class="button button--sm"
                        [disabled]="busy()"
                        (click)="setStatus(business, 'active')"
                      >
                        {{ t('superadmin.reactivate') }}
                      </button>
                    }
                  }
                  <a
                    class="button button--ghost button--sm"
                    [routerLink]="['negocios', business.id]"
                    >{{ t('superadmin.manage') }}</a
                  >
                  <button
                    type="button"
                    class="button button--ghost button--sm"
                    (click)="startAddOwner(business)"
                  >
                    {{ t('superadmin.addOwner') }}
                  </button>
                  <button
                    type="button"
                    class="button button--danger button--sm"
                    [disabled]="busy()"
                    (click)="remove(business)"
                  >
                    {{ t('common.delete') }}
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      </main>
    </ng-container>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
      align-items: center;
      justify-content: space-between;
      margin: 12px 0 4px;
    }

    .toolbar__search {
      flex: 1 1 240px;
      max-width: 420px;
    }

    /* Los tiles de cifras son los filtros: el activo lleva un anillo de tinta.
       En el celular van de a dos ("Suspendidos" no cabe en un tercio). */
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filter:last-child:nth-child(even) {
      grid-column: 1 / -1;
    }

    @media (min-width: 640px) {
      .stats {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .filter:last-child:nth-child(even) {
        grid-column: auto;
      }
    }

    .filter.stat--wide {
      grid-column: 1 / -1;
    }

    .filter .stat__value {
      font-size: clamp(36px, 9vw, 68px);
    }

    .filter.is-active {
      border-color: var(--color-text);
      box-shadow: inset 0 0 0 1px var(--color-text);
    }

    .filter.stat--accent.is-active {
      box-shadow:
        0 0 0 3px var(--color-bg),
        0 0 0 5px var(--color-text);
    }

    .filter.is-active::after {
      content: '';
      position: absolute;
      top: 18px;
      right: 18px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: currentColor;
    }

    @media (min-width: 900px) {
      .stats {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }

      .filter.stat--wide {
        grid-column: span 2;
      }
    }

    .business-row {
      align-items: flex-start;
    }

    /* Correos largos: se cortan con "…" en vez de ensanchar la fila. */
    .owner__email {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .owners {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
      font-size: 13px;
    }

    .owner {
      min-width: 0;
      max-width: 100%;
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
    return new Date(iso).toLocaleDateString(intlLocale(), {
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
          translate(invited ? 'superadmin.createdInvited' : 'superadmin.createdAssigned', {
            email: email.trim(),
          }),
        );
      } else {
        await this.api.createBusiness(business.name, business.slug);
        this.notice.set(translate('superadmin.created'));
      }
      this.creating.set(false);
      this.filter.set('all');
      await this.reload();
    });
  }

  protected setStatus(business: AdminBusiness, status: BusinessStatus): Promise<void> {
    if (
      status === 'suspended' &&
      !confirm(translate('superadmin.confirmSuspend', { name: business.name }))
    ) {
      return Promise.resolve();
    }
    return this.run(async () => {
      await this.api.setStatus(business.id, status);
      this.businesses.update((list) =>
        list.map((b) => (b.id === business.id ? { ...b, status } : b)),
      );
      this.notice.set(
        translate('superadmin.statusChanged', {
          name: business.name,
          status: translate(`superadmin.status.${status}`).toLowerCase(),
        }),
      );
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
        translate(invited ? 'superadmin.ownerInvited' : 'superadmin.ownerAssigned', {
          email,
          name: business.name,
        }),
      );
      this.addingOwnerTo.set(null);
      await this.reload();
    });
  }

  protected removeOwner(
    business: AdminBusiness,
    owner: { user_id: string; email: string },
  ): Promise<void> {
    if (
      !confirm(
        translate('superadmin.confirmRemoveOwner', { email: owner.email, name: business.name }),
      )
    ) {
      return Promise.resolve();
    }
    return this.run(async () => {
      await this.api.removeOwner(owner.user_id);
      await this.reload();
    });
  }

  protected remove(business: AdminBusiness): Promise<void> {
    const typed = prompt(
      translate('superadmin.confirmDelete', { name: business.name, slug: business.slug }),
    );
    if (typed?.trim() !== business.slug) return Promise.resolve();
    return this.run(async () => {
      await this.api.deleteBusiness(business.id);
      this.businesses.update((list) => list.filter((b) => b.id !== business.id));
      this.notice.set(translate('superadmin.deleted', { name: business.name }));
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
