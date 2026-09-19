import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, EMPTY, interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import QRCode from 'qrcode';
import { PaymentService, KhqrPaymentResult } from '../../services/payment.service';
import { PricePipe } from '../../pipes/price.pipe';

type PaymentPhase = 'generating' | 'waiting' | 'success' | 'error' | 'expired';

@Component({
  selector: 'app-khqr-modal',
  standalone: true,
  imports: [CommonModule, PricePipe],
  templateUrl: './khqr-modal.component.html',
  styleUrl: './khqr-modal.component.scss',
})
export class KhqrModalComponent implements OnInit, OnDestroy {
  @Input() amount = 0;
  @Input() currency: 'USD' | 'KHR' = 'USD';
  @Input() billNumber = '';
  @Input() orderId = '';
  @Input() expiresInSeconds = 900;
  @Input() merchantName = 'Computer&Gaming Store';

  @Output() paid = new EventEmitter<KhqrPaymentResult>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('qrCanvas', { static: false }) qrCanvas?: ElementRef<HTMLCanvasElement>;

  phase: PaymentPhase = 'generating';
  errorMessage = '';
  md5 = '';
  remainingSeconds = 900;

  private pollSub: Subscription | null = null;
  private timerSub: Subscription | null = null;
  private toastShown = false;

  constructor(private paymentService: PaymentService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.remainingSeconds = this.expiresInSeconds;
    this.generate();
  }

  generate(): void {
    this.stopPolling();
    this.stopCountdown();
    this.errorMessage = '';
    this.toastShown = false;
    this.phase = 'generating';

    this.paymentService
      .generateKhqr({
        amount: this.amount,
        currency: this.currency,
        billNumber: this.billNumber || undefined,
      })
      .subscribe({
        next: (res) => {
          const qrString = res?.data?.qrString ?? res?.qrString;
          const md5 = res?.data?.md5 ?? res?.md5 ?? '';

          if (!res.success || !qrString || !md5) {
            this.phase = 'error';
            this.errorMessage = res?.message || 'Could not generate the payment QR code.';
            return;
          }

          this.errorMessage = '';
          this.md5 = md5;
          if (res.expiresAt) {
            this.remainingSeconds = Math.max(0, Math.floor((res.expiresAt - Date.now()) / 1000));
          }
          this.phase = 'waiting';
          setTimeout(() => this.renderQr(qrString), 50);
        },
        error: (err) => {
          console.error('KHQR Generation Error Details:', err);
          this.phase = 'error';
          this.errorMessage = err.error?.message || 'Could not generate the payment QR code.';
        },
      });
  }

  renderQr(qrString: string) {
    if (!this.qrCanvas || !this.qrCanvas.nativeElement) {
      setTimeout(() => this.renderQr(qrString), 50);
      return;
    }

    const canvas = this.qrCanvas.nativeElement;

    QRCode.toCanvas(canvas, qrString, {
      errorCorrectionLevel: 'M',
      width: 240,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }, (error) => {
      if (error) {
        console.error('Failed to render KHQR:', error);
        this.phase = 'error';
        this.errorMessage = 'Failed to generate QR code';
        return;
      }

      if (this.phase === 'waiting') {
        this.startCountdown();
        this.startPolling();
      }
    });
  }

  private isPaid(res: any): boolean {
    return (
      res?.status === 'SUCCESS' ||
      res?.status === 'PAID' ||
      res?.data?.status === 'PAID' ||
      res?.data?.status === 'SUCCESS' ||
      res?.code === 0 ||
      res?.responseCode === '00'
    );
  }

  private startPolling(): void {
    console.log('[KHQR] Polling started for md5:', this.md5, 'order:', this.orderId);

    this.pollSub = interval(3000)
      .pipe(
        switchMap(() =>
          this.paymentService
            .verifyPayment({
              md5: this.md5,
              orderId: this.orderId || undefined,
            })
            .pipe(catchError(() => EMPTY))
        ),
        takeWhile((res) => !this.isPaid(res), true)
      )
      .subscribe({
        next: (res) => {
          console.log('[KHQR] Polling response:', res);

          if (this.isPaid(res)) {
            console.log('[KHQR] Payment verified — handing off to checkout redirect.');
            this.stopPolling();
            this.stopCountdown();
            this.phase = 'success';
            this.cdr.detectChanges();

            if (!this.toastShown) {
              this.toastShown = true;
              this.paid.emit({
                md5: this.md5,
                orderId: this.orderId || (res.orderId ?? undefined),
                orderNumber: res.orderNumber,
              });
            }
            // Safety net: if the parent never reacts to `paid`, don't leave the
            // modal polling forever — close it shortly after.
            setTimeout(() => this.close(), 1500);
          }
        },
      });
  }

  private startCountdown(): void {
    this.timerSub = interval(1000).subscribe(() => {
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
      if (this.remainingSeconds === 0 && this.phase !== 'success') {
        this.phase = 'expired';
        this.stopPolling();
      }
    });
  }

  formattedRemaining(): string {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  close(): void {
    this.stopPolling();
    this.stopCountdown();
    this.closed.emit();
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  private stopCountdown(): void {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.stopCountdown();
  }
}