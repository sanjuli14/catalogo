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
import { TranslocoDirective, translate } from '@jsverse/transloco';

import { AppManifest } from '../../core/app-manifest';
import { readableTextColor } from '../../core/color';
import { CustomerProfile } from '../../core/customer';
import { errorMessage } from '../../core/format';
import { Language } from '../../core/i18n';
import { Stats } from '../../core/stats';
import { Icon } from '../../shared/icon';
import { Cart, MAX_QUANTITY } from './cart';
import { CartSheet } from './cart-sheet';
import { CatalogAppBar } from './catalog-app-bar';
import { CustomerSheet } from './customer-sheet';
import { ProductCard } from './product-card';
import {
  PublicCatalog,
  PublicCatalogData,
  askAvailabilityUrl,
  discountPercent,
  isOrderable,
  isNew,
  itemCompareAtPrice,
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
  imports: [
    NgTemplateOutlet,
    RouterLink,
    Icon,
    ProductCard,
    CartSheet,
    CustomerSheet,
    TranslocoDirective,
    CatalogAppBar,
  ],
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
  /** Los textos armados en el código (precios, mensajes) se rehacen al cambiar de idioma. */
  private readonly language = inject(Language);
  private readonly stats = inject(Stats);
  private readonly manifest = inject(AppManifest);

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
  /** Variante elegida (talla, sabor...); null si el producto no tiene. */
  protected readonly variantId = signal<string | null>(null);
  protected readonly variant = computed(
    () => this.item()?.variants.find((v) => v.id === this.variantId()) ?? null,
  );
  protected readonly orderable = computed(() => {
    const item = this.item();
    return item ? isOrderable(item) : false;
  });

  /** Cuántos hay ya en el pedido de este renglón (con la variante elegida). */
  protected readonly inCart = computed(() => {
    const item = this.item();
    return item ? this.cart.quantity(item.business_id, item.id, this.variant()) : 0;
  });
  /** Cuántos hay en el pedido sumando todas las variantes. */
  protected readonly inCartTotal = computed(() => {
    const item = this.item();
    return item ? this.cart.itemQuantity(item.business_id, item.id) : 0;
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
  protected readonly relatedTitle = computed(() => {
    this.language.current();
    return this.categoryName() && this.related()[0]?.category_id === this.item()?.category_id
      ? translate('product.moreIn', { category: this.categoryName() })
      : translate('product.alsoLike');
  });

  protected readonly onBrand = computed(() => {
    const color = this.business()?.primary_color;
    return color ? readableTextColor(color) : null;
  });
  protected readonly before = computed(() => {
    this.language.current();
    const business = this.business();
    const item = this.item();
    return business && item ? itemCompareAtPrice(business, item, this.variant()) : null;
  });
  protected readonly discount = computed(() => {
    const item = this.item();
    return item ? discountPercent(item, this.variant()) : null;
  });
  protected readonly isNew = computed(() => {
    const item = this.item();
    return item ? isNew(item) : false;
  });
  protected readonly price = computed(() => {
    this.language.current();
    const business = this.business();
    const item = this.item();
    return business && item ? itemPrice(business, item, this.variant()) : '';
  });
  protected readonly orderUrl = computed(() => {
    this.language.current();
    const business = this.business();
    const item = this.item();
    if (!business || !item) return null;
    // Los servicios no llevan cantidad.
    const quantity = item.kind === 'product' ? this.quantity() : 1;
    return orderUrl(business, item, this.customer.data(), quantity, this.variant());
  });
  protected readonly total = computed(() => {
    this.language.current();
    const business = this.business();
    const item = this.item();
    return business && item ? orderTotal(business, item, this.quantity(), this.variant()) : '';
  });
  /** Para un producto agotado: preguntar cuándo vuelve. */
  protected readonly askUrl = computed(() => {
    this.language.current();
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
        // Empieza con la primera variante disponible ya elegida.
        this.variantId.set(item?.variants.find((v) => v.is_available)?.id ?? null);
        this.gallery()?.nativeElement.scrollTo({ left: 0 });
      });
      if (!item || !business) return;
      untracked(() => this.stats.view(business.id, item.id));
      this.title.setTitle(`${item.name} · ${business.name}`);
      this.meta.updateTag({
        name: 'description',
        content:
          item.description ??
          translate<string>('product.itemAt', { item: item.name, name: business.name }),
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
    this.manifest.reset();
  }

  private async load(): Promise<void> {
    try {
      const data = await this.catalog.load(this.slug());
      this.data.set(data);
      if (!data) return;
      // Instalado desde un producto, abre el catálogo entero.
      void this.manifest.use({
        name: data.business.name,
        shortName: data.business.name,
        startPath: `/${data.business.slug}`,
        color: data.business.primary_color,
        iconUrl: data.business.icon_path ? this.catalog.imageUrl(data.business.icon_path) : null,
        logoUrl: this.logoUrl(),
      });
      if (data.business.whatsapp) this.customer.askOnArrival();
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
        const text = translate('product.itemAt', { item: item.name, name: business.name });
        await navigator.share({ title: item.name, text, url });
      } catch {
        // La persona cerró el menú de compartir.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  /** Botones de WhatsApp: si faltan los datos del cliente se piden; si no, cuenta el clic. */
  protected whatsappClick(event: Event): void {
    this.customer.interceptOrder(event);
    if (!event.defaultPrevented) this.stats.whatsappClick(this.business()!.id, this.item()!.id);
  }

  protected addToCart(): void {
    const item = this.item()!;
    this.cart.add(item, item.kind === 'product' ? this.quantity() : 1, this.variant());
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
