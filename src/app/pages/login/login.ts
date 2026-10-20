import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { Auth, homeFor } from '../../core/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <main class="auth-page">
      <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
        <h1>Iniciar sesión</h1>

        @if (auth.session() && !auth.profile()) {
          <p class="alert">
            Tu cuenta no tiene acceso a ningún panel. Pide al administrador que te asigne un negocio.
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

        <button type="submit" class="button" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>
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

  protected async submit(): Promise<void> {
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    const error = await this.auth.signIn(email, password);
    this.loading.set(false);
    if (error) {
      this.error.set(error);
      return;
    }

    const profile = this.auth.profile();
    if (profile) await this.router.navigateByUrl(homeFor(profile.role));
  }
}
