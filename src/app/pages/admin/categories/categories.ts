import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage } from '../../../core/format';
import { Category } from '../../../core/models';
import { Icon } from '../../../shared/icon';
import { CurrentBusiness } from '../current-business';

@Component({
  selector: 'app-categories',
  imports: [FormsModule, Icon],
  styles: `
    .cat-board {
      display: grid;
      gap: var(--gap);
      margin-bottom: 16px;
    }

    .cat-add {
      display: grid;
      align-content: space-between;
      gap: 18px;
    }

    .cat-index {
      width: 28px;
      padding-left: 6px;
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    @media (min-width: 900px) {
      .cat-board {
        grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
      }
    }
  `,
  template: `
    <section class="section-header">
      <div>
        <h2>Categorías</h2>
        <p class="muted">Agrupan tus productos y servicios en el catálogo, en este orden.</p>
      </div>
    </section>

    <!-- Tablero: agregar una categoría (tile ancho) y cuántas hay. -->
    <div class="cat-board">
      <form class="card cat-add" (ngSubmit)="add()">
        <label class="kicker" for="new-category">Nueva categoría</label>
        <div class="inline-form">
          <input
            id="new-category"
            class="input"
            name="newName"
            placeholder="Por ejemplo: Bebidas"
            [(ngModel)]="newName"
            maxlength="60"
          />
          <button type="submit" class="button" [disabled]="!newName.trim() || busy()">
            <app-icon name="plus" [size]="18" /> Agregar
          </button>
        </div>
      </form>
      <div class="stat">
        <span class="kicker">Categorías</span>
        <span class="stat__value">{{ loading() ? '–' : categories().length }}</span>
        <app-icon class="stat__icon" name="layers" [size]="20" />
      </div>
    </div>

    @if (error(); as error) {
      <p class="alert">{{ error }}</p>
    }

    @if (loading()) {
      <p class="muted">Cargando…</p>
    } @else if (!categories().length) {
      <p class="empty">Todavía no tienes categorías.</p>
    } @else {
      <ul class="list">
        @for (category of categories(); track category.id; let i = $index, last = $last) {
          <li class="list__row">
            @if (editingId() === category.id) {
              <form class="inline-form list__grow" (ngSubmit)="rename(category)">
                <input
                  class="input"
                  name="editName"
                  [(ngModel)]="editName"
                  maxlength="60"
                  aria-label="Nombre de la categoría"
                />
                <button type="submit" class="button" [disabled]="!editName.trim() || busy()">
                  Guardar
                </button>
                <button type="button" class="button button--ghost" (click)="editingId.set(null)">
                  Cancelar
                </button>
              </form>
            } @else {
              <span class="cat-index" aria-hidden="true">{{ i < 9 ? '0' + (i + 1) : i + 1 }}</span>
              <span class="list__grow list__title">{{ category.name }}</span>
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
                  (click)="startEdit(category)"
                  aria-label="Renombrar"
                  title="Renombrar"
                >
                  <app-icon name="pencil" [size]="16" />
                </button>
                <button
                  type="button"
                  class="icon-button icon-button--danger"
                  [disabled]="busy()"
                  (click)="remove(category)"
                  aria-label="Eliminar"
                  title="Eliminar"
                >
                  <app-icon name="trash" [size]="16" />
                </button>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class Categories {
  private readonly api = inject(CatalogApi);
  private readonly businessId = inject(CurrentBusiness).id()!;

  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected newName = '';
  protected editName = '';

  constructor() {
    void this.run(async () => {
      this.categories.set(await this.api.listCategories(this.businessId));
      this.loading.set(false);
    });
  }

  protected add(): Promise<void> {
    return this.run(async () => {
      const name = this.newName.trim();
      const created = await this.api.createCategory(
        this.businessId,
        name,
        this.categories().length,
      );
      this.categories.update((list) => [...list, created]);
      this.newName = '';
    });
  }

  protected startEdit(category: Category): void {
    this.editName = category.name;
    this.editingId.set(category.id);
  }

  protected rename(category: Category): Promise<void> {
    return this.run(async () => {
      const name = this.editName.trim();
      await this.api.renameCategory(category.id, name);
      this.categories.update((list) =>
        list.map((c) => (c.id === category.id ? { ...c, name } : c)),
      );
      this.editingId.set(null);
    });
  }

  protected remove(category: Category): Promise<void> {
    const ok = confirm(
      `¿Eliminar la categoría "${category.name}"? Sus productos no se borran: quedan sin categoría.`,
    );
    if (!ok) return Promise.resolve();
    return this.run(async () => {
      await this.api.deleteCategory(category.id);
      this.categories.update((list) => list.filter((c) => c.id !== category.id));
    });
  }

  protected move(index: number, delta: -1 | 1): Promise<void> {
    return this.run(async () => {
      const list = [...this.categories()];
      [list[index], list[index + delta]] = [list[index + delta], list[index]];
      this.categories.set(list);
      this.categories.set(await this.api.savePositions('categories', list));
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
