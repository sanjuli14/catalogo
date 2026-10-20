import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Auth, homeFor } from '../../core/auth';
import { errorMessage } from '../../core/format';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password === confirm ? null : { mismatch: true };
}

/**
 * Llega desde el correo de invitación (dueño nuevo) o de recuperación de contraseña.
 * Supabase inicia la sesión con el enlace; aquí la persona elige su contraseña.
 */
@Component({
  selector: 'app-set-password',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth-page">
      @if (!ready()) {
        <p class="muted">Cargando…</p>
      } @else if (!auth.session()) {
        <section class="card auth-card">
          <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
          <h1>El enlace no es válido</h1>
          <p class="muted">
            Puede que haya vencido o que ya se haya usado. Pide uno nuevo para elegir tu contraseña.
          </p>
          <a class="button" routerLink="/recuperar">Pedir un enlace nuevo</a>
        </section>
      } @else {
        <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
          <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
          <h1>Elige tu contraseña</h1>
          <p class="muted">Para {{ auth.session()?.user?.email }}</p>

          <label class="field">
            <span>Contraseña nueva</span>
            <input type="password" formControlName="password" autocomplete="new-password" />
            <small>Al menos 8 caracteres.</small>
          </label>

          <label class="field">
            <span>Repite la contraseña</span>
            <input type="password" formControlName="confirm" autocomplete="new-password" />
            @if (form.hasError('mismatch') && form.controls.confirm.touched) {
              <small class="error-text">Las contraseñas no coinciden.</small>
            }
          </label>

          @if (error(); as error) {
            <p class="alert">{{ error }}</p>
          }

          <button type="submit" class="button" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Guardando…' : 'Guardar y entrar' }}
          </button>
        </form>
      }
    </main>
  `,
})
export class SetPassword {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    // Espera a que Supabase lea la sesión que viene en el enlace del correo.
    void this.auth.ready.then(() => this.ready.set(true));
  }

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.updatePassword(this.form.controls.password.value);
      const profile = this.auth.profile();
      await this.router.navigateByUrl(profile ? homeFor(profile.role) : '/registro');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
