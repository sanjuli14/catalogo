import { Component, ElementRef, OnDestroy, afterNextRender, inject, output } from '@angular/core';

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
    tag.onerror = () => reject(new Error('No se pudo cargar el captcha'));
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
  template: '',
  host: { class: 'turnstile' },
})
export class Turnstile implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private widgetId?: string;

  readonly token = output<string | null>();

  constructor() {
    afterNextRender(async () => {
      const turnstile = await loadTurnstile();
      this.widgetId = turnstile.render(this.element.nativeElement, {
        sitekey: environment.turnstileSiteKey,
        language: 'es',
        callback: (token: string) => this.token.emit(token),
        'expired-callback': () => this.token.emit(null),
        'error-callback': () => this.token.emit(null),
      });
    });
  }

  reset(): void {
    this.token.emit(null);
    if (this.widgetId) window.turnstile?.reset(this.widgetId);
  }

  ngOnDestroy(): void {
    if (this.widgetId) window.turnstile?.remove(this.widgetId);
  }
}
