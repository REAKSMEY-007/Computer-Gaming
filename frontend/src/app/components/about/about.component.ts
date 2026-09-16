import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShippingService } from '../../services/shipping.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.component.html',
})
export class AboutComponent implements OnInit {
  constructor(private shippingService: ShippingService) {}

  ngOnInit(): void {
    this.shippingService.load();
  }

  freeShippingText(): string {
    const cfg = this.shippingService.config;
    if (!cfg.enabled || cfg.freeShippingThreshold <= 0) return 'Free shipping on every order';
    return `Free shipping on orders over $${cfg.freeShippingThreshold}`;
  }
}