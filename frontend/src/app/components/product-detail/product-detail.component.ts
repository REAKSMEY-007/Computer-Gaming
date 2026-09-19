import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductService, Product, Category } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService } from '../../services/auth.service';
import { ShippingService } from '../../services/shipping.service';
import { PricePipe } from '../../pipes/price.pipe';
import { RevealDirective } from '../../directives/reveal.directive';
import { TiltDirective } from '../../directives/tilt.directive';
import { AbsoluteUrlPipe } from '../../pipes/absolute-url.pipe';

const COMPONENT_KEYS = new Set([
  'cpu', 'processor', 'gpu', 'graphics', 'graphics card', 'vga', 'vram',
  'ram', 'memory', 'motherboard', 'mainboard', 'storage', 'ssd', 'hdd', 'drive',
  'power supply', 'psu', 'power', 'case', 'chassis', 'cooling', 'os',
  'operating system',
]);

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, PricePipe, RevealDirective, TiltDirective, AbsoluteUrlPipe],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: Product | null = null;
  categories: Category[] = [];
  isLoading = true;
  notFound = false;

  quantity = 1;
  activeImageIndex = 0;
  recentlyAdded = false;

  showStickyBar = false;

  wishlistIds: Set<string> = new Set();

  private routeSub!: Subscription;
  private categoriesSub!: Subscription;
  private wishlistSub!: Subscription;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private authService: AuthService,
    private shippingService: ShippingService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.shippingService.load();
    this.categoriesSub = this.productService.getCategories().subscribe((cats) => {
      this.categories = cats;
    });

    this.wishlistSub = this.wishlistService.wishlistItems$.subscribe((ids) => {
      this.wishlistIds = new Set(ids);
    });

    this.routeSub = this.route.paramMap.subscribe((params) => this.loadProduct(params));
  }

  shippingSubtitle(): string {
    const cfg = this.shippingService.config;
    if (!cfg.enabled || cfg.freeShippingThreshold <= 0) return 'On every order';
    return `On orders over $${cfg.freeShippingThreshold}`;
  }

  private loadProduct(params: ParamMap): void {
    const slug = params.get('productSlug');
    if (!slug) {
      this.notFound = true;
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.notFound = false;
    this.productService.getProductBySlug(slug).subscribe({
      next: (product) => {
        this.product = product;
        this.quantity = product.stock > 0 ? 1 : 0;
        this.activeImageIndex = 0;
        this.isLoading = false;
        setTimeout(() => this.updateStickyBar(), 0);
      },
      error: () => {
        this.notFound = true;
        this.isLoading = false;
      },
    });
  }

  // ——— Breadcrumbs ———
  get breadcrumbs(): { label: string; link?: (string | number)[] }[] {
    const crumbs: { label: string; link?: (string | number)[] }[] = [
      { label: 'Home', link: ['/'] },
    ];
    if (!this.product || !this.categories.length) return crumbs;

    const cat = this.categories.find((c) => c.name === this.product!.category);
    if (cat?.parentCategory) {
      const parent = this.categories.find((c) => c.name === cat.parentCategory);
      if (parent) {
        crumbs.push({ label: parent.name, link: ['/products', parent.slug] });
      }
    }
    if (cat) {
      crumbs.push({ label: cat.name, link: ['/products', cat.slug] });
    }
    crumbs.push({ label: this.product.name });
    return crumbs;
  }

  private get categoryParent(): string {
    if (!this.product) return '';
    return (
      this.categories.find((c) => c.name === this.product!.category)?.parentCategory ?? ''
    );
  }

  get isComputerPart(): boolean {
    return this.categoryParent === 'Computer Parts';
  }

  get isPcLaptop(): boolean {
    return this.categoryParent === 'PC & Laptop';
  }

  // ——— Specifications ———
  private get rawSpecs(): Record<string, unknown> {
    const p = this.product;
    if (!p) return {};
    if (p.specifications && Object.keys(p.specifications).length) {
      return p.specifications as Record<string, unknown>;
    }
    return (p.specs ?? {}) as Record<string, unknown>;
  }

  private isComponentKey(key: string): boolean {
    const k = key.toLowerCase().replace(/[_\s]+/g, ' ').trim();
    if (COMPONENT_KEYS.has(k)) return true;
    if (COMPONENT_KEYS.has(key.toLowerCase().trim())) return true;
    return COMPONENT_KEYS.has(key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().trim());
  }

  get insideComponents(): { key: string; value: string }[] {
    if (!this.isPcLaptop) return [];
    return Object.entries(this.rawSpecs)
      .filter(([k]) => this.isComponentKey(k))
      .map(([k, v]) => ({ key: this.formatSpecKey(k), value: String(v ?? '') }))
      .filter((e) => e.value.trim() !== '');
  }

  get specEntries(): { key: string; value: string }[] {
    const entries = Object.entries(this.rawSpecs)
      .map(([k, v]) => ({ key: this.formatSpecKey(k), value: String(v ?? '') }))
      .filter((e) => e.value.trim() !== '');
    if (this.isPcLaptop && this.insideComponents.length) {
      const insideKeys = new Set(this.insideComponents.map((c) => c.key));
      return entries.filter((e) => !insideKeys.has(e.key));
    }
    return entries;
  }

  get hasSpecs(): boolean {
    return this.specEntries.length > 0;
  }

  formatSpecKey(key: string): string {
    const words = key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_\s]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => {
        const lower = w.toLowerCase();
        const upper = w.toUpperCase();
        const acronyms = new Set([
          'cpu', 'gpu', 'ram', 'ssd', 'hdd', 'usb', 'rgb', 'led', 'hdr',
          'anc', 'oled', 'ips', 'qhd', 'uhd', 'pcie', 'hd', 'va', 'psu',
          'os', 'qmk', 'via', 'g', 'w', 'tbp',
        ]);
        if (lower === 'pcie') return 'PCIe';
        if (lower === 'mac' || lower === 'win') return w === 'win' ? 'Windows' : w;
        if (acronyms.has(lower)) return upper;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      });
    return words.join(' ');
  }

  // ——— Gallery ———
  get galleryImages(): string[] {
    const p = this.product;
    if (!p || !p.image) return [];
    const extras = (p.images ?? []).filter((src) => src && src !== p.image);
    return [p.image, ...extras];
  }

  setActiveImage(index: number): void {
    this.activeImageIndex = index;
  }

  // ——— Price / stock ———
  effectivePrice(): number {
    return this.product?.discountPrice ?? this.product?.price ?? 0;
  }

  hasDiscount(): boolean {
    return (this.product?.discount ?? 0) > 0;
  }

  savings(): number {
    if (!this.product) return 0;
    return Math.round((this.product.price - this.effectivePrice()) * 100) / 100;
  }

  stockLabel(): string {
    const s = this.product?.stock ?? 0;
    if (s === 0) return 'Sold out';
    if (s <= 5) return 'Low stock';
    return 'In stock';
  }

  get outOfStock(): boolean {
    return (this.product?.stock ?? 0) === 0;
  }

  // ——— Quantity ———
  increaseQty(): void {
    const p = this.product;
    if (!p) return;
    if (this.quantity < p.stock) this.quantity += 1;
  }

  decreaseQty(): void {
    if (this.quantity > 1) this.quantity -= 1;
  }

  // ——— Cart / wishlist ———
  addToCart(): void {
    const p = this.product;
    if (!p || this.outOfStock) return;
    if (!this.requireAuth()) return;
    this.cartService.addItem(p, this.quantity);
    this.recentlyAdded = true;
    setTimeout(() => (this.recentlyAdded = false), 1500);
  }

  buyNow(): void {
    const p = this.product;
    if (!p || this.outOfStock) return;
    if (!this.requireAuth()) return;
    this.cartService.addItem(p, this.quantity);
    this.router.navigate(['/cart']);
  }

  toggleWishlist(): void {
    if (!this.product) return;
    if (!this.requireAuth()) return;
    this.wishlistService.toggle(this.product);
  }

  isWishlisted(): boolean {
    return !!this.product && this.wishlistIds.has(this.product._id);
  }

  private requireAuth(): boolean {
    if (this.authService.isLoggedIn()) {
      return true;
    }
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
    return false;
  }

  starValues(): number[] {
    return [1, 2, 3, 4, 5];
  }

  isStarFilled(star: number): boolean {
    return Math.round(this.product?.rating ?? 0) >= star;
  }

  // ——— Mobile sticky buy bar ———
  private isMobileViewport(): boolean {
    return window.innerWidth < 1024; // matches Tailwind `lg` breakpoint
  }

  private updateStickyBar(): void {
    if (!this.product || !this.isMobileViewport()) {
      this.showStickyBar = false;
      return;
    }
    const sentinel = document.getElementById('buy-sentinel');
    if (!sentinel) {
      this.showStickyBar = false;
      return;
    }
    // Show the bar only once the main Add to Cart controls have scrolled out of view.
    this.showStickyBar = sentinel.getBoundingClientRect().bottom < 0;
  }

  @HostListener('window:scroll')
  private onWindowScroll(): void {
    this.updateStickyBar();
  }

  @HostListener('window:resize')
  private onWindowResize(): void {
    this.updateStickyBar();
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.categoriesSub?.unsubscribe();
    this.wishlistSub?.unsubscribe();
  }
}