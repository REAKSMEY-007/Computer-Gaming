import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription, combineLatest, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProductService, Product, Category } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService } from '../../services/auth.service';
import { PricePipe } from '../../pipes/price.pipe';
import { RevealDirective } from '../../directives/reveal.directive';
import { TiltDirective } from '../../directives/tilt.directive';

const SORT_KEYS = ['newest', 'price', '-price', 'rating', 'name', 'top-selling', 'discount'];

interface LoadedState {
  q: string;
  cat: string;
  brand: string;
  w: boolean;
  d: boolean;
  sort: string;
  price: string;
  stock: boolean;
  page: number;
  size: number;
}

export interface PriceRangeOption {
  key: string;
  label: string;
  min?: number;
  max?: number;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PricePipe, RevealDirective, TiltDirective],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css'
})
export class ProductListComponent implements OnInit, OnDestroy {
  @ViewChild('gridTop') gridTopRef?: ElementRef<HTMLElement>;

  products: Product[] = [];
  totalResults = 0;
  page = 1;
  pageSize = 10;
  pageSizeOptions = [10, 20, 50];
  categories: Category[] = [];
  isLoading = true;
  errorMessage = '';

  searchQuery = '';
  selectedCategory = '';
  selectedBrand = '';
  wishlistOnly = false;
  discountOnly = false;
  sortBy = 'newest';
  priceRange = '';
  inStockOnly = false;
  viewMode: 'grid' | 'list' = 'grid';

  priceRanges: PriceRangeOption[] = [
    { key: 'under50', label: 'Under $50', max: 50 },
    { key: '50-200', label: '$50 – $200', min: 50, max: 200 },
    { key: '200plus', label: '$200+', min: 200 },
  ];

  wishlistIds: Set<string> = new Set();
  recentlyAdded: Set<string> = new Set();
  skeletonCards = Array.from({ length: 8 });

  private routeSub!: Subscription;
  private productsSub!: Subscription;
  private categoriesSub!: Subscription;
  private wishlistSub!: Subscription;
  private search$ = new Subject<string>();
  private loaded: LoadedState | null = null;
  private pendingScroll = false;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.routeSub = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(
      ([params, query]) => this.applyRouteState(params, query)
    );

    this.categoriesSub = this.productService.getCategories().subscribe((cats) => {
      this.categories = cats;
      this.applyRouteState(this.route.snapshot.paramMap, this.route.snapshot.queryParamMap);
    });

