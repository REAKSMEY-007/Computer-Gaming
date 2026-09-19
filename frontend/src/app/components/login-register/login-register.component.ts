import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { AbsoluteUrlPipe } from '../../pipes/absolute-url.pipe';
import {
  SiteConfigService,
  SiteConfig,
  DEFAULT_SITE_CONFIG,
  SiteNameParts,
  splitSiteName,
} from '../../services/site-config.service';

@Component({
  selector: 'app-login-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AbsoluteUrlPipe],
  templateUrl: './login-register.component.html',
  styleUrl: './login-register.component.css'
})
export class LoginRegisterComponent implements OnInit, OnDestroy {
  config: SiteConfig = { ...DEFAULT_SITE_CONFIG };
  private configSub: Subscription | null = null;

  activeTab: 'login' | 'register' = 'login';
  loginEmail = '';
  loginPassword = '';
  registerUsername = '';
  registerEmail = '';
  registerPassword = '';
  errorMessage = '';
  successMessage = '';
  loading = false;
  googleLoading = false;
  private googleInitialized = false;

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute, private configService: SiteConfigService) {}

  ngOnInit(): void {
    this.configService.load();
    this.configSub = this.configService.config$.subscribe((cfg) => {
      this.config = cfg;
    });
  }

  ngOnDestroy(): void {
    this.configSub?.unsubscribe();
  }

  get siteParts(): SiteNameParts {
    return splitSiteName(this.config.siteName);
  }

  switchTab(tab: 'login' | 'register'): void {
    this.activeTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
  }

  login(): void {
    this.loading = true;
    this.errorMessage = '';
    this.authService.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.loading = false;
        this.redirectAfterAuth();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Login failed';
      },
    });
  }

  register(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.authService
      .register(this.registerUsername, this.registerEmail, this.registerPassword)
      .subscribe({
        next: () => {
          this.loading = false;
          this.successMessage = 'Registration successful! Please login.';
          this.activeTab = 'login';
          this.loginEmail = this.registerEmail;
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err.error?.message || 'Registration failed';
        },
      });
  }

  signInWithGoogle(): void {
    if (this.googleLoading || this.loading) return;
    if (!this.initGoogle()) {
      this.errorMessage =
        'Google Sign-In is unavailable right now. Please use email login or try again later.';
      return;
    }
    this.googleLoading = true;
    this.errorMessage = '';
    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        this.googleLoading = false;
        this.errorMessage =
          'Google sign-in could not be opened. Please try again or use email login.';
      }
    });
  }

  private initGoogle(): boolean {
    if (this.googleInitialized) return true;
    if (!window.google?.accounts?.id) return false;
    window.google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response) => this.handleGoogleCredential(response.credential),
    });
    this.googleInitialized = true;
    return true;
  }

  private handleGoogleCredential(credential: string): void {
    if (!credential) {
      this.googleLoading = false;
      this.errorMessage = 'Google sign-in failed. Please try again.';
      return;
    }
    this.authService.googleLogin(credential).subscribe({
      next: () => {
        this.googleLoading = false;
        this.redirectAfterAuth();
      },
      error: (err) => {
        this.googleLoading = false;
        this.errorMessage = err.error?.message || 'Google sign-in failed';
      },
    });
  }

  private redirectAfterAuth(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const target = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/';
    this.router.navigateByUrl(target);
  }
}
