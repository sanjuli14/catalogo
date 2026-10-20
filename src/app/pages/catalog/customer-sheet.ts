import { Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CustomerProfile } from '../../core/customer';
import { Icon } from '../../shared/icon';

/**
 * Hoja para que el cliente escriba quién es y dónde está. Se abre al llegar al catálogo
 * (si todavía no la llenó) y al pedir sin datos. Va dentro del catálogo para heredar su color.
 */
@Component({
  selector: 'app-customer-sheet',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <dialog
      #dialog
      class="sheet"
      aria-labelledby="customer-sheet-title"
      (cancel)="$event.preventDefault(); customer.cancel()"
      (close)="customer.closedByBrowser()"
    >
      <form class="sheet__body" [formGroup]="form" (ngSubmit)="save()">
        <header class="sheet__head">
          <span class="sheet__icon"><app-icon name="pin" [size]="22" /></span>
          <button
            type="button"
            class="sheet__close"
            (click)="customer.cancel()"
            aria-label="Cerrar"
          >
            <app-icon name="close" [size]="18" />
          </button>
        </header>

        <h2 id="customer-sheet-title" class="sheet__title">¿Quién nos escribe?</h2>
        <p class="sheet__text">
          Tu nombre y dirección van en el mensaje de WhatsApp, así {{ businessName() }} sabe quién
          eres y dónde estás sin tener que preguntarte. Se guardan solo en este teléfono.
        </p>

        <label class="field">
          <span>Tu nombre</span>
          <input formControlName="name" autocomplete="name" placeholder="Ej. María Pérez" />
        </label>
        <label class="field">
          <span>Tu dirección</span>
          <textarea
            formControlName="address"
            rows="2"
            autocomplete="street-address"
            placeholder="Calle, número, entre calles, barrio, municipio"
          ></textarea>
        </label>
        <label class="field">
          <span>Referencia <small>(opcional)</small></span>
          <input formControlName="reference" placeholder="Ej. cerca del parque, edificio azul" />
        </label>

        <button type="submit" class="sheet__primary" [disabled]="form.invalid">
          Guardar mis datos
        </button>
        <button type="button" class="sheet__skip" (click)="customer.dismiss()">Ahora no</button>
      </form>
    </dialog>
  `,
  styleUrl: './sheet.css',
  styles: `
    .field {
      display: grid;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
    }

    .field small {
      color: var(--muted);
      font-weight: 500;
    }

    .field :is(input, textarea) {
      font: inherit;
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: #ffffff;
      color: var(--ink);
      font-size: 16px;
      font-weight: 500;
      resize: vertical;
    }

    .field :is(input, textarea):focus {
      border-color: var(--ink);
      outline: none;
      box-shadow: 0 0 0 4px color-mix(in oklab, var(--brand) 16%, transparent);
    }
  `,
})
export class CustomerSheet {
  protected readonly customer = inject(CustomerProfile);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly businessName = input.required<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    address: ['', [Validators.required, Validators.pattern(/\S/)]],
    reference: [''],
  });

  constructor() {
    // El estado de la hoja es global: si la página se destruye con la hoja abierta (por
    // ejemplo, con el botón atrás), no debe reabrirse sola en la página siguiente.
    inject(DestroyRef).onDestroy(() => this.customer.sheetOpen.set(false));
    // Abre o cierra el <dialog> según el servicio; al abrir, con los datos guardados.
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.customer.sheetOpen()) {
        const saved = this.customer.data();
        this.form.reset(saved ?? { name: '', address: '', reference: '' });
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected save(): void {
    const { name, address, reference } = this.form.getRawValue();
    this.customer.save({ name: name.trim(), address: address.trim(), reference: reference.trim() });
  }
}
