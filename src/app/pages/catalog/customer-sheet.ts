import { Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import { CustomerProfile } from '../../core/customer';
import { Icon } from '../../shared/icon';

/**
 * Hoja para que el cliente escriba quién es y dónde está. Se abre al llegar al catálogo
 * (si todavía no la llenó) y al pedir sin datos. Va dentro del catálogo para heredar su color.
 */
@Component({
  selector: 'app-customer-sheet',
  imports: [ReactiveFormsModule, Icon, TranslocoDirective],
  template: `
    <dialog
      #dialog
      class="sheet"
      aria-labelledby="customer-sheet-title"
      (cancel)="$event.preventDefault(); customer.dismiss()"
      (close)="customer.closedByBrowser()"
    >
      <form class="sheet__body" [formGroup]="form" (ngSubmit)="save()" *transloco="let t">
        <header class="sheet__head">
          <span class="sheet__icon"><app-icon name="pin" [size]="22" /></span>
          <button
            type="button"
            class="sheet__close"
            (click)="customer.dismiss()"
            [attr.aria-label]="t('common.close')"
          >
            <app-icon name="close" [size]="18" />
          </button>
        </header>

        <h2 id="customer-sheet-title" class="sheet__title">{{ t('customer.title') }}</h2>
        <p class="sheet__text">{{ t('customer.text', { name: businessName() }) }}</p>
        @if (customer.forOrder()) {
          <p class="sheet__hint">{{ t('customer.hint') }}</p>
        }

        <label class="field">
          <span>{{ t('customer.name') }}</span>
          <input
            formControlName="name"
            autocomplete="name"
            [placeholder]="t('customer.namePlaceholder')"
          />
        </label>
        <label class="field">
          <span>{{ t('customer.address') }}</span>
          <textarea
            formControlName="address"
            rows="2"
            autocomplete="street-address"
            [placeholder]="t('customer.addressPlaceholder')"
          ></textarea>
        </label>
        <label class="field">
          <span
            >{{ t('customer.reference') }} <small>({{ t('customer.optional') }})</small></span
          >
          <input formControlName="reference" [placeholder]="t('customer.referencePlaceholder')" />
        </label>

        <button type="submit" class="sheet__primary" [disabled]="form.invalid">
          {{ t('customer.save') }}
        </button>
        <button type="button" class="sheet__skip" (click)="customer.dismiss()">
          {{ t('customer.skip') }}
        </button>
      </form>
    </dialog>
  `,
  styleUrl: './sheet.css',
  styles: `
    .sheet__hint {
      margin: -4px 0 4px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--brand-soft);
      color: var(--ink);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
    }

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
