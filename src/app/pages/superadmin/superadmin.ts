import { Component } from '@angular/core';

import { PanelHeader } from '../../shared/panel-header';

@Component({
  selector: 'app-superadmin',
  imports: [PanelHeader],
  template: `
    <app-panel-header title="Panel del superadmin" />
    <main class="panel">
      <p>Aquí vas a gestionar los negocios de la plataforma.</p>
    </main>
  `,
})
export class Superadmin {}
