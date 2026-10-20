import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Al volver del detalle de un producto, el catálogo aparece donde se había dejado.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
  ],
};
