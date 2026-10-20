import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage, formatPrice } from '../../../core/format';
import { Category, Item } from '../../../core/models';
import { Icon } from '../../../shared/icon';
import { CurrentBusiness } from '../current-business';

@Component({
  selector: 'app-items',
  imports: [RouterLink, Icon],
  styles: `
    .list-title {
      margin: 28px 0 4px;
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
    <section class="section-header">
      <div>
        <h2>Productos y servicios</h2>
        <p class="muted">Aparecen en tu catálogo en este orden.</p>
      </div>
    </section>

    <!-- Resumen en tablero: cifras del catálogo y accesos a lo más usado. -->
    <section class="stats" aria-label="Resumen">
      <div class="stat stat--wide">
        <span class="kicker">En total</span>
        <span class="stat__value">{{ loading() ? '–' : items().length }}</span>
        <app-icon class="stat__icon" name="bag" [size]="20" />
      </div>
      <div class="stat">
        <span class="kicker">Visibles</span>
        <span class="stat__value">{{ loading() ? '–' : visibleCount() }}</span>
        <app-icon class="stat__icon" name="eye" [size]="20" />
      </div>
      <div class="stat">
        <span class="kicker">Agotados</span>
        <span class="stat__value">{{ loading() ? '–' : soldOutCount() }}</span>
        <app-icon class="stat__icon" name="tag" [size]="20" />
      </div>
      <a class="stat stat--wide stat--accent" routerLink="nuevo">
        <span class="kicker">Agregar</span>
        <span class="stat__title">Nuevo producto o servicio</span>
        <app-icon class="stat__icon" name="plus" [size]="22" />
      </a>
      <div class="stat">
        <span class="kicker">Categorías</span>
        <span class="stat__value">{{ loading() ? '–' : categories().length }}</span>
        <app-icon class="stat__icon" name="layers" [size]="20" />
      </div>
      @if (current.business(); as business) {
        <a class="stat stat--ink" [href]="'/' + business.slug" target="_blank" rel="noopener">
          <span class="kicker">Tu catálogo</span>
          <span class="stat__title">Ver mi catálogo</span>
          <app-icon class="stat__icon" name="arrowUpRight" [size]="20" />
        </a>
      }
    </section>

    <h3 class="kicker list-title">Lista en orden del catálogo</h3>

    @if (error(); as error) {
      <p class="alert">{{ error }}</p>
    }

    @if (loading()) {
      <p class="muted">Cargando…</p>
    } @else if (!items().length) {
      <p class="empty">
        Todavía no tienes productos ni servicios. <a routerLink="nuevo">Agrega el primero</a>.
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
                <span class="badge">{{ item.kind === 'service' ? 'Servicio' : 'Producto' }}</span>
                @if (item.category_id) {
                  <span>{{ categoryNames().get(item.category_id) }}</span>
                }
                <span>{{ price(item) }}</span>
                @if (!item.is_available) {
                  <span class="badge badge--warn">No disponible</span>
                }
                @if (!item.is_visible) {
                  <span class="badge badge--muted">Oculto</span>
                }
              </div>
            </div>

            <div class="list__actions">
              <button
                type="button"
                class="icon-button"
                [disabled]="i === 0 || busy()"
                (click)="move(i, -1)"
                aria-label="Subir"
                title="Subir"
              >
                <app-icon name="chevronUp" [size]="18" />
              </button>
              <button
                type="button"
                class="icon-button"
                [disabled]="last || busy()"
                (click)="move(i, 1)"
                aria-label="Bajar"
                title="Bajar"
              >
                <app-icon name="chevronDown" [size]="18" />
              </button>
              <button
                type="button"
                class="icon-button"
                [disabled]="busy()"
                (click)="toggle(item, 'is_visible')"
                [attr.aria-label]="
                  item.is_visible ? 'Ocultar del catálogo' : 'Mostrar en el catálogo'
                "
                [title]="item.is_visible ? 'Ocultar del catálogo' : 'Mostrar en el catálogo'"
              >
                <app-icon [name]="item.is_visible ? 'eye' : 'eyeOff'" [size]="18" />
              </button>
              <button
                type="button"
                class="button button--ghost button--sm"
                [disabled]="busy()"
                (click)="toggle(item, 'is_available')"
              >
                {{ item.is_available ? 'Marcar agotado' : 'Marcar disponible' }}
              </button>
              <a class="icon-button" [routerLink]="item.id" aria-label="Editar" title="Editar">
                <app-icon name="pencil" [size]="16" />
              </a>
              <button
                type="button"
                class="icon-button icon-button--danger"
                [disabled]="busy()"
                (click)="remove(item)"
                aria-label="Eliminar"
                title="Eliminar"
              >
                <app-icon name="trash" [size]="16" />
              </button>
            </div>
          </li>
        }
      </ul>
    }
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
    if (!confirm(`¿Eliminar "${item.name}"? Esta acción no se puede deshacer.`)) {
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
