import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { CatalogApi } from '../../../core/catalog-api';
import { errorMessage, intlLocale } from '../../../core/format';
import { Item } from '../../../core/models';
import { BusinessStats, Stats as StatsApi } from '../../../core/stats';
import { Icon } from '../../../shared/icon';
import { CurrentBusiness } from '../current-business';

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

interface Day {
  date: Date;
  views: number;
  clicks: number;
}

/** Visitas al catálogo, productos más vistos y clics a WhatsApp. */
@Component({
  selector: 'app-stats',
  imports: [RouterLink, Icon, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <section class="section-header">
        <div>
          <h2>{{ t('stats.title') }}</h2>
          <p class="muted">{{ t('stats.lead') }}</p>
        </div>
        <div class="periods" role="group" [attr.aria-label]="t('stats.period')">
          @for (option of periods; track option) {
            <button
              type="button"
              class="button button--sm"
              [class.button--ghost]="period() !== option"
              [attr.aria-pressed]="period() === option"
              (click)="setPeriod(option)"
            >
              {{ t('stats.days', { n: option }) }}
            </button>
          }
        </div>
      </section>

      @if (error(); as error) {
        <p class="alert">{{ error }}</p>
      }

      <section class="stats" [attr.aria-label]="t('items.summary')">
        <div class="stat stat--wide stat--accent">
          <span class="kicker">{{ t('stats.catalogViews') }}</span>
          <span class="stat__value">{{ data()?.catalog_views ?? '–' }}</span>
          <app-icon class="stat__icon" name="store" [size]="20" />
        </div>
        <div class="stat">
          <span class="kicker">{{ t('stats.itemViews') }}</span>
          <span class="stat__value">{{ data()?.item_views ?? '–' }}</span>
          <app-icon class="stat__icon" name="eye" [size]="20" />
        </div>
        <div class="stat">
          <span class="kicker">{{ t('stats.whatsappClicks') }}</span>
          <span class="stat__value">{{ data()?.whatsapp_clicks ?? '–' }}</span>
          <app-icon class="stat__icon" name="whatsapp" [size]="20" />
        </div>
      </section>

      <!-- Visitas por día (catálogo + productos). Tocar o pasar el mouse muestra el detalle. -->
      <section class="card chart">
        <header class="chart__head">
          <span class="kicker">{{ t('stats.perDay') }}</span>
          <span class="chart__detail" aria-live="polite">
            @if (selectedDay(); as day) {
              <strong>{{ formatDay(day.date) }}</strong> ·
              {{ t('stats.visits', { n: day.views }) }} ·
              {{ t('stats.clicks', { n: day.clicks }) }}
            } @else {
              {{ t('stats.peak', { n: maxViews() }) }}
            }
          </span>
        </header>
        @if (loading()) {
          <p class="muted">{{ t('common.loading') }}</p>
        } @else {
          <div class="chart__plot" (mouseleave)="hovered.set(null)">
            @for (day of days(); track day.date.getTime(); let i = $index) {
              <button
                type="button"
                class="chart__col"
                [class.is-active]="hovered() === i"
                (mouseenter)="hovered.set(i)"
                (focus)="hovered.set(i)"
                (click)="hovered.set(i)"
                [attr.aria-label]="
                  formatDay(day.date) +
                  ': ' +
                  t('stats.visits', { n: day.views }) +
                  ', ' +
                  t('stats.clicks', { n: day.clicks })
                "
              >
                <span class="chart__bar" [style.height.%]="barHeight(day.views)"></span>
              </button>
            }
          </div>
          <div class="chart__axis" aria-hidden="true">
            <span>{{ formatDay(days()[0].date) }}</span>
            <span>{{ t('stats.today') }}</span>
          </div>
        }
      </section>

      <h3 class="kicker list-title">{{ t('stats.topItems') }}</h3>
      @if (!loading()) {
        @if (!topItems().length) {
          <p class="empty">{{ t('stats.noItems') }}</p>
        } @else {
          <ul class="list">
            @for (row of topItems(); track row.item.id; let i = $index) {
              <li class="list__row">
                <span class="rank" aria-hidden="true">{{ i < 9 ? '0' + (i + 1) : i + 1 }}</span>
                @if (row.item.photos.length) {
                  <img class="thumb" [src]="api.imageUrl(row.item.photos[0])" alt="" />
                } @else {
                  <span class="thumb thumb--empty" aria-hidden="true"
                    ><app-icon name="image" [size]="22"
                  /></span>
                }
                <div class="list__grow">
                  <a class="list__title" [routerLink]="['..', 'productos', row.item.id]">{{
                    row.item.name
                  }}</a>
                  <div class="list__meta">
                    <span>{{ t('stats.views', { n: row.views }) }}</span>
                    <span>{{ t('stats.clicks', { n: row.clicks }) }}</span>
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      }

      <p class="muted note">{{ t('stats.note') }}</p>
    </ng-container>
  `,
  styles: `
    .periods {
      display: flex;
      gap: 6px;
    }

    .stats {
      margin-bottom: var(--gap);
    }

    .chart {
      display: grid;
      gap: 14px;
    }

    .chart__head {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      align-items: baseline;
      justify-content: space-between;
    }

    .chart__detail {
      color: var(--color-muted);
      font-size: 14px;
      font-variant-numeric: tabular-nums;
    }

    .chart__detail strong {
      color: var(--color-text);
    }

    .chart__plot {
      display: flex;
      gap: 2px;
      align-items: stretch;
      height: 160px;
      border-bottom: 1px solid var(--color-border-strong);
    }

    /* La columna entera es el área para tocar: más grande que la barra. */
    .chart__col {
      display: flex;
      flex: 1;
      align-items: flex-end;
      min-width: 0;
      padding: 0;
      border: none;
      border-radius: 4px 4px 0 0;
      background: none;
      cursor: pointer;
    }

    .chart__col:hover,
    .chart__col.is-active {
      background: var(--color-primary-soft);
    }

    .chart__bar {
      width: 100%;
      min-height: 2px;
      border-radius: 4px 4px 0 0;
      background: var(--color-primary);
    }

    .chart__axis {
      display: flex;
      justify-content: space-between;
      margin-top: -6px;
      color: var(--color-muted);
      font-size: 12px;
    }

    .list-title {
      margin: 28px 0 4px;
    }

    .rank {
      width: 28px;
      padding-left: 6px;
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .note {
      margin-top: 20px;
      font-size: 13px;
    }

    @media (min-width: 900px) {
      .stats {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
  `,
})
export class Stats {
  protected readonly api = inject(CatalogApi);
  private readonly statsApi = inject(StatsApi);
  private readonly businessId = inject(CurrentBusiness).id()!;

  protected readonly periods = PERIODS;
  protected readonly period = signal<Period>(30);
  protected readonly data = signal<BusinessStats | null>(null);
  private readonly items = signal<Item[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Día bajo el mouse o tocado (índice en days). */
  protected readonly hovered = signal<number | null>(null);

  /** Todos los días del período, también los que no tuvieron visitas. */
  protected readonly days = computed<Day[]>(() => {
    const byDay = new Map((this.data()?.daily ?? []).map((d) => [d.day, d]));
    const today = startOfDay(new Date());
    return Array.from({ length: this.period() }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (this.period() - 1 - i));
      const found = byDay.get(isoDay(date));
      return { date, views: found?.views ?? 0, clicks: found?.clicks ?? 0 };
    });
  });

  protected readonly maxViews = computed(() => Math.max(0, ...this.days().map((d) => d.views)));

  protected readonly selectedDay = computed(() => {
    const index = this.hovered();
    return index === null ? null : (this.days()[index] ?? null);
  });

  protected readonly topItems = computed(() => {
    const items = new Map(this.items().map((i) => [i.id, i]));
    return (this.data()?.items ?? []).flatMap((row) => {
      const item = items.get(row.item_id);
      return item ? [{ item, views: row.views, clicks: row.clicks }] : [];
    });
  });

  constructor() {
    void this.load();
  }

  protected setPeriod(period: Period): void {
    this.period.set(period);
    this.hovered.set(null);
    void this.load();
  }

  protected barHeight(views: number): number {
    const max = this.maxViews();
    return max ? (views / max) * 100 : 0;
  }

  protected formatDay(date: Date): string {
    return date.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });
  }

  /** Solo vale la última consulta: si se cambia de período rápido, las viejas se descartan. */
  private request = 0;

  private async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set(null);
    try {
      const since = startOfDay(new Date());
      since.setDate(since.getDate() - (this.period() - 1));
      const [data, items] = await Promise.all([
        this.statsApi.get(this.businessId, since),
        this.items().length ? this.items() : this.api.listItems(this.businessId),
      ]);
      if (request !== this.request) return;
      this.data.set(data);
      this.items.set(items);
    } catch (e) {
      if (request === this.request) this.error.set(errorMessage(e));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "2026-10-20" en hora local, como los días que agrupa la base de datos. */
function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
