import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppNotification } from '../../services/notification.service';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './notification-dropdown.component.html',
  styleUrl: './notification-dropdown.component.css',
})
export class NotificationDropdownComponent {
  @Input() notifications: AppNotification[] = [];
  @Input() unreadCount = 0;
  @Input() loading = false;

  @Output() markAllRead = new EventEmitter<void>();
  @Output() openOrder = new EventEmitter<AppNotification>();
  @Output() dismiss = new EventEmitter<AppNotification>();

  titleFor(n: AppNotification): string {
    if (n.title) return n.title;
    switch (n.type) {
      case 'payment_confirmed':
        return 'Payment Received';
      case 'payment_rejected':
        return 'Payment Failed';
      case 'order_status':
        return 'Order Update';
      case 'support_reply':
        return 'Support Reply';
      default:
        return 'Notification';
    }
  }

  isSuccess(n: AppNotification): boolean {
    return n.type === 'payment_confirmed';
  }

  isFailure(n: AppNotification): boolean {
    return n.type === 'payment_rejected';
  }

  timeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString();
  }

  onViewOrder(n: AppNotification): void {
    this.openOrder.emit(n);
  }

  onDismiss(n: AppNotification): void {
    this.dismiss.emit(n);
  }
}