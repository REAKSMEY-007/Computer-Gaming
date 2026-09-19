import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService, CartItem } from '../../services/cart.service';
import { Product } from '../../services/product.service';
import { ShippingService } from '../../services/shipping.service';
import { PricePipe } from '../../pipes/price.pipe';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, PricePipe],
  templateUrl: './cart-drawer.component.html',
  styles: [
    `
      @keyframes drawer-item-in {
        from {
          opacity: 0;
          transform: translateX(12px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      .drawer-item {
        animation: drawer-item-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) backwards;
      }
      @media (prefers-reduced-motion: reduce) {
        .drawer-item {
          animation: none;
        }
      }
    `,
  ],
})
export class CartDrawerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  items: CartItem[] = [];
  total = 0;

  private sub?: Subscription;
  private previousOverflow = '';

  constructor(
    private cartService: CartService,
    private shippingService: ShippingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.shippingService.load();
    this.sub = this.cartService.cartItems$.subscribe((items) => {
      this.items = items;
      this.total = this.cartService.getTotal();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.open ? this.lockScroll() : this.unlockScroll();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.unlockScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  get itemCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  price(item: CartItem): number {
    return CartService.effectivePrice(item.product);
  }

  lineTotal(item: CartItem): number {
    return this.price(item) * item.quantity;
  }

  hasDiscount(product: Product): boolean {
    return (product.discount ?? 0) > 0;
  }

  meta(product: Product): string {
    const parts = [product.brand, product.category].filter(
      (part): part is string => !!part && part.trim().length > 0
    );
    return parts.slice(0, 2).join(' · ');
  }

  subtotal(): number {
    return this.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  savings(): number {
    return this.subtotal() - this.total;
  }

  shippingEnabled(): boolean {
    return this.shippingService.config.enabled;
  }

  shippingThreshold(): number {
    return this.shippingService.config.freeShippingThreshold;
  }

  shipping(): number {
    return this.shippingService.estimate(this.total);
  }

  grandTotal(): number {
    return this.total + this.shipping();
  }

  remainingForFreeShipping(): number {
    return Math.max(0, this.shippingThreshold() - this.total);
  }

  freeShippingProgress(): number {
    if (this.shippingThreshold() <= 0) return 100;
    return Math.min(100, (this.total / this.shippingThreshold()) * 100);
  }

  increment(item: CartItem): void {
    this.cartService.updateQuantity(item.product._id, item.quantity + 1);
  }

  decrement(item: CartItem): void {
    this.cartService.updateQuantity(item.product._id, item.quantity - 1);
  }

  remove(productId: string): void {
    this.cartService.removeItem(productId);
  }

  close(): void {
    this.closed.emit();
  }

  continueShopping(): void {
    this.close();
    this.router.navigate(['/products']);
  }

  goToCheckout(): void {
    this.close();
    this.router.navigate(['/cart']);
  }

  private lockScroll(): void {
    if (typeof document === 'undefined') return;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = this.previousOverflow;
  }
}
