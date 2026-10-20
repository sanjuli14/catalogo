import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage, formatPrice } from '../../../core/format';
import { Category, Item } from '../../../core/models';
import { CurrentBusiness } from '../current-business';

@Component({
  selector: 'app-items',
  imports: [RouterLink],
  template: `
    <section class="section-header">
      <div>
        <h2>Productos y servicios</h2>
        <p class="muted">Aparecen en tu catálogo en este orden.</p>
      </div>
      <a class="button" routerLink="nuevo">Nuevo</a>
    </section>

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
              <span class="thumb thumb--empty" aria-hidden="true">Sin foto</span>
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
              >
                ↑
              </button>
              <button
                type="button"
                class="icon-button"
                [disabled]="last || busy()"
                (click)="move(i, 1)"
                aria-label="Bajar"
              >
                ↓
              </button>
              <button
                type="button"
                class="button button--ghost"
                [disabled]="busy()"
                (click)="toggle(item, 'is_visible')"
              >
                {{ item.is_visible ? 'Ocultar' : 'Mostrar' }}
              </button>
              <button
                type="button"
                class="button button--ghost"
                [disabled]="busy()"
                (click)="toggle(item, 'is_available')"
              >
                {{ item.is_available ? 'Marcar agotado' : 'Marcar disponible' }}
              </button>
              <button
                type="button"
                class="button button--danger"
                [disabled]="busy()"
                (click)="remove(item)"
              >
                Eliminar
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
  private readonly current = inject(CurrentBusiness);
  private readonly businessId = this.current.id()!;

  protected readonly items = signal<Item[]>([]);
  private readonly categories = signal<Category[]>([]);
  protected readonly categoryNames = computed(
    () => new Map(this.categories().map((c) => [c.id, c.name])),
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
