import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'theme';
const API_URL = `${environment.apiUrl}/user/preferences`;

interface PreferencesResponse {
  preferences?: { themeMode?: ThemeMode };
}

/**
 * Single source of truth for the app-wide theme.
 *
 * Resolution order:
 *  1. localStorage (explicit user choice) — survives reloads.
 *  2. OS preference via `prefers-color-scheme` — only when nothing stored.
 *  3. Server preference (per account) — fetched on login when no local
 *     choice exists yet; pushed on every toggle so the choice syncs devices.
 *
 * The active theme is applied as a `.dark` class on <html>, which Tailwind's
 * class-based dark mode reads, so the customer site AND admin share it.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  // NOTE: declared before `isDarkSubject` — detectInitialTheme() runs during
  // the field initializer and needs the media query list already created.
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private isDarkSubject = new BehaviorSubject<boolean>(this.detectInitialTheme());
  private subs: Subscription[] = [];

  isDark$: Observable<boolean> = this.isDarkSubject.asObservable();

  get isDark(): boolean {
    return this.isDarkSubject.getValue();
  }

  get themeMode(): ThemeMode {
    return this.isDark ? 'dark' : 'light';
  }

  constructor(private http: HttpClient, private authService: AuthService) {
    // Keep `.dark` on <html> in sync so the SAME persisted theme applies
    // app-wide with no per-layout wiring.
    this.isDarkSubject.subscribe((dark) => this.syncDom(dark));
    this.mediaQuery.addEventListener('change', this.onSystemPreferenceChange);
  }

  /** Call once at app bootstrap (AppComponent). Wires server sync on login. */
  initialize(): void {
    this.subs.push(this.authService.currentUser$.subscribe(() => this.syncWithServer()));
  }

  toggle(): void {
    this.setTheme(this.isDark ? 'light' : 'dark');
    this.pushToServer();
  }

  setTheme(mode: ThemeMode): void {
    this.isDarkSubject.next(mode === 'dark');
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* storage unavailable (private mode) — theme still applies this session */
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.mediaQuery.removeEventListener('change', this.onSystemPreferenceChange);
  }

  private detectInitialTheme(): boolean {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored === 'dark';
      }
    } catch {
      /* fall through to OS preference */
    }
    return this.mediaQuery.matches;
  }

  private syncDom(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
  }

  /** Follow the OS only while the user hasn't made an explicit choice. */
  private onSystemPreferenceChange = (event: MediaQueryListEvent): void => {
    try {
      if (localStorage.getItem(THEME_KEY) === null) {
        this.isDarkSubject.next(event.matches);
      }
    } catch {
      this.isDarkSubject.next(event.matches);
    }
  };

  /**
   * Reconcile with the account-level preference. Called on every login state
   * change. A stored choice is kept and pushed back; otherwise the server's
   * value (if any) is adopted.
   */
  private syncWithServer(): void {
    if (!this.authService.isLoggedIn()) {
      return;
    }
    this.http.get<PreferencesResponse>(API_URL).subscribe({
      next: (data) => {
        const serverMode = data?.preferences?.themeMode;
        if (!serverMode) {
          return; // never toggled before — stay on local/OS default
        }
        let hasChoice = false;
        try {
          hasChoice = localStorage.getItem(THEME_KEY) !== null;
        } catch {
          hasChoice = false;
        }
        if (hasChoice) {
          if (serverMode !== this.themeMode) {
            this.pushToServer(); // local choice wins on this device
          }
        } else {
          this.setTheme(serverMode);
        }
      },
      error: () => {
        // Offline/401 — keep the local choice, nothing to reconcile.
      },
    });
  }

  /** Best-effort async write; failures are silent (local state still applies). */
  private pushToServer(): void {
    if (!this.authService.isLoggedIn()) {
      return;
    }
    this.http.patch<PreferencesResponse>(API_URL, { themeMode: this.themeMode }).subscribe({
      error: () => {
        /* fire-and-forget */
      },
    });
  }
}