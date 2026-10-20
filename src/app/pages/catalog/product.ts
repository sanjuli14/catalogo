import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { readableTextColor } from '../../core/color';
import { CustomerProfile } from '../../core/customer';
import { errorMessage } from '../../core/format';
import { Icon } from '../../shared/icon';
import { Cart, MAX_QUANTITY } from './cart';
import { CartSheet } from './cart-sheet';
import { CustomerSheet } from './customer-sheet';
import { ProductCard } from './product-card';
import {
  PublicCatalog,
  PublicCatalogData,
  askAvailabilityUrl,
  itemPrice,
  orderTotal,
  orderUrl,
  productUrl,
} from './public-catalog';

/** Cuántos productos se sugieren abajo ("Más en esta categoría"). */
const RELATED_LIMIT = 8;

/** Página de un producto o servicio: /:slug/:itemId */
@Component({
  selector: 'app-product',
  imports: [NgTemplateOutlet, RouterLink, Icon, ProductCard, CartSheet, CustomerSheet],
  templateUrl: './product.html',
  styleUrls: ['./catalog-theme.css', './product.css'],
  host: {
    '[style.--brand]': 'business()?.primary_color',
    '[style.--brand-2]': 'business()?.secondary_color',
    '[style.--on-brand]': 'onBrand()',
  },
})
export class Product implements OnInit, OnDestroy {
  private readonly catalog = inject(PublicCatalog);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  protected readonly customer = inject(CustomerProfile);
  protected readonly cart = inject(Cart);

  /** Vienen de la ruta /:slug/:itemId */
  readonly slug = input.required<string>();
  readonly itemId = input.required<string>();

  private readonly data = signal<PublicCatalogData | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly photoIndex = signal(0);
  /** Durante un momento después de añadir, el botón lo confirma. */
  protected readonly justAdded = signal(false);
  private justAddedTimer?: ReturnType<typeof setTimeout>;
  /** Cantidad que se añade al pedido o se pide directo. */
  protected readonly quantity = signal(1);
  protected readonly maxQuantity = MAX_QUANTITY;
  private readonly gallery = viewChild<ElementRef<HTMLElement>>('gallery');

  protected readonly business = computed(() => this.data()?.business ?? null);
  protected readonly item = computed(
    () => this.data()?.items.find((i) => i.id === this.itemId()) ?? null,
  );

  protected readonly allItems = computed(() => this.data()?.items ?? []);
  /** Cuántos hay ya en el pedido (0 si no está). */
  protected readonly inCart = computed(() => {
    const item = this.item();
    return item ? this.cart.quantity(item.business_id, item.id) : 0;
  });

  protected readonly categoryName = computed(() => {
    const categoryId = this.item()?.category_id;
    return this.data()?.categories.find((c) => c.id === categoryId)?.name ?? null;
  });

  /** Primero los de la misma categoría; si son pocos, se completa con el resto del catálogo. */
  protected readonly related = computed(() => {
    const item = this.item();
    const items = this.data()?.items ?? [];
    if (!item) return [];
    const others = items.filter((i) => i.id !== item.id);
    const sameCategory = others.filter(
      (i) => item.category_id && i.category_id === item.category_id,
    );
    const rest = others.filter((i) => !sameCategory.includes(i));
    return [...sameCategory, ...rest].slice(0, RELATED_LIMIT);
  });
  protected readonly relatedTitle = computed(() =>
    this.categoryName() && this.related()[0]?.category_id === this.item()?.category_id
      ? `Más en ${this.categoryName()}`
      : 'También te puede interesar',
  );

  protected readonly onBrand = computed(() => {
    const color = this.business()?.primary_color;
    return color ? readableTextColor(color) : null;
  });
  protected readonly price = computed(() => {
    const business = this.business();
    const item = this.item();
    return business && item ? itemPrice(business, item) : '';
  });
  protected readonly orderUrl = computed(() => {
    const business = this.business();
    const item = this.item();
    if (!business || !item) return null;
    // Los servicios no llevan cantidad.
    const quantity = item.kind === 'product' ? this.quantity() : 1;
    return orderUrl(business, item, this.customer.data(), quantity);
  });
  protected readonly total = computed(() => {
    const business = this.business();
    const item = this.item();
    return business && item ? orderTotal(business, item, this.quantity()) : '';
  });
  /** Para un producto agotado: preguntar cuándo vuelve. */
  protected readonly askUrl = computed(() => {
    const business = this.business();
    const item = this.item();
    return business && item ? askAvailabilityUrl(business, item, this.customer.data()) : null;
  });

  /** El dueño (o el superadmin) ve su catálogo aunque todavía no sea público. */
  protected readonly isPreview = computed(() => this.business()?.status !== 'active');

  /** Título y color de la barra del navegador de la plataforma, para restaurarlos al salir. */
  private readonly platformTitle = this.title.getTitle();
  private readonly platformThemeColor =
    this.meta.getTag('name="theme-color"')?.content ?? '#6b45ff';

  constructor() {
    // Al pasar a otro producto (desde las sugerencias), la galería vuelve a la primera foto
    // y la pestaña del navegador muestra el producto nuevo.
    effect(() => {
      const item = this.item();
      const business = this.business();
      untracked(() => {
        this.photoIndex.set(0);
        this.quantity.set(1);
        this.gallery()?.nativeElement.scrollTo({ left: 0 });
      });
      if (!item || !business) return;
      this.title.setTitle(`${item.name} · ${business.name}`);
      this.meta.updateTag({
        name: 'description',
        content: item.description ?? `${item.name} en ${business.name}`,
      });
      this.meta.updateTag({ name: 'theme-color', content: business.primary_color });
    });
  }

  // En ngOnInit (no en el constructor): el router ya asignó el slug de la ruta.
  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.justAddedTimer);
    this.title.setTitle(this.platformTitle);
    this.meta.updateTag({ name: 'theme-color', content: this.platformThemeColor });
    this.meta.removeTag('name="description"');
  }

  private async load(): Promise<void> {
    try {
      const data = await this.catalog.load(this.slug());
      this.data.set(data);
      if (data?.business.whatsapp) this.customer.askOnArrival();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected imageUrl(path: string): string {
    return this.catalog.imageUrl(path);
  }

  protected logoUrl(): string | null {
    const path = this.business()?.logo_path;
    return path ? this.catalog.imageUrl(path) : null;
  }

  protected async share(): Promise<void> {
    const business = this.business()!;
    const item = this.item()!;
    const url = productUrl(business, item);
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: `${item.name} en ${business.name}`, url });
      } catch {
        // La persona cerró el menú de compartir.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  protected addToCart(): void {
    const item = this.item()!;
    this.cart.add(item, item.kind === 'product' ? this.quantity() : 1);
    this.quantity.set(1);
    this.justAdded.set(true);
    clearTimeout(this.justAddedTimer);
    this.justAddedTimer = setTimeout(() => this.justAdded.set(false), 1800);
  }

  protected changeQuantity(delta: 1 | -1): void {
    this.quantity.update((q) => Math.min(MAX_QUANTITY, Math.max(1, q + delta)));
  }

  /** La galería se desliza con el dedo; aquí se sabe qué foto se está viendo. */
  protected onGalleryScroll(event: Event): void {
    const gallery = event.target as HTMLElement;
    this.photoIndex.set(Math.round(gallery.scrollLeft / gallery.clientWidth));
  }

  protected goToPhoto(index: number): void {
    const gallery = this.gallery()?.nativeElement;
    gallery?.scrollTo({ left: index * gallery.clientWidth, behavior: 'smooth' });
    this.photoIndex.set(index);
  }
}
