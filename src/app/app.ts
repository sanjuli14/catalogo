import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppManifest } from './core/app-manifest';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('catalogo');

  constructor() {
    // Desde el arranque: el navegador avisa una sola vez que se puede instalar la app.
    inject(AppManifest);
  }
}
