import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { Auth, homeFor } from '../../core/auth';
import { Icon, IconName } from '../../shared/icon';
import { LangSwitch } from '../../shared/lang-switch';

/** key: home.features.{key}.title / .text en los archivos de traducción. */
const FEATURES: { icon: IconName; key: string }[] = [
  { icon: 'whatsapp', key: 'whatsapp' },
  { icon: 'sparkles', key: 'brand' },
  { icon: 'download', key: 'share' },
];

/** Productos de muestra de la maqueta de celular. */
const PREVIEW = [
  { name: 'cappuccino', price: '$2.75', tone: 'a' },
  { name: 'cake', price: '$18.00', tone: 'b' },
  { name: 'croissant', price: '$1.50', tone: 'c' },
  { name: 'lemonade', price: '$2.00', tone: 'd' },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, TranslocoDirective, LangSwitch],
  template: `
    <div class="landing" *transloco="let t">
      <header class="nav">
        <a class="nav__brand" routerLink="/">
          <img src="icono/icono.png" alt="" width="34" height="34" />
          {{ t('common.appName') }}
        </a>
        <div class="nav__actions">
          <app-lang-switch />
          @if (auth.profile(); as profile) {
            <a class="button button--sm" [routerLink]="homeFor(profile.role)">{{
              t('common.goToPanel')
            }}</a>
          } @else {
            <a class="button button--ghost button--sm" routerLink="/login">{{
              t('common.signIn')
            }}</a>
          }
        </div>
      </header>

      <!-- Tablero bento: titular gigante, maqueta, beneficios y llamada final. -->
      <main class="board">
        <section class="tile hero">
          <span class="kicker">{{ t('home.kicker') }}</span>
          <div>
            <h1 class="headline">
              {{ t('home.headline') }} <span>{{ t('home.headlineAccent') }}</span>
            </h1>
            <p class="hero__lead">{{ t('home.lead') }}</p>
            <div class="hero__cta">
              @if (auth.profile(); as profile) {
                <a class="button button--lg" [routerLink]="homeFor(profile.role)">
                  {{ t('common.goToPanel') }} <app-icon name="arrowUpRight" [size]="18" />
                </a>
              } @else {
                <a class="button button--lg" routerLink="/registro">
                  {{ t('home.create') }} <app-icon name="arrowUpRight" [size]="18" />
                </a>
                <a class="button button--ghost button--lg" routerLink="/login">{{
                  t('home.haveAccount')
                }}</a>
              }
            </div>
          </div>
        </section>

        <section class="tile phone-tile" [attr.aria-label]="t('home.previewLabel')">
          <div class="phone">
            <div class="phone__screen">
              <div class="phone__board">
                <div class="phone__hero">
                  <span class="phone__kicker">{{ t('home.preview.kicker') }}</span>
                  <p class="phone__name">{{ t('home.preview.business') }}</p>
                </div>
                <div class="phone__logo">A</div>
                <span class="phone__cta"
                  ><app-icon name="whatsapp" [size]="13" /> {{ t('home.preview.order') }}</span
                >
              </div>
              <div class="phone__chips">
                <span class="is-active">{{ t('home.preview.all') }}</span
                ><span>{{ t('home.preview.drinks') }}</span
                ><span>{{ t('home.preview.desserts') }}</span>
              </div>
              <div class="phone__grid">
                @for (product of preview; track product.name; let first = $first) {
                  <div class="phone__card" [class.is-featured]="first">
                    <span [class]="'phone__img tone-' + product.tone"></span>
                    <span class="phone__pname">{{ t('home.preview.' + product.name) }}</span>
                    <span class="phone__price">{{ product.price }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </section>

        @for (feature of features; track feature.key; let i = $index) {
          <section class="tile feature">
            <span class="feature__icon"><app-icon [name]="feature.icon" [size]="20" /></span>
            <div>
              <span class="kicker">0{{ i + 1 }}</span>
              <h2>{{ t('home.features.' + feature.key + '.title') }}</h2>
              <p>{{ t('home.features.' + feature.key + '.text') }}</p>
            </div>
          </section>
        }

        <section class="tile closing">
          <h2 class="headline">
            {{ t('home.closing') }} <span>{{ t('home.closingAccent') }}</span>
          </h2>
          @if (auth.profile(); as profile) {
            <a class="button button--lg closing__button" [routerLink]="homeFor(profile.role)">
              {{ t('common.goToPanel') }} <app-icon name="arrowUpRight" [size]="18" />
            </a>
          } @else {
            <a class="button button--lg closing__button" routerLink="/registro">
              {{ t('home.create') }} <app-icon name="arrowUpRight" [size]="18" />
            </a>
          }
        </section>
      </main>
    </div>
  `,
  styles: `
    .landing {
      min-height: 100dvh;
      padding-bottom: 16px;
      background: var(--color-bg);
    }

    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1240px;
      margin: 0 auto;
      padding: 16px;
    }

    .nav__actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .nav__brand {
      display: flex;
      gap: 10px;
      align-items: center;
      color: var(--color-text);
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.03em;
      text-decoration: none;
    }

    .nav__brand img {
      border-radius: 10px;
    }

    .board {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--gap);
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 16px;
    }

    .board > * {
      animation: rise-in 0.5s var(--ease) backwards;
    }

    .board > :nth-child(2) {
      animation-delay: 0.06s;
    }

    .board > :nth-child(n + 3) {
      animation-delay: 0.12s;
    }

    .tile {
      min-width: 0;
      padding: 22px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-tile);
      background: var(--color-surface);
    }

    .hero {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 48px;
    }

    h1 {
      font-size: clamp(46px, 13vw, 104px);
    }

    h1 span,
    .closing span {
      color: var(--color-primary);
    }

    .hero__lead {
      max-width: 48ch;
      margin: 22px 0 0;
      color: var(--color-muted);
      font-size: 17px;
      line-height: 1.55;
    }

    .hero__cta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 28px;
    }

    .button--lg {
      min-height: 56px;
      padding: 0 24px;
      border-radius: 16px;
      font-size: 16px;
    }

    .feature {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 28px;
    }

    .feature:nth-child(3) {
      grid-column: 1 / -1;
    }

    .feature__icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: var(--color-text);
      color: #ffffff;
    }

    .feature h2 {
      margin: 10px 0 0;
      font-size: clamp(22px, 5.6vw, 30px);
      line-height: 1;
      letter-spacing: -0.045em;
    }

    .feature p {
      margin: 10px 0 0;
      color: var(--color-muted);
      font-size: 15px;
      line-height: 1.5;
    }

    .closing {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: flex-end;
      justify-content: space-between;
      border-color: var(--color-text);
      background: var(--color-text);
      color: #ffffff;
    }

    .closing h2 {
      font-size: clamp(40px, 10vw, 88px);
    }

    .closing span {
      color: var(--purple-400);
    }

    .closing__button {
      background: #ffffff;
      color: var(--color-text);
    }

    .closing__button:hover:not(:disabled) {
      background: var(--purple-100);
    }

    /* ---------- Tile de color con la maqueta de celular ---------- */
    .phone-tile {
      grid-column: 1 / -1;
      display: grid;
      place-items: center;
      padding: 36px 16px;
      overflow: hidden;
      border-color: transparent;
      background: var(--color-primary);
    }

    .phone {
      width: 272px;
      padding: 10px;
      border-radius: 42px;
      background: #111014;
      box-shadow: 0 40px 80px -30px rgb(17 16 20 / 0.6);
      transform: rotate(-4deg);
    }

    .phone__screen {
      height: 540px;
      padding: 12px 10px;
      overflow: hidden;
      border-radius: 33px;
      background: #f6f5f2;
    }

    .phone__board {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .phone__hero {
      grid-column: 1 / -1;
      padding: 12px;
      border: 1px solid #e7e5df;
      border-radius: 16px;
      background: #ffffff;
    }

    .phone__kicker {
      color: #6b6975;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .phone__name {
      margin: 16px 0 0;
      font-size: 27px;
      font-weight: 800;
      line-height: 0.92;
      letter-spacing: -0.055em;
    }

    .phone__logo {
      display: grid;
      place-items: center;
      aspect-ratio: 1.3;
      border-radius: 16px;
      background: #7c2d12;
      color: #fde68a;
      font-size: 30px;
      font-weight: 800;
    }

    .phone__cta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      justify-content: flex-end;
      padding: 10px;
      border-radius: 16px;
      background: #c2410c;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.02em;
    }

    .phone__chips {
      display: flex;
      gap: 4px;
      margin: 10px 0 0;
    }

    .phone__chips span {
      padding: 5px 8px;
      border-radius: 7px;
      color: #6b6975;
      font-size: 9px;
      font-weight: 650;
    }

    .phone__chips .is-active {
      background: #111014;
      color: #ffffff;
    }

    .phone__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 8px;
    }

    .phone__card {
      display: grid;
      gap: 1px;
      padding: 4px 4px 7px;
      border: 1px solid #e7e5df;
      border-radius: 14px;
      background: #ffffff;
    }

    .phone__card.is-featured {
      grid-column: 1 / -1;
    }

    .phone__img {
      aspect-ratio: 1;
      margin-bottom: 4px;
      border-radius: 10px;
    }

    .is-featured .phone__img {
      aspect-ratio: 2.1;
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
      font-size: 10px;
      font-weight: 700;
    }

    .is-featured .phone__pname {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }

    .phone__price {
      padding: 0 3px;
      font-size: 11px;
      font-weight: 800;
    }

    @media (min-width: 640px) {
      .nav {
        padding: 20px 24px;
      }

      .board {
        padding: 0 24px;
      }

      .tile {
        padding: 32px;
      }

      .feature:nth-child(3) {
        grid-column: auto;
      }

      .board .feature:nth-child(5) {
        grid-column: 1 / -1;
      }
    }

    @media (min-width: 960px) {
      .board {
        grid-template-columns: repeat(12, minmax(0, 1fr));
      }

      .hero {
        grid-column: span 8;
        padding: 40px 44px 44px;
      }

      .phone-tile {
        grid-column: span 4;
      }

      .board > .feature:nth-child(n) {
        grid-column: span 4;
        min-height: 240px;
      }

      .closing {
        padding: 40px 44px 44px;
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
