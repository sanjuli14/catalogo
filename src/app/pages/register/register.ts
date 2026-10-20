import { Component, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Auth } from '../../core/auth';
import { errorMessage } from '../../core/format';
import { SLUG_PATTERN, toSlug } from '../../core/slug';
import { Turnstile, captchaEnabled } from '../../shared/turnstile';

/**
 * account: datos de la cuenta y del negocio.
 * check-email: la cuenta se creó y falta confirmar el correo.
 * business: ya tiene sesión pero no negocio (volvió del correo y no se pudo crear solo).
 */
type Step = 'loading' | 'account' | 'check-email' | 'business';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, Turnstile],
  template: `
    <main class="auth-page">
      @switch (step()) {
        @case ('loading') {
          <p class="muted">Cargando…</p>
        }
        @case ('check-email') {
          <section class="card auth-card">
            <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
            <h1>Revisa tu correo</h1>
            <p>
              Te enviamos un enlace a <strong>{{ form.controls.email.value }}</strong> para
              confirmar tu cuenta. Al abrirlo terminamos de crear tu negocio.
            </p>
          </section>
        }
        @default {
          <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
            <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
            <h1>{{ step() === 'business' ? 'Crea tu negocio' : 'Crea tu catálogo' }}</h1>

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
              @if (form.controls.slug.touched && form.controls.slug.invalid) {
                <small class="error-text">
                  De 3 a 50 caracteres: minúsculas, números y guiones.
                </small>
              }
            </label>

            @if (step() === 'account') {
              <label class="field">
                <span>Correo</span>
                <input type="email" formControlName="email" autocomplete="email" />
              </label>

              <label class="field">
                <span>Contraseña</span>
                <input type="password" formControlName="password" autocomplete="new-password" />
                <small>Al menos 8 caracteres.</small>
              </label>

              @if (captchaEnabled) {
                <app-turnstile (token)="captchaToken.set($event)" />
              }
            }

            @if (error(); as error) {
              <p class="alert">{{ error }}</p>
            }

            <button
              type="submit"
              class="button"
              [disabled]="form.invalid || busy() || (needsCaptcha() && !captchaToken())"
            >
              {{ busy() ? 'Creando…' : 'Crear' }}
            </button>

            <p class="muted">
              Tu catálogo quedará en revisión hasta que lo aprobemos. Mientras tanto ya puedes
              cargar tus productos.
            </p>

            @if (step() === 'account') {
              <p class="muted">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
            }
          </form>
        }
      }
    </main>
  `,
})
export class Register {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly origin = location.origin;
  protected readonly step = signal<Step>('loading');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly captchaEnabled = captchaEnabled;
  protected readonly captchaToken = signal<string | null>(null);
  private readonly captcha = viewChild(Turnstile);
  /** Mientras el usuario no toque la dirección, se genera a partir del nombre. */
  protected slugEdited = false;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    slug: ['', [Validators.required, Validators.minLength(3), Validators.pattern(SLUG_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.form.controls.name.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      if (!this.slugEdited) this.form.controls.slug.setValue(toSlug(name));
    });
    void this.init();
  }

  private async init(): Promise<void> {
    await this.auth.ready;
    const session = this.auth.session();
    if (!session) {
      this.step.set('account');
      return;
    }

    // Tiene sesión pero no negocio (si lo tuviera, el guard lo habría mandado a su panel).
    this.form.controls.email.disable();
    this.form.controls.password.disable();
    const { business_name, business_slug } = session.user.user_metadata;
    if (business_name && business_slug) {
      this.slugEdited = true;
      this.form.patchValue({ name: business_name, slug: business_slug });
      await this.finish();
    } else {
      this.step.set('business');
    }
  }

  protected async submit(): Promise<void> {
    const { slug } = this.form.controls;
    slug.setValue(toSlug(slug.value));
    this.busy.set(true);
    this.error.set(null);
    try {
      if (!(await this.auth.slugAvailable(slug.value))) {
        this.error.set('Esa dirección web ya está en uso. Elige otra.');
        return;
      }
      if (this.step() === 'business') {
        await this.finish();
        return;
      }

      const { name, email, password } = this.form.getRawValue();
      const hasSession = await this.auth.signUp(
        email.trim(),
        password,
        { name: name.trim(), slug: slug.value },
        this.captchaToken() ?? undefined,
      );
      if (hasSession) {
        await this.finish();
      } else {
        this.step.set('check-email');
      }
    } catch (e) {
      this.error.set(errorMessage(e));
      // El token ya se usó: hace falta uno nuevo para reintentar.
      this.captcha()?.reset();
    } finally {
      this.busy.set(false);
    }
  }

  /** El captcha solo se pide al crear la cuenta, no al completar el negocio con sesión. */
  protected needsCaptcha(): boolean {
    return captchaEnabled && this.step() === 'account';
  }

  /** Crea el negocio del usuario con sesión y lo lleva a su panel. */
  private async finish(): Promise<void> {
    const { name, slug } = this.form.getRawValue();
    try {
      await this.auth.registerBusiness({ name: name.trim(), slug });
      await this.router.navigateByUrl('/admin');
    } catch (e) {
      this.error.set(errorMessage(e));
      this.step.set('business');
    }
  }
}