    this.wishlistSub = this.wishlistService.wishlistItems$.subscribe((ids) => {
      this.wishlistIds = new Set(ids);
      if (this.wishlistOnly && this.loaded) this.loadPage();
    });

    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.syncToUrl();
    });
  }

  // ---- route state → server fetch ----

  private applyRouteState(params: ParamMap, query: ParamMap): void {
    const brand = (query.get('brand') ?? '').trim();
    const slug = params.get('categorySlug') ?? '';
    const cat = brand ? null : this.categories.find((c) => c.slug === slug);
    const c = cat ? cat.name : (brand ? '' : (query.get('category') ?? ''));
    const q = query.get('q') ?? '';
    const w = query.get('wishlist') === 'true';
    const d = query.get('deals') === 'true';
    const sortRaw = query.get('sort') ?? 'newest';
    const s = SORT_KEYS.includes(sortRaw) ? sortRaw : 'newest';
    const priceRaw = query.get('price') ?? '';
    const price = this.priceRanges.some((r) => r.key === priceRaw) ? priceRaw : '';
    const st = query.get('stock') === 'true';
    const sizeRaw = Number(query.get('size'));
    const size = this.pageSizeOptions.includes(sizeRaw) ? sizeRaw : 10;
    const urlPage = Math.max(1, parseInt(query.get('page') ?? '', 10) || 1);

    const L = this.loaded;
    const filtersChanged =
      !L ||
      L.q !== q ||
      L.cat !== c ||
      L.brand !== brand ||
      L.w !== w ||
      L.d !== d ||
      L.sort !== s ||
      L.price !== price ||
      L.stock !== st;
    const sizeChanged = !L || L.size !== size;

    this.searchQuery = q;
    this.selectedCategory = c;
    this.selectedBrand = brand;
    this.wishlistOnly = w;
    this.discountOnly = d;
    this.sortBy = s;
    this.priceRange = price;
    this.inStockOnly = st;
    this.pageSize = size;
    this.page = filtersChanged && L ? 1 : urlPage;

    if (!filtersChanged && !sizeChanged && L && L.page === urlPage) return;
    this.loadPage();
  }

  private loadPage(): void {
    this.isLoading = true;
    this.productsSub?.unsubscribe();
    const bounds = this.priceBounds();
    const common = {
      page: this.page,
      limit: this.pageSize,
      search: this.searchQuery || undefined,
      category: this.selectedCategory || undefined,
      brand: this.selectedBrand || undefined,
      sort: this.discountOnly && this.sortBy === 'newest' ? 'discount' : this.sortBy,
      deals: this.discountOnly,
      minPrice: bounds.min,
      maxPrice: bounds.max,
      inStock: this.inStockOnly || undefined,
    };
    const src = this.wishlistOnly
      ? this.productService.getProductsPaginated({ ...common, limit: 0 })
      : this.productService.getProductsPaginated(common);

    this.productsSub = src.subscribe({
      next: (data) => {
        if (this.wishlistOnly) {
          const filtered = this.sortProducts(data.products.filter((p) => this.wishlistIds.has(p._id)));
          this.totalResults = filtered.length;
          const start = (this.page - 1) * this.pageSize;
          this.products = filtered.slice(start, start + this.pageSize);
        } else {
          this.products = data.products;
          this.totalResults = data.total;
          if (data.total > 0 && this.page > this.totalPages) {
            this.page = this.totalPages;
            this.syncToUrl();
            return;
          }
        }
        this.isLoading = false;
        this.errorMessage = '';
        this.loaded = {
          q: this.searchQuery,
          cat: this.selectedCategory,
          brand: this.selectedBrand,
          w: this.wishlistOnly,
          d: this.discountOnly,
          sort: this.sortBy,
          price: this.priceRange,
          stock: this.inStockOnly,
          page: this.page,
          size: this.pageSize,
        };
        if (this.pendingScroll) {
          this.pendingScroll = false;
          this.scrollToGridTop();
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load products';
        this.isLoading = false;
      },
    });
  }

  // ---- pagination ----

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

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.page = p;
    this.pendingScroll = true;
    this.syncToUrl();
  }

  onPageSizeChange(size: number): void {
    if (size === this.pageSize) return;
    this.pageSize = size;
    this.page = 1;
    this.syncToUrl();
  }

  private scrollToGridTop(): void {
    const el = this.gridTopRef?.nativeElement;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, y - 200), behavior: 'smooth' });
  }

  // ---- sorting (client-side, used by the wishlist path) ----

  private sortProducts(list: Product[]): Product[] {
    const price = (p: Product) => p.discountPrice ?? p.price;
    switch (this.sortBy) {
      case 'newest':
        list.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        );
        break;
      case 'price':
        list.sort((a, b) => price(a) - price(b));
        break;
      case '-price':
        list.sort((a, b) => price(b) - price(a));
        break;
      case 'rating':
        list.sort(
          (a, b) =>
            (b.rating ?? 0) - (a.rating ?? 0) ||
            (b.numReviews ?? 0) - (a.numReviews ?? 0)
        );
        break;
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'top-selling':
        list.sort(
          (a, b) =>
            (b.isTopSelling ? 1 : 0) - (a.isTopSelling ? 1 : 0) ||
            (b.numReviews ?? 0) - (a.numReviews ?? 0)
        );
        break;
      case 'discount':
        list.sort(
          (a, b) =>
            (b.discount ?? 0) - (a.discount ?? 0) || price(b) - price(a)
        );
        break;
      default:
        break;
    }
    return list;
  }

  // ---- user interactions → URL ----

  onSearchInput(value: string): void {
    this.searchQuery = value;
    this.search$.next(value);
  }

  clearSearch(): void {
    this.onSearchInput('');
  }

  clearCategoryFilter(): void {
    this.selectedCategory = '';
    this.page = 1;
    this.syncToUrl();
  }

  clearBrandFilter(): void {
    this.selectedBrand = '';
    this.page = 1;
    this.syncToUrl();
  }

  toggleDeals(): void {
    this.discountOnly = !this.discountOnly;
    this.page = 1;
    this.syncToUrl();
  }

  toggleWishlistOnly(): void {
    this.wishlistOnly = !this.wishlistOnly;
    this.page = 1;
    this.syncToUrl();
  }

  onSortChange(value: string): void {
    this.sortBy = value;
    this.page = 1;
    this.syncToUrl();
  }

  selectPriceRange(key: string): void {
    this.priceRange = this.priceRange === key ? '' : key;
    this.page = 1;
    this.syncToUrl();
  }

  toggleInStock(): void {
    this.inStockOnly = !this.inStockOnly;
    this.page = 1;
    this.syncToUrl();
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  priceBounds(): { min?: number; max?: number } {
    const range = this.priceRanges.find((r) => r.key === this.priceRange);
    return range ? { min: range.min, max: range.max } : {};
  }

  activeFilterCount(): number {
    let count = 0;
    if (this.searchQuery.trim()) count++;
    if (this.selectedCategory) count++;
    if (this.selectedBrand) count++;
    if (this.priceRange) count++;
    if (this.inStockOnly) count++;
    if (this.discountOnly) count++;
    if (this.wishlistOnly) count++;
    return count;
  }

  priceRangeLabel(): string {
    return this.priceRanges.find((r) => r.key === this.priceRange)?.label ?? '';
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = '';
    this.selectedBrand = '';
    this.wishlistOnly = false;
    this.discountOnly = false;
    this.priceRange = '';
    this.inStockOnly = false;
    this.sortBy = 'newest';
    this.page = 1;
    this.syncToUrl();
  }

  private syncToUrl(): void {
    const params: Record<string, string> = {};
    if (this.selectedBrand) params['brand'] = this.selectedBrand;
    if (this.searchQuery.trim()) params['q'] = this.searchQuery.trim();
    if (this.wishlistOnly) params['wishlist'] = 'true';
    if (this.discountOnly) params['deals'] = 'true';
    if (this.priceRange) params['price'] = this.priceRange;
    if (this.inStockOnly) params['stock'] = 'true';
    if (this.sortBy !== 'newest') params['sort'] = this.sortBy;
    if (this.page > 1) params['page'] = String(this.page);
    if (this.pageSize !== 10) params['size'] = String(this.pageSize);

    const base: string[] =
      this.selectedCategory && !this.selectedBrand
        ? ['/products', this.slugFor(this.selectedCategory)]
        : ['/products'];
    this.router.navigate(base, { queryParams: params, replaceUrl: true });
  }

  private slugFor(name: string): string {
    return this.categories.find((c) => c.name === name)?.slug ?? name;
  }

  // ---- cards ----

  productRoute(product: Product): (string | number)[] {
    return ['/products', this.slugFor(product.category), product.slug ?? product._id];
  }

  addToCart(product: Product): void {
    if (!this.requireAuth()) return;
    if (product.stock <= 0) return;
    this.cartService.addItem(product);
    this.recentlyAdded.add(product._id);
    setTimeout(() => this.recentlyAdded.delete(product._id), 1500);
  }

  toggleWishlist(product: Product): void {
    if (!this.requireAuth()) return;
    this.wishlistService.toggle(product);
  }

  isWishlisted(id: string): boolean {
    return this.wishlistIds.has(id);
  }

  private requireAuth(): boolean {
    if (this.authService.isLoggedIn()) {
      return true;
    }
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
    return false;
  }

  isRecentlyAdded(id: string): boolean {
    return this.recentlyAdded.has(id);
  }

  effectivePrice(p: Product): number {
    return p.discountPrice ?? p.price;
  }

  starValues(): number[] {
    return [1, 2, 3, 4, 5];
  }

  isStarFilled(p: Product, star: number): boolean {
    return Math.round(p.rating ?? 0) >= star;
  }

  wishlistButtonClass(product: Product): string {
    const base =
      'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 focus:outline-none active:translate-y-0.5 active:scale-90 backdrop-blur-md ring-1';
    const state = this.isWishlisted(product._id)
      ? 'bg-rose-500/90 text-white ring-rose-400/50 shadow-[0_4px_12px_-2px_rgba(244,63,94,0.6)] hover:bg-rose-500'
      : 'bg-white/80 text-slate-600 ring-white/60 shadow-[0_4px_12px_-3px_rgba(15,23,42,0.25)] hover:bg-rose-500/90 hover:text-white hover:ring-rose-400/50 hover:shadow-[0_4px_12px_-2px_rgba(244,63,94,0.6)] dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-600/60';
    return `${base} ${state}`;
  }

  addButtonClass(product: Product): string {
    const base =
      'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-all duration-200 active:translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';
    const state = this.isRecentlyAdded(product._id)
      ? 'bg-success-500 hover:bg-success-600 shadow-[0_8px_18px_-6px_rgba(16,185,129,0.55)] active:shadow-[0_2px_4px_-2px_rgba(16,185,129,0.4)]'
      : 'bg-primary-600 hover:bg-primary-700 shadow-[0_8px_18px_-6px_rgba(79,70,229,0.55)] active:shadow-[0_2px_4px_-2px_rgba(79,70,229,0.4)]';
    return `${base} ${state}`;
  }

  addButtonClassCompact(product: Product): string {
    const base =
      'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-all duration-200 active:translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';
    const state = this.isRecentlyAdded(product._id)
      ? 'bg-success-500 hover:bg-success-600'
      : 'bg-primary-600 hover:bg-primary-700';
    return `${base} ${state}`;
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.productsSub?.unsubscribe();
    this.categoriesSub?.unsubscribe();
    this.wishlistSub?.unsubscribe();
  }
}