import { Component, OnDestroy, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage } from '../../../core/format';
import { Category, ItemKind } from '../../../core/models';
import { CurrentBusiness } from '../current-business';

const MAX_PHOTOS = 5;

/** Una foto ya guardada (path) o una nueva elegida en este formulario (file). */
interface PhotoDraft {
  path?: string;
  file?: File;
  url: string;
}

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="section-header">
      <div>
        <span class="kicker">{{ id() ? 'Editar' : 'Agregar' }}</span>
        <h2>{{ id() ? form.controls.name.value || 'Editar' : 'Nuevo producto o servicio' }}</h2>
      </div>
      <a class="button button--ghost" routerLink="..">Volver</a>
    </section>

    @if (loading()) {
      <p class="muted">Cargando…</p>
    } @else {
      <form class="form-tiles item-form" [formGroup]="form" (ngSubmit)="save()">
        <section class="card form-tile item-form__info">
          <header class="form-tile__head">
            <span class="kicker">01 · Información</span>
            <h3>Qué es y cómo se llama</h3>
          </header>
          <div class="form-grid">
            <label class="field">
              <span>Tipo</span>
              <select formControlName="kind">
                <option value="product">Producto</option>
                <option value="service">Servicio</option>
              </select>
            </label>

            <label class="field">
              <span>Categoría</span>
              <select formControlName="category_id">
                <option [ngValue]="null">Sin categoría</option>
                @for (category of categories(); track category.id) {
                  <option [ngValue]="category.id">{{ category.name }}</option>
                }
              </select>
            </label>

            <label class="field form-grid__full">
              <span>Nombre</span>
              <input formControlName="name" maxlength="120" />
            </label>

            <label class="field form-grid__full">
              <span>Descripción</span>
              <textarea formControlName="description" rows="5" maxlength="1000"></textarea>
            </label>
          </div>
        </section>

        <section class="card form-tile">
          <header class="form-tile__head">
            <span class="kicker">02 · Precio</span>
            <h3>Cuánto cuesta</h3>
          </header>
          <label class="field">
            <span>Precio ({{ current.business()?.currency }})</span>
            <input type="number" formControlName="price" min="0" step="0.01" inputmode="decimal" />
            <small>Déjalo vacío para mostrar "Precio a consultar".</small>
          </label>
        </section>

        <section class="card form-tile">
          <header class="form-tile__head">
            <span class="kicker">03 · Estado</span>
            <h3>Quién lo ve</h3>
          </header>
          <div class="field">
            <label class="check">
              <input type="checkbox" formControlName="is_available" /> Disponible
            </label>
            <label class="check">
              <input type="checkbox" formControlName="is_visible" /> Visible en el catálogo
            </label>
          </div>
        </section>

        <section class="card form-tile item-form__photos">
          <header class="form-tile__head">
            <span class="kicker">04 · Fotos · {{ photos().length }} de {{ maxPhotos }}</span>
            <h3>Cómo se ve</h3>
          </header>
          <div class="field">
            <div class="photos">
              @for (photo of photos(); track photo.url; let i = $index) {
                <div class="photos__item">
                  <img [src]="photo.url" alt="" />
                  <button
                    type="button"
                    class="photos__remove"
                    (click)="removePhoto(i)"
                    aria-label="Quitar foto"
                  >
                    ×
                  </button>
                </div>
              }
              @if (photos().length < maxPhotos) {
                <label class="photos__add">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    (change)="addPhotos($event)"
                  />
                  + Agregar
                </label>
              }
            </div>
            <small>La primera foto es la principal.</small>
          </div>
        </section>

        <div class="form-bar item-form__bar">
          @if (error(); as error) {
            <p class="alert">{{ error }}</p>
          }
          <button type="submit" class="button" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    }
  `,
  styles: `
    .item-form__info,
    .item-form__photos,
    .item-form__bar {
      grid-column: 1 / -1;
    }

    /* Computadora: información a la izquierda; precio y estado apilados a la derecha. */
    @media (min-width: 900px) {
      .item-form {
        grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
      }

      .item-form__info {
        grid-column: 1;
        grid-row: span 2;
      }
    }
  `,
})
export class ItemForm implements OnDestroy {
  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly current = inject(CurrentBusiness);
  private readonly businessId = this.current.id()!;

  /** Viene de la ruta /admin/productos/:id; vacío al crear. */
  readonly id = input<string>();

  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly categories = signal<Category[]>([]);
  protected readonly photos = signal<PhotoDraft[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Fotos guardadas que se quitaron: se borran del Storage al guardar. */
  private removedPaths: string[] = [];
  private nextPosition = 0;

  protected readonly form = inject(NonNullableFormBuilder).group({
    kind: ['product' as ItemKind],
    category_id: [null as string | null],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    price: [null as number | null, Validators.min(0)],
    is_available: [true],
    is_visible: [true],
  });

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    for (const photo of this.photos()) if (photo.file) URL.revokeObjectURL(photo.url);
  }

  private async load(): Promise<void> {
    try {
      const [categories, items] = await Promise.all([
        this.api.listCategories(this.businessId),
        this.api.listItems(this.businessId),
      ]);
      this.categories.set(categories);
      this.nextPosition = items.length;

      const item = items.find((i) => i.id === this.id());
      if (this.id() && !item) throw new Error('No se encontró este producto.');
      if (item) {
        this.form.patchValue({ ...item, description: item.description ?? '' });
        this.photos.set(item.photos.map((path) => ({ path, url: this.api.imageUrl(path) })));
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected addPhotos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const free = MAX_PHOTOS - this.photos().length;
    const added = Array.from(input.files ?? [])
      .slice(0, free)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    this.photos.update((list) => [...list, ...added]);
    input.value = '';
  }

  protected removePhoto(index: number): void {
    const photo = this.photos()[index];
    if (photo.path) this.removedPaths.push(photo.path);
    if (photo.file) URL.revokeObjectURL(photo.url);
    this.photos.update((list) => list.filter((_, i) => i !== index));
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    // Fotos subidas en este intento: si algo falla, se borran para no dejarlas huérfanas.
    const uploaded: string[] = [];
    try {
      // Sube las fotos nuevas y deja todas como rutas del bucket, en el orden mostrado.
      // allSettled espera a todas las subidas, así `uploaded` queda completo aunque una falle.
      const results = await Promise.allSettled(
        this.photos().map(async (photo) => {
          if (photo.path) return photo.path;
          const path = await this.api.uploadImage(this.businessId, 'items', photo.file!);
          uploaded.push(path);
          return path;
        }),
      );
      const failedUpload = results.find((r) => r.status === 'rejected');
      if (failedUpload) throw failedUpload.reason;
      const photos = results.map((r) => (r as PromiseFulfilledResult<string>).value);
      const value = this.form.getRawValue();
      const data = {
        ...value,
        name: value.name.trim(),
        description: value.description.trim() || null,
        price: value.price ?? null,
        photos,
      };

      const id = this.id();
      if (id) {
        await this.api.updateItem(id, data);
      } else {
        await this.api.createItem({
          ...data,
          business_id: this.businessId,
          position: this.nextPosition,
        });
      }
      uploaded.length = 0; // Ya quedaron guardadas en el producto.
      await this.api.removeImages(this.removedPaths);
      // Vuelve a la lista, sea /admin o /superadmin/negocios/:id.
      await this.router.navigate(['..'], { relativeTo: this.route });
    } catch (e) {
      await this.api.removeImages(uploaded);
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
