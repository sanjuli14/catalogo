import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';

import { CustomerProfile } from '../../core/customer';
import { formatPrice } from '../../core/format';
import { Business, Item } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Cart, MAX_QUANTITY } from './cart';
import { PublicCatalog, cartOrderUrl, itemPrice, linesTotal, orderTotal } from './public-catalog';

/**
 * Pedido de varios productos y servicios: una barra flotante con el resumen y una hoja para
 * revisarlo y enviarlo por WhatsApp en un solo mensaje. Va dentro del catálogo y del detalle.
 */
@Component({
  selector: 'app-cart-sheet',
  imports: [Icon],
  template: `
    @if (lines().length) {
      <!-- Espacio al final de la página para que la barra no tape lo último. -->
      <div class="cart-spacer" aria-hidden="true"></div>
    }
    @if (lines().length && !cart.sheetOpen()) {
      <button
        type="button"
        class="cart-bar"
        [class.cart-bar--raised]="raised()"
        (click)="cart.sheetOpen.set(true)"
      >
        <span class="cart-bar__count">{{ count() }}</span>
        <span class="cart-bar__text">Ver mi pedido</span>
        @if (total(); as total) {
          <span class="cart-bar__total">{{ total }}</span>
        }
      </button>
    }

    <dialog
      #dialog
      class="sheet"
      aria-labelledby="cart-sheet-title"
      (cancel)="$event.preventDefault(); cart.sheetOpen.set(false)"
      (close)="cart.sheetOpen.set(false)"
    >
      <div class="sheet__body">
        <header class="sheet__head">
          <span class="sheet__icon"><app-icon name="bag" [size]="22" /></span>
          <button
            type="button"
            class="sheet__close"
            (click)="cart.sheetOpen.set(false)"
            aria-label="Cerrar"
          >
            <app-icon name="close" [size]="18" />
          </button>
        </header>

        <h2 id="cart-sheet-title" class="sheet__title">Tu pedido</h2>

        @if (!lines().length) {
          <p class="sheet__text">Todavía no agregaste nada. Toca «Añadir» en lo que te interese.</p>
        } @else {
          <ul class="lines">
            @for (line of lines(); track line.item.id) {
              <li class="line">
                @if (line.item.photos[0]; as photo) {
                  <img class="line__photo" [src]="imageUrl(photo)" alt="" />
                } @else {
                  <span class="line__photo line__photo--empty" aria-hidden="true">{{
                    line.item.name.charAt(0)
                  }}</span>
                }
                <div class="line__info">
                  <span class="line__name">{{ line.item.name }}</span>
                  <span class="line__price">
                    @if (line.item.kind === 'service') {
                      Servicio · {{ price(line.item) }}
                    } @else if (line.item.price !== null && line.quantity > 1) {
                      {{ price(line.item) }} c/u ·
                      <strong>{{ lineTotal(line.item, line.quantity) }}</strong>
                    } @else {
                      {{ price(line.item) }}
                    }
                  </span>
                  @if (line.item.kind === 'product') {
                    <div class="stepper">
                      <button
                        type="button"
                        (click)="cart.set(line.item, line.quantity - 1)"
                        [attr.aria-label]="line.quantity === 1 ? 'Quitar' : 'Uno menos'"
                      >
                        <app-icon [name]="line.quantity === 1 ? 'trash' : 'minus'" [size]="16" />
                      </button>
                      <output>{{ line.quantity }}</output>
                      <button
                        type="button"
                        (click)="cart.set(line.item, line.quantity + 1)"
                        [disabled]="line.quantity === maxQuantity"
                        aria-label="Uno más"
                      >
                        <app-icon name="plus" [size]="16" />
                      </button>
                    </div>
                  }
                </div>
                @if (line.item.kind === 'service') {
                  <button
                    type="button"
                    class="line__remove"
                    (click)="cart.set(line.item, 0)"
                    [attr.aria-label]="'Quitar ' + line.item.name"
                  >
                    <app-icon name="trash" [size]="16" />
                  </button>
                }
              </li>
            }
          </ul>

          <div class="summary">
            <span class="summary__label">Total</span>
            <span class="summary__value">{{ total() ?? 'A consultar' }}</span>
            @if (total() && hasUnpriced()) {
              <small class="summary__note">Más lo que tiene precio a consultar</small>
            }
          </div>

          <div class="customer">
            <app-icon name="pin" [size]="18" />
            @if (customer.data(); as c) {
              <span class="customer__text"
                >Tus datos: <strong>{{ c.name }}</strong> · {{ c.address }}</span
              >
              <button type="button" (click)="customer.edit()">Cambiar</button>
            } @else {
              <span class="customer__text">Agrega tu nombre y dirección al enviar.</span>
            }
          </div>

          @if (orderUrl(); as url) {
            <a
              class="sheet__primary"
              [href]="url"
              target="_blank"
              rel="noopener"
              (click)="customer.interceptOrder($event, orderUrl)"
            >
              <app-icon name="whatsapp" [size]="20" />
              Enviar pedido por WhatsApp
            </a>
          }
          <button type="button" class="sheet__skip" (click)="clear()">Vaciar el pedido</button>
        }
      </div>
    </dialog>
  `,
  styleUrl: './sheet.css',
  styles: `
    .cart-spacer {
      height: 84px;
    }

    /* Barra flotante con el resumen del pedido. */
    .cart-bar {
      font: inherit;
      position: fixed;
      left: 50%;
      bottom: calc(12px + env(safe-area-inset-bottom));
      z-index: 31;
      display: flex;
      gap: 12px;
      align-items: center;
      width: min(420px, 100% - 24px);
      min-height: 58px;
      padding: 8px 18px 8px 8px;
      border: none;
      border-radius: 20px;
      background: var(--brand);
      color: var(--on-brand);
      box-shadow: 0 18px 40px -16px rgb(13 11 20 / 0.55);
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transform: translateX(-50%);
      animation: cart-in 0.35s var(--ease);
    }

    /* En el catálogo del celular, encima de la barra de accesos rápidos. */
    .cart-bar--raised {
      bottom: calc(84px + env(safe-area-inset-bottom));
    }

    .cart-bar__count {
      display: grid;
      place-items: center;
      min-width: 42px;
      height: 42px;
      padding: 0 8px;
      border-radius: 14px;
      background: rgb(255 255 255 / 0.2);
      font-variant-numeric: tabular-nums;
    }

    .cart-bar__text {
      flex: 1;
      text-align: left;
    }

    .cart-bar__total {
      font-weight: 800;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .lines {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .line {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 18px;
    }

    .line__photo {
      flex: none;
      width: 64px;
      height: 64px;
      border-radius: 14px;
      background: var(--panel);
      object-fit: cover;
    }

    .line__photo--empty {
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 26px;
      font-weight: 800;
    }

    .line__info {
      display: grid;
      flex: 1;
      gap: 4px;
      min-width: 0;
    }

    .line__name {
      display: -webkit-box;
      overflow: hidden;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.25;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .line__price {
      color: var(--muted);
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }

    .line__price strong {
      color: var(--ink);
    }

    .stepper {
      display: flex;
      gap: 4px;
      align-items: center;
      margin-top: 4px;
    }

    .stepper button,
    .line__remove {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      color: var(--ink);
      cursor: pointer;
    }

    .stepper button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .line__remove {
      flex: none;
    }

    .stepper output {
      min-width: 32px;
      font-size: 17px;
      font-weight: 800;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 12px;
      align-items: baseline;
      justify-content: space-between;
      padding: 4px 2px 0;
    }

    .summary__label {
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .summary__value {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.04em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    .summary__note {
      flex-basis: 100%;
      color: var(--muted);
      font-size: 12.5px;
      text-align: right;
    }

    .customer {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 12px;
      border-radius: 16px;
      background: var(--panel);
      color: var(--ink-2);
      font-size: 14px;
      line-height: 1.35;
    }

    .customer > app-icon {
      flex: none;
      color: var(--muted);
    }

    .customer__text {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .customer button {
      font: inherit;
      flex: none;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }

    @media (min-width: 900px) {
      .cart-bar,
      .cart-bar--raised {
        bottom: 24px;
      }
    }

    @keyframes cart-in {
      from {
        opacity: 0;
        transform: translate(-50%, 16px);
      }
    }
  `,
})
export class CartSheet {
  protected readonly cart = inject(Cart);
  protected readonly customer = inject(CustomerProfile);
  private readonly catalog = inject(PublicCatalog);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly business = input.required<Business>();
  /** Productos del catálogo, para armar los renglones con sus datos actuales. */
  readonly items = input.required<Item[]>();
  /** Subir la barra (catálogo en el celular, donde abajo están los accesos rápidos). */
  readonly raised = input(false);

