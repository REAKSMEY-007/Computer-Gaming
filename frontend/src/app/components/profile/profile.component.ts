import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, AppUser } from '../../services/auth.service';

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

  private subs: Subscription[] = [];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.subs.push(
      this.authService.currentUser$.subscribe((u) => {
        this.user = u;
        if (u && !this.editing) this.username = u.username;
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
