import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { Auth } from '../../core/auth';
import { CatalogApi } from '../../core/catalog-api';
import { readableTextColor } from '../../core/color';
import { errorMessage, formatPrice } from '../../core/format';
import { Business, Category, Item } from '../../core/models';
import { whatsappChatUrl, whatsappShareUrl } from '../../core/whatsapp';
import { downloadCatalogPdf } from './catalog-pdf';
import { groupItems } from './group-items';

const SOCIAL_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
  website: 'Sitio web',
} as const;

@Component({
  selector: 'app-catalog',
  imports: [RouterLink],
  templateUrl: './catalog.html',
  styleUrl: './catalog.css',
  host: {
    '[style.--brand]': 'business()?.primary_color',
    '[style.--brand-2]': 'business()?.secondary_color',
    '[style.--on-brand]': 'onBrand()',
  },
})
export class Catalog implements OnDestroy {
  private readonly api = inject(CatalogApi);
  private readonly auth = inject(Auth);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  /** Viene de la ruta /:slug */
  readonly slug = input.required<string>();

  protected readonly business = signal<Business | null>(null);
  private readonly categories = signal<Category[]>([]);
  private readonly items = signal<Item[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  /** null = todas las categorías */
  protected readonly selectedGroup = signal<string | null>(null);
  protected readonly openItem = signal<Item | null>(null);
  protected readonly openPhoto = signal(0);
  protected readonly copied = signal(false);
  protected readonly generatingPdf = signal(false);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly onBrand = computed(() => {
    const color = this.business()?.primary_color;
    return color ? readableTextColor(color) : null;
  });
  protected readonly catalogUrl = computed(() => `${location.origin}/${this.business()?.slug}`);

  protected readonly groups = computed(() => groupItems(this.categories(), this.items()));

  /** Lo que se muestra: agrupado si no hay filtros; una sola lista si se filtra o busca. */
  protected readonly visibleGroups = computed(() => {
    const query = normalize(this.search().trim());
    const selected = this.selectedGroup();
    if (!query && !selected) return this.groups();

    const items = this.groups()
      .filter((g) => !selected || g.id === selected)
      .flatMap((g) => g.items)
      .filter((i) => !query || normalize(`${i.name} ${i.description ?? ''}`).includes(query));
    return [{ id: 'resultados', name: '', items }];
  });
  protected readonly resultCount = computed(() =>
    this.visibleGroups().reduce((total, g) => total + g.items.length, 0),
  );

  protected readonly socials = computed(() => {
    const socials = this.business()?.socials ?? {};
    return (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[])
      .filter((key) => socials[key])
      .map((key) => ({ label: SOCIAL_LABELS[key], url: withProtocol(socials[key]!) }));
  });

  /** El dueño (o el superadmin) ve su catálogo aunque todavía no sea público. */
  protected readonly isPreview = computed(() => this.business()?.status !== 'active');

  /** Título y color de la barra del navegador de la plataforma, para restaurarlos al salir. */
  private readonly platformTitle = this.title.getTitle();
  private readonly platformThemeColor =
    this.meta.getTag('name="theme-color"')?.content ?? '#6b45ff';

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.title.setTitle(this.platformTitle);
    this.meta.updateTag({ name: 'theme-color', content: this.platformThemeColor });
    this.meta.removeTag('name="description"');
  }

  private async load(): Promise<void> {
    try {
      // Con sesión, la RLS deja ver al dueño su catálogo aunque esté pendiente.
      await this.auth.ready;
      const business = await this.api.getBusinessBySlug(this.slug());
      if (!business) return;

      const [categories, items] = await Promise.all([
        this.api.listCategories(business.id),
        this.api.listItems(business.id),
      ]);
      this.business.set(business);
      this.categories.set(categories);
      // El dueño también recibe los ocultos (por la RLS): aquí nunca se muestran.
      this.items.set(items.filter((i) => i.is_visible));

      this.title.setTitle(business.name);
      this.meta.updateTag({
        name: 'description',
        content: business.description ?? `Catálogo de ${business.name}`,
      });
      this.meta.updateTag({ name: 'theme-color', content: business.primary_color });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected price(item: Item): string {
    return formatPrice(item.price, this.business()!.currency);
  }

  protected photoUrl(path: string): string {
    return this.api.imageUrl(path);
  }

  protected logoUrl(): string | null {
    const path = this.business()?.logo_path;
    return path ? this.api.imageUrl(path) : null;
  }

  protected orderUrl(item: Item): string | null {
    const business = this.business()!;
    if (!business.whatsapp) return null;
    const message =
      `¡Hola ${business.name}! Me interesa *${item.name}* (${this.price(item)}).\n` +
      this.catalogUrl();
    return whatsappChatUrl(business.whatsapp, message);
  }

  protected contactUrl(): string | null {
    const business = this.business()!;
    if (!business.whatsapp) return null;
    return whatsappChatUrl(
      business.whatsapp,
      `¡Hola ${business.name}! Vi su catálogo y quiero hacer una consulta.`,
    );
  }

  protected shareOnWhatsappUrl(): string {
    return whatsappShareUrl(`Mira el catálogo de ${this.business()!.name}: ${this.catalogUrl()}`);
  }

  protected async share(): Promise<void> {
    const name = this.business()!.name;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `Catálogo de ${name}`, url: this.catalogUrl() });
      } catch {
        // La persona cerró el menú de compartir.
      }
      return;
    }
    await navigator.clipboard.writeText(this.catalogUrl());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  protected async downloadPdf(): Promise<void> {
    this.generatingPdf.set(true);
    try {
      await downloadCatalogPdf({
        business: this.business()!,
        groups: this.groups(),
        catalogUrl: this.catalogUrl(),
        imageUrl: (path) => this.api.imageUrl(path),
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.generatingPdf.set(false);
    }
  }

  protected showItem(item: Item): void {
    this.openItem.set(item);
    this.openPhoto.set(0);
    this.dialog()?.nativeElement.showModal();
  }

  protected closeItem(): void {
    this.dialog()?.nativeElement.close();
  }

  /** Cierra el detalle al tocar fuera de la tarjeta. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.closeItem();
  }
}

/** Minúsculas y sin acentos, para buscar "cafe" y encontrar "Café". */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
