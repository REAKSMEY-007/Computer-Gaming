import { Component, OnInit, OnDestroy, HostListener, Input, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProductService, Category } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService, AppUser } from '../../services/auth.service';
import { NotificationService, AppNotification } from '../../services/notification.service';
import { RealtimeService } from '../../services/realtime.service';
import { SiteConfigService } from '../../services/site-config.service';
import { ShippingService } from '../../services/shipping.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { NotificationDropdownComponent } from '../notification-dropdown/notification-dropdown.component';
import { CartDrawerComponent } from '../cart-drawer/cart-drawer.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule, ThemeToggleComponent, NotificationDropdownComponent, CartDrawerComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  menuOpen = false;
  cartDrawerOpen = false;
  categories: Category[] = [];
  searchQuery = '';
  selectedCategory = '';
  cartCount = 0;
  wishlistCount = 0;
  user: AppUser | null = null;
  userMenuOpen = false;
  categoryDropdownOpen = false;
  isScrolled = false;
  searchFocused = false;

  notifications: AppNotification[] = [];
  unreadCount = 0;
  bellOpen = false;
  notifLoading = false;

  private lastCartPop = -1;
  private lastWishPop = -1;
  private lastNotifPop = -1;
  private notifSub: Subscription | null = null;

  private subs: Subscription[] = [];

  constructor(
    private el: ElementRef<HTMLElement>,
    public router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private realtimeService: RealtimeService,
    public configService: SiteConfigService,
    public shippingService: ShippingService
  ) {}

  ngOnInit(): void {
    this.configService.load();
    this.shippingService.load();
    this.isScrolled = window.scrollY > 8;
    this.subs.push(
      this.productService.getCategories().subscribe((cats) => {
        this.categories = cats;
      }),
      this.cartService.cartCount$.subscribe((count) => {
        this.cartCount = count;
        this.popBadge('cart', count);
      }),
      this.wishlistService.wishlistItems$.subscribe((ids) => {
        this.wishlistCount = ids.length;
        this.popBadge('wishlist', ids.length);
      }),
      this.authService.currentUser$.subscribe((user) => {
        this.user = user;
        if (!user) {
          this.userMenuOpen = false;
          this.bellOpen = false;
          this.notifications = [];
          this.unreadCount = 0;
          this.notifSub?.unsubscribe();
        } else {
          this.refreshNotifications();
          this.subscribeNotifications();
        }
      })
    );
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-user-menu]')) {
      this.userMenuOpen = false;
    }
    if (!target.closest('[data-notif-menu]')) {
      this.bellOpen = false;
    }
    if (!target.closest('[data-category-dropdown], [data-category-panel]')) {
      this.categoryDropdownOpen = false;
    }
    if (!target.closest('[data-search-area]')) {
      this.searchFocused = false;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(_event: KeyboardEvent): void {
    this.userMenuOpen = false;
    this.bellOpen = false;
    this.categoryDropdownOpen = false;
    this.searchFocused = false;
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    this.isScrolled = window.scrollY > 8;
  }

  onSearch(): void {
    const params: Record<string, string> = {};
    if (this.searchQuery.trim()) params['q'] = this.searchQuery.trim();
    if (this.selectedCategory) params['category'] = this.selectedCategory;
    this.menuOpen = false;
    this.categoryDropdownOpen = false;
    this.searchFocused = false;

    // Blur the active search input so the suggestions panel collapses
    // immediately after the search is executed.
    const active = document.activeElement as HTMLElement | null;
    if (active && this.el.nativeElement.contains(active)) {
      active.blur();
    }

    this.router.navigate(['/products'], { queryParams: params });
  }

  goToWishlist(): void {
    this.menuOpen = false;
    this.router.navigate(['/products'], { queryParams: { wishlist: 'true' } });
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }

  toggleCategoryDropdown(event: Event): void {
    event.stopPropagation();
    // Keep the "Popular searches" suggestion panel hidden while the category
    // menu is open (both float below the same search bar).
    this.searchFocused = false;
    this.categoryDropdownOpen = !this.categoryDropdownOpen;
  }

  selectCategory(name: string, event: Event): void {
    event.stopPropagation();
    this.selectedCategory = name;
    this.categoryDropdownOpen = false;
  }

  // ---- notifications ----

  refreshNotifications(): void {
    this.notifLoading = true;
    this.notificationService.getNotifications(20).subscribe({
      next: (data) => {
        this.notifications = data.notifications;
        if (data.unreadCount !== this.unreadCount) {
          this.unreadCount = data.unreadCount;
          this.popBadge('notif', data.unreadCount);
        }
        this.notifLoading = false;
      },
      error: () => {
        this.notifLoading = false;
      },
    });
  }

  private subscribeNotifications(): void {
    this.notifSub?.unsubscribe();
    this.notifSub = this.realtimeService.onNotification().subscribe(() => {
      this.refreshNotifications();
    });
  }

  toggleBell(event: Event): void {
    event.stopPropagation();
    this.bellOpen = !this.bellOpen;
    if (this.bellOpen) this.refreshNotifications();
  }

  onNotificationClick(notification: AppNotification): void {
    if (!notification.read) {
      notification.read = true;
      notification.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.notificationService.markRead(notification._id).subscribe(() => {});
    }
    this.bellOpen = false;
    if (notification.order) {
      this.router.navigate(['/profile/orders'], { queryParams: { order: notification.order } });
    } else if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  markAllNotificationsRead(): void {
    if (this.unreadCount === 0) return;
    this.notificationService.markAllRead().subscribe(() => {
      this.unreadCount = 0;
      this.notifications.forEach((n) => {
        n.read = true;
        n.isRead = true;
      });
    });
  }

  dismissNotification(notification: AppNotification): void {
    this.notificationService.deleteNotification(notification._id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter((n) => n._id !== notification._id);
        if (!notification.read) {
          this.unreadCount = Math.max(0, this.unreadCount - 1);
          this.popBadge('notif', this.unreadCount);
        }
      },
      error: () => {
        // Keep the notification in the list so the user can retry.
      },
    });
  }

  goToOrderHistory(): void {
    this.userMenuOpen = false;
    this.menuOpen = false;
    this.router.navigate(['/profile/orders']);
  }

  get isAdmin(): boolean {
    return !!this.user && this.user.role === 'admin';
  }

  get isLoggedIn(): boolean {
    return !!this.user;
  }

  get leafCategories(): Category[] {
    return this.categories.filter((c) => !!c.parentCategory);
  }

  get parentSections(): Category[] {
    return this.categories.filter((c) => !c.parentCategory);
  }

  childrenOf(parentName: string): Category[] {
    return this.categories.filter((c) => c.parentCategory === parentName);
  }

  navigateTo(route: string): void {
    this.menuOpen = false;
    this.router.navigateByUrl(route);
  }

  get displayName(): string {
    if (!this.user) return '';
    const first = this.user.username.trim();
    return first ? `Hi, ${first}` : first;
  }

  get initials(): string {
    if (!this.user) return '';
    const name = this.user.username.trim() || this.user.email.trim();
    return name.slice(0, 2).toUpperCase();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  setSearchFocus(focused: boolean): void {
    this.searchFocused = focused;
  }

  /** Replays the pop-in animation every time the cart/wishlist/notif count changes. */
  popBadge(kind: 'cart' | 'wishlist' | 'notif', count: number): void {
    const el = this.el?.nativeElement.querySelector(
      kind === 'cart'
        ? '[data-cart-badge]'
        : kind === 'wishlist'
          ? '[data-wish-badge]'
          : '[data-notif-badge]'
    ) as HTMLElement | null;
    if (!el || count <= 0) return;
    const last = kind === 'cart' ? this.lastCartPop : kind === 'wishlist' ? this.lastWishPop : this.lastNotifPop;
    if (count === last) return;
    el.classList.remove('badge-pop');
    void el.offsetWidth;
    el.classList.add('badge-pop');
    if (kind === 'cart') this.lastCartPop = count;
    else if (kind === 'wishlist') this.lastWishPop = count;
    else this.lastNotifPop = count;
  }

  goToProfile(): void {
    this.userMenuOpen = false;
    this.menuOpen = false;
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.userMenuOpen = false;
    this.menuOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.notifSub?.unsubscribe();
  }
}