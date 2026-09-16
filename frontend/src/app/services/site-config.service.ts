import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';

export interface SiteConfig {
  siteName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: 'Computer&Gaming',
  logoUrl: null,
  faviconUrl: null,
};

export interface SiteNameParts {
  whole: string;
  before: string;
  ampersand: string;
  after: string;
  hasAmpersand: boolean;
}

export function splitSiteName(name: string): SiteNameParts {
  const idx = name.indexOf('&');
  if (idx === -1) {
    return { whole: name, before: '', ampersand: '', after: '', hasAmpersand: false };
  }
  return {
    whole: name,
    before: name.slice(0, idx),
    ampersand: '&',
    after: name.slice(idx + 1),
    hasAmpersand: true,
  };
}

@Injectable({ providedIn: 'root' })
export class SiteConfigService {
  private configSubject = new BehaviorSubject<SiteConfig>(DEFAULT_SITE_CONFIG);
  private loaded = false;

  config$: Observable<SiteConfig> = this.configSubject.asObservable();

  constructor(private http: HttpClient) {}

  get config(): SiteConfig {
    return this.configSubject.getValue();
  }

  // Fetches the global site config once and applies the favicon too.
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.http
      .get<SiteConfig>('http://localhost:3000/api/config/site')
      .pipe(take(1))
      .subscribe({
        next: (cfg) => {
          this.configSubject.next({ ...DEFAULT_SITE_CONFIG, ...cfg });
          this.applyFavicon(this.configSubject.getValue());
        },
        error: () => {},
      });
  }

  setConfig(cfg: Partial<SiteConfig>): void {
    const next = { ...this.config, ...cfg };
    this.configSubject.next(next);
    this.applyFavicon(next);
  }

  // Splits "Computer&Gaming" around the '&' so components can style it.
  siteNameParts(): SiteNameParts {
    return splitSiteName(this.config.siteName || DEFAULT_SITE_CONFIG.siteName);
  }

  // Admin CRUD (guarded by the auth interceptor).
  getSettings(): Observable<SiteConfig> {
    return this.http.get<SiteConfig>('http://localhost:3000/api/admin/settings');
  }

  updateSettings(payload: Partial<SiteConfig> | FormData): Observable<SiteConfig> {
    return this.http.put<SiteConfig>('http://localhost:3000/api/admin/settings', payload as any);
  }

  private applyFavicon(cfg: SiteConfig): void {
    const base = cfg.faviconUrl || cfg.logoUrl || 'favicon.ico';
    const sep = base.includes('?') ? '&' : '?';
    const href = `${base}${sep}v=${Date.now()}`;
    const link = document.querySelector<HTMLLinkElement>('link#app-favicon');
    if (link && link.href.split('?')[0] !== href.split('?')[0]) {
      link.href = href;
    }
  }
}