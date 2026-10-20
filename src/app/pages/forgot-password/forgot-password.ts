import { Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Auth } from '../../core/auth';
import { errorMessage } from '../../core/format';
import { Turnstile, captchaEnabled } from '../../shared/turnstile';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, Turnstile],
  template: `
    <main class="auth-page">
      @if (sent()) {
        <section class="card auth-card">
          <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
          <h1>Revisa tu correo</h1>
          <p>
            Si <strong>{{ form.controls.email.value }}</strong> tiene una cuenta, te llegará un
            enlace para elegir una contraseña nueva.
          </p>
          <a class="button button--ghost" routerLink="/login">Volver al inicio de sesión</a>
        </section>
      } @else {
        <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
          <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
          <h1>Recuperar contraseña</h1>
          <p class="muted">Te enviaremos un enlace para elegir una contraseña nueva.</p>

          <label class="field">
            <span>Correo</span>
            <input type="email" formControlName="email" autocomplete="email" />
          </label>

          @if (captchaEnabled) {
            <app-turnstile (token)="captchaToken.set($event)" />
          }

          @if (error(); as error) {
            <p class="alert">{{ error }}</p>
          }

          <button
            type="submit"
            class="button"
            [disabled]="form.invalid || busy() || (captchaEnabled && !captchaToken())"
          >
            {{ busy() ? 'Enviando…' : 'Enviar enlace' }}
          </button>

          <p class="muted"><a routerLink="/login">Volver al inicio de sesión</a></p>
        </form>
      }
    </main>
  `,
})
export class ForgotPassword {
  private readonly auth = inject(Auth);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly captchaEnabled = captchaEnabled;
  protected readonly captchaToken = signal<string | null>(null);
  private readonly captcha = viewChild(Turnstile);

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.sendPasswordReset(
        this.form.controls.email.value.trim(),
        this.captchaToken() ?? undefined,
      );
      this.sent.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
      // El token ya se usó: hace falta uno nuevo para reintentar.
      this.captcha()?.reset();
    } finally {
      this.busy.set(false);
    }
  }
}
