import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, translate } from '@jsverse/transloco';

import { Language } from '../../core/i18n';
import { Business, Item } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Cart } from './cart';
import {
  PublicCatalog,
  cardPrice,
  discountPercent,
  hasPriceRange,
  isOrderable,
  isNew,
  itemCompareAtPrice,
} from './public-catalog';

/** Tarjeta de un producto o servicio: abre su página y, si se puede, lo pide por WhatsApp. */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, Icon, TranslocoDirective],
  template: `
    <article class="product" [class.is-unavailable]="!orderable()" *transloco="let t">
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
          @if (!orderable()) {
            <span class="tag tag--dark">{{ t('card.soldOut') }}</span>
          } @else if (discount(); as discount) {
            <span class="tag tag--brand">-{{ discount }}%</span>
          } @else if (isNew()) {
            <span class="tag tag--brand">{{ t('card.new') }}</span>
          } @else if (item().kind === 'service') {
            <span class="tag">{{ t('kind.service') }}</span>
          }
        </span>
        <span class="product__body">
          <span class="product__name">{{ item().name }}</span>
        </span>
      </a>
      <div class="product__foot">
        <span class="product__price" [class.is-ask]="item().price === null">
          @if (before(); as before) {
            <s class="product__was"
              ><span class="visually-hidden">{{ t('card.before') }} </span>{{ before }}</s
            >
          }
          {{ price() }}
        </span>
        @if (orderable() && business().whatsapp) {
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
              t(inCart() ? 'card.inOrder' : hasVariants() ? 'card.choose' : 'card.add')
            }}</span>
            @if (inCart() && (item().kind === 'product' || hasVariants())) {
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
  private readonly language = inject(Language);
  private readonly router = inject(Router);

  readonly business = input.required<Business>();
  readonly item = input.required<Item>();

  protected readonly hasVariants = computed(() => this.item().variants.length > 0);
  protected readonly orderable = computed(() => isOrderable(this.item()));

  /** "Desde $5" si las variantes tienen precios distintos. */
  protected readonly price = computed(() => {
    this.language.current();
    return cardPrice(this.business(), this.item());
  });
  /** Con otro precio que el del producto ("Desde…") no se muestra la oferta. */
  private readonly priceRange = computed(() => hasPriceRange(this.item()));
  protected readonly before = computed(() => {
    this.language.current();
    return this.priceRange() ? null : itemCompareAtPrice(this.business(), this.item());
  });
  protected readonly discount = computed(() =>
    this.priceRange() ? null : discountPercent(this.item()),
  );
  protected readonly isNew = computed(() => isNew(this.item()));
  /** Cantidad que ya está en el pedido, de todas sus variantes (0 si no está). */
  protected readonly inCart = computed(() =>
    this.cart.itemQuantity(this.business().id, this.item().id),
  );
  protected readonly label = computed(() => {
    this.language.current();
    const name = this.item().name;
    if (this.hasVariants()) return translate('card.chooseLabel', { name });
    if (!this.inCart()) return translate('card.addLabel', { name });
    return this.item().kind === 'service'
      ? translate('card.serviceInOrderLabel', { name })
      : translate('card.addAnotherLabel', { name, count: this.inCart() });
  });
  /**
   * Un producto suma uno más; un servicio ya agregado abre el pedido. Con variantes, abre
   * la página del producto para elegir cuál.
   */
  protected add(): void {
    if (this.hasVariants()) {
      void this.router.navigate(['/', this.business().slug, this.item().id]);
      return;
    }
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
