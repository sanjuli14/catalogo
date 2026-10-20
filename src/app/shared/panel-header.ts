import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { Auth } from '../core/auth';

@Component({
  selector: 'app-panel-header',
  template: `
    <header class="panel-header">
      <div class="panel-header__brand">
        <img src="icono/icono.png" alt="" width="36" height="36" />
        <h1>{{ title() }}</h1>
      </div>
      <div class="panel-header__user">
        <span>{{ auth.session()?.user?.email }}</span>
        <button type="button" class="button button--ghost" (click)="signOut()">Cerrar sesión</button>
      </div>
    </header>
  `,
})
export class PanelHeader {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly title = input.required<string>();

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
