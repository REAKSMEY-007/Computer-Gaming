import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SiteConfigService, SiteConfig, DEFAULT_SITE_CONFIG, SiteNameParts, splitSiteName } from '../../services/site-config.service';
import { ShippingService, ShippingConfig, DEFAULT_SHIPPING_CONFIG } from '../../services/shipping.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent implements OnInit, OnDestroy {
  config: SiteConfig = { ...DEFAULT_SITE_CONFIG };
  shippingConfig: ShippingConfig = { ...DEFAULT_SHIPPING_CONFIG };
  private configSub: Subscription | null = null;
  private shippingSub: Subscription | null = null;

  constructor(
    private configService: SiteConfigService,
    private shippingService: ShippingService
  ) {}

  get siteParts(): SiteNameParts {
    return splitSiteName(this.config.siteName);
  }

  ngOnInit(): void {
    this.configService.load();
    this.configSub = this.configService.config$.subscribe((cfg) => {
      this.config = cfg;
    });
    this.shippingService.load();
    this.shippingSub = this.shippingService.config$.subscribe((cfg) => {
      this.shippingConfig = cfg;
    });
  }

  ngOnDestroy(): void {
    this.configSub?.unsubscribe();
    this.shippingSub?.unsubscribe();
  }
}