import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, translate } from '@jsverse/transloco';

import { AppManifest } from '../../core/app-manifest';
import { readableTextColor } from '../../core/color';
import { CustomerProfile } from '../../core/customer';
import { errorMessage } from '../../core/format';
import { Language } from '../../core/i18n';
import { Stats } from '../../core/stats';
import { Business, Category, Item } from '../../core/models';
import { whatsappShareUrl } from '../../core/whatsapp';
import { Icon, IconName } from '../../shared/icon';
import { LangSwitch } from '../../shared/lang-switch';
import { downloadCatalogPdf } from './catalog-pdf';
import { countLabel, groupItems, withPinned } from './group-items';
import { Cart } from './cart';
import { CartSheet } from './cart-sheet';
import { CatalogAppBar } from './catalog-app-bar';
import { CustomerSheet } from './customer-sheet';
import { ProductCard } from './product-card';
import { PublicCatalog, catalogUrl, contactUrl, shareCatalogMessage } from './public-catalog';

/** label null: se traduce ("Sitio web", "Website"). */
const SOCIALS = {
  instagram: { label: 'Instagram', icon: 'instagram' },
  facebook: { label: 'Facebook', icon: 'facebook' },
  tiktok: { label: 'TikTok', icon: 'tiktok' },
  x: { label: 'X', icon: 'xsocial' },
  website: { label: null, icon: 'globe' },
} as const satisfies Record<string, { label: string | null; icon: IconName }>;

@Component({
  selector: 'app-catalog',
  imports: [
    RouterLink,
    Icon,
    ProductCard,
    CartSheet,
    CustomerSheet,
    TranslocoDirective,
    LangSwitch,
    CatalogAppBar,
  ],
  templateUrl: './catalog.html',
  styleUrls: ['./catalog-theme.css', './catalog.css'],
  host: {
    '[style.--brand]': 'business()?.primary_color',
    '[style.--brand-2]': 'business()?.secondary_color',
    '[style.--on-brand]': 'onBrand()',
  },
})
export class Catalog implements OnInit, OnDestroy {
  private readonly catalog = inject(PublicCatalog);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  protected readonly customer = inject(CustomerProfile);
  protected readonly cart = inject(Cart);
  /** Los textos armados en el código (grupos, mensajes) se rehacen al cambiar de idioma. */
  private readonly language = inject(Language);
  private readonly stats = inject(Stats);
  private readonly manifest = inject(AppManifest);

  /** Viene de la ruta /:slug */
  readonly slug = input.required<string>();

  protected readonly business = signal<Business | null>(null);
  private readonly categories = signal<Category[]>([]);
  private readonly items = signal<Item[]>([]);
  protected readonly allItems = this.items.asReadonly();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  /** null = todas las categorías */
  protected readonly selectedGroup = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly generatingPdf = signal(false);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly contactSection = viewChild<ElementRef<HTMLElement>>('contactSection');

  protected readonly onBrand = computed(() => {
    const color = this.business()?.primary_color;
    return color ? readableTextColor(color) : null;
  });

  protected readonly groups = computed(() => {
    this.language.current();
    return groupItems(this.categories(), this.items());
  });

  /** Lo que se muestra: agrupado si no hay filtros; una sola lista si se filtra o busca. */
  protected readonly visibleGroups = computed(() => {
    const query = normalize(this.search().trim());
    const selected = this.selectedGroup();
    if (!query && !selected) return withPinned(this.groups());

    const items = this.groups()
      .filter((g) => !selected || g.id === selected)
      .flatMap((g) => g.items)
      .filter((i) => !query || normalize(`${i.name} ${i.description ?? ''}`).includes(query));
    return [{ id: 'resultados', name: '', items }];
  });
  protected readonly resultCount = computed(() =>
    this.visibleGroups().reduce((total, g) => total + g.items.length, 0),
  );

