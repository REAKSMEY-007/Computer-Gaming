import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService, ContactMessage, MessageStatus } from '../../services/message.service';

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-messages.component.html',
})
export class AdminMessagesComponent implements OnInit {
  messages: ContactMessage[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';
  busyId = '';
  replyId: string | null = null;
  replyText = '';

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    this.loadMessages();
  }

  get unreadCount(): number {
    return this.messages.filter((m) => m.status === 'unread').length;
  }

  loadMessages(): void {
    this.loading = true;
    this.errorMessage = '';
    this.messageService.getMessages().subscribe({
      next: (data) => {
        this.messages = data;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load messages.';
        this.loading = false;
      },
    });
  }

  initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  statusLabel(status: MessageStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  statusClasses(status: MessageStatus): string {
    switch (status) {
      case 'unread':
        return 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30';
      case 'read':
        return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
      case 'replied':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30';
      case 'archived':
        return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30';
    }
  }

  relativeTime(iso: string): string {
    if (!iso) return '';
    const date = new Date(iso).getTime();
    const diff = Date.now() - date;
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;
    if (diff < min) return 'Just now';
    if (diff < hour) return `${Math.floor(diff / min)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  markRead(message: ContactMessage): void {
    if (message.status === 'read' || this.busyId) return;
    this.busyId = message._id;
    this.errorMessage = '';
    this.messageService.updateStatus(message._id, 'read').subscribe({
      next: (updated) => {
        this.busyId = '';
        this.replaceMessage(updated);
      },
      error: (err) => {
        this.busyId = '';
        this.errorMessage = err.error?.message || 'Could not update the message.';
      },
    });
  }

  archive(message: ContactMessage): void {
    if (message.status === 'archived' || this.busyId) return;
    this.busyId = message._id;
    this.errorMessage = '';
    this.messageService.updateStatus(message._id, 'archived').subscribe({
      next: (updated) => {
        this.busyId = '';
        this.replaceMessage(updated);
      },
      error: (err) => {
        this.busyId = '';
        this.errorMessage = err.error?.message || 'Could not archive the message.';
      },
    });
  }

  openReply(message: ContactMessage): void {
    if (this.busyId) return;
    if (this.replyId === message._id) {
      this.closeReply();
      return;
    }
    this.replyId = message._id;
    this.replyText = message.reply?.text ?? '';
    this.errorMessage = '';
  }

  closeReply(): void {
    this.replyId = null;
    this.replyText = '';
  }

  sendReply(message: ContactMessage): void {
    const text = this.replyText.trim();
    if (!text || this.busyId) return;
    this.busyId = message._id;
    this.errorMessage = '';
    this.messageService.replyToMessage(message._id, text).subscribe({
      next: (res) => {
        this.busyId = '';
        const i = this.messages.findIndex((x) => x._id === message._id);
        if (i >= 0 && res.message) this.messages[i] = res.message;
        this.closeReply();
        this.successMessage = 'Reply sent.';
      },
      error: (err) => {
        this.busyId = '';
        this.errorMessage = err.error?.message || 'Could not send the reply.';
      },
    });
  }

  deleteMessage(message: ContactMessage): void {
    if (this.busyId) return;
    if (!window.confirm(`Delete the message from ${message.name}?`)) return;
    this.busyId = message._id;
    this.errorMessage = '';
    this.messageService.deleteMessage(message._id).subscribe({
      next: () => {
        this.busyId = '';
        this.messages = this.messages.filter((m) => m._id !== message._id);
        this.successMessage = 'Message deleted.';
      },
      error: (err) => {
        this.busyId = '';
        this.errorMessage = err.error?.message || 'Could not delete the message.';
      },
    });
  }

  private replaceMessage(updated: ContactMessage): void {
    const i = this.messages.findIndex((m) => m._id === updated._id);
    if (i >= 0) this.messages[i] = updated;
  }
}