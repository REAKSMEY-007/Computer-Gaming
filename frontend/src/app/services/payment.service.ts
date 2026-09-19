import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GenerateKhqrRequest {
  amount: number;
  currency?: 'USD' | 'KHR';
  billNumber?: string;
}

export interface GenerateKhqrResponse {
  success: boolean;
  data?: {
    qrString?: string;
    md5?: string;
  };
  qrString?: string;
  md5?: string;
  expiresAt?: number;
  currency?: 'USD' | 'KHR';
  message?: string;
}

export interface VerifyKhqrResponse {
  status: 'SUCCESS' | 'PENDING';
  orderId?: string | null;
  orderNumber?: string;
  message?: string;
}

export interface KhqrPaymentResult {
  md5: string;
  orderId?: string;
  orderNumber?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private apiUrl = `${environment.apiUrl}/payment`;
  private paymentsApiUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) {}

  generateKhqr(payload: GenerateKhqrRequest): Observable<GenerateKhqrResponse> {
    return this.http.post<GenerateKhqrResponse>(`${this.apiUrl}/generate-khqr`, payload);
  }

  // Auto-verification poll: the backend checks the transfer with Bakong and
  // marks the linked order paid as soon as the money is received.
  verifyPayment(payload: {
    md5?: string;
    transactionId?: string;
    orderId?: string;
  }): Observable<VerifyKhqrResponse> {
    return this.http.post<VerifyKhqrResponse>(`${this.paymentsApiUrl}/verify-khqr`, payload);
  }
}