import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage } from '../../../core/format';
import { Category } from '../../../core/models';
import { CurrentBusiness } from '../current-business';

@Component({
  selector: 'app-categories',
  imports: [FormsModule],
  template: `
    <section class="section-header">
      <div>
        <h2>Categorías</h2>
        <p class="muted">Agrupan tus productos y servicios en el catálogo, en este orden.</p>
      </div>
    </section>

    <form class="inline-form" (ngSubmit)="add()">
      <input
        class="input"
        name="newName"
        placeholder="Nueva categoría, por ejemplo: Bebidas"
        [(ngModel)]="newName"
        maxlength="60"
      />
      <button type="submit" class="button" [disabled]="!newName.trim() || busy()">Agregar</button>
    </form>

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
              <span class="list__grow">{{ category.name }}</span>
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
                <button type="button" class="button button--ghost" (click)="startEdit(category)">
                  Renombrar
                </button>
                <button
                  type="button"
                  class="button button--danger"
                  [disabled]="busy()"
                  (click)="remove(category)"
                >
                  Eliminar
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
      await this.api.savePositions('categories', list);
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