  protected readonly itemCount = computed(() => this.items().length);
  /** Título del tile del contador: "Productos", "Servicios" o "En catálogo" si hay de ambos. */
  protected readonly itemsLabel = computed(() => {
    const kinds = new Set(this.items().map((i) => i.kind));
    if (kinds.size !== 1) return 'catalog.inCatalog';
    return kinds.has('service') ? 'catalog.services' : 'admin.tabs.products';
  });
  protected readonly countLabel = countLabel;
  /** Cosas en el pedido: la barra de abajo abre el pedido en vez de una consulta. */
  protected readonly cartCount = computed(() => {
    const business = this.business();
    if (!business) return 0;
    return this.cart.lines(business.id, this.items()).reduce((n, l) => n + l.quantity, 0);
  });

  protected readonly socials = computed(() => {
    const socials = this.business()?.socials ?? {};
    return (Object.keys(SOCIALS) as (keyof typeof SOCIALS)[])
      .filter((key) => socials[key])
      .map((key) => ({ ...SOCIALS[key], url: withProtocol(socials[key]!) }));
  });

  protected readonly contactUrl = computed(() => {
    this.language.current();
    const business = this.business();
    return business ? contactUrl(business, this.customer.data()) : null;
  });

  /** El dueño (o el superadmin) ve su catálogo aunque todavía no sea público. */
  protected readonly isPreview = computed(() => this.business()?.status !== 'active');

  /** Título y color de la barra del navegador de la plataforma, para restaurarlos al salir. */
  private readonly platformTitle = this.title.getTitle();
  private readonly platformThemeColor =
    this.meta.getTag('name="theme-color"')?.content ?? '#6b45ff';

  // En ngOnInit (no en el constructor): el router ya asignó el slug de la ruta.
  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    this.title.setTitle(this.platformTitle);
    this.meta.updateTag({ name: 'theme-color', content: this.platformThemeColor });
    this.meta.removeTag('name="description"');
    this.manifest.reset();
  }

  private async load(): Promise<void> {
    try {
      const data = await this.catalog.load(this.slug());
      if (!data) return;
      this.business.set(data.business);
      this.categories.set(data.categories);
      this.items.set(data.items);

      this.title.setTitle(data.business.name);
      this.meta.updateTag({
        name: 'description',
        content:
          data.business.description ??
          translate<string>('catalog.of', { name: data.business.name }),
      });
      this.meta.updateTag({ name: 'theme-color', content: data.business.primary_color });
      this.stats.view(data.business.id);
      // Instalado desde aquí, el catálogo queda como app con el nombre y el logo del negocio.
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

  protected logoUrl(): string | null {
    const path = this.business()?.logo_path;
    return path ? this.catalog.imageUrl(path) : null;
  }

  protected shareOnWhatsappUrl(): string {
    const business = this.business()!;
    return whatsappShareUrl(shareCatalogMessage(business));
  }

  protected async share(): Promise<void> {
    const business = this.business()!;
    const url = catalogUrl(business);
    if (navigator.share) {
      try {
        const text = translate('catalog.of', { name: business.name });
        await navigator.share({ title: business.name, text, url });
      } catch {
        // La persona cerró el menú de compartir.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  protected async downloadPdf(): Promise<void> {
    this.generatingPdf.set(true);
    try {
      await downloadCatalogPdf({
        business: this.business()!,
        groups: this.groups(),
        catalogUrl: catalogUrl(this.business()!),
        imageUrl: (path) => this.catalog.imageUrl(path),
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.generatingPdf.set(false);
    }
  }

  /** Botones de WhatsApp: si faltan los datos del cliente se piden; si no, cuenta el clic. */
  protected whatsappClick(event: Event): void {
    this.customer.interceptOrder(event);
    if (!event.defaultPrevented) this.stats.whatsappClick(this.business()!.id);
  }

  // Acciones de la barra inferior.
  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected focusSearch(): void {
    const input = this.searchInput()?.nativeElement;
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus({ preventScroll: true });
  }

  protected scrollToContact(): void {
    this.contactSection()?.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }
}

/** Minúsculas y sin acentos, para buscar "cafe" y encontrar "Café". */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
