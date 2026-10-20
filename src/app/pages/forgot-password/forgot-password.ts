import { Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { Auth } from '../../core/auth';
import { errorMessage } from '../../core/format';
import { LangSwitch } from '../../shared/lang-switch';
import { Turnstile, captchaEnabled } from '../../shared/turnstile';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, Turnstile, TranslocoDirective, LangSwitch],
  template: `
    <main class="auth-page" *transloco="let t">
      @if (sent()) {
        <section class="card auth-card">
          <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
          <h1>{{ t('forgot.sentTitle') }}</h1>
          <p>
            {{ t('forgot.sentBefore') }} <strong>{{ form.controls.email.value }}</strong>
            {{ t('forgot.sentAfter') }}
          </p>
          <a class="button button--ghost" routerLink="/login">{{ t('common.backToLogin') }}</a>
        </section>
      } @else {
        <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
          <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
          <h1>{{ t('forgot.title') }}</h1>
          <p class="muted">{{ t('forgot.lead') }}</p>

          <label class="field">
            <span>{{ t('common.email') }}</span>
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
            {{ busy() ? t('forgot.sending') : t('forgot.send') }}
          </button>

          <p class="muted">
            <a routerLink="/login">{{ t('common.backToLogin') }}</a>
          </p>
          <app-lang-switch />
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
