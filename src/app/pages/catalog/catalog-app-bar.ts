import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AppManifest } from '../../core/app-manifest';
import { Business } from '../../core/models';
import { Icon } from '../../shared/icon';

/**
 * Barra fija arriba del catálogo y del detalle: logo y nombre del negocio, y a la derecha
 * "Instalar" (si el navegador lo ofrece) y las acciones que pase la página (<ng-content>).
 * Sin encapsulación: así .appbar__btn también da estilo a los botones que pasa la página.
 * Todos los selectores van bajo app-catalog-app-bar para no afectar al resto.
 */
@Component({
  selector: 'app-catalog-app-bar',
  imports: [RouterLink, Icon, TranslocoDirective],
  template: `
    <header class="appbar" *transloco="let t">
      <div class="appbar__inner" [class.shell--wide]="wide()">
        @if (back()) {
          <a
            class="appbar__btn"
            [routerLink]="['/', business().slug]"
            [attr.aria-label]="t('product.back')"
          >
            <app-icon name="arrowLeft" [size]="20" />
          </a>
        }
        <a class="appbar__brand" [routerLink]="['/', business().slug]">
          @if (logoUrl(); as logo) {
            <img class="appbar__logo" [src]="logo" alt="" />
          } @else {
            <span class="appbar__logo appbar__logo--initial" aria-hidden="true">{{
              business().name.charAt(0)
            }}</span>
          }
          <span class="appbar__name">{{ business().name }}</span>
        </a>
        <div class="appbar__actions">
          @if (manifest.canInstall()) {
            <button type="button" class="appbar__install" (click)="manifest.install()">
              <app-icon name="download" [size]="16" />
              <span>{{ t('appBar.install') }}</span>
            </button>
          }
          <ng-content />
        </div>
      </div>
    </header>
  `,
  styles: `
    app-catalog-app-bar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: block;
    }

    app-catalog-app-bar .appbar {
      border-bottom: 1px solid var(--border);
      background: color-mix(in oklab, var(--canvas) 88%, transparent);
      backdrop-filter: saturate(180%) blur(18px);
    }

    app-catalog-app-bar .appbar__inner {
      display: flex;
      gap: 10px;
      align-items: center;
      width: 100%;
      max-width: 1200px;
      height: var(--appbar-height);
      margin: 0 auto;
      padding: 0 16px;
    }

    app-catalog-app-bar .appbar__inner.shell--wide {
      max-width: none;
    }

    app-catalog-app-bar .appbar__brand {
      display: flex;
      flex: 1;
      gap: 12px;
      align-items: center;
      min-width: 0;
      color: var(--ink);
      text-decoration: none;
    }

    app-catalog-app-bar .appbar__logo {
      flex: none;
      width: 40px;
      height: 40px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      object-fit: contain;
    }

    app-catalog-app-bar .appbar__logo--initial {
      display: grid;
      place-items: center;
      border-color: transparent;
      background: var(--brand);
      color: var(--on-brand);
      font-size: 19px;
      font-weight: 800;
    }

    app-catalog-app-bar .appbar__name {
      overflow: hidden;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.03em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    app-catalog-app-bar .appbar__actions {
      display: flex;
      flex: none;
      gap: 6px;
      align-items: center;
    }

    app-catalog-app-bar .appbar__btn {
      display: grid;
      flex: none;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      color: var(--ink);
      cursor: pointer;
    }

    app-catalog-app-bar .appbar__install {
      font: inherit;
      display: inline-flex;
      gap: 6px;
      align-items: center;
      height: 40px;
      padding: 0 14px;
      border: none;
      border-radius: 12px;
      background: var(--brand);
      color: var(--on-brand);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }

    /* En el celular, "Instalar" solo con el ícono para que el nombre tenga lugar. */
    @media (max-width: 479px) {
      app-catalog-app-bar .appbar__install span {
        display: none;
      }

      app-catalog-app-bar .appbar__install {
        width: 40px;
        justify-content: center;
        padding: 0;
      }
    }

    @media (min-width: 640px) {
      app-catalog-app-bar .appbar__inner {
        padding: 0 24px;
      }

      app-catalog-app-bar .appbar__name {
        font-size: 20px;
      }
    }

    @media (min-width: 900px) {
      app-catalog-app-bar .appbar__inner.shell--wide {
        padding: 0 32px;
      }
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class CatalogAppBar {
  protected readonly manifest = inject(AppManifest);

  readonly business = input.required<Business>();
  readonly logoUrl = input<string | null>(null);
  /** Flecha para volver al catálogo (en el detalle de un producto). */
  readonly back = input(false);
  /** A todo lo ancho de la pantalla, como el catálogo. */
  readonly wide = input(false);
}
