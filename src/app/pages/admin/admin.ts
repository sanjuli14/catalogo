import { Component } from '@angular/core';

import { PanelHeader } from '../../shared/panel-header';

@Component({
  selector: 'app-admin',
  imports: [PanelHeader],
  template: `
    <app-panel-header title="Panel del negocio" />
    <main class="panel">
      <p>Aquí vas a personalizar tu negocio y gestionar tus productos y servicios.</p>
    </main>
  `,
})
export class Admin {}
