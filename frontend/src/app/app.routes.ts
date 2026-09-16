import { Routes } from '@angular/router';
import { MainLayoutComponent } from './components/main-layout/main-layout.component';
import { HomeComponent } from './components/home/home.component';
import { ProductListComponent } from './components/product-list/product-list.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';
import { CartComponent } from './components/cart/cart.component';
import { LoginRegisterComponent } from './components/login-register/login-register.component';
import { ProfileComponent } from './components/profile/profile.component';
import { OrderHistoryComponent } from './components/order-history/order-history.component';
import { BuildPcComponent } from './components/build-pc/build-pc.component';
import { ContactComponent } from './components/contact/contact.component';
import { AboutComponent } from './components/about/about.component';
import { AdminGuard, AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'products', component: ProductListComponent },
      { path: 'products/:categorySlug', component: ProductListComponent },
      { path: 'products/:categorySlug/:productSlug', component: ProductDetailComponent },
      { path: 'build-pc', component: BuildPcComponent },
      { path: 'contact', component: ContactComponent },
      { path: 'about', component: AboutComponent },
      { path: 'cart', component: CartComponent },
      { path: 'login', component: LoginRegisterComponent },
      { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
      { path: 'profile/orders', component: OrderHistoryComponent, canActivate: [AuthGuard] },
    ],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./components/admin-layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent
      ),
    canActivate: [AdminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./components/admin-dashboard/admin-overview.component').then(
            (m) => m.AdminOverviewComponent
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./components/admin-dashboard/admin-products.component').then(
            (m) => m.AdminProductsComponent
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./components/admin-dashboard/admin-categories.component').then(
            (m) => m.AdminCategoriesComponent
          ),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./components/admin-dashboard/admin-orders.component').then(
            (m) => m.AdminOrdersComponent
          ),
      },
      {
        path: 'shipping',
        loadComponent: () =>
          import('./components/admin-shipping/admin-shipping.component').then(
            (m) => m.AdminShippingComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./components/admin-settings/admin-settings.component').then(
            (m) => m.AdminSettingsComponent
          ),
      },
    ],
  },
];