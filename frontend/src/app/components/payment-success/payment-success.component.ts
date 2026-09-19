import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderService, Order } from '../../services/order.service';
import { PricePipe } from '../../pipes/price.pipe';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule, RouterLink, PricePipe],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.scss',
})
export class PaymentSuccessComponent implements OnInit, OnDestroy {
  order: Order | null = null;
  loading = true;
  error = '';
  toastVisible = true;
  fallbackOrderNumber = '';

  private querySub!: Subscription;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    // Toast "Payment received successfully!" auto-fades after a few seconds.
    this.toastTimer = setTimeout(() => (this.toastVisible = false), 6000);
    this.querySub = this.route.queryParamMap.subscribe((q) => {
      const orderId = q.get('orderId');
      const orderNumber = q.get('orderNumber');
      if (!orderId) {
        this.loading = false;
        this.error = 'No order reference was provided.';
        return;
      }
      this.fallbackOrderNumber = orderNumber ?? '';
      this.load(orderId);
    });
  }

  private load(orderId: string): void {
    this.loading = true;
    this.error = '';
    this.orderService.getOrder(orderId).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'We could not load your order right now. Please check your order history.';
      },
    });
  }

  get reference(): string {
    return this.order?.orderNumber ?? this.fallbackOrderNumber;
  }

  get isPaid(): boolean {
    return this.order?.isPaid || this.order?.paymentStatus === 'confirmed';
  }

  totalQty(): number {
    return this.order?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  }

  orderDate(): string {
    if (!this.order) return '';
    return new Date(this.order.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  paidAtDate(): string {
    if (!this.order?.paidAt) return '';
    return new Date(this.order.paidAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  paymentMethodLabel(): string {
    if (!this.order) return '';
    if (this.order.paymentMethod === 'card') return 'Credit / Debit Card';
    if (this.order.paymentMethod === 'khqr') return 'Bakong KHQR';
    return 'Bank Transfer (ABA)';
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }
}