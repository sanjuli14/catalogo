import { Injectable, signal } from '@angular/core';

/** Lo que se instala: el catálogo de un negocio o el panel de su dueño. */
export interface InstallableApp {
  name: string;
  shortName: string;
  /** Ruta donde abre la app instalada ("/mi-tienda", "/admin"); también es su id y alcance. */
  startPath: string;
  color: string;
  /** Ícono cuadrado guardado en el Storage (URL pública); el mejor para instalar. */
  iconUrl: string | null;
  /** Logo del negocio: si todavía no hay ícono guardado, se arma uno con él en el navegador. */
  logoUrl: string | null;
}

/** Evento de Chrome/Edge/Android para mostrar el diálogo de instalación cuando se quiera. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PLATFORM_ICON = 'icono/icono.png';
/** Lado del ícono guardado para la app instalable. */
export const ICON_SIZE = 512;

/**
 * Manifiesto de la app instalable (PWA). La plataforma tiene uno fijo (manifest.webmanifest);
 * en un catálogo o en el panel de un dueño se cambia por uno con el nombre y el logo del
 * negocio, así la app queda instalada con su ícono. iOS no lee el manifiesto: usa el
 * apple-touch-icon y el título, que también se cambian.
 */
@Injectable({ providedIn: 'root' })
export class AppManifest {
  /** El navegador ofreció instalar: se puede mostrar un botón "Instalar app". */
  readonly canInstall = signal(false);
  private installEvent: BeforeInstallPromptEvent | null = null;
  private objectUrl: string | null = null;
  /** Solo vale el último pedido: si se cambia de página rápido, uno viejo no lo pisa. */
  private request = 0;

  private readonly defaults = {
    manifest: linkHref('manifest'),
    appleIcon: linkHref('apple-touch-icon'),
    title: metaContent('apple-mobile-web-app-title'),
  };

  constructor() {
    // Sin preventDefault: Chrome sigue mostrando su aviso propio para instalar (también en
    // la portada, donde no hay botón). El evento se guarda para el botón "Instalar app".
    window.addEventListener('beforeinstallprompt', (event) => {
      this.installEvent = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });
    window.addEventListener('appinstalled', () => this.forgetInstallEvent());
  }

  async install(): Promise<void> {
    const event = this.installEvent;
    if (!event) return;
    await event.prompt();
    // El evento sirve una sola vez; el navegador manda otro si vuelve a ofrecerlo.
    this.forgetInstallEvent();
  }

  async use(app: InstallableApp): Promise<void> {
    const request = ++this.request;
    const source = app.logoUrl ?? PLATFORM_ICON;
    // Con ícono guardado, el manifiesto apunta a él (una URL de verdad, la que mejor aceptan
    // los navegadores); si no, se arman los íconos aquí a partir del logo.
    const [appleIcon, ...generated] = await Promise.all([
      iconDataUrl(source, 180),
      ...(app.iconUrl ? [] : [iconDataUrl(source, 192), iconDataUrl(source, ICON_SIZE)]),
    ]);
    if (request !== this.request) return;

    const icons = app.iconUrl
      ? [{ src: app.iconUrl, sizes: `${ICON_SIZE}x${ICON_SIZE}`, type: 'image/png' }]
      : [
          { src: generated[0], sizes: '192x192', type: 'image/png' },
          { src: generated[1], sizes: `${ICON_SIZE}x${ICON_SIZE}`, type: 'image/png' },
        ];
    // Sin barra final: Angular la quita de la URL ("/guay/" pasa a "/guay"), y con ella la app
    // quedaría fuera de su propio alcance. A cambio, "/guay" también abarca "/guayaba".
    const start = new URL(app.startPath, location.origin).href;
    const manifest = {
      id: start,
      name: app.name,
      short_name: app.shortName,
      start_url: start,
      scope: start,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: app.color,
      icons: icons.map((icon) => ({ ...icon, purpose: 'any' })),
    };
    // Blob y no data: el blob tiene el mismo origen que la página, que es lo que pide el
    // navegador para aceptar start_url y scope.
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    this.setManifest(URL.createObjectURL(blob));
    setLink('apple-touch-icon', appleIcon);
    setMeta('apple-mobile-web-app-title', app.shortName);
  }

  /** Vuelve a la app de la plataforma (al salir del catálogo o del panel). */
  reset(): void {
    this.request++;
    this.setManifest(this.defaults.manifest);
    setLink('apple-touch-icon', this.defaults.appleIcon);
    setMeta('apple-mobile-web-app-title', this.defaults.title);
  }

  private setManifest(href: string): void {
    if (linkHref('manifest') === href) return;
    setLink('manifest', href);
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = href.startsWith('blob:') ? href : null;
    // El evento guardado era del manifiesto anterior: instalaría esa app y no esta. El
    // navegador manda uno nuevo cuando termina de leer el manifiesto nuevo.
    this.forgetInstallEvent();
  }

  private forgetInstallEvent(): void {
    this.installEvent = null;
    this.canInstall.set(false);
  }
}

/**
 * Ícono cuadrado PNG: el logo centrado sobre blanco, con margen (los sistemas recortan las
 * esquinas). Lo usa también la configuración del negocio para guardar el ícono.
 * null si la imagen no se pudo leer.
 */
export async function squareIcon(source: Blob | string, size: number): Promise<Blob | null> {
  const canvas = await iconCanvas(source, size);
  if (!canvas) return null;
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Como squareIcon, en data URL; si el logo no carga, el ícono de la plataforma. */
async function iconDataUrl(source: string, size: number): Promise<string> {
  const canvas = (await iconCanvas(source, size)) ?? (await iconCanvas(PLATFORM_ICON, size));
  return canvas?.toDataURL('image/png') ?? PLATFORM_ICON;
}

async function iconCanvas(source: Blob | string, size: number): Promise<HTMLCanvasElement | null> {
  const image = await loadBitmap(source);
  if (!image) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  const inner = size * 0.8;
  const scale = Math.min(inner / image.width, inner / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  image.close();
  return canvas;
}

async function loadBitmap(source: Blob | string): Promise<ImageBitmap | null> {
  try {
    if (typeof source !== 'string') return await createImageBitmap(source);
    const response = await fetch(source);
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}

function linkHref(rel: string): string {
  return document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)?.getAttribute('href') ?? '';
}

function metaContent(name: string): string {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? '';
}

function setLink(rel: string, href: string): void {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

function setMeta(name: string, content: string): void {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}
