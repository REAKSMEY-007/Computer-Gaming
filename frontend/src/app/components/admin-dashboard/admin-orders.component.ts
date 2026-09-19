import {
  Component,
  OnInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  OrderService,
  Order,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from '../../services/order.service';
import { PricePipe } from '../../pipes/price.pipe';

type StatusFilter = Order['status'] | 'all';
type PaymentFilter = 'all' | 'confirmed' | 'awaiting' | 'rejected';
type SortKey = 'newest' | 'oldest' | 'total_desc' | 'total_asc';

const PAGE_SIZE = 10;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: ORDER_STATUS_LABELS['pending_payment'], cls: 'badge-amber' },
  pending: { label: ORDER_STATUS_LABELS['pending'], cls: 'badge-amber' },
  processing: { label: ORDER_STATUS_LABELS['processing'], cls: 'badge-indigo' },
  shipped: { label: ORDER_STATUS_LABELS['shipped'], cls: 'badge-blue' },
  delivered: { label: ORDER_STATUS_LABELS['delivered'], cls: 'badge-teal' },
  cancelled: { label: ORDER_STATUS_LABELS['cancelled'], cls: 'badge-red' },
  returned: { label: 'Returned', cls: 'badge-red' },
  pickup: { label: 'Pickup', cls: 'badge-orange' },
};

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, PricePipe],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.css', './admin-orders.badges.css', './admin-orders.drawer.css'],
})
export class AdminOrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  // ---- Filters / toolbar ----
  statusFilter: StatusFilter = 'all';
  paymentFilter: PaymentFilter = 'all';
  dateFrom = '';
  dateTo = '';
  sortKey: SortKey = 'newest';
  advancedOpen = false;
  searchQuery = '';
  customerFilterId: string | null = null;
  customerFilterName = '';

  // ---- Selection ----
  selectedIds = new Set<string>();

  // ---- Row action menu + drawer ----
  menuForId: string | null = null;
  drawerOrder: Order | null = null;
  drawerOpen = false;
  footerMenuOpen = false;

  verifyingId: string | null = null;
  statuses = ORDER_STATUSES;
  pageSize = PAGE_SIZE;
  currentPage = 1;

  statusOptions: StatusFilter[] = ['all', ...ORDER_STATUSES];
  paymentOptions: { value: PaymentFilter; label: string }[] = [
    { value: 'all', label: 'Payment: All' },
    { value: 'confirmed', label: 'Paid' },
    { value: 'awaiting', label: 'Awaiting' },
    { value: 'rejected', label: 'Rejected' },
  ];
  sortOptions: { value: SortKey; label: string }[] = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'total_desc', label: 'Total: High to Low' },
    { value: 'total_asc', label: 'Total: Low to High' },
  ];

  constructor(private orderService: OrderService, private route: ActivatedRoute) {}

  private pendingOrderId: string | null = null;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.searchQuery = q;
    const order = this.route.snapshot.queryParamMap.get('order');
    if (order) this.pendingOrderId = order;
    this.loadOrders();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.drawerOpen = false;
    this.menuForId = null;
    this.footerMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-row-menu]')) this.menuForId = null;
    if (!target.closest('[data-footer-menu]')) this.footerMenuOpen = false;
  }

  // ================================================================
  //  Data pipeline: filtered -> sorted -> paged
  // ================================================================

  get filteredOrders(): Order[] {
    const q = this.searchQuery.trim().toLowerCase();
    const from = this.dateFrom ? new Date(this.dateFrom + 'T00:00:00').getTime() : null;
    const to = this.dateTo ? new Date(this.dateTo + 'T23:59:59.999').getTime() : null;
    return this.orders.filter((o) => {
      if (this.statusFilter !== 'all' && o.status !== this.statusFilter) return false;
      if (this.paymentFilter !== 'all' && this.paymentFilter === 'confirmed' && o.paymentStatus !== 'confirmed') return false;
      if (this.paymentFilter === 'awaiting' && (o.paymentStatus === 'confirmed' || o.paymentStatus === 'rejected')) return false;
      if (this.paymentFilter === 'rejected' && o.paymentStatus !== 'rejected') return false;
      if (this.customerFilterId && o.customer !== this.customerFilterId) return false;
      const t = new Date(o.createdAt).getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q)
      );
    });
  }

  get sortedFiltered(): Order[] {
    const list = [...this.filteredOrders];
    list.sort((a, b) => {
      switch (this.sortKey) {
        case 'oldest':
          return +new Date(a.createdAt) - +new Date(b.createdAt);
        case 'total_desc':
          return b.totalPrice - a.totalPrice;
        case 'total_asc':
          return a.totalPrice - b.totalPrice;
        default:
          return +new Date(b.createdAt) - +new Date(a.createdAt);
      }
    });
    return list;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sortedFiltered.length / this.pageSize));
  }

  get pagedOrders(): Order[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedFiltered.slice(start, start + this.pageSize);
  }

  get filteredCount(): number {
    return this.sortedFiltered.length;
  }

  get pageRangeLabel(): string {
    if (this.sortedFiltered.length === 0) return '';
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.sortedFiltered.length);
    return `Showing ${start}–${end} of ${this.sortedFiltered.length}`;
  }

  setPage(p: number | string): void {
    if (typeof p !== 'number') return;
    this.currentPage = Math.min(this.totalPages, Math.max(1, p));
  }

  get pageNumbers(): (number | string)[] {
    const total = this.totalPages;
    const cur = this.currentPage;
    if (total <= 1) return [1];
    const nums: (number | string)[] = [1];
    const start = Math.max(2, cur - 1);
    const end = Math.min(total - 1, cur + 1);
    if (start > 2) nums.push('…');
    for (let n = start; n <= end; n++) nums.push(n);
    if (end < total - 1) nums.push('…');
    nums.push(total);
    return nums;
  }

  // ================================================================
  //  Selection
  // ================================================================

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelection(id: string, event: Event): void {
    event.stopPropagation();
    this.selectedIds.has(id) ? this.selectedIds.delete(id) : this.selectedIds.add(id);
  }

  get pageSelected(): boolean {
    return this.pagedOrders.length > 0 && this.pagedOrders.every((o) => this.selectedIds.has(o._id));
  }

  get hasPartialSelection(): boolean {
    return this.pagedOrders.some((o) => this.selectedIds.has(o._id)) && !this.pageSelected;
  }

  toggleSelectPage(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.pagedOrders.forEach((o) => this.selectedIds.add(o._id));
    else this.pagedOrders.forEach((o) => this.selectedIds.delete(o._id));
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  bulkAction(status: Order['status']): void {
    const ids = [...this.selectedIds];
    if (ids.length === 0) return;
    if (!confirm(`Update ${ids.length} selected order(s) to "${ORDER_STATUS_LABELS[status]}"?`)) return;
    ids.forEach((id, i) => {
      this.orderService.updateOrderStatus(id, status).subscribe({
        next: (updated) => {
          const idx = this.orders.findIndex((o) => o._id === id);
          if (idx !== -1) this.orders[idx] = updated;
          if (i === ids.length - 1) {
            this.successMessage = `Updated ${ids.length} order(s) to ${ORDER_STATUS_LABELS[status]}.`;
            this.clearSelection();
          }
        },
        error: () => {
          if (i === ids.length - 1) this.errorMessage = 'Failed to update some orders.';
        },
      });
    });
  }

  // ================================================================
  //  Display helpers
  // ================================================================

  statusMeta(status: string): { label: string; cls: string } {
    return STATUS_META[status] ?? { label: status, cls: 'badge-neutral' };
  }

  paymentMeta(order: Order): { label: string; cls: string } {
    if (order.paymentStatus === 'confirmed' || order.isPaid) return { label: 'Paid', cls: 'badge-green' };
    if (order.paymentStatus === 'rejected') return { label: 'Rejected', cls: 'badge-red' };
    return { label: 'Awaiting', cls: 'badge-amber' };
  }

  statusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  initials(name: string): string {
    return (name.trim().slice(0, 2) || '?').toUpperCase();
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

  totalQty(order: Order): number {
    return order.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  proofOf(order: Order): Order['proofOfPayment'] {
    return order.proofOfPayment;
  }

  shipToLabel(order: Order): string {
    const a = order.shippingAddress;
    if (!a) return '\u2014';
    const place = [a.city, a.country].filter(Boolean).join(', ');
    return [a.fullName, place && `\u00B7 ${place}`].filter(Boolean).join(' ');
  }

  get pendingPaymentCount(): number {
    return this.orders.filter((o) => o.paymentStatus !== 'confirmed' && o.status !== 'cancelled').length;
  }

  get revenue(): number {
    return this.orders
      .filter((o) => ['processing', 'shipped', 'delivered'].includes(o.status))
      .reduce((sum, o) => sum + o.totalPrice, 0);
  }

  // ================================================================
  //  Drawer
  // ================================================================

  openDrawer(order: Order): void {
    this.drawerOrder = order;
    this.drawerOpen = true;
    this.menuForId = null;
    this.footerMenuOpen = false;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.footerMenuOpen = false;
  }

  filterByCustomer(order: Order): void {
    this.customerFilterId = order.customer;
    this.customerFilterName = order.customerName;
    this.currentPage = 1;
    this.closeDrawer();
  }

  resetFilters(): void {
    this.statusFilter = 'all';
    this.paymentFilter = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    this.customerFilterId = null;
    this.customerFilterName = '';
    this.sortKey = 'newest';
    this.searchQuery = '';
    this.currentPage = 1;
  }

  // ================================================================
  //  Order actions
  // ================================================================

  changeStatus(order: Order, status: Order['status']): void {
    if (status === order.status || order.status === 'pending_payment') return;
    if (!confirm(`Change order ${order.orderNumber} to "${this.statusLabel(status)}"?`)) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.orderService.updateOrderStatus(order._id, status).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex((o) => o._id === order._id);
        if (idx !== -1) this.orders[idx] = updated;
        if (this.drawerOrder?._id === order._id) this.drawerOrder = updated;
        this.successMessage = `Order ${updated.orderNumber} marked as ${this.statusLabel(updated.status)}.`;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to update order';
      },
    });
  }

  trackOrder(order: Order): void {
    const next: Order['status'] = order.status === 'shipped' ? 'delivered' : 'shipped';
    const label = this.statusLabel(next);
    if (!confirm(`Mark order ${order.orderNumber} as ${label}?`)) return;
    this.changeStatus(order, next);
  }

  refundOrder(order: Order): void {
    if (!confirm(`Refund order ${order.orderNumber}? The order will be cancelled and stock returned.`)) return;
    this.changeStatus(order, 'cancelled');
  }

  confirmPayment(order: Order): void {
    if (!confirm(`Confirm payment for order ${order.orderNumber}? It will move to Processing.`)) return;
    this.verify(order, 'confirm');
  }

  rejectPayment(order: Order): void {
    const reason = prompt(
      `Reject payment for order ${order.orderNumber}? (Optional reason shown to customer)`,
      ''
    );
    if (reason === null) return;
    if (!confirm(`Reject payment for order ${order.orderNumber}? It will be cancelled and stock returned.`)) return;
    this.verify(order, 'reject', reason.trim() || 'Payment could not be verified');
  }

  copyOrderId(order: Order): void {
    navigator.clipboard?.writeText(order.orderNumber).then(
      () => (this.successMessage = `Copied ${order.orderNumber}.`),
      () => {}
    );
  }

  eligibleStatuses(order: Order): Order['status'][] {
    const statuses: Order['status'][] = ['processing', 'shipped', 'delivered', 'cancelled'];
    return statuses.filter((s) => s !== order.status);
  }

  private verify(order: Order, action: 'confirm' | 'reject', reason?: string): void {
    this.verifyingId = order._id;
    this.errorMessage = '';
    this.successMessage = '';
    this.orderService.verifyPayment(order._id, action, reason).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex((o) => o._id === order._id);
        if (idx !== -1) this.orders[idx] = updated;
        if (this.drawerOrder?._id === order._id) this.drawerOrder = updated;
        this.verifyingId = null;
        this.successMessage =
          action === 'confirm'
            ? `Payment confirmed for ${updated.orderNumber}. Order moved to Processing.`
            : `Payment rejected for ${updated.orderNumber}. Order cancelled.`;
      },
      error: (err) => {
        this.verifyingId = null;
        this.errorMessage = err.error?.message || 'Failed to verify payment';
      },
    });
  }

  loadOrders(): void {
    this.loading = true;
    this.errorMessage = '';
    this.orderService.getOrders().subscribe({
      next: (data) => {
        this.orders = data;
        this.loading = false;
        if (this.pendingOrderId) {
          const target = this.orders.find((o) => o._id === this.pendingOrderId);
          this.pendingOrderId = null;
          if (target) this.openDrawer(target);
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load orders';
        this.loading = false;
      },
    });
  }
}