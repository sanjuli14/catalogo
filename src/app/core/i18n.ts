import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Translation, TranslocoLoader, TranslocoService } from '@jsverse/transloco';

export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const STORAGE_KEY = 'catalogo.idioma';

/** Lee las traducciones de public/i18n/{lang}.json. */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`i18n/${lang}.json`);
  }
}

/** El idioma que eligió antes; si no, el del navegador (español si no es inglés). */
export function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Almacenamiento bloqueado: se usa el del navegador.
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

function isLang(value: unknown): value is Lang {
  return LANGS.includes(value as Lang);
}

/** Idioma activo como signal, para los textos que se arman en el código (computed). */
@Injectable({ providedIn: 'root' })
export class Language {
  private readonly transloco = inject(TranslocoService);

  readonly current = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  set(lang: Lang): void {
    this.transloco.setActiveLang(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Sin almacenamiento: el idioma dura solo esta visita.
    }
  }
}
