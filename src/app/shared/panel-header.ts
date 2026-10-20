import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { Auth } from '../core/auth';
import { Icon } from './icon';
import { LangSwitch } from './lang-switch';

@Component({
  selector: 'app-panel-header',
  imports: [Icon, TranslocoDirective, LangSwitch],
  template: `
    <header class="panel-header" *transloco="let t">
      <div class="panel-header__brand">
        <img src="icono/icono.png" alt="" width="36" height="36" />
        <h1>{{ title() }}</h1>
      </div>
      <div class="panel-header__user">
        <span class="panel-header__email">{{ auth.session()?.user?.email }}</span>
        <app-lang-switch />
        <button type="button" class="button button--ghost button--sm" (click)="signOut()">
          <app-icon name="logout" [size]="16" /> {{ t('panelHeader.signOut') }}
        </button>
      </div>
    </header>
  `,
})
export class PanelHeader {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly title = input.required<string>();

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
