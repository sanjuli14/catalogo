import { Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Auth, homeFor } from '../../core/auth';
import { Turnstile, captchaEnabled } from '../../shared/turnstile';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Turnstile],
  template: `
    <main class="auth-page">
      <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
        <h1>Iniciar sesión</h1>

        @if (auth.profileError()) {
          <p class="alert">No pudimos cargar tu cuenta. Revisa tu conexión e inténtalo de nuevo.</p>
        } @else if (auth.session() && !auth.profile()) {
          <p class="alert">
            Tu cuenta todavía no tiene un negocio.
            <a routerLink="/registro">Termina de crearlo aquí</a>.
          </p>
        }

        <label class="field">
          <span>Correo</span>
          <input type="email" formControlName="email" autocomplete="email" />
        </label>

        <label class="field">
          <span>Contraseña</span>
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
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>

        <p class="muted">¿No tienes cuenta? <a routerLink="/registro">Crea tu catálogo</a></p>
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
    this.loading.set(false);
    if (error) {
      // El token ya se usó: hace falta uno nuevo para reintentar.
      this.captcha()?.reset();
      this.error.set(error);
      return;
    }

    // Entró, pero no se pudo leer su perfil: la alerta de arriba lo explica.
    if (this.auth.profileError()) return;

    // Sin perfil: se registró pero aún no creó su negocio.
    const profile = this.auth.profile();
    await this.router.navigateByUrl(profile ? homeFor(profile.role) : '/registro');
  }
}
