import { Component, OnDestroy, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective, translate } from '@jsverse/transloco';

import { AppManifest } from '../../core/app-manifest';
import { CatalogApi } from '../../core/catalog-api';
import { Language } from '../../core/i18n';

import { Icon } from '../../shared/icon';
import { PanelHeader } from '../../shared/panel-header';
import { CurrentBusiness } from './current-business';

@Component({
  selector: 'app-admin',
  imports: [PanelHeader, RouterLink, RouterLinkActive, RouterOutlet, Icon, TranslocoDirective],
  providers: [CurrentBusiness],
  template: `
    <ng-container *transloco="let t">
      <app-panel-header [title]="current.business()?.name ?? t('admin.title')" />
      @if (current.managedBySuperadmin) {
        <p class="superadmin-bar">
          {{ t('admin.asSuperadmin') }}
          <a routerLink="/superadmin">← {{ t('admin.allBusinesses') }}</a>
        </p>
      }

      @if (!current.id()) {
        <main class="panel">
          <p class="alert">{{ t('admin.noBusiness') }}</p>
        </main>
      } @else {
        <nav class="tabs" [attr.aria-label]="t('admin.sections')">
          <a routerLink="productos" routerLinkActive="is-active">
            <app-icon name="bag" [size]="16" /> {{ t('admin.tabs.products')
            }}<span class="tabs__long">&nbsp;{{ t('admin.tabs.productsLong') }}</span>
          </a>
          <a routerLink="categorias" routerLinkActive="is-active">
            <app-icon name="layers" [size]="16" /> {{ t('admin.tabs.categories') }}
          </a>
          <a routerLink="estadisticas" routerLinkActive="is-active">
            <app-icon name="chart" [size]="16" /> {{ t('admin.tabs.stats') }}
          </a>
          <a routerLink="compartir" routerLinkActive="is-active">
            <app-icon name="share" [size]="16" /> {{ t('admin.tabs.share') }}
          </a>
          <a routerLink="negocio" routerLinkActive="is-active">
            <app-icon name="store" [size]="16" /> {{ t('admin.tabs.business') }}
          </a>
          @if (current.business(); as business) {
            <a class="tabs__external" [href]="'/' + business.slug" target="_blank" rel="noopener">
              {{ t('admin.viewCatalog') }} <app-icon name="arrowUpRight" [size]="16" />
            </a>
          }
        </nav>

        <main class="panel">
          @if (current.business()?.status === 'pending') {
            <p class="notice">{{ t('admin.pending') }}</p>
          }
          @if (current.business()?.status === 'suspended') {
            <p class="alert">{{ t('admin.suspended') }}</p>
          }
          @if (current.error(); as error) {
            <p class="alert">{{ error }}</p>
          }
          <router-outlet />
        </main>
      }
    </ng-container>
  `,
})
export class Admin implements OnDestroy {
  protected readonly current = inject(CurrentBusiness);
  private readonly manifest = inject(AppManifest);
  private readonly api = inject(CatalogApi);
  private readonly language = inject(Language);

  constructor() {
    // Instalado desde aquí, el panel del dueño queda como app con el logo de su negocio.
    // El superadmin administrando otro negocio sigue con la app de la plataforma.
    effect(() => {
      const business = this.current.business();
      this.language.current();
      if (!business || this.current.managedBySuperadmin) return;
      void this.manifest.use({
        name: translate('appBar.adminName', { name: business.name }),
        shortName: business.name,
        startPath: '/admin',
        color: business.primary_color,
        iconUrl: business.icon_path ? this.api.imageUrl(business.icon_path) : null,
        logoUrl: business.logo_path ? this.api.imageUrl(business.logo_path) : null,
      });
    });
  }

  ngOnDestroy(): void {
    this.manifest.reset();
  }
}
