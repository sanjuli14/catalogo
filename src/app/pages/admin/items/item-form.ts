import { Component, OnDestroy, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, translate } from '@jsverse/transloco';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage } from '../../../core/format';
import { Category, ItemKind, Variant } from '../../../core/models';
import { Icon } from '../../../shared/icon';
import { CurrentBusiness } from '../current-business';

const MAX_PHOTOS = 5;
const MAX_VARIANTS = 30;

type VariantForm = FormGroup<{
  id: FormControl<string>;
  name: FormControl<string>;
  price: FormControl<number | null>;
  is_available: FormControl<boolean>;
}>;

/** El precio anterior (tachado) tiene que ser mayor que el precio, y necesita uno. */
function compareAtAbovePrice(group: AbstractControl): ValidationErrors | null {
  const { price, compare_at_price } = group.value as {
    price: number | null;
    compare_at_price: number | null;
  };
  if (compare_at_price === null) return null;
  return price !== null && compare_at_price > price ? null : { compareAt: true };
}

/** Una foto ya guardada (path) o una nueva elegida en este formulario (file). */
interface PhotoDraft {
  path?: string;
  file?: File;
  url: string;
}

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, Icon],
  template: `
    <ng-container *transloco="let t">
      <section class="section-header">
        <div>
          <span class="kicker">{{ t(id() ? 'items.edit' : 'items.add') }}</span>
          <h2 [class.is-long]="heading().length > longHeading">{{ heading() }}</h2>
        </div>
        <a class="button button--ghost" routerLink="..">{{ t('itemForm.back') }}</a>
      </section>

      @if (loading()) {
        <p class="muted">{{ t('common.loading') }}</p>
      } @else {
        <form class="form-tiles item-form" [formGroup]="form" (ngSubmit)="save()">
          <section class="card form-tile item-form__info">
            <header class="form-tile__head">
              <span class="kicker">01 · {{ t('itemForm.info') }}</span>
              <h3>{{ t('itemForm.infoTitle') }}</h3>
            </header>
            <div class="form-grid">
              <label class="field">
                <span>{{ t('itemForm.kind') }}</span>
                <select formControlName="kind">
                  <option value="product">{{ t('kind.product') }}</option>
                  <option value="service">{{ t('kind.service') }}</option>
                </select>
              </label>

              <label class="field">
                <span>{{ t('itemForm.category') }}</span>
                <select formControlName="category_id">
                  <option [ngValue]="null">{{ t('itemForm.noCategory') }}</option>
                  @for (category of categories(); track category.id) {
                    <option [ngValue]="category.id">{{ category.name }}</option>
                  }
                </select>
              </label>

              <label class="field form-grid__full">
                <span>{{ t('itemForm.name') }}</span>
                <input formControlName="name" maxlength="120" />
              </label>

              <label class="field form-grid__full">
                <span>{{ t('itemForm.description') }}</span>
                <textarea formControlName="description" rows="5" maxlength="1000"></textarea>
              </label>
            </div>
          </section>

          <section class="card form-tile">
            <header class="form-tile__head">
              <span class="kicker">02 · {{ t('itemForm.price') }}</span>
              <h3>{{ t('itemForm.priceTitle') }}</h3>
            </header>
            <label class="field">
              <span>{{ t('itemForm.price') }} ({{ current.business()?.currency }})</span>
              <input
                type="number"
                formControlName="price"
                min="0"
                step="0.01"
                inputmode="decimal"
              />
              <small>{{ t('itemForm.priceHint') }}</small>
            </label>
            <label class="field">
              <span>{{ t('itemForm.compareAt') }} ({{ current.business()?.currency }})</span>
              <input
                type="number"
                formControlName="compare_at_price"
                min="0"
                step="0.01"
                inputmode="decimal"
              />
              @if (form.hasError('compareAt')) {
                <small class="error-text">{{ t('itemForm.compareAtError') }}</small>
              } @else {
                <small>{{ t('itemForm.compareAtHint') }}</small>
              }
            </label>
          </section>

          <section class="card form-tile">
            <header class="form-tile__head">
              <span class="kicker">03 · {{ t('itemForm.status') }}</span>
              <h3>{{ t('itemForm.statusTitle') }}</h3>
            </header>
            <div class="field">
              <label class="check">
                <input type="checkbox" formControlName="is_available" />
                {{ t('itemForm.available') }}
              </label>
              <label class="check">
                <input type="checkbox" formControlName="is_visible" /> {{ t('itemForm.visible') }}
              </label>
              <label class="check">
                <input type="checkbox" formControlName="is_pinned" /> {{ t('itemForm.pinned') }}
              </label>
              <small>{{ t('itemForm.pinnedHint') }}</small>
            </div>
          </section>

          <section class="card form-tile item-form__wide">
            <header class="form-tile__head">
              <span class="kicker">04 · {{ t('itemForm.variants') }}</span>
              <h3>{{ t('itemForm.variantsTitle') }}</h3>
            </header>
            <p class="muted variants-hint">{{ t('itemForm.variantsHint') }}</p>
            @if (variants.length) {
              <label class="field">
                <span>{{ t('itemForm.variantLabel') }}</span>
                <input
                  formControlName="variant_label"
                  maxlength="40"
                  [placeholder]="t('itemForm.variantLabelPlaceholder')"
                />
              </label>
              <ul class="variant-rows" formArrayName="variants">
                @for (row of variants.controls; track row; let i = $index, last = $last) {
                  <li class="variant-row" [formGroupName]="i">
                    <label class="field">
                      <span>{{ t('itemForm.variantName') }}</span>
                      <input formControlName="name" maxlength="40" />
                    </label>
                    <label class="field">
                      <span>{{ t('itemForm.price') }}</span>
                      <input
                        type="number"
                        formControlName="price"
                        min="0"
                        step="0.01"
                        inputmode="decimal"
                        [placeholder]="t('itemForm.variantPricePlaceholder')"
                      />
                    </label>
                    <label class="check">
                      <input type="checkbox" formControlName="is_available" />
                      {{ t('itemForm.available') }}
                    </label>
                    <div class="variant-row__actions">
                      <button
                        type="button"
                        class="icon-button"
                        [disabled]="i === 0"
                        (click)="moveVariant(i, -1)"
                        [attr.aria-label]="t('common.moveUp')"
                        [title]="t('common.moveUp')"
                      >
                        <app-icon name="chevronUp" [size]="18" />
                      </button>
                      <button
                        type="button"
                        class="icon-button"
                        [disabled]="last"
                        (click)="moveVariant(i, 1)"
                        [attr.aria-label]="t('common.moveDown')"
                        [title]="t('common.moveDown')"
                      >
                        <app-icon name="chevronDown" [size]="18" />
                      </button>
                      <button
                        type="button"
                        class="icon-button icon-button--danger"
                        (click)="variants.removeAt(i)"
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
            <button
              type="button"
              class="button button--ghost variants-add"
              [disabled]="variants.length >= maxVariants"
              (click)="addVariant()"
            >
              <app-icon name="plus" [size]="18" /> {{ t('itemForm.addVariant') }}
            </button>
          </section>

          <section class="card form-tile item-form__wide">
            <header class="form-tile__head">
              <span class="kicker"
                >05 · {{ t('itemForm.photos', { count: photos().length, max: maxPhotos }) }}</span
              >
              <h3>{{ t('itemForm.photosTitle') }}</h3>
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
                      [attr.aria-label]="t('itemForm.removePhoto')"
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
                    + {{ t('itemForm.addPhoto') }}
                  </label>
                }
              </div>
              <small>{{ t('itemForm.photosHint') }}</small>
            </div>
          </section>

          <div class="form-bar item-form__bar">
            @if (error(); as error) {
              <p class="alert">{{ error }}</p>
            }
            <button type="submit" class="button" [disabled]="form.invalid || saving()">
              {{ saving() ? t('common.saving') : t('common.save') }}
            </button>
          </div>
        </form>
      }
    </ng-container>
  `,
  styles: `
    .item-form__info,
    .item-form__wide,
    .item-form__bar {
      grid-column: 1 / -1;
    }

    .variants-hint {
      margin: 0;
      font-size: 14px;
    }

    .variant-rows {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* Celular: nombre y precio lado a lado; disponible y acciones debajo. */
    .variant-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px 12px;
      align-items: end;
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: 16px;
    }

    .variant-row .check {
      min-height: 44px;
    }

    .variant-row__actions {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }

    .variants-add {
      justify-self: start;
    }

    @media (min-width: 900px) {
      .variant-row {
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto auto;
      }
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
  protected readonly maxVariants = MAX_VARIANTS;
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly categories = signal<Category[]>([]);
  protected readonly photos = signal<PhotoDraft[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Fotos guardadas que se quitaron: se borran del Storage al guardar. */
  private removedPaths: string[] = [];
  private nextPosition = 0;

  protected readonly form = this.fb.group(
    {
      kind: ['product' as ItemKind],
      category_id: [null as string | null],
      name: ['', [Validators.required, Validators.maxLength(120)]],
      description: [''],
      price: [null as number | null, Validators.min(0)],
      compare_at_price: [null as number | null, Validators.min(0)],
      is_available: [true],
      is_visible: [true],
      is_pinned: [false],
      variant_label: [''],
      variants: new FormArray<VariantForm>([]),
    },
    { validators: compareAtAbovePrice },
  );

  /** Desde este largo el título usa letra más chica (si no, ocupa 4 renglones en el celular). */
  protected readonly longHeading = 22;

  /** Título de la página: el nombre mientras se edita. */
  protected heading(): string {
    return this.id()
      ? this.form.controls.name.value || translate('items.edit')
      : translate('items.new');
  }

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
      if (this.id() && !item) throw new Error(translate('itemForm.notFound'));
      if (item) {
        for (const variant of item.variants) this.variants.push(this.variantForm(variant));
        this.form.patchValue({
          ...item,
          description: item.description ?? '',
          variant_label: item.variant_label ?? '',
        });
        this.photos.set(item.photos.map((path) => ({ path, url: this.api.imageUrl(path) })));
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected get variants(): FormArray<VariantForm> {
    return this.form.controls.variants;
  }

  protected addVariant(): void {
    this.variants.push(
      this.variantForm({ id: crypto.randomUUID(), name: '', price: null, is_available: true }),
    );
  }

  protected moveVariant(index: number, delta: -1 | 1): void {
    const row = this.variants.at(index);
    this.variants.removeAt(index);
    this.variants.insert(index + delta, row);
  }

  /** El id se conserva al editar: así un pedido armado con esa variante sigue valiendo. */
  private variantForm(variant: Variant): VariantForm {
    return this.fb.group({
      id: [variant.id],
      name: [variant.name, [Validators.required, Validators.pattern(/\S/)]],
      price: [variant.price, Validators.min(0)],
      is_available: [variant.is_available],
    });
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
        compare_at_price: value.compare_at_price ?? null,
        variant_label: (value.variants.length && value.variant_label.trim()) || null,
        variants: value.variants.map((v) => ({
          ...v,
          name: v.name.trim(),
          price: v.price ?? null,
        })),
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
