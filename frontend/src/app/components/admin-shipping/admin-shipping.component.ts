import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ShippingService,
  DEFAULT_SHIPPING_CONFIG,
} from '../../services/shipping.service';
import { PricePipe } from '../../pipes/price.pipe';

@Component({
  selector: 'app-admin-shipping',
  standalone: true,
  imports: [CommonModule, FormsModule, PricePipe],
  templateUrl: './admin-shipping.component.html',
})
export class AdminShippingComponent implements OnInit {
  enabled = true;
  flatRate: number = DEFAULT_SHIPPING_CONFIG.flatRate;
  freeShippingThreshold: number = DEFAULT_SHIPPING_CONFIG.freeShippingThreshold;

  loading = true;
  saving = false;
  successMessage = '';
  errorMessage = '';

  constructor(private shippingService: ShippingService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.shippingService.getConfig().subscribe({
      next: (cfg) => {
        this.enabled = cfg.enabled;
        this.flatRate = cfg.flatRate;
        this.freeShippingThreshold = cfg.freeShippingThreshold;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load shipping settings';
        this.loading = false;
      },
    });
  }

  save(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!Number.isFinite(this.flatRate) || this.flatRate < 0) {
      this.errorMessage = 'Shipping rate must be a non-negative number.';
      return;
    }
    if (!Number.isFinite(this.freeShippingThreshold) || this.freeShippingThreshold < 0) {
      this.errorMessage = 'Free shipping threshold must be a non-negative number.';
      return;
    }

    this.saving = true;
    this.shippingService
      .updateConfig({
        enabled: this.enabled,
        flatRate: this.flatRate,
        freeShippingThreshold: this.freeShippingThreshold,
      })
      .subscribe({
        next: (cfg) => {
          this.shippingService.setConfig(cfg);
          this.saving = false;
          this.successMessage = 'Shipping settings saved. The storefront and checkout now use these values.';
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err.error?.message || 'Failed to save shipping settings';
        },
      });
  }
}