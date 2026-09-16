import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from './product.service';

export interface CartItem {
  product: Product;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private storageKey = 'cart_items';
  private cartItemsSubject = new BehaviorSubject<CartItem[]>(this.loadFromStorage());
  cartItems$ = this.cartItemsSubject.asObservable();
  cartCount$ = this.cartItems$.pipe(
    map((items) => items.reduce((sum, item) => sum + item.quantity, 0))
  );
  cartTotal$ = this.cartItems$.pipe(
    map((items) => items.reduce((sum, item) => sum + CartService.effectivePrice(item.product) * item.quantity, 0))
  );

  static effectivePrice(product: Product): number {
    return product.discountPrice ?? product.price;
  }

  private loadFromStorage(): CartItem[] {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    }
    return [];
  }

  private saveToStorage(items: CartItem[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
    this.cartItemsSubject.next(items);
  }

  getItems(): CartItem[] {
    return this.cartItemsSubject.value;
  }

  addItem(product: Product, quantity: number = 1): void {
    const items = this.getItems();
    const existing = items.find((item) => item.product._id === product._id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ product, quantity });
    }
    this.saveToStorage([...items]);
  }

  removeItem(productId: string): void {
    const items = this.getItems().filter((item) => item.product._id !== productId);
    this.saveToStorage(items);
  }

  updateQuantity(productId: string, quantity: number): void {
    const items = this.getItems();
    const item = items.find((i) => i.product._id === productId);
    if (item) {
      item.quantity = quantity;
      if (item.quantity <= 0) {
        this.removeItem(productId);
        return;
      }
    }
    this.saveToStorage([...items]);
  }

  getTotal(): number {
    return this.getItems().reduce(
      (sum, item) => sum + CartService.effectivePrice(item.product) * item.quantity,
      0
    );
  }

  getItemCount(): number {
    return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  isInCart(productId: string): boolean {
    return this.getItems().some((item) => item.product._id === productId);
  }

  clearCart(): void {
    this.saveToStorage([]);
  }
}
