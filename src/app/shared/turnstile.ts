import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

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

/** Turnstile reintenta solo tras un error; el aviso sale si falla esta cantidad de veces seguidas. */
const ERRORS_BEFORE_NOTICE = 3;

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
  imports: [TranslocoDirective],
  template: `
    <div #widget></div>
    @if (problem(); as problem) {
      <p class="alert" *transloco="let t">{{ t('turnstile.' + problem) }}</p>
    }
  `,
  host: { class: 'turnstile' },
})
export class Turnstile implements OnDestroy {
  private readonly transloco = inject(TranslocoService);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('widget');
  private widgetId?: string;
  private destroyed = false;
  private consecutiveErrors = 0;

  readonly token = output<string | null>();
  /** script: no cargó el script de Cloudflare. challenge: la verificación falla una y otra vez. */
  protected readonly problem = signal<'script' | 'challenge' | null>(null);

  constructor() {
    afterNextRender(async () => {
      let turnstile: TurnstileApi;
      try {
        turnstile = await loadTurnstile();
      } catch {
        this.problem.set('script');
        return;
      }
      // El formulario pudo cerrarse mientras cargaba el script.
      if (this.destroyed) return;

      this.widgetId = turnstile.render(this.container().nativeElement, {
        sitekey: environment.turnstileSiteKey,
        language: this.transloco.getActiveLang(),
        retry: 'auto',
        'retry-interval': 3000,
        callback: (token: string) => {
          this.consecutiveErrors = 0;
          this.problem.set(null);
          this.token.emit(token);
        },
        'expired-callback': () => this.token.emit(null),
        // Errores como el 600010 son pasajeros: Turnstile reintenta solo.
        'error-callback': () => {
          this.token.emit(null);
          this.consecutiveErrors++;
          if (this.consecutiveErrors >= ERRORS_BEFORE_NOTICE) this.problem.set('challenge');
          return true; // Error manejado: Turnstile no lo lanza como excepción.
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
