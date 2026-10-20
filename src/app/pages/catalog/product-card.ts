import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Business, Item } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Cart } from './cart';
import { PublicCatalog, itemPrice } from './public-catalog';

/** Tarjeta de un producto o servicio: abre su página y, si se puede, lo pide por WhatsApp. */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, Icon],
  template: `
    <article class="product" [class.is-unavailable]="!item().is_available">
      <a
        class="product__open"
        [routerLink]="['/', business().slug, item().id]"
        [attr.aria-label]="item().name"
      >
        <span class="product__media">
          @if (photo(); as photo) {
            <img [src]="photo" alt="" loading="lazy" />
          } @else {
            <span class="product__placeholder" aria-hidden="true">{{ item().name.charAt(0) }}</span>
          }
          @if (!item().is_available) {
            <span class="tag tag--dark">Agotado</span>
          } @else if (item().kind === 'service') {
            <span class="tag">Servicio</span>
          }
        </span>
        <span class="product__body">
          <!-- Solo se ve en los destacados (2×2), que marca la cuadrícula del catálogo. -->
          <span class="product__flag" aria-hidden="true">Destacado</span>
          <span class="product__name">{{ item().name }}</span>
        </span>
      </a>
      <div class="product__foot">
        <span class="product__price" [class.is-ask]="item().price === null">{{ price() }}</span>
        @if (item().is_available && business().whatsapp) {
          <button
            type="button"
            class="product__order"
            [class.is-added]="inCart()"
            (click)="add()"
            [attr.aria-label]="label()"
            [title]="label()"
          >
            <app-icon [name]="inCart() ? 'check' : 'plus'" [size]="18" />
            <span class="product__order-text" aria-hidden="true">{{
              inCart() ? 'En el pedido' : 'Añadir'
            }}</span>
            @if (inCart() && item().kind === 'product') {
              <span class="product__order-count" aria-hidden="true">{{ inCart() }}</span>
            }
          </button>
        }
      </div>
    </article>
  `,
  styleUrl: './product-card.css',
})
export class ProductCard {
  private readonly catalog = inject(PublicCatalog);
  private readonly cart = inject(Cart);

  readonly business = input.required<Business>();
  readonly item = input.required<Item>();

  protected readonly price = computed(() => itemPrice(this.business(), this.item()));
  /** Cantidad que ya está en el pedido (0 si no está). */
  protected readonly inCart = computed(() =>
    this.cart.quantity(this.business().id, this.item().id),
  );
  protected readonly label = computed(() => {
    const name = this.item().name;
    if (!this.inCart()) return `Añadir ${name} al pedido`;
    return this.item().kind === 'service'
      ? `${name} ya está en el pedido: ver el pedido`
      : `Añadir otro ${name} (ya hay ${this.inCart()})`;
  });
  /** Un producto suma uno más; un servicio ya agregado abre el pedido. */
  protected add(): void {
    if (this.inCart() && this.item().kind === 'service') {
      this.cart.sheetOpen.set(true);
      return;
    }
    this.cart.add(this.item());
  }

  protected readonly photo = computed(() => {
    const path = this.item().photos[0];
    return path ? this.catalog.imageUrl(path) : null;
  });
}
