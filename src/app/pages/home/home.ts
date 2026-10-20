import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Auth, homeFor } from '../../core/auth';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <main class="auth-page">
      <section class="card auth-card home">
        <img class="auth-card__logo" src="icono/icono.png" alt="" width="72" height="72" />
        <h1>Tu catálogo en un enlace</h1>
        <p class="muted">
          Crea el catálogo de tu negocio, compártelo por WhatsApp y recibe pedidos con un toque.
        </p>

        @if (auth.profile(); as profile) {
          <a class="button" [routerLink]="homeFor(profile.role)">Ir a mi panel</a>
        } @else {
          <a class="button" routerLink="/registro">Crear mi catálogo</a>
          <a class="button button--ghost" routerLink="/login">Iniciar sesión</a>
        }
      </section>
    </main>
  `,
})
export class Home {
  protected readonly auth = inject(Auth);
  protected readonly homeFor = homeFor;
}
