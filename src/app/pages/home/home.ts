import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Auth, homeFor } from '../../core/auth';
import { Icon, IconName } from '../../shared/icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'whatsapp',
    title: 'Pedidos por WhatsApp',
    text: 'Cada producto con su botón y el mensaje ya escrito.',
  },
  {
    icon: 'sparkles',
    title: 'Con tu marca',
    text: 'Tu logo, tus colores y tu propia dirección web.',
  },
  {
    icon: 'download',
    title: 'Comparte como quieras',
    text: 'Enlace, WhatsApp o un PDF listo para enviar.',
  },
];

/** Productos de muestra de la maqueta de celular. */
const PREVIEW = [
  { name: 'Capuchino', price: '$2.75', tone: 'a' },
  { name: 'Cake de fresa', price: '$18.00', tone: 'b' },
  { name: 'Croissant', price: '$1.50', tone: 'c' },
  { name: 'Limonada', price: '$2.00', tone: 'd' },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon],
  template: `
    <div class="landing">
      <header class="nav">
        <a class="nav__brand" routerLink="/">
          <img src="icono/icono.png" alt="" width="34" height="34" />
          Catálogo
        </a>
        @if (auth.profile(); as profile) {
          <a class="button button--sm" [routerLink]="homeFor(profile.role)">Ir a mi panel</a>
        } @else {
          <a class="button button--ghost button--sm" routerLink="/login">Iniciar sesión</a>
        }
      </header>

      <main class="hero">
        <section class="hero__copy">
          <span class="eyebrow"><app-icon name="sparkles" [size]="14" /> Gratis para empezar</span>
          <h1>Tu catálogo en un enlace, <span>listo para vender.</span></h1>
          <p class="hero__lead">
            Muestra tus productos y servicios con fotos, precios y tu marca. Tus clientes lo abren
            desde WhatsApp y te piden con un toque.
          </p>
          <div class="hero__cta">
            @if (auth.profile(); as profile) {
              <a class="button button--lg" [routerLink]="homeFor(profile.role)">
                Ir a mi panel <app-icon name="arrowUpRight" [size]="18" />
              </a>
            } @else {
              <a class="button button--lg" routerLink="/registro">
                Crear mi catálogo <app-icon name="arrowUpRight" [size]="18" />
              </a>
              <a class="button button--ghost button--lg" routerLink="/login">Ya tengo cuenta</a>
            }
          </div>

          <ul class="features">
            @for (feature of features; track feature.title) {
              <li>
                <span class="features__icon"><app-icon [name]="feature.icon" [size]="18" /></span>
                <span>
                  <strong>{{ feature.title }}</strong>
                  {{ feature.text }}
                </span>
              </li>
            }
          </ul>
        </section>

        <section class="phone" aria-label="Ejemplo de catálogo">
          <div class="phone__screen">
            <div class="phone__cover"></div>
            <div class="phone__logo">A</div>
            <p class="phone__name">Café Doña Ana</p>
            <p class="phone__desc">Café de especialidad y repostería</p>
            <span class="phone__cta"
              ><app-icon name="whatsapp" [size]="13" /> Escribir por WhatsApp</span
            >
            <div class="phone__chips">
              <span class="is-active">Todo</span><span>Bebidas</span><span>Postres</span>
            </div>
            <div class="phone__grid">
              @for (product of preview; track product.name) {
                <div class="phone__card">
                  <span class="phone__img" [class]="'phone__img tone-' + product.tone"></span>
                  <span class="phone__pname">{{ product.name }}</span>
                  <span class="phone__price">{{ product.price }}</span>
                </div>
              }
            </div>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: `
    .landing {
      min-height: 100dvh;
      background:
        radial-gradient(48rem 36rem at 100% 0%, rgb(143 115 255 / 0.26), transparent 60%),
        radial-gradient(40rem 30rem at 0% 100%, rgb(188 171 255 / 0.35), transparent 60%),
        var(--color-bg);
      overflow: hidden;
    }

    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1160px;
      margin: 0 auto;
      padding: 18px 20px;
    }

    .nav__brand {
      display: flex;
      gap: 10px;
      align-items: center;
      color: var(--color-text);
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      text-decoration: none;
    }

    .nav__brand img {
      border-radius: 10px;
    }

    .hero {
      display: grid;
      gap: 56px;
      align-items: center;
      max-width: 1160px;
      margin: 0 auto;
      padding: 32px 20px 72px;
    }

    .eyebrow {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 6px 12px;
      border: 1px solid var(--purple-100);
      border-radius: 999px;
      background: rgb(255 255 255 / 0.7);
      color: var(--color-primary);
      font-size: 13px;
      font-weight: 700;
    }

    h1 {
      margin: 18px 0 0;
      font-size: clamp(38px, 7vw, 64px);
      line-height: 1.02;
      letter-spacing: -0.045em;
      text-wrap: balance;
    }

    h1 span {
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .hero__lead {
      max-width: 52ch;
      margin: 20px 0 0;
      color: var(--color-muted);
      font-size: 18px;
      line-height: 1.6;
    }

    .hero__cta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }

    .button--lg {
      min-height: 54px;
      padding: 0 24px;
      border-radius: 14px;
      font-size: 16px;
    }

    .features {
      display: grid;
      gap: 14px;
      margin: 40px 0 0;
      padding: 0;
      list-style: none;
    }

    .features li {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      color: var(--color-muted);
      font-size: 15px;
      line-height: 1.45;
    }

    .features strong {
      display: block;
      color: var(--color-text);
    }

    .features__icon {
      display: grid;
      flex: none;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--color-surface);
      color: var(--color-primary);
      box-shadow: var(--shadow-md);
    }

    /* Maqueta de celular */
    .phone {
      justify-self: center;
      width: 300px;
      padding: 12px;
      border-radius: 46px;
      background: #16132a;
      box-shadow:
        0 0 0 2px #2c2745,
        0 50px 100px -30px rgb(64 38 170 / 0.55);
      transform: rotate(-3deg);
    }

    .phone__screen {
      height: 590px;
      overflow: hidden;
      border-radius: 36px;
      background: #ffffff;
    }

    .phone__cover {
      height: 104px;
      background:
        radial-gradient(80% 120% at 100% 0%, #fb923c, transparent 60%),
        linear-gradient(135deg, #c2410c, #ea580c);
    }

    .phone__logo {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      margin: -32px 0 0 16px;
      border: 3px solid #ffffff;
      border-radius: 20px;
      background: #7c2d12;
      color: #fde68a;
      font-size: 28px;
      font-weight: 800;
      box-shadow: 0 10px 20px -10px rgb(0 0 0 / 0.4);
    }

    .phone__name {
      margin: 10px 16px 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .phone__desc {
      margin: 2px 16px 0;
      color: #8b889c;
      font-size: 11px;
    }

    .phone__cta {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: center;
      height: 34px;
      margin: 12px 16px 0;
      border-radius: 999px;
      background: #c2410c;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
    }

    .phone__chips {
      display: flex;
      gap: 6px;
      margin: 14px 16px 0;
    }

    .phone__chips span {
      padding: 6px 10px;
      border-radius: 999px;
      background: #f4f4f7;
      color: #4b4860;
      font-size: 10px;
      font-weight: 600;
    }

    .phone__chips .is-active {
      background: #c2410c;
      color: #ffffff;
    }

    .phone__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 14px 12px 0;
    }

    .phone__card {
      display: grid;
      gap: 2px;
      padding: 5px 5px 8px;
      border-radius: 14px;
      box-shadow: 0 6px 16px -10px rgb(19 17 28 / 0.35);
    }

    .phone__img {
      aspect-ratio: 1;
      margin-bottom: 4px;
      border-radius: 10px;
    }

    .tone-a {
      background: radial-gradient(circle at 50% 45%, #fde68a 0 22%, #b45309 60%, #78350f);
    }

    .tone-b {
      background: radial-gradient(circle at 50% 45%, #fecdd3 0 22%, #e11d48 62%, #881337);
    }

    .tone-c {
      background: radial-gradient(circle at 50% 45%, #fef3c7 0 22%, #d97706 60%, #92400e);
    }

    .tone-d {
      background: radial-gradient(circle at 50% 45%, #d9f99d 0 22%, #16a34a 60%, #14532d);
    }

    .phone__pname {
      padding: 0 3px;
      font-size: 11px;
      font-weight: 700;
    }

    .phone__price {
      padding: 0 3px;
      font-size: 12px;
      font-weight: 800;
    }

    @media (min-width: 960px) {
      .hero {
        grid-template-columns: 1.1fr 0.9fr;
        padding-top: 56px;
      }

      .phone {
        width: 330px;
      }

      .phone__screen {
        height: 640px;
      }
    }
  `,
})
export class Home {
  protected readonly auth = inject(Auth);
  protected readonly homeFor = homeFor;
  protected readonly features = FEATURES;
  protected readonly preview = PREVIEW;
}
