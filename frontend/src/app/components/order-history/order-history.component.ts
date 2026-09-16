import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderService, Order, ORDER_STATUS_LABELS } from '../../services/order.service';
import { PricePipe } from '../../pipes/price.pipe';

const STATUS_CLASSES: Record<string, string> = {
  pending_payment:
    'bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
  pending: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  processing:
    'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
  shipped:
    'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300',
  delivered:
    'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400',
  cancelled:
    'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400',
};

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PricePipe],
  templateUrl: './order-history.component.html',
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  totalResults = 0;
  page = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 20];
  loading = true;
  error = '';
  expandedId: string | null = null;

  private routeSub!: Subscription;
  private ordersSub!: Subscription;

  constructor(
    private orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParamMap.subscribe((q) => {
      const order = q.get('order');
      if (order && order !== this.expandedId) this.expandedId = order;
      const pageRaw = Number(q.get('page'));
      if (Number.isInteger(pageRaw) && pageRaw > 0) this.page = pageRaw;
      const sizeRaw = Number(q.get('size'));
      if (this.pageSizeOptions.includes(sizeRaw)) this.pageSize = sizeRaw;
      this.load();
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalResults / this.pageSize));
  }

  get pageNumbers(): (number | string)[] {
    const total = this.totalPages;
    const cur = this.page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: (number | string)[] = [1];
    const start = Math.max(2, cur - 1);
    const end = Math.min(total - 1, cur + 1);
    if (start > 2) out.push('...');
    for (let i = start; i <= end; i++) out.push(i);
    if (end < total - 1) out.push('...');
    out.push(total);
    return out;
  }

  pageNumber(n: number | string): number {
    return Number(n);
  }

  pageStart(): number {
    return this.totalResults === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.totalResults);
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.ordersSub?.unsubscribe();
    this.ordersSub = this.orderService
      .getMyOrdersPaginated({ page: this.page, limit: this.pageSize })
      .subscribe({
        next: (data) => {
          if (data.total > 0 && this.page > this.totalPages) {
            this.page = this.totalPages;
            this.syncParams();
            return;
          }
          this.orders = data.orders;
          this.totalResults = data.total;
          this.loading = false;
          if (this.expandedId) {
            setTimeout(() => {
              const el = document.getElementById(`order-${this.expandedId}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 60);
          }
        },
        error: () => {
          this.loading = false;
          this.error = 'Something went wrong loading your orders. Please try again.';
        },
      });
  }

  toggleOrder(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.page = p;
    this.syncParams();
  }

  onPageSizeChange(size: number): void {
    if (size === this.pageSize) return;
    this.pageSize = size;
    this.page = 1;
    this.syncParams();
  }

  private syncParams(): void {
    const query: Record<string, string> = {};
    if (this.expandedId) query['order'] = this.expandedId;
    if (this.page > 1) query['page'] = String(this.page);
    if (this.pageSize !== 10) query['size'] = String(this.pageSize);
    this.router.navigate(['/profile/orders'], { queryParams: query, replaceUrl: true });
  }

  // ---- display helpers ----

  statusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  statusClass(status: string): string {
    return STATUS_CLASSES[status] ?? STATUS_CLASSES['pending'];
  }

  totalQty(order: Order): number {
    return order.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  orderDate(order: Order): string {
    return new Date(order.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  orderTime(order: Order): string {
    return new Date(order.createdAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  itemSubtotal(item: Order['items'][number]): number {
    return item.price * item.quantity;
  }

  addressLine(order: Order): string {
    const a = order.shippingAddress ?? {};
    return [a.address, a.city, a.postalCode, a.country].filter(Boolean).join(', ');
  }

  paymentMethodLabel(order: Order): string {
    if (order.paymentMethod === 'card') return 'Credit / Debit Card';
    if (order.paymentMethod === 'khqr') return 'Bakong KHQR';
    return 'Bank Transfer (ABA)';
  }

  isBankTransfer(order: Order): boolean {
    return (order.paymentMethod ?? 'bank_transfer') === 'bank_transfer';
  }

  hasProofScreenshot(order: Order): boolean {
    return !!order.proofOfPayment?.screenshot;
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.ordersSub?.unsubscribe();
  }
}