  protected readonly maxQuantity = MAX_QUANTITY;
  protected readonly lines = computed(() => this.cart.lines(this.business().id, this.items()));
  protected readonly count = computed(() => this.lines().reduce((n, l) => n + l.quantity, 0));
  protected readonly hasUnpriced = computed(() => this.lines().some((l) => l.item.price === null));
  protected readonly total = computed(() => {
    const total = linesTotal(this.lines());
    return total === null ? null : formatPrice(total, this.business().currency);
  });
  protected readonly orderUrl = computed(() =>
    cartOrderUrl(this.business(), this.lines(), this.customer.data()),
  );

  constructor() {
    // El estado de la hoja es global: si la página se destruye con la hoja abierta (por
    // ejemplo, con el botón atrás), no debe reabrirse sola en la página siguiente.
    inject(DestroyRef).onDestroy(() => this.cart.sheetOpen.set(false));
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.cart.sheetOpen() && !dialog.open) dialog.showModal();
      if (!this.cart.sheetOpen() && dialog.open) dialog.close();
    });
  }

  protected price(item: Item): string {
    return itemPrice(this.business(), item);
  }

  protected lineTotal(item: Item, quantity: number): string {
    return orderTotal(this.business(), item, quantity);
  }

  protected imageUrl(path: string): string {
    return this.catalog.imageUrl(path);
  }

  protected clear(): void {
    this.cart.clear(this.business().id);
    this.cart.sheetOpen.set(false);
  }
}
