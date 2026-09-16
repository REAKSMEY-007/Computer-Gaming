import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule],
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

  private readonly topics: Record<string, string> = {
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    shipping: 'Shipping & Returns',
    orders: 'Order Help',
    builds: 'Build Support',
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const topic = params.get('topic');
      if (topic && this.topics[topic]) {
        this.form.subject = this.topics[topic];
      }
    });
  }

  sendMessage(form: NgForm): void {
    if (form.invalid) {
      return;
    }
    this.sent = true;
    this.form = { name: '', email: '', subject: 'General', message: '' };
    form.resetForm();
  }
}