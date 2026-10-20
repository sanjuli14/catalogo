import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { PanelHeader } from '../../shared/panel-header';
import { CurrentBusiness } from './current-business';

@Component({
  selector: 'app-admin',
  imports: [PanelHeader, RouterLink, RouterLinkActive, RouterOutlet],
  providers: [CurrentBusiness],
  template: `
    <app-panel-header [title]="current.business()?.name ?? 'Panel del negocio'" />
    @if (current.managedBySuperadmin) {
      <p class="superadmin-bar">
        Estás administrando este negocio como superadmin.
        <a routerLink="/superadmin">← Todos los negocios</a>
      </p>
    }

    @if (!current.id()) {
      <main class="panel">
        <p class="alert">
          Tu cuenta todavía no tiene un negocio asignado. Pide al administrador de la plataforma que
          te asigne uno.
        </p>
      </main>
    } @else {
      <nav class="tabs" aria-label="Secciones del panel">
        <a routerLink="productos" routerLinkActive="is-active">Productos y servicios</a>
        <a routerLink="categorias" routerLinkActive="is-active">Categorías</a>
        <a routerLink="negocio" routerLinkActive="is-active">Mi negocio</a>
        @if (current.business(); as business) {
          <a class="tabs__external" [href]="'/' + business.slug" target="_blank" rel="noopener">
            Ver mi catálogo ↗
          </a>
        }
      </nav>

      <main class="panel">
        @if (current.business()?.status === 'pending') {
          <p class="notice">
            Tu catálogo está en revisión. Ya puedes cargar tus productos; el público lo verá en
            cuanto lo aprobemos.
          </p>
        }
        @if (current.business()?.status === 'suspended') {
          <p class="alert">
            Tu catálogo está suspendido: el público no lo puede ver. Contacta al administrador.
          </p>
        }
        @if (current.error(); as error) {
          <p class="alert">{{ error }}</p>
        }
        <router-outlet />
      </main>
    }
  `,
})
export class Admin {
  protected readonly current = inject(CurrentBusiness);
}
