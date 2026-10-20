import { Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { Auth, homeFor } from '../../core/auth';
import { Icon } from '../../shared/icon';
import { LangSwitch } from '../../shared/lang-switch';
import { Turnstile, captchaEnabled } from '../../shared/turnstile';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Turnstile, Icon, TranslocoDirective, LangSwitch],
  template: `
    <main class="auth-page" *transloco="let t">
      <!-- Tile de marca: solo en computadora (en el celular se ve solo el formulario). -->
      <aside class="auth-brand">
        <a class="auth-brand__top" routerLink="/">
          <img src="icono/icono.png" alt="" width="36" height="36" /> {{ t('common.appName') }}
        </a>
        <h2>{{ t('login.brandTitle') }}</h2>
        <ul class="auth-brand__list">
          <li><app-icon name="whatsapp" [size]="20" /> {{ t('brand.whatsapp') }}</li>
          <li><app-icon name="sparkles" [size]="20" /> {{ t('brand.colors') }}</li>
          <li><app-icon name="download" [size]="20" /> {{ t('brand.pdf') }}</li>
        </ul>
      </aside>
      <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
        <h1>{{ t('login.title') }}</h1>

        @if (auth.profileError()) {
          <p class="alert">{{ t('login.profileError') }}</p>
        } @else if (auth.session() && !auth.profile()) {
          <p class="alert">
            {{ t('login.noBusiness') }}
            <a routerLink="/registro">{{ t('login.finishHere') }}</a
            >.
          </p>
        }

        <label class="field">
          <span>{{ t('common.email') }}</span>
          <input type="email" formControlName="email" autocomplete="email" />
        </label>

        <label class="field">
          <span>{{ t('common.password') }}</span>
          <input type="password" formControlName="password" autocomplete="current-password" />
        </label>

        @if (error()) {
          <p class="alert">{{ error() }}</p>
        }

        @if (captchaEnabled) {
          <app-turnstile (token)="captchaToken.set($event)" />
        }

        <button
          type="submit"
          class="button"
          [disabled]="form.invalid || loading() || (captchaEnabled && !captchaToken())"
        >
          {{ loading() ? t('login.submitting') : t('login.submit') }}
        </button>

        <p class="muted">
          <a routerLink="/recuperar">{{ t('login.forgot') }}</a>
        </p>
        <p class="muted">
          {{ t('login.noAccount') }} <a routerLink="/registro">{{ t('login.createCatalog') }}</a>
        </p>
        <app-lang-switch />
      </form>
    </main>
  `,
})
export class Login {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly captchaEnabled = captchaEnabled;
  protected readonly captchaToken = signal<string | null>(null);
  private readonly captcha = viewChild(Turnstile);

  protected async submit(): Promise<void> {
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    const error = await this.auth.signIn(email, password, this.captchaToken() ?? undefined);
    if (error) {
      // El token ya se usó: hace falta uno nuevo para reintentar.
      this.captcha()?.reset();
      this.error.set(error);
      this.loading.set(false);
      return;
    }

    // Entró, pero no se pudo leer su perfil: la alerta de arriba lo explica.
    if (this.auth.profileError()) {
      this.loading.set(false);
      return;
    }

    // Sin perfil: se registró pero aún no creó su negocio.
    // "Entrando…" sigue visible hasta que termina de abrir el panel.
    const profile = this.auth.profile();
    await this.router.navigateByUrl(profile ? homeFor(profile.role) : '/registro');
    this.loading.set(false);
  }
}
