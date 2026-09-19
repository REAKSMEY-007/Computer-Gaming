import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';
import { Product } from '../../services/product.service';
import { OrderService, Order } from '../../services/order.service';
import { AuthService, DeliveryAddress } from '../../services/auth.service';
import { ShippingService } from '../../services/shipping.service';
import { PricePipe } from '../../pipes/price.pipe';
import { RevealDirective } from '../../directives/reveal.directive';
import { AbsoluteUrlPipe } from '../../pipes/absolute-url.pipe';
import { KhqrModalComponent } from '../khqr-modal/khqr-modal.component';
import { KhqrPaymentResult } from '../../services/payment.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PricePipe, RevealDirective, KhqrModalComponent, AbsoluteUrlPipe],
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
  pendingOrderId = '';
  pendingOrderNumber = '';

  addresses: DeliveryAddress[] = [];
  selectedAddressId = '';
  showAddForm = false;
  addingLocation = false;
  addLocationError = '';

  addressForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private orderService: OrderService,
    private authService: AuthService,
    private shippingService: ShippingService,
    private router: Router
  ) {
    this.addressForm = this.fb.group({
      fullName: ['', Validators.required],
      city: ['', Validators.required],
      address: ['', Validators.required],
      postalCode: [''],
      country: ['Cambodia'],
    });
  }

  ngOnInit(): void {
    this.shippingService.load();
    const user = this.authService.currentUser;
    if (user) {
      this.addresses = user.addresses ?? [];
      this.selectDefaultAddress();
      this.addressForm.patchValue({ fullName: user.username || '' });
    }
    this.cartService.cartItems$.subscribe((items) => {
      this.items = items;
      this.total = this.cartService.getTotal();
    });
  }

  get selectedAddress(): DeliveryAddress | null {
    return this.addresses.find((a) => a._id === this.selectedAddressId) ?? null;
  }

  private selectDefaultAddress(): void {
    const preferred = this.addresses.find((a) => a.isDefault) || this.addresses[0];
    this.selectedAddressId = preferred?._id || '';
  }

  selectAddress(addr: DeliveryAddress): void {
    this.selectedAddressId = (addr && addr._id) || '';
    this.checkoutError = '';
  }

  toggleAddAddressForm(): void {
    this.showAddForm = !this.showAddForm;
    this.addLocationError = '';
    if (this.showAddForm) {
      this.addressForm.reset({ fullName: this.authService.currentUser?.username || '', country: 'Cambodia' });
    }
  }

  submitNewAddress(): void {
    const f = this.addressForm.value;
    const fullName = (f.fullName ?? '').trim();
    const city = (f.city ?? '').trim();
    const address = (f.address ?? '').trim();
    const postalCode = (f.postalCode ?? '').trim();
    const country = (f.country ?? 'Cambodia').trim() || 'Cambodia';
    if (!fullName || !city || !address) {
      this.addLocationError = 'Full name, street address and city are required.';
      return;
    }
    this.addingLocation = true;
    this.addLocationError = '';
    this.authService
      .addAddress({ fullName, address, city, postalCode, country })
      .subscribe({
        next: (res) => {
          this.addingLocation = false;
          this.addresses = res.user.addresses ?? [];
          const added = this.addresses[this.addresses.length - 1];
          this.selectedAddressId = added?._id || '';
          this.showAddForm = false;
          this.addLocationError = '';
          this.checkoutError = '';
          this.addressForm.reset({ fullName: res.user.username || '', country: 'Cambodia' });
        },
        error: (err) => {
          this.addingLocation = false;
          this.addLocationError = err.error?.message || 'Could not save this location.';
        },
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
    if (this.placingOrder) return;

    // A delivery location is required before payment can start.
    const ship = this.selectedAddress;
    if (!ship) {
      this.checkoutError = 'Please choose a delivery location before proceeding to payment.';
      document.getElementById('delivery-location')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // The order is created BEFORE the QR is scanned so the auto-verification
    // endpoint (/api/payments/verify-khqr) has a record to mark as PAID as soon
    // as Bakong confirms the transfer lands.
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
      status: 'pending_payment',
      paymentMethod: 'khqr',
      proofOfPayment: {
        reference: '',
        note: 'Paid via Bakong KHQR',
      },
      shippingAddress: {
        fullName: ship.fullName.trim(),
        address: ship.address.trim(),
        city: ship.city.trim(),
        postalCode: ship.postalCode.trim(),
        country: ship.country.trim(),
      },
    };

    this.orderService.createOrder(payload).subscribe({
      next: (saved) => {
        this.placingOrder = false;
        this.pendingOrderId = saved._id;
        this.pendingOrderNumber = saved.orderNumber;
        // The server is authoritative on the total after shipping/tax rules.
        this.totalAmount = saved.totalPrice;
        this.khqrBillNumber = saved.orderNumber;
        this.showKhqrModal = true;
      },
      error: (err) => {
        this.placingOrder = false;
        this.checkoutError = err.error?.message || 'Could not place your order. Please try again.';
      },
    });
  }

  onPaymentSuccess(result: KhqrPaymentResult): void {
    this.checkoutError = '';
    // Payment confirmed by Bakong: close the QR modal, drop the cart and land
    // the user on the success page which shows the animated confirmation.
    this.showKhqrModal = false;
    this.cartService.clearCart();
    const orderId = result.orderId || this.pendingOrderId;
    this.router.navigate(['/payment-success'], {
      queryParams: {
        ...(orderId ? { orderId } : {}),
        orderNumber: result.orderNumber || this.pendingOrderNumber || undefined,
      },
    });
  }

  onModalClosed(): void {
    // Modal dismissed before payment settled — the pending order stays in order
    // history for tracking (no QR to re-open since the md5 was never persisted).
    this.showKhqrModal = false;
  }
}