import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RevealDirective } from '../../directives/reveal.directive';
import { MessageService } from '../../services/message.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, RevealDirective],
  templateUrl: './contact.component.html',
})
export class ContactComponent implements OnInit {
  readonly directionsUrl =
    'https://www.google.com/maps/dir/?api=1&destination=SETEC+Institute%2C+No.+86A%2C+Street+110%2C+Phnom+Penh';

  form = {
    name: '',
    email: '',
    subject: 'General',
    message: '',
  };
  sent = false;
  sending = false;
  errorMessage = '';

  private readonly topics: Record<string, string> = {
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    shipping: 'Shipping & Returns',
    orders: 'Order Help',
    builds: 'Build Support',
  };

  constructor(
    private route: ActivatedRoute,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const topic = params.get('topic');
      if (topic && this.topics[topic]) {
        this.form.subject = this.topics[topic];
      }
    });
  }

  sendMessage(form: NgForm): void {
    if (form.invalid || this.sending) {
      return;
    }
    this.sending = true;
    this.errorMessage = '';
    this.sent = false;
    this.messageService
      .submitMessage({
        name: this.form.name.trim(),
        email: this.form.email.trim(),
        subject: this.form.subject,
        message: this.form.message.trim(),
      })
      .subscribe({
        next: () => {
          this.sending = false;
          this.sent = true;
          this.form = { name: '', email: '', subject: 'General', message: '' };
          form.resetForm();
        },
        error: (err) => {
          this.sending = false;
          this.errorMessage =
            err.error?.message || 'Something went wrong sending your message. Please try again.';
        },
      });
  }
}