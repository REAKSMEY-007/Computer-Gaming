import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SiteConfigService,
  DEFAULT_SITE_CONFIG,
  SiteNameParts,
  splitSiteName,
} from '../../services/site-config.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-settings.component.html',
})
export class AdminSettingsComponent implements OnInit {
  siteName = '';
  logoUrl: string | null = null;
  logoFile: File | null = null;
  logoPreview: string | null = null;

  loading = true;
  saving = false;
  successMessage = '';
  errorMessage = '';

  constructor(private configService: SiteConfigService) {}

  ngOnInit(): void {
    this.load();
  }

  get defaultName(): string {
    return DEFAULT_SITE_CONFIG.siteName;
  }

  sitePartsFor(name: string): SiteNameParts {
    return splitSiteName(name);
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.configService.getSettings().subscribe({
      next: (cfg) => {
        this.siteName = cfg.siteName;
        this.logoUrl = cfg.logoUrl;
        this.logoPreview = cfg.logoUrl;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load settings';
        this.loading = false;
      },
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.logoFile = null;
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.errorMessage = 'Only JPG, PNG or WEBP images are allowed.';
      input.value = '';
      this.logoFile = null;
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Image must be 5MB or smaller.';
      input.value = '';
      this.logoFile = null;
      return;
    }
    this.logoFile = file;
    this.errorMessage = '';
    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreview = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  saveName(): void {
    const name = this.siteName.trim();
    if (!name) {
      this.errorMessage = 'Site name cannot be empty.';
      return;
    }
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.configService.updateSettings({ siteName: name }).subscribe({
      next: (cfg) => {
        this.configService.setConfig(cfg);
        this.siteName = cfg.siteName;
        this.saving = false;
        this.successMessage = 'Site name updated. It now appears in the header, footer, sidebar and login page.';
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.message || 'Failed to save site name';
      },
    });
  }

  saveLogo(): void {
    if (!this.logoFile) {
      this.errorMessage = 'Choose a logo image first.';
      return;
    }
    const fd = new FormData();
    fd.append('logo', this.logoFile);
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.configService.updateSettings(fd).subscribe({
      next: (cfg) => {
        this.configService.setConfig(cfg);
        this.logoUrl = cfg.logoUrl;
        this.logoPreview = cfg.logoUrl;
        this.logoFile = null;
        this.saving = false;
        this.successMessage = 'Logo updated. It now appears in the header, footer, admin sidebar and login page.';
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.message || 'Failed to save logo';
      },
    });
  }
}