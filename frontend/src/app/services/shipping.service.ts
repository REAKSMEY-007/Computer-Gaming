import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ShippingConfig {
  enabled: boolean;
  flatRate: number;
  freeShippingThreshold: number;
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  enabled: true,
  flatRate: 5.99,
  freeShippingThreshold: 50,
};

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private configSubject = new BehaviorSubject<ShippingConfig>(DEFAULT_SHIPPING_CONFIG);
  private loaded = false;

  config$: Observable<ShippingConfig> = this.configSubject.asObservable();

  constructor(private http: HttpClient) {}

  get config(): ShippingConfig {
    return this.configSubject.getValue();
  }

  // Fetches the admin-configured shipping rule once and caches it for the session.
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.http
.get<ShippingConfig>(`${environment.apiUrl}/config/shipping`)
      .pipe(take(1))
      .subscribe({
        next: (cfg) => this.configSubject.next({ ...DEFAULT_SHIPPING_CONFIG, ...cfg }),
        error: () => {},
      });
  }

  setConfig(cfg: Partial<ShippingConfig>): void {
    this.configSubject.next({ ...this.config, ...cfg });
  }

  // Client-side estimate that mirrors the server-side rule.
  estimate(subtotal: number): number {
    if (!this.config.enabled) return 0;
    if (subtotal >= this.config.freeShippingThreshold) return 0;
    return this.config.flatRate;
  }

  getConfig(): Observable<ShippingConfig> {
    return this.http.get<ShippingConfig>(`${environment.apiUrl}/config/shipping`);
  }

  updateConfig(payload: Partial<ShippingConfig>): Observable<ShippingConfig> {
    return this.http.put<ShippingConfig>(`${environment.apiUrl}/admin/shipping`, payload);
  }
}