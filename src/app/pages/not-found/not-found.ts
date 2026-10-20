import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslocoDirective],
  template: `
    <main class="auth-page" *transloco="let t">
      <section class="card auth-card">
        <img class="auth-card__logo" src="icono/icono.png" alt="" width="56" height="56" />
        <h1>{{ t('notFound.title') }}</h1>
        <p class="muted">{{ t('notFound.text') }}</p>
        <a class="button" routerLink="/">{{ t('notFound.home') }}</a>
      </section>
    </main>
  `,
})
export class NotFound {}
