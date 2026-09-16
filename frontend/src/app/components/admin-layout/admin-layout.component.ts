import { Component, OnDestroy } from '@angular/core';
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
    LucideSettings,
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
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

type TabId = 'overview' | 'products' | 'categories' | 'orders' | 'shipping' | 'settings';

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
    LucideSettings,
    LucideLogOut,
    LucideMenu,
    LucideChevronsLeft,
    LucideX,
    LucideCalendarDays,
    LucideArrowLeft,
    LucideChevronDown,
    LucideCheck,
    ThemeToggleComponent,
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
    { id: 'shipping', label: 'Shipping', route: '/admin/shipping', icon: 'lucideTruck' },
  ];

  private routerSub!: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    public themeService: ThemeService,
    public analyticsService: AnalyticsService,
    public configService: SiteConfigService
  ) {
    this.configService.load();
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.syncFromUrl());
    this.syncFromUrl();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private syncFromUrl(): void {
    const url = this.router.url.split('?')[0].replace(/\/+$/, '') || '/admin';
    const seg = url.split('/').pop() ?? 'overview';
    if (seg === 'settings') {
      this.activeTab = 'settings';
      this.pageTitle = 'Settings';
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
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  backToStore(): void {
    this.router.navigate(['/']);
  }
}