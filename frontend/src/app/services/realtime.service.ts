import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { AppNotification } from './notification.service';

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private socket: Socket | null = null;

  constructor(private auth: AuthService) {}

  private connect(): Socket {
    if (!this.socket) {
      this.socket = io('http://localhost:3000', {
        transports: ['websocket'],
        auth: (cb: (value: { token: string | null }) => void) =>
          cb({ token: this.auth.getToken() }),
      });
    }
    return this.socket;
  }

  onNewOrder(): Observable<{ orderId: string; orderNumber: string }> {
    return new Observable((subscriber) => {
      const socket = this.connect();
      const handler = (payload: { orderId: string; orderNumber: string }) => subscriber.next(payload);
      socket.on('new-order', handler);
      return () => {
        socket.off('new-order', handler);
      };
    });
  }

  onNewCustomer(): Observable<{ userId: string; username: string }> {
    return new Observable((subscriber) => {
      const socket = this.connect();
      const handler = (payload: { userId: string; username: string }) => subscriber.next(payload);
      socket.on('new-customer', handler);
      return () => {
        socket.off('new-customer', handler);
      };
    });
  }

  onNotification(): Observable<{ notification: AppNotification }> {
    return new Observable((subscriber) => {
      const socket = this.connect();
      const handler = (payload: { notification: AppNotification }) => subscriber.next(payload);
      socket.on('notification', handler);
      return () => {
        socket.off('notification', handler);
      };
    });
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}