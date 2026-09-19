import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Router,
  NavigationEnd,
  RouterOutlet,
  RouterLink,
} from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  LucideLayoutDashboard,
  LucidePackage,
  LucideBoxes,
  LucideShoppingCart,
  LucideTruck,
  LucideMail,
  LucideSettings,
  LucideUser,
  LucideLogOut,
  LucideMenu,
  LucideChevronsLeft,
  LucideX,
  LucideCalendarDays,
  LucideArrowLeft,
  LucideChevronDown,
  LucideCheck,
} from '@lucide/angular';
import { AuthService, AppUser } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { AnalyticsService } from '../../services/analytics.service';
import { SiteConfigService } from '../../services/site-config.service';
import { NotificationService, AppNotification } from '../../services/notification.service';
import { RealtimeService } from '../../services/realtime.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { NotificationDropdownComponent } from '../notification-dropdown/notification-dropdown.component';

type TabId = 'overview' | 'products' | 'categories' | 'orders' | 'messages' | 'shipping' | 'settings' | 'profile';

interface NavItem {
  id: TabId;
  label: string;
  route: string;
  icon: string;
}

const RANGES: { days: number; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
LucideLayoutDashboard,
    LucidePackage,
    LucideBoxes,
    LucideShoppingCart,
    LucideTruck,
    LucideMail,
    LucideSettings,
    LucideUser,
    LucideLogOut,
    LucideMenu,
    LucideChevronsLeft,
    LucideX,
    LucideCalendarDays,
    LucideArrowLeft,
    LucideChevronDown,
    LucideCheck,
    ThemeToggleComponent,
    NotificationDropdownComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnDestroy {
  sidebarCollapsed = false;
  mobileNavOpen = false;
  ranges = RANGES;
  activeTab: TabId = 'overview';
  pageTitle = 'Overview';
  userMenuOpen = false;

  // ---- Quick search ----
  quickSearch = '';
  @ViewChild('quickSearchInput') quickSearchInput!: ElementRef<HTMLInputElement>;

  // ---- Notifications ----
  bellOpen = false;
  notifications: AppNotification[] = [];
  unreadCount = 0;
  notifLoading = false;

  // ---- Date-range picker ---- 
  rangeOpen = false;
  customMode = false;
  rangeError = '';
  fromDate = '';
  toDate = '';

  navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', route: '/admin/overview', icon: 'lucideLayoutDashboard' },
    { id: 'products', label: 'Products', route: '/admin/products', icon: 'lucidePackage' },
    { id: 'categories', label: 'Categories', route: '/admin/categories', icon: 'lucideBoxes' },
    { id: 'orders', label: 'Orders', route: '/admin/orders', icon: 'lucideShoppingCart' },
    { id: 'messages', label: 'Messages', route: '/admin/messages', icon: 'lucideMail' },
    { id: 'shipping', label: 'Shipping', route: '/admin/shipping', icon: 'lucideTruck' },
  ];

  private routerSub!: Subscription;
  private notifSub: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    public themeService: ThemeService,
    public analyticsService: AnalyticsService,
    public configService: SiteConfigService,
    private notificationService: NotificationService,
    private realtimeService: RealtimeService
  ) {
    this.configService.load();
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.syncFromUrl());
    this.syncFromUrl();
    authService.currentUser$.subscribe((u) => {
      if (u) {
        this.refreshNotifications();
        this.subscribeNotifications();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.notifSub?.unsubscribe();
  }

  private syncFromUrl(): void {
    const url = this.router.url.split('?')[0].replace(/\/+$/, '') || '/admin';
    const seg = url.split('/').pop() ?? 'overview';
    if (seg === 'settings') {
      this.activeTab = 'settings';
      this.pageTitle = 'Settings';
      return;
    }
    if (seg === 'profile') {
      this.activeTab = 'profile';
      this.pageTitle = 'Profile';
      return;
    }
    const item = this.navItems.find((n) => n.id === seg);
    this.activeTab = (item?.id ?? 'overview') as TabId;
    this.pageTitle = item?.label ?? 'Overview';
  }

  get user(): AppUser | null {
    return this.authService.currentUser;
  }

  get userName(): string {
    return this.user?.username ?? 'Admin';
  }

  get userInitials(): string {
    const name = this.user?.username || '';
    return name.slice(0, 2).toUpperCase();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-admin-user-menu]')) {
      this.userMenuOpen = false;
    }
    if (!target.closest('[data-admin-notif-menu]')) {
      this.bellOpen = false;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(_event: KeyboardEvent): void {
    this.userMenuOpen = false;
    this.bellOpen = false;
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const t = event.target as HTMLElement | null;
    const tag = t?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
    event.preventDefault();
    this.quickSearchInput?.nativeElement.focus();
  }

  get pageHeading(): string {
    switch (this.activeTab) {
      case 'overview':
        return 'Dashboard Overview';
      case 'products':
        return 'Products Management';
      case 'categories':
        return 'Categories Management';
      case 'orders':
        return 'Orders Management';
      case 'messages':
        return 'Customer Messages';
      case 'shipping':
        return 'Shipping & Delivery';
      case 'settings':
        return 'Store Settings';
      case 'profile':
        return 'My Profile';
      default:
        return 'Overview';
    }
  }

  get subtitle(): string {
    return this.activeTab === 'overview'
      ? 'Business analytics dashboard'
      : 'Manage store ' + this.pageTitle.toLowerCase();
  }

  get roleLabel(): string {
    if (!this.user) return '';
    if (this.user.role === 'admin') return 'Administrator';
    const r = this.user.role || 'customer';
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  quickSearchSubmit(): void {
    const q = this.quickSearch.trim();
    this.quickSearch = '';
    if (!q) return;
    this.closeMobileNav();
    this.router.navigate(['/admin/products'], { queryParams: { q } });
  }

  // ---- Notifications ----

  refreshNotifications(): void {
    this.notifLoading = true;
    this.notificationService.getNotifications(20).subscribe({
      next: (data) => {
        this.notifications = data.notifications;
        this.unreadCount = data.unreadCount;
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
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.notificationService.markRead(notification._id).subscribe(() => {});
    }
    this.bellOpen = false;
    this.router.navigate(['/admin/orders'], {
      queryParams: notification.order ? { order: notification.order } : {},
    });
  }

  markAllNotificationsRead(): void {
    if (this.unreadCount === 0) return;
    this.notificationService.markAllRead().subscribe(() => {
      this.unreadCount = 0;
      this.notifications.forEach((n) => (n.read = true));
    });
  }

  dismissNotification(notification: AppNotification): void {
    this.notificationService.deleteNotification(notification._id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter((n) => n._id !== notification._id);
        if (!notification.read) this.unreadCount = Math.max(0, this.unreadCount - 1);
      },
      error: () => {},
    });
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }

  goToProfile(): void {
    this.userMenuOpen = false;
    this.closeMobileNav();
    this.router.navigate(['/admin/profile']);
  }

  goToOrderHistory(): void {
    this.userMenuOpen = false;
    this.closeMobileNav();
    this.router.navigate(['/profile/orders']);
  }

  onRangeChange(days: number): void {
    this.analyticsService.setDateRange(days);
  }

  get activePreset(): number | null {
    return this.analyticsService.isCustomRange ? null : this.analyticsService.dateRangeDays;
  }

  get todayISO(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  selectPreset(days: number): void {
    this.analyticsService.setDateRange(days);
    this.customMode = false;
    this.rangeOpen = false;
  }

  enableCustom(): void {
    const c = this.analyticsService.customRange;
    if (c) {
      this.fromDate = c.start;
      this.toDate = c.end;
    } else if (!this.fromDate || !this.toDate) {
      this.toDate = this.todayISO;
      const s = new Date(this.toDate + 'T00:00:00');
      s.setDate(s.getDate() - 7);
      this.fromDate =
        `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
    }
    this.rangeError = '';
    this.customMode = true;
  }

  applyCustom(): void {
    if (!this.fromDate || !this.toDate) {
      this.rangeError = 'Please pick both "From" and "To" dates.';
      return;
    }
    if (this.fromDate > this.toDate) {
      this.rangeError = '"To" date must be on or after the "From" date.';
      return;
    }
    if (this.toDate > this.todayISO) {
      this.rangeError = 'The "To" date cannot be in the future.';
      return;
    }
    this.analyticsService.setCustomRange(this.fromDate, this.toDate);
    this.customMode = false;
    this.rangeOpen = false;
  }

  toggleCollapsed(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  closeMobileNav(): void {
    this.mobileNavOpen = false;
  }

  logout(): void {
    this.userMenuOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

backToStore(): void {
  window.open('/', '_blank');
}

onRouteActivated(wrap: HTMLDivElement): void {
  wrap.classList.remove('page-in');
  void wrap.offsetWidth;
  wrap.classList.add('page-in');
}
}