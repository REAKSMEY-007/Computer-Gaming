import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AppNotification {
  _id: string;
  type: 'payment_confirmed' | 'payment_rejected' | 'order_status' | 'support_reply';
  title?: string;
  message: string;
  link?: string;
  order?: string;
  orderNumber?: string;
  read: boolean;
  isRead?: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private apiUrl = 'http://localhost:3000/api/notifications';

  constructor(private http: HttpClient) {}

  getNotifications(limit = 50): Observable<{ notifications: AppNotification[]; unreadCount: number }> {
    return this.http.get<{ notifications: AppNotification[]; unreadCount: number }>(
      this.apiUrl,
      { params: { limit: String(limit) } }
    );
  }

  markRead(id: string): Observable<AppNotification> {
    return this.http.patch<AppNotification>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllRead(): Observable<{ modified: number }> {
    return this.http.patch<{ modified: number }>(`${this.apiUrl}/read-all`, {});
  }

  deleteNotification(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}