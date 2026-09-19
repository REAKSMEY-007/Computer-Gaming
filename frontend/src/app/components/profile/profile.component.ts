import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, AppUser, DeliveryAddress } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit, OnDestroy {
  user: AppUser | null = null;
  editing = false;
  username = '';
  profileSaving = false;
  profileError = '';
  profileSuccess = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordSaving = false;
  passwordError = '';
  passwordSuccess = '';
  avatarSaving = false;
  avatarError = '';

  delivery: DeliveryAddress = {
    fullName: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Cambodia',
  };
  locationSaving = false;
  locationError = '';
  locationSuccess = '';
  addLocationOpen = false;

  private subs: Subscription[] = [];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.subs.push(
      this.authService.currentUser$.subscribe((u) => {
        this.user = u;
        if (!u) return;
        if (!this.editing) this.username = u.username;
        if (!this.addLocationOpen) this.delivery.fullName = u.username;
      })
    );
  }

  get initials(): string {
    if (!this.user) return '';
    const name = this.user.username.trim() || this.user.email.trim();
    return name.slice(0, 2).toUpperCase();
  }

  get displayName(): string {
    return this.user?.username ?? '';
  }

  get joinedDate(): string | null {
    return null;
  }

  get isGoogleAccount(): boolean {
    return this.user?.authProvider === 'google';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.avatarError = 'Please choose a valid image file.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError = 'Image must be 5 MB or smaller.';
      input.value = '';
      return;
    }

    this.avatarSaving = true;
    this.avatarError = '';
    this.authService.updateAvatar(file).subscribe({
      next: () => {
        this.avatarSaving = false;
        input.value = '';
      },
      error: (err) => {
        this.avatarSaving = false;
        this.avatarError = err.error?.message || 'Could not upload your avatar.';
        input.value = '';
      },
    });
  }

  beginEdit(): void {
    this.username = this.user?.username ?? '';
    this.profileError = '';
    this.profileSuccess = '';
    this.editing = true;
  }

  cancelEdit(): void {
    this.username = this.user?.username ?? '';
    this.profileError = '';
    this.editing = false;
  }

  saveProfile(): void {
    const username = this.username.trim();
    if (username.length < 2 || username.length > 40) {
      this.profileError = 'Username must be between 2 and 40 characters.';
      return;
    }
    this.profileSaving = true;
    this.profileError = '';
    this.profileSuccess = '';
    this.authService.updateProfile(username).subscribe({
      next: () => {
        this.profileSaving = false;
        this.editing = false;
        this.profileSuccess = 'Profile updated successfully.';
      },
      error: (err) => {
        this.profileSaving = false;
        this.profileError = err.error?.message || 'Could not update your profile.';
      },
    });
  }

  isLocationSet(): boolean {
    return Boolean(this.user?.addresses?.some((a) => a.address.trim() && a.city.trim()));
  }

  toggleAddLocation(): void {
    this.addLocationOpen = !this.addLocationOpen;
    this.locationError = '';
    this.locationSuccess = '';
    if (this.addLocationOpen) {
      this.delivery = {
        fullName: this.user?.username || '',
        address: '',
        city: '',
        postalCode: '',
        country: 'Cambodia',
      };
    }
  }

  saveDelivery(): void {
    const loc = this.delivery;
    if (!loc.fullName.trim() || !loc.address.trim() || !loc.city.trim() || !loc.country.trim()) {
      this.locationError = 'Full name, street address, city and country are required.';
      this.locationSuccess = '';
      return;
    }
    this.locationSaving = true;
    this.locationError = '';
    this.locationSuccess = '';
    this.authService
      .addAddress({
        fullName: loc.fullName.trim(),
        address: loc.address.trim(),
        city: loc.city.trim(),
        postalCode: loc.postalCode.trim(),
        country: loc.country.trim(),
      })
      .subscribe({
        next: (res) => {
          this.locationSaving = false;
          this.user = res.user;
          this.addLocationOpen = false;
          this.delivery = {
            fullName: res.user.username || '',
            address: '',
            city: '',
            postalCode: '',
            country: 'Cambodia',
          };
          this.locationSuccess = 'Delivery location saved.';
        },
        error: (err) => {
          this.locationSaving = false;
          this.locationError = err.error?.message || 'Could not save your delivery location.';
        },
      });
  }

  savePassword(): void {
    if (this.isGoogleAccount) return;
    if (this.newPassword.length < 8) {
      this.passwordError = 'New password must be at least 8 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New password and confirmation do not match.';
      return;
    }
    this.passwordSaving = true;
    this.passwordError = '';
    this.passwordSuccess = '';
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (res) => {
        this.passwordSaving = false;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordSuccess = res.message;
      },
      error: (err) => {
        this.passwordSaving = false;
        this.passwordError = err.error?.message || 'Could not update your password.';
      },
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
