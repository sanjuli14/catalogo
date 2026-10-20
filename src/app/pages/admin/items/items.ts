import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, translate } from '@jsverse/transloco';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage, formatPrice } from '../../../core/format';
import { Category, Item } from '../../../core/models';
import { Icon } from '../../../shared/icon';
import { CurrentBusiness } from '../current-business';

@Component({
  selector: 'app-items',
  imports: [RouterLink, Icon, TranslocoDirective],
  styles: `
    .list-title {
      margin: 28px 0 4px;
    }

    /* Ancho fijo: al pasar de "Marcar agotado" a "Marcar disponible" los íconos no se corren. */
    .list__actions .button {
      min-width: 158px;
    }

    /* Celular: los íconos en una fila pareja y "Marcar agotado" debajo, a todo el ancho. */
    @media (max-width: 639px) {
      .list__actions {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        width: 100%;
      }

      .list__actions .icon-button {
        width: 100%;
      }

      .list__actions .button {
        grid-column: 1 / -1;
        order: 1;
      }
    }
  `,
  template: `
    <ng-container *transloco="let t">
      <section class="section-header">
        <div>
          <h2>{{ t('items.title') }}</h2>
          <p class="muted">{{ t('items.lead') }}</p>
        </div>
      </section>

      <!-- Resumen en tablero: cifras del catálogo y accesos a lo más usado. -->
      <section class="stats" [attr.aria-label]="t('items.summary')">
        <div class="stat stat--wide">
          <span class="kicker">{{ t('items.total') }}</span>
          <span class="stat__value">{{ loading() ? '–' : items().length }}</span>
          <app-icon class="stat__icon" name="bag" [size]="20" />
        </div>
        <div class="stat">
          <span class="kicker">{{ t('items.visible') }}</span>
          <span class="stat__value">{{ loading() ? '–' : visibleCount() }}</span>
          <app-icon class="stat__icon" name="eye" [size]="20" />
        </div>
        <div class="stat">
          <span class="kicker">{{ t('items.soldOut') }}</span>
          <span class="stat__value">{{ loading() ? '–' : soldOutCount() }}</span>
          <app-icon class="stat__icon" name="tag" [size]="20" />
        </div>
        <a class="stat stat--wide stat--accent" routerLink="nuevo">
          <span class="kicker">{{ t('items.add') }}</span>
          <span class="stat__title">{{ t('items.new') }}</span>
          <app-icon class="stat__icon" name="plus" [size]="22" />
        </a>
        <div class="stat">
          <span class="kicker">{{ t('admin.tabs.categories') }}</span>
          <span class="stat__value">{{ loading() ? '–' : categories().length }}</span>
          <app-icon class="stat__icon" name="layers" [size]="20" />
        </div>
        @if (current.business(); as business) {
          <a class="stat stat--ink" [href]="'/' + business.slug" target="_blank" rel="noopener">
            <span class="kicker">{{ t('items.yourCatalog') }}</span>
            <span class="stat__title">{{ t('admin.viewCatalog') }}</span>
            <app-icon class="stat__icon" name="arrowUpRight" [size]="20" />
          </a>
        }
      </section>

      <h3 class="kicker list-title">{{ t('items.listTitle') }}</h3>

      @if (error(); as error) {
        <p class="alert">{{ error }}</p>
      }

      @if (loading()) {
        <p class="muted">{{ t('common.loading') }}</p>
      } @else if (!items().length) {
        <p class="empty">
          {{ t('items.empty') }} <a routerLink="nuevo">{{ t('items.addFirst') }}</a
          >.
        </p>
      } @else {
        <ul class="list">
          @for (item of items(); track item.id; let i = $index, last = $last) {
            <li class="list__row" [class.is-muted]="!item.is_visible">
              @if (item.photos.length) {
                <img class="thumb" [src]="api.imageUrl(item.photos[0])" alt="" />
              } @else {
                <span class="thumb thumb--empty" aria-hidden="true"
                  ><app-icon name="image" [size]="22"
                /></span>
              }

              <div class="list__grow">
                <a class="list__title" [routerLink]="item.id">{{ item.name }}</a>
                <div class="list__meta">
                  <span class="badge">{{ t('kind.' + item.kind) }}</span>
                  @if (item.category_id) {
                    <span>{{ categoryNames().get(item.category_id) }}</span>
                  }
                  <span>{{ price(item) }}</span>
                  @if (!item.is_available) {
                    <span class="badge badge--warn">{{ t('items.unavailable') }}</span>
                  }
                  @if (!item.is_visible) {
                    <span class="badge badge--muted">{{ t('items.hidden') }}</span>
                  }
                </div>
              </div>

              <div class="list__actions">
                <button
                  type="button"
                  class="icon-button"
                  [disabled]="i === 0 || busy()"
                  (click)="move(i, -1)"
                  [attr.aria-label]="t('common.moveUp')"
                  [title]="t('common.moveUp')"
                >
                  <app-icon name="chevronUp" [size]="18" />
                </button>
                <button
                  type="button"
                  class="icon-button"
                  [disabled]="last || busy()"
                  (click)="move(i, 1)"
                  [attr.aria-label]="t('common.moveDown')"
                  [title]="t('common.moveDown')"
                >
                  <app-icon name="chevronDown" [size]="18" />
                </button>
                <button
                  type="button"
                  class="icon-button"
                  [disabled]="busy()"
                  (click)="toggle(item, 'is_visible')"
                  [attr.aria-label]="t(item.is_visible ? 'items.hide' : 'items.show')"
                  [title]="t(item.is_visible ? 'items.hide' : 'items.show')"
                >
                  <app-icon [name]="item.is_visible ? 'eye' : 'eyeOff'" [size]="18" />
                </button>
                <button
                  type="button"
                  class="button button--ghost button--sm"
                  [disabled]="busy()"
                  (click)="toggle(item, 'is_available')"
                >
                  {{ t(item.is_available ? 'items.markSoldOut' : 'items.markAvailable') }}
                </button>
                <a
                  class="icon-button"
                  [routerLink]="item.id"
                  [attr.aria-label]="t('items.edit')"
                  [title]="t('items.edit')"
                >
                  <app-icon name="pencil" [size]="16" />
                </a>
                <button
                  type="button"
                  class="icon-button icon-button--danger"
                  [disabled]="busy()"
                  (click)="remove(item)"
                  [attr.aria-label]="t('common.delete')"
                  [title]="t('common.delete')"
                >
                  <app-icon name="trash" [size]="16" />
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </ng-container>
  `,
})
export class Items {
  protected readonly api = inject(CatalogApi);
  protected readonly current = inject(CurrentBusiness);
  private readonly businessId = this.current.id()!;

