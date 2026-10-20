import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="auth-page">
      <section class="card auth-card">
        <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
        <h1>Página no encontrada</h1>
        <p class="muted">Revisa el enlace: esta dirección no existe.</p>
        <a class="button" routerLink="/">Ir al inicio</a>
      </section>
    </main>
  `,
})
export class NotFound {}
