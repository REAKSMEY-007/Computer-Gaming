import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from './product.service';

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  private storageKey = 'wishlist_items';
  private itemsSubject = new BehaviorSubject<string[]>(this.loadFromStorage());
  wishlistItems$ = this.itemsSubject.asObservable();

  private loadFromStorage(): string[] {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    }
    return [];
  }

  private save(items: string[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
    this.itemsSubject.next(items);
  }

  getItems(): string[] {
    return this.itemsSubject.value;
  }

  isWishlisted(productId: string): boolean {
    return this.itemsSubject.value.includes(productId);
  }

  toggle(product: Product): void {
    const items = this.itemsSubject.value;
    const idx = items.indexOf(product._id);
    if (idx >= 0) {
      items.splice(idx, 1);
    } else {
      items.push(product._id);
    }
    this.save([...items]);
  }

  clear(): void {
    this.save([]);
  }
}