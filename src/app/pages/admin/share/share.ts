import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage } from '../../../core/format';
import { renderQr } from '../../../core/qr';
import { Icon } from '../../../shared/icon';
import { CurrentBusiness } from '../current-business';
import { downloadQrPoster } from './qr-poster';

/** Enlace del catálogo y su código QR, para compartir o imprimir y pegar en el local. */
@Component({
  selector: 'app-share',
  imports: [Icon, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <section class="section-header">
        <div>
          <h2>{{ t('share.title') }}</h2>
          <p class="muted">{{ t('share.lead') }}</p>
        </div>
      </section>

      @if (current.business()?.status !== 'active') {
        <p class="notice">{{ t('share.notPublic') }}</p>
      }
      @if (error(); as error) {
        <p class="alert">{{ error }}</p>
      }

      <div class="share-board">
        <section class="card share-qr">
          <span class="kicker">{{ t('share.qr') }}</span>
          <div class="share-qr__frame">
            @if (qrUrl(); as src) {
              <img [src]="src" [alt]="t('share.qrAlt', { url: url() })" width="280" height="280" />
            } @else {
              <span class="muted">{{ t('common.loading') }}</span>
            }
          </div>
          <div class="share-actions">
            <button type="button" class="button" [disabled]="!qrUrl()" (click)="downloadPng()">
              <app-icon name="download" [size]="18" /> {{ t('share.downloadPng') }}
            </button>
            <button
              type="button"
              class="button button--ghost"
              [disabled]="!qrUrl() || busy()"
              (click)="downloadPoster()"
            >
              <app-icon name="download" [size]="18" />
              {{ busy() ? t('share.generating') : t('share.downloadPoster') }}
            </button>
          </div>
          <small class="muted">{{ t('share.qrHint') }}</small>
        </section>

        <section class="card share-link">
          <span class="kicker">{{ t('share.link') }}</span>
          <p class="share-link__url">{{ url() }}</p>
          <div class="share-actions">
            <button type="button" class="button" (click)="copy()">
              <app-icon [name]="copied() ? 'check' : 'share'" [size]="18" />
              {{ copied() ? t('share.copied') : t('share.copy') }}
            </button>
            <a class="button button--ghost" [href]="url()" target="_blank" rel="noopener">
              {{ t('admin.viewCatalog') }} <app-icon name="arrowUpRight" [size]="18" />
            </a>
          </div>
          <small class="muted">{{ t('share.linkHint') }}</small>
        </section>
      </div>
    </ng-container>
  `,
  styles: `
    .share-board {
      display: grid;
      gap: var(--gap);
    }

    .share-qr,
    .share-link {
      display: grid;
      align-content: start;
      gap: 16px;
    }

    .share-qr__frame {
      display: grid;
      place-items: center;
      min-height: 280px;
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: 20px;
      background: #ffffff;
    }

    .share-qr__frame img {
      width: min(280px, 100%);
      height: auto;
    }

    .share-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .share-link__url {
      margin: 0;
      font-size: clamp(20px, 5vw, 28px);
      font-weight: 800;
      letter-spacing: -0.03em;
      overflow-wrap: anywhere;
    }

    @media (min-width: 900px) {
      .share-board {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
    }
  `,
})
export class Share {
  protected readonly current = inject(CurrentBusiness);
  private readonly api = inject(CatalogApi);

  protected readonly url = computed(
    () => `${location.origin}/${this.current.business()?.slug ?? ''}`,
  );
  protected readonly qrUrl = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly copied = signal(false);
  protected readonly error = signal<string | null>(null);
  private qr: HTMLCanvasElement | null = null;

  constructor() {
    // Se rehace si cambian el enlace, el color o el logo del negocio.
    effect(() => {
      const business = this.current.business();
      if (!business) return;
      const logoUrl = business.logo_path ? this.api.imageUrl(business.logo_path) : null;
      void this.render(this.url(), business.primary_color, logoUrl);
    });
  }

  protected downloadPng(): void {
    const link = document.createElement('a');
    link.href = this.qrUrl()!;
    link.download = `${this.current.business()!.slug}-qr.png`;
    link.click();
  }

  protected async downloadPoster(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await downloadQrPoster(this.current.business()!, this.qr!, this.url());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.url());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  private async render(url: string, color: string, logoUrl: string | null): Promise<void> {
    try {
      this.qr = await renderQr(url, { color, logoUrl });
      this.qrUrl.set(this.qr.toDataURL('image/png'));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
