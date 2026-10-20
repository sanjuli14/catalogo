import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { environment } from '../../environments/environment';

/** Hay captcha solo si se configuró TURNSTILE_SITE_KEY. */
export const captchaEnabled = environment.turnstileSiteKey !== '';

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let script: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  script ??= new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    tag.async = true;
    tag.onload = () => resolve(window.turnstile!);
    tag.onerror = () => {
      script = undefined; // Permite reintentar si el componente se vuelve a crear.
      tag.remove();
      reject(new Error('No se pudo cargar el captcha'));
    };
    document.head.appendChild(tag);
  });
  return script;
}

/**
 * Captcha de Cloudflare Turnstile. Emite el token cuando la persona pasa la verificación
 * y null cuando caduca. Cada token sirve una sola vez: llama a reset() después de usarlo.
 */
@Component({
  selector: 'app-turnstile',
  template: `
    <div #widget></div>
    @if (failed()) {
      <p class="alert">
        No se pudo cargar la verificación de seguridad. Recarga la página o desactiva el bloqueador
        de anuncios para este sitio.
      </p>
    }
  `,
  host: { class: 'turnstile' },
})
export class Turnstile implements OnDestroy {
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('widget');
  private widgetId?: string;
  private destroyed = false;

  readonly token = output<string | null>();
  protected readonly failed = signal(false);

  constructor() {
    afterNextRender(async () => {
      let turnstile: TurnstileApi;
      try {
        turnstile = await loadTurnstile();
      } catch {
        this.failed.set(true);
        return;
      }
      // El formulario pudo cerrarse mientras cargaba el script.
      if (this.destroyed) return;

      this.widgetId = turnstile.render(this.container().nativeElement, {
        sitekey: environment.turnstileSiteKey,
        language: 'es',
        callback: (token: string) => {
          this.failed.set(false);
          this.token.emit(token);
        },
        'expired-callback': () => this.token.emit(null),
        // Por ejemplo, si el dominio no está en los Hostnames del widget en Cloudflare.
        'error-callback': () => {
          this.failed.set(true);
          this.token.emit(null);
        },
      });
    });
  }

  reset(): void {
    this.token.emit(null);
    if (this.widgetId) window.turnstile?.reset(this.widgetId);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId) window.turnstile?.remove(this.widgetId);
  }
}
