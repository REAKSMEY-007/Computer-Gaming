import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface ProofOfPayment {
  reference?: string;
  note?: string;
  screenshot?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: string;
  customerName: string;
  customerEmail: string;
  phone?: string;
  items: OrderItem[];
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
  status: 'pending_payment' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod?: 'bank_transfer' | 'card' | 'khqr';
  paymentStatus?: 'unpaid' | 'confirmed' | 'rejected';
  khqrMd5?: string;
  proofOfPayment?: ProofOfPayment;
  paymentVerifiedAt?: string;
  paymentRejectReason?: string;
  shippingAddress?: {
    fullName?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  isPaid: boolean;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const ORDER_STATUSES: Order['status'][] = [
  'pending_payment',
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment Verification',
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export interface BankPaymentConfig {
  accountName: string;
  accountNumber: string;
  bankName: string;
  khqrImage: string;
  note?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private apiUrl = 'http://localhost:3000/api/orders';
  private configApiUrl = 'http://localhost:3000/api/config';

  constructor(private http: HttpClient) {}

  getOrders(): Observable<Order[]> {
    return this.http.get<any>(this.apiUrl).pipe(map((res) => res?.orders ?? res));
  }

  getMyOrders(): Observable<Order[]> {
    return this.http.get<any>(`${this.apiUrl}/mine`).pipe(map((res) => res?.orders ?? res));
  }

  getMyOrdersPaginated(params: {
    page?: number;
    limit?: number;
  } = {}): Observable<{ orders: Order[]; total: number; page: number; limit: number }> {
    const query: Record<string, string> = {};
    if (params.page != null) query['page'] = String(params.page);
    if (params.limit != null) query['limit'] = String(params.limit);
    return this.http.get<any>(`${this.apiUrl}/mine`, { params: query });
  }

  getOrderStats(): Observable<{ totalOrders: number; revenue: number; pendingOrders: number }> {
    return this.http.get<{ totalOrders: number; revenue: number; pendingOrders: number }>(
      `${this.apiUrl}/stats`
    );
  }

  createOrder(payload: Partial<Order> | FormData): Observable<Order> {
    return this.http.post<Order>(this.apiUrl, payload);
  }

  updateOrderStatus(id: string, status: Order['status']): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/${id}`, { status });
  }

  verifyPayment(id: string, action: 'confirm' | 'reject', reason?: string): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/${id}/payment`, { action, reason: reason ?? '' });
  }

  getBankPaymentConfig(): Observable<BankPaymentConfig> {
    return this.http.get<BankPaymentConfig>(`${this.configApiUrl}/bank-payment`);
  }
}