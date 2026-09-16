import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteConfigService } from './services/site-config.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'frontend';

  constructor(private siteConfig: SiteConfigService, private themeService: ThemeService) {
    // Branding must also be ready for login and admin-only routes.
    this.siteConfig.load();
    // Reconcile the theme with the account preference on login/logout.
    this.themeService.initialize();
  }
}
