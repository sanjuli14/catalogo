import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { LANGS, TranslocoHttpLoader, initialLang } from './core/i18n';

const lang = initialLang();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Al volver del detalle de un producto, el catálogo aparece donde se había dejado.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: [...LANGS],
        defaultLang: lang,
        fallbackLang: 'es',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // Las traducciones se cargan antes de mostrar la app: translate() ya funciona en el código.
    provideAppInitializer(() => {
      document.documentElement.lang = lang;
      return firstValueFrom(inject(TranslocoService).load(lang));
    }),
  ],
};
