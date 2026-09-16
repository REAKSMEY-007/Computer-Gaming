import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AppNotification {
  _id: string;
  type: 'payment_confirmed' | 'payment_rejected' | 'order_status';
  message: string;
  order?: string;
  orderNumber?: string;
  read: boolean;
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
    return this.http.put<AppNotification>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllRead(): Observable<{ modified: number }> {
    return this.http.put<{ modified: number }>(`${this.apiUrl}/read-all`, {});
  }
}