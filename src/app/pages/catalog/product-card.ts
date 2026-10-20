import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Business, Item } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PublicCatalog, itemPrice, orderUrl } from './public-catalog';

/** Tarjeta de un producto o servicio: abre su página y, si se puede, lo pide por WhatsApp. */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, Icon],
  template: `
    <article class="product" [class.is-unavailable]="!item().is_available">
      <a class="product__open" [routerLink]="['/', business().slug, item().id]">
        <span class="product__media">
          @if (photo(); as photo) {
            <img [src]="photo" [alt]="item().name" loading="lazy" />
          } @else {
            <span class="product__placeholder" aria-hidden="true">{{ item().name.charAt(0) }}</span>
          }
          <span class="product__badges">
            @if (!item().is_available) {
              <span class="badge badge--dark">Agotado</span>
            } @else if (item().kind === 'service') {
              <span class="badge">Servicio</span>
            }
            @if (item().photos.length > 1) {
              <span class="badge badge--glass">
                <app-icon name="image" [size]="12" /> {{ item().photos.length }}
              </span>
            }
          </span>
        </span>
        <span class="product__body">
          <span class="product__name">{{ item().name }}</span>
          @if (item().description) {
            <span class="product__description">{{ item().description }}</span>
          }
          <span class="product__price" [class.is-ask]="item().price === null">{{ price() }}</span>
        </span>
      </a>
      @if (item().is_available && order(); as url) {
        <a
          class="product__order"
          [href]="url"
          target="_blank"
          rel="noopener"
          [attr.aria-label]="'Pedir ' + item().name + ' por WhatsApp'"
        >
          <app-icon name="whatsapp" [size]="18" />
          <span>Pedir</span>
        </a>
      }
    </article>
  `,
  styleUrl: './product-card.css',
})
export class ProductCard {
  private readonly catalog = inject(PublicCatalog);

  readonly business = input.required<Business>();
  readonly item = input.required<Item>();

  protected readonly price = computed(() => itemPrice(this.business(), this.item()));
  protected readonly order = computed(() => orderUrl(this.business(), this.item()));
  protected readonly photo = computed(() => {
    const path = this.item().photos[0];
    return path ? this.catalog.imageUrl(path) : null;
  });
}
