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

import { readableTextColor } from '../../core/color';
import { errorMessage } from '../../core/format';
import { Business, Category, Item } from '../../core/models';
import { whatsappShareUrl } from '../../core/whatsapp';
import { Icon, IconName } from '../../shared/icon';
import { downloadCatalogPdf } from './catalog-pdf';
import { groupItems } from './group-items';
import { ProductCard } from './product-card';
import { PublicCatalog, catalogUrl, contactUrl } from './public-catalog';

const SOCIALS = {
  instagram: { label: 'Instagram', icon: 'instagram' },
  facebook: { label: 'Facebook', icon: 'facebook' },
  tiktok: { label: 'TikTok', icon: 'tiktok' },
  x: { label: 'X', icon: 'xsocial' },
  website: { label: 'Sitio web', icon: 'globe' },
} as const satisfies Record<string, { label: string; icon: IconName }>;

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, Icon, ProductCard],
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
  protected readonly copied = signal(false);
  protected readonly generatingPdf = signal(false);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly contactSection = viewChild<ElementRef<HTMLElement>>('contactSection');

  protected readonly onBrand = computed(() => {
    const color = this.business()?.primary_color;
    return color ? readableTextColor(color) : null;
  });

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

  protected readonly itemCount = computed(() => this.items().length);

  protected readonly socials = computed(() => {
    const socials = this.business()?.socials ?? {};
    return (Object.keys(SOCIALS) as (keyof typeof SOCIALS)[])
      .filter((key) => socials[key])
      .map((key) => ({ ...SOCIALS[key], url: withProtocol(socials[key]!) }));
  });

  protected readonly contactUrl = computed(() => {
    const business = this.business();
    return business ? contactUrl(business) : null;
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
        content: data.business.description ?? `Catálogo de ${data.business.name}`,
      });
      this.meta.updateTag({ name: 'theme-color', content: data.business.primary_color });
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
    return whatsappShareUrl(`Mira el catálogo de ${business.name}: ${catalogUrl(business)}`);
  }

  protected async share(): Promise<void> {
    const business = this.business()!;
    const url = catalogUrl(business);
    if (navigator.share) {
      try {
        await navigator.share({ title: business.name, text: `Catálogo de ${business.name}`, url });
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
