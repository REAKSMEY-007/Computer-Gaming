import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

export interface VerifyMd5Response {
  success: boolean;
  status?: 'PAID' | 'PENDING';
  responseCode?: number;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private apiUrl = 'http://localhost:3000/api/payment';

  constructor(private http: HttpClient) {}

  generateKhqr(payload: GenerateKhqrRequest): Observable<GenerateKhqrResponse> {
    return this.http.post<GenerateKhqrResponse>(`${this.apiUrl}/generate-khqr`, payload);
  }

  verifyMd5(md5: string): Observable<VerifyMd5Response> {
    return this.http.post<VerifyMd5Response>(`${this.apiUrl}/verify-md5`, { md5 });
  }
}