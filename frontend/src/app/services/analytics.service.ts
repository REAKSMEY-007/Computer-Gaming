import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Order } from './order.service';

export interface StatCard {
  key: 'orders' | 'revenue' | 'avgOrderValue' | 'customers' | 'products' | 'lowStock';
  label: string;
  value: number;
  delta: number;
  /** Value of the same metric in the previous period (baseline for the delta). */
  prev?: number;
  /** Change amount to display when the previous baseline is 0 (avoids a fake "+100%"). */
  periodAdd?: number;
  currency?: boolean;
}

export interface StatusSlice {
  status: Order['status'] | string;
  count: number;
}

export interface StockSummary {
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export type RevenueGranularity = 'daily' | 'weekly' | 'monthly';

export interface RevenueBucket {
  label: string;
  revenue: number;
  orders: number;
}

export interface CustomRange {
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
}

export interface OrderStatusDatum {
  status: string;
  count: number;
}

export interface AnalyticsResponse {
  stats: StatCard[];
  statusBreakdown: OrderStatusDatum[];
  stockSummary: StockSummary;
  granularity: RevenueGranularity;
  revenueSeries: RevenueBucket[];
  recentOrders: Order[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private apiUrl = 'http://localhost:3000/api/orders/analytics';

  private dateRangeDaysSubject = new BehaviorSubject<number>(30);
  private customRangeSubject = new BehaviorSubject<CustomRange | null>(null);

  /** Emits whenever the active range (preset or custom) changes. */
  range$: Observable<{ days: number; custom: CustomRange | null }> = combineLatest([
    this.dateRangeDaysSubject,
    this.customRangeSubject,
  ]).pipe(map(([days, custom]) => ({ days, custom })));

  constructor(private http: HttpClient) {}

  get dateRangeDays(): number {
    return this.dateRangeDaysSubject.getValue();
  }

  get customRange(): CustomRange | null {
    return this.customRangeSubject.getValue();
  }

  get isCustomRange(): boolean {
    return !!this.customRangeSubject.getValue();
  }

  /** Length of the currently active range, in days. */
  get rangeDays(): number {
    const c = this.customRangeSubject.getValue();
    if (c) {
      const start = new Date(c.start + 'T00:00:00').getTime();
      const end = new Date(c.end + 'T00:00:00').getTime();
      return Math.max(1, Math.round((end - start) / 86400000) + 1);
    }
    return this.dateRangeDays;
  }

  /** Human label for the active range, e.g. "Last 30 days" or "Sep 1 – Sep 10, 2026". */
  get rangeLabel(): string {
    const c = this.customRangeSubject.getValue();
    if (c) return `${AnalyticsService.formatRangeDate(c.start)} – ${AnalyticsService.formatRangeDate(c.end)}`;
    return `Last ${this.dateRangeDays} days`;
  }

  private static formatRangeDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  setDateRange(days: number): void {
    this.customRangeSubject.next(null);
    this.dateRangeDaysSubject.next(days);
  }

  setCustomRange(start: string, end: string): void {
    this.customRangeSubject.next({ start, end });
  }

  getAnalytics(): Observable<AnalyticsResponse> {
    let params = new HttpParams().set('days', String(this.dateRangeDays));
    const c = this.customRangeSubject.getValue();
    if (c) {
      params = params.set('startDate', c.start).set('endDate', c.end);
    }
    return this.http.get<AnalyticsResponse>(this.apiUrl, { params });
  }
}