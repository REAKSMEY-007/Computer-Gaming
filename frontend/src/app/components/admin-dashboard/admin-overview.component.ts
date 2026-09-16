import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import {
  LucideShoppingCart,
  LucideCircleDollarSign,
  LucideBadgeDollarSign,
  LucideUsers,
  LucidePackage,
  LucideTrendingUp,
  LucideTrendingDown,
  LucideRefreshCw,
  LucideShoppingBag,
} from '@lucide/angular';
import { AnalyticsService, AnalyticsResponse, StatCard } from '../../services/analytics.service';
import { ThemeService } from '../../services/theme.service';
import { RealtimeService } from '../../services/realtime.service';
import { Order } from '../../services/order.service';
import { PricePipe, formatNumber } from '../../pipes/price.pipe';

const CARD_KEYS: StatCard['key'][] = ['orders', 'revenue', 'avgOrderValue', 'customers', 'products'];

const STATUS_PILL: Record<string, string> = {
  pending_payment: 'bg-warning-200 text-warning-800',
  pending: 'bg-neutral-100 text-neutral-600',
  processing: 'bg-warning-100 text-warning-700',
  shipped: 'bg-primary-100 text-primary-700',
  delivered: 'bg-success-100 text-success-700',
  cancelled: 'bg-danger-100 text-danger-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pending Payment Verification',
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Fixed ordering/colors for the Order Status donut (matches the status pills
// used across the admin UI: amber=pending payment, gray=pending, yellow=
// processing, blue=shipped, green=delivered, red=cancelled).
const ORDER_STATUS_ORDER = ['pending_payment', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const ORDER_STATUS_LABELS: Record<string, string> = STATUS_LABEL;
const ORDER_STATUS_COLORS: Record<string, string> = {
  pending_payment: '#f59e0b',
  pending: '#94a3b8',
  processing: '#fbbf24',
  shipped: '#6366f1',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

type CardKey = 'orders' | 'revenue' | 'avgOrderValue' | 'customers' | 'products';

interface CardTheme {
  bar: string;
  badge: string;
  tint: string;
}

const CARD_THEMES: Record<CardKey, CardTheme> = {
  orders: {
    bar: 'bg-gradient-to-r from-primary-500 to-primary-600',
    badge: 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-primary-500/30',
    tint: 'bg-gradient-to-br from-primary-100/60 via-primary-50/20 to-transparent dark:from-primary-500/15 dark:via-primary-500/5',
  },
  revenue: {
    bar: 'bg-gradient-to-r from-success-500 to-success-600',
    badge: 'bg-gradient-to-br from-success-500 to-success-600 shadow-success-500/30',
    tint: 'bg-gradient-to-br from-success-100/60 via-success-50/20 to-transparent dark:from-success-500/15 dark:via-success-500/5',
  },
  avgOrderValue: {
    bar: 'bg-gradient-to-r from-accent-400 to-accent-500',
    badge: 'bg-gradient-to-br from-accent-400 to-accent-500 shadow-accent-500/30',
    tint: 'bg-gradient-to-br from-accent-100/60 via-accent-50/20 to-transparent dark:from-accent-500/15 dark:via-accent-500/5',
  },
  customers: {
    bar: 'bg-gradient-to-r from-primary-400 to-primary-500',
    badge: 'bg-gradient-to-br from-primary-400 to-primary-500 shadow-primary-400/30',
    tint: 'bg-gradient-to-br from-primary-100/60 via-primary-50/20 to-transparent dark:from-primary-500/15 dark:via-primary-500/5',
  },
  products: {
    bar: 'bg-gradient-to-r from-warning-400 to-warning-500',
    badge: 'bg-gradient-to-br from-warning-400 to-warning-500 shadow-warning-500/30',
    tint: 'bg-gradient-to-br from-warning-100/60 via-warning-50/20 to-transparent dark:from-warning-500/15 dark:via-warning-500/5',
  },
};

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [
    CommonModule,
    LucideShoppingCart,
    LucideCircleDollarSign,
    LucideBadgeDollarSign,
    LucideUsers,
    LucidePackage,
    LucideTrendingUp,
    LucideTrendingDown,
    LucideRefreshCw,
    LucideShoppingBag,
    PricePipe,
  ],
  templateUrl: './admin-overview.component.html',
})
export class AdminOverviewComponent implements AfterViewInit, OnDestroy {
  data: AnalyticsResponse | null = null;
  loading = true;

  @ViewChild('salesChart') salesCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stockChart') stockCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('orderStatusChart') orderStatusCanvas!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];
  private subs: Subscription[] = [];

  constructor(
    public analyticsService: AnalyticsService,
    private themeService: ThemeService,
    private realtimeService: RealtimeService
  ) {}

  ngOnInit(): void {
    this.subs.push(this.analyticsService.range$.subscribe(() => this.load()));
    this.subs.push(this.themeService.isDark$.subscribe(() => this.renderCharts()));
    this.subs.push(this.realtimeService.onNewOrder().subscribe(() => this.load(true)));
    this.subs.push(this.realtimeService.onNewCustomer().subscribe(() => this.load(true)));
  }

  ngAfterViewInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.destroyCharts();
  }

  load(silent = false): void {
    if (!silent) this.loading = true;
    this.analyticsService.getAnalytics().subscribe({
      next: (data) => {
        if (silent && this.data && JSON.stringify(data) === JSON.stringify(this.data)) {
          this.loading = false;
          return;
        }
        this.data = data;
        this.loading = false;
        setTimeout(() => this.renderCharts(), 0);
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  refresh(): void {
    this.load();
  }

  // ----- Stat cards -----
  get statCards(): StatCard[] {
    const byKey = new Map((this.data?.stats ?? []).map((s) => [s.key, s] as const));
    return CARD_KEYS.map((k) => byKey.get(k)).filter(
      (s): s is StatCard => s !== undefined
    );
  }

  cardTheme(key: StatCard['key']): CardTheme {
    return CARD_THEMES[key as CardKey] ?? CARD_THEMES.orders;
  }

  formattedValue(card: StatCard): string {
    if (card.currency) return `$${formatNumber(card.value)}`;
    return card.value.toLocaleString();
  }

  statusOf(card: StatCard): { up: boolean; text: string } {
    if (!card.delta) return { up: false, text: '—' };
    // A percentage change is meaningless when the previous baseline is 0
    // (percent-from-zero is undefined). Show the raw amount added instead.
    if (card.prev === 0 && card.value > 0) {
      const add = card.periodAdd ?? card.value;
      const shown = card.currency
        ? `+$${formatNumber(add, 0)}`
        : `+${add.toLocaleString(undefined, { maximumFractionDigits: 0 })} new`;
      return { up: true, text: shown };
    }
    return {
      up: card.delta > 0,
      text: `${card.delta > 0 ? '+' : ''}${card.delta}%`,
    };
  }

  // ----- Stock donut -----
  get stockLegend(): { label: string; count: number; pct: number; color: string }[] {
    if (!this.data) return [];
    const s = this.data.stockSummary;
    const total = s.inStock + s.lowStock + s.outOfStock || 1;
    return [
      { label: 'In Stock', count: s.inStock, pct: Math.round((s.inStock / total) * 100), color: '#10b981' },
      { label: 'Low Stock', count: s.lowStock, pct: Math.round((s.lowStock / total) * 100), color: '#fbbf24' },
      { label: 'Out of Stock', count: s.outOfStock, pct: Math.round((s.outOfStock / total) * 100), color: '#ef4444' },
    ];
  }

  get stockTotal(): number {
    if (!this.data) return 0;
    const s = this.data.stockSummary;
    return s.inStock + s.lowStock + s.outOfStock;
  }

  // ----- Order Status donut -----
  get orderStatusTotal(): number {
    return (this.data?.statusBreakdown ?? []).reduce((n, s) => n + s.count, 0);
  }

  get orderStatusLegend(): { label: string; count: number; pct: number; color: string }[] {
    const map = new Map((this.data?.statusBreakdown ?? []).map((s) => [s.status, s.count]));
    const total = this.orderStatusTotal || 1;
    return ORDER_STATUS_ORDER.map((status) => {
      const count = map.get(status) ?? 0;
      return {
        label: ORDER_STATUS_LABELS[status] ?? status,
        count,
        pct: Math.round((count / total) * 100),
        color: ORDER_STATUS_COLORS[status] ?? '#94a3b8',
      };
    });
  }

  // ----- Recent orders -----
  get recentOrders(): Order[] {
    return this.data?.recentOrders ?? [];
  }

  get hasSales(): boolean {
    return (this.data?.revenueSeries ?? []).some((b) => b.revenue > 0);
  }

  get granularityLabel(): string {
    switch (this.data?.granularity ?? 'daily') {
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      default:
        return 'Daily';
    }
  }

  statusPill(status: string): string {
    return STATUS_PILL[status] ?? 'bg-slate-100 text-slate-600';
  }

  statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  initials(name: string): string {
    return name.trim().slice(0, 2).toUpperCase();
  }

  orderDate(order: Order): string {
    try {
      return new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  // ----- Charts -----
  private renderCharts(): void {
    if (!this.data || !this.salesCanvas) return;
    this.destroyCharts();

    const dark = this.themeService.isDark;
    const grid = dark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.07)';
    const tick = dark ? '#94a3b8' : '#64748b';
    const indigo = dark ? '#818cf8' : '#6366f1';

    // Bar: revenue across the active range (daily/weekly/monthly granularity)
    const series = this.data.revenueSeries ?? [];
    const salesCtx = this.salesCanvas.nativeElement.getContext('2d');
    let barBg: string | CanvasGradient = indigo;
    if (salesCtx) {
      const grad = salesCtx.createLinearGradient(0, 0, 0, 300);
      grad.addColorStop(0, dark ? '#a5b4fc' : '#6366f1');
      grad.addColorStop(1, dark ? '#4338ca' : '#c7d2fe');
      barBg = grad;
    }
    this.charts.push(
      new Chart(this.salesCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: series.map((b) => b.label),
          datasets: [
            {
              label: 'Revenue',
              data: series.map((b) => b.revenue),
              backgroundColor: barBg,
              borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 2, bottomRight: 2 },
              maxBarThickness: 26,
              hoverBackgroundColor: dark ? '#818cf8' : '#4f46e5',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => `${items[0]?.label ?? ''} · ${this.analyticsService.rangeLabel}`,
                label: (ctx) => ` Revenue: $${formatNumber(Number(ctx.raw ?? 0))}`,
              },
              backgroundColor: dark ? '#1e293b' : '#0f172a',
              titleColor: dark ? '#cbd5e1' : '#e2e8f0',
              bodyColor: '#f8fafc',
              padding: 10,
              cornerRadius: 8,
              caretSize: 5,
              borderColor: dark ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.08)',
              borderWidth: 1,
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: tick } },
            y: {
              beginAtZero: true,
              grid: { color: grid },
              ticks: { color: tick, callback: (v) => `$${v}` },
              border: { display: false },
            },
          },
        },
      })
    );

    // Donut: stock status
    this.charts.push(
      new Chart(this.stockCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.stockSlices().labels,
          datasets: [{ data: this.stockSlices().values, backgroundColor: this.stockSlices().colors, borderWidth: 0, hoverOffset: 6 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => (items[0]?.label ?? ''),
                label: (ctx) => {
                  const total = this.stockTotal || 1;
                  const pct = Math.round(((ctx.raw as number) / total) * 100);
                  return ` ${ctx.label}: ${ctx.raw} products (${pct}%)`;
                },
              },
              backgroundColor: dark ? '#1e293b' : '#0f172a',
              bodyColor: '#f8fafc',
              padding: 10,
              cornerRadius: 8,
              caretSize: 5,
            },
          },
        },
      })
    );

    // Donut: order status breakdown
    const statusSlices = this.orderStatusSlices();
    this.charts.push(
      new Chart(this.orderStatusCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: statusSlices.labels,
          datasets: [{ data: statusSlices.values, backgroundColor: statusSlices.colors, borderWidth: 0, hoverOffset: 6 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => (items[0]?.label ?? ''),
                label: (ctx) => {
                  const total = this.orderStatusTotal || 1;
                  const pct = Math.round(((ctx.raw as number) / total) * 100);
                  return ` ${ctx.label}: ${ctx.raw} order${(ctx.raw as number) === 1 ? '' : 's'} (${pct}%)`;
                },
              },
              backgroundColor: dark ? '#1e293b' : '#0f172a',
              bodyColor: '#f8fafc',
              padding: 10,
              cornerRadius: 8,
              caretSize: 5,
            },
          },
        },
      })
    );
  }

  private stockSlices(): { labels: string[]; values: number[]; colors: string[] } {
    const s = this.data?.stockSummary ?? { inStock: 0, lowStock: 0, outOfStock: 0 };
    return {
      labels: ['In Stock', 'Low Stock', 'Out of Stock'],
      values: [s.inStock, s.lowStock, s.outOfStock],
      colors: ['#10b981', '#fbbf24', '#ef4444'],
    };
  }

  private orderStatusSlices(): { labels: string[]; values: number[]; colors: string[] } {
    return this.orderStatusLegend.reduce(
      (acc, it) => {
        acc.labels.push(it.label);
        acc.values.push(it.count);
        acc.colors.push(it.color);
        return acc;
      },
      { labels: [] as string[], values: [] as number[], colors: [] as string[] }
    );
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }
}