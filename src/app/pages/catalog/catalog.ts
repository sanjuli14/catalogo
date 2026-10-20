import { Component, input } from '@angular/core';

@Component({
  selector: 'app-catalog',
  template: `<h1>Catálogo: {{ slug() }}</h1>`,
})
export class Catalog {
  readonly slug = input.required<string>();
}