  protected readonly items = signal<Item[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly categoryNames = computed(
    () => new Map(this.categories().map((c) => [c.id, c.name])),
  );
  /** Cifras del tablero de resumen (solo lectura). */
  protected readonly visibleCount = computed(() => this.items().filter((i) => i.is_visible).length);
  protected readonly soldOutCount = computed(
    () => this.items().filter((i) => !i.is_available).length,
  );
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.run(async () => {
      const [items, categories] = await Promise.all([
        this.api.listItems(this.businessId),
        this.api.listCategories(this.businessId),
      ]);
      this.items.set(items);
      this.categories.set(categories);
      this.loading.set(false);
    });
  }

  protected price(item: Item): string {
    return formatPrice(item.price, this.current.business()?.currency ?? 'USD');
  }

  protected toggle(item: Item, field: 'is_visible' | 'is_available'): Promise<void> {
    return this.run(async () => {
      const value = !item[field];
      await this.api.updateItem(item.id, { [field]: value });
      this.items.update((list) =>
        list.map((i) => (i.id === item.id ? { ...i, [field]: value } : i)),
      );
    });
  }

  protected remove(item: Item): Promise<void> {
    if (!confirm(translate('items.confirmDelete', { name: item.name }))) {
      return Promise.resolve();
    }
    return this.run(async () => {
      await this.api.deleteItem(item);
      this.items.update((list) => list.filter((i) => i.id !== item.id));
    });
  }

  protected move(index: number, delta: -1 | 1): Promise<void> {
    return this.run(async () => {
      const list = [...this.items()];
      [list[index], list[index + delta]] = [list[index + delta], list[index]];
      this.items.set(list);
      this.items.set(await this.api.savePositions('items', list));
    });
  }

  /** Ejecuta una acción mostrando el estado "ocupado" y el error si falla. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
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
