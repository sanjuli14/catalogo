import { Component, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage } from '../../../core/format';
import { Business } from '../../../core/models';
import { SLUG_PATTERN, toSlug } from '../../../core/slug';
import { CurrentBusiness } from '../current-business';

const CURRENCIES = [
  ['USD', 'Dólar estadounidense'],
  ['EUR', 'Euro'],
  ['MXN', 'Peso mexicano'],
  ['COP', 'Peso colombiano'],
  ['ARS', 'Peso argentino'],
  ['CLP', 'Peso chileno'],
  ['CUP', 'Peso cubano'],
  ['DOP', 'Peso dominicano'],
  ['UYU', 'Peso uruguayo'],
  ['PEN', 'Sol peruano'],
  ['BOB', 'Boliviano'],
  ['GTQ', 'Quetzal'],
  ['PYG', 'Guaraní'],
  ['VES', 'Bolívar'],
] as const;

@Component({
  selector: 'app-business-settings',
  imports: [ReactiveFormsModule],
  styles: `
    .settings__colors {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .settings__bar {
      grid-column: 1 / -1;
    }

    /* Computadora: tiles anchos a la izquierda y angostos a la derecha. */
    @media (min-width: 900px) {
      .settings {
        grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
      }
    }
  `,
  template: `
    <section class="section-header">
      <div>
        <h2>Mi negocio</h2>
        <p class="muted">Así se presenta tu negocio en el catálogo.</p>
      </div>
    </section>

    @if (!current.business()) {
      <p class="muted">Cargando…</p>
    } @else {
      <form class="form-tiles settings" [formGroup]="form" (ngSubmit)="save()">
        <section class="card form-tile">
          <header class="form-tile__head">
            <span class="kicker">01 · Identidad</span>
            <h3>Quién eres</h3>
          </header>
          <div class="form-grid">
            <div class="field form-grid__full">
              <span>Logo</span>
              <div class="logo-picker">
                @if (logoUrl(); as url) {
                  <img class="logo-picker__image" [src]="url" alt="Logo" />
                } @else {
                  <span class="logo-picker__image logo-picker__image--empty">Sin logo</span>
                }
                <label class="button button--ghost">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    (change)="pickLogo($event)"
                  />
                  {{ logoUrl() ? 'Cambiar' : 'Subir logo' }}
                </label>
                @if (logoUrl()) {
                  <button type="button" class="button button--ghost" (click)="clearLogo()">
                    Quitar
                  </button>
                }
              </div>
            </div>

            <label class="field">
              <span>Nombre</span>
              <input formControlName="name" maxlength="80" />
            </label>

            <label class="field">
              <span>Dirección web</span>
              <div class="input-prefix">
                <span>{{ origin }}/</span>
                <input formControlName="slug" maxlength="50" (blur)="normalizeSlug()" />
              </div>
              @if (form.controls.slug.invalid) {
                <small class="error-text">
                  De 3 a 50 caracteres: minúsculas, números y guiones. Ejemplo: mi-tienda
                </small>
              } @else if (form.controls.slug.value !== current.business()!.slug) {
                <small>Ojo: el enlace anterior dejará de funcionar.</small>
              }
            </label>

            <label class="field form-grid__full">
              <span>Descripción corta</span>
              <textarea formControlName="description" rows="3" maxlength="300"></textarea>
            </label>
          </div>
        </section>

        <section class="card form-tile">
          <header class="form-tile__head">
            <span class="kicker">02 · Colores y moneda</span>
            <h3>Cómo se ve</h3>
          </header>
          <div class="settings__colors">
            <label class="field">
              <span>Color principal</span>
              <input type="color" formControlName="primary_color" />
            </label>

            <label class="field">
              <span>Color secundario</span>
              <input type="color" formControlName="secondary_color" />
            </label>
          </div>

          <label class="field">
            <span>Moneda de los precios</span>
            <select formControlName="currency">
              @for (currency of currencies; track currency[0]) {
                <option [value]="currency[0]">{{ currency[0] }} · {{ currency[1] }}</option>
              }
            </select>
          </label>
        </section>

        <section class="card form-tile">
          <header class="form-tile__head">
            <span class="kicker">03 · Contacto</span>
            <h3>Cómo te encuentran</h3>
          </header>
          <div class="form-grid">
            <label class="field">
              <span>WhatsApp</span>
              <input formControlName="whatsapp" inputmode="tel" placeholder="5355551234" />
              <small
                >Con código de país, sin + ni espacios. Lo usan los botones "Pedir por
                WhatsApp".</small
              >
            </label>

            <label class="field">
              <span>Teléfono</span>
              <input formControlName="phone" inputmode="tel" />
            </label>

            <label class="field">
              <span>Correo</span>
              <input type="email" formControlName="email" />
            </label>

            <label class="field">
              <span>Dirección</span>
              <input formControlName="address" />
            </label>

            <label class="field form-grid__full">
              <span>Horario</span>
              <textarea
                formControlName="schedule"
                rows="2"
                placeholder="Lunes a viernes de 9:00 a 18:00"
              ></textarea>
            </label>
          </div>
        </section>

        <section class="card form-tile">
          <header class="form-tile__head">
            <span class="kicker">04 · Redes sociales</span>
            <h3>Dónde te siguen</h3>
          </header>
          <label class="field">
            <span>Instagram</span>
            <input formControlName="instagram" placeholder="https://instagram.com/mi-tienda" />
          </label>

          <label class="field">
            <span>Facebook</span>
            <input formControlName="facebook" placeholder="https://facebook.com/mi-tienda" />
          </label>

          <label class="field">
            <span>TikTok</span>
            <input formControlName="tiktok" placeholder="https://tiktok.com/@mi-tienda" />
          </label>

          <label class="field">
            <span>Sitio web</span>
            <input formControlName="website" placeholder="https://mi-tienda.com" />
          </label>
        </section>

        <div class="form-bar settings__bar">
          @if (error(); as error) {
            <p class="alert">{{ error }}</p>
          }
          @if (saved()) {
            <p class="success">Cambios guardados.</p>
          }
          <button type="submit" class="button" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class BusinessSettings implements OnDestroy {
  private readonly api = inject(CatalogApi);
  protected readonly current = inject(CurrentBusiness);

  protected readonly origin = location.origin;
  protected readonly currencies = CURRENCIES;
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly logoUrl = signal<string | null>(null);
  /** undefined = sin cambios, null = quitar el logo, File = logo nuevo. */
  private logoChange: File | null | undefined;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    slug: ['', [Validators.required, Validators.minLength(3), Validators.pattern(SLUG_PATTERN)]],
    description: [''],
    primary_color: ['#6b45ff'],
    secondary_color: ['#8f73ff'],
    currency: ['USD'],
    whatsapp: [''],
    phone: [''],
    email: ['', Validators.email],
    address: [''],
    schedule: [''],
    instagram: [''],
    facebook: [''],
    tiktok: [''],
    website: [''],
  });

  constructor() {
    // Llena el formulario cuando el negocio termina de cargar.
    effect(() => {
      const business = this.current.business();
      if (business) untracked(() => this.fill(business));
    });
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  private fill(business: Business): void {
    this.form.reset({
      ...business,
      ...business.socials,
      description: business.description ?? '',
      whatsapp: business.whatsapp ?? '',
      phone: business.phone ?? '',
      email: business.email ?? '',
      address: business.address ?? '',
      schedule: business.schedule ?? '',
    });
    this.revokePreview();
    this.logoChange = undefined;
    this.logoUrl.set(business.logo_path ? this.api.imageUrl(business.logo_path) : null);
  }

  protected normalizeSlug(): void {
    this.form.controls.slug.setValue(toSlug(this.form.controls.slug.value));
  }

  protected pickLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.revokePreview();
    this.logoChange = file;
    this.logoUrl.set(URL.createObjectURL(file));
  }

  protected clearLogo(): void {
    this.revokePreview();
    this.logoChange = null;
    this.logoUrl.set(null);
  }

  protected async save(): Promise<void> {
    const business = this.current.business()!;
    this.normalizeSlug();
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    // Si el guardado falla, el logo recién subido se borra para no dejarlo huérfano.
    let uploadedLogo: string | null = null;
    try {
      let logoPath = business.logo_path;
      if (this.logoChange) {
        uploadedLogo = await this.api.uploadImage(business.id, 'logo', this.logoChange);
        logoPath = uploadedLogo;
      } else if (this.logoChange === null) {
        logoPath = null;
      }

      const { instagram, facebook, tiktok, website, ...value } = this.form.getRawValue();
      const socials = Object.fromEntries(
        Object.entries({ instagram, facebook, tiktok, website })
          .map(([key, url]) => [key, url.trim()])
          .filter(([, url]) => url),
      );
      const updated = await this.api.updateBusiness(business.id, {
        name: value.name.trim(),
        slug: value.slug,
        description: value.description.trim() || null,
        primary_color: value.primary_color,
        secondary_color: value.secondary_color,
        currency: value.currency,
        whatsapp: value.whatsapp.replace(/\D/g, '') || null,
        phone: value.phone.trim() || null,
        email: value.email.trim() || null,
        address: value.address.trim() || null,
        schedule: value.schedule.trim() || null,
        socials,
        logo_path: logoPath,
      });

      if (logoPath !== business.logo_path && business.logo_path) {
        await this.api.removeImages([business.logo_path]);
      }
      this.current.business.set(updated);
      this.saved.set(true);
    } catch (e) {
      if (uploadedLogo) await this.api.removeImages([uploadedLogo]);
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  private revokePreview(): void {
    if (this.logoChange) URL.revokeObjectURL(this.logoUrl()!);
  }
}
