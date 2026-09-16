import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';
import { Product } from '../../services/product.service';
import { OrderService, Order } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { ShippingService } from '../../services/shipping.service';
import { PricePipe } from '../../pipes/price.pipe';
import { KhqrModalComponent } from '../khqr-modal/khqr-modal.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PricePipe, KhqrModalComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent implements OnInit {
  items: CartItem[] = [];
  total = 0;
  checkoutError = '';
  showKhqrModal = false;
  totalAmount = 0;
  khqrBillNumber = '';
  placingOrder = false;
  orderPlaced = false;

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private authService: AuthService,
    private shippingService: ShippingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.shippingService.load();
    this.cartService.cartItems$.subscribe((items) => {
      this.items = items;
      this.total = this.cartService.getTotal();
    });
  }

  price(item: CartItem): number {
    return CartService.effectivePrice(item.product);
  }

  hasDiscount(product: Product): boolean {
    return (product.discount ?? 0) > 0;
  }

  originalSubtotal(): number {
    return this.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  savings(): number {
    return this.originalSubtotal() - this.total;
  }

  shipping(): number {
    return this.shippingService.estimate(this.total);
  }

  shippingEnabled(): boolean {
    return this.shippingService.config.enabled;
  }

  shippingThreshold(): number {
    return this.shippingService.config.freeShippingThreshold;
  }

  grandTotal(): number {
    return this.total + this.shipping();
  }

  remainingForFreeShipping(): number {
    return Math.max(0, this.shippingThreshold() - this.total);
  }

  freeShippingProgress(): number {
    return Math.min(100, (this.total / this.shippingThreshold()) * 100);
  }

  updateQuantity(productId: string, quantity: number): void {
    this.cartService.updateQuantity(productId, quantity);
  }

  removeItem(productId: string): void {
    this.cartService.removeItem(productId);
  }

  openKhqrModal(): void {
    this.checkoutError = '';
    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/cart' } });
      return;
    }
    if (this.items.length === 0) return;
    this.totalAmount = this.grandTotal();
    this.khqrBillNumber = `INV-${Date.now()}`;
    this.placingOrder = false;
    this.orderPlaced = false;
    this.showKhqrModal = true;
  }

  onPaymentSuccess(transactionMd5: string): void {
    this.checkoutError = '';
    if (this.placingOrder) return;
    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/cart' } });
      return;
    }

    this.placingOrder = true;
    const itemsPrice = this.total;
    const shippingPrice = this.shipping();
    const itemsPayload = this.items.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      price: CartService.effectivePrice(item.product),
      quantity: item.quantity,
      image: item.product.image ?? '',
    }));

    const payload: Partial<Order> = {
      customer: user.id,
      customerName: user.username,
      customerEmail: user.email,
      items: itemsPayload,
      itemsPrice,
      shippingPrice,
      taxPrice: 0,
      totalPrice: itemsPrice + shippingPrice,
      status: 'processing',
      paymentMethod: 'khqr',
      khqrMd5: transactionMd5,
      proofOfPayment: {
        reference: transactionMd5,
        note: 'Paid via Bakong KHQR',
      },
      shippingAddress: {
        fullName: user.username,
        address: '',
        city: '',
        postalCode: '',
        country: '',
      },
    };

    this.orderService.createOrder(payload).subscribe({
      next: (saved) => {
        this.placingOrder = false;
        this.orderPlaced = true;
        this.cartService.clearCart();
        // Keep the modal open so the success screen is visible; it auto-closes
        // after a short delay and `onModalClosed()` navigates to order history.
      },
      error: (err) => {
        this.placingOrder = false;
        this.showKhqrModal = false;
        this.checkoutError = err.error?.message || 'Could not place your order. Please try again.';
      },
    });
  }

  onModalClosed(): void {
    this.showKhqrModal = false;
    if (this.orderPlaced) {
      this.orderPlaced = false;
      this.router.navigate(['/profile/orders']);
    }
  }
}