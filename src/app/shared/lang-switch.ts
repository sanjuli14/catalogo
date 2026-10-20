import { Component, computed, inject } from '@angular/core';

import { Lang, Language } from '../core/i18n';
import { Icon } from './icon';

/** Nombre de cada idioma escrito en ese mismo idioma: así lo reconoce quien no entiende el otro. */
const NAMES: Record<Lang, string> = { es: 'Español', en: 'English' };

/** Botón que cambia al otro idioma (español ↔ inglés). */
@Component({
  selector: 'app-lang-switch',
  imports: [Icon],
  template: `
    <button
      type="button"
      class="button button--ghost button--sm"
      [attr.lang]="next()"
      (click)="language.set(next())"
    >
      <app-icon name="globe" [size]="16" /> {{ names[next()] }}
    </button>
  `,
  host: { class: 'lang-switch' },
})
export class LangSwitch {
  protected readonly language = inject(Language);
  protected readonly names = NAMES;
  protected readonly next = computed<Lang>(() => (this.language.current() === 'es' ? 'en' : 'es'));
}
