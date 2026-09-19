import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type MessageStatus = 'unread' | 'read' | 'replied' | 'archived';

export interface MessageReply {
  text: string;
  repliedAt?: string;
  repliedBy?: string;
}

export interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: MessageStatus;
  reply?: MessageReply;
  createdAt: string;
}

export interface NewMessagePayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  private apiUrl = 'http://localhost:3000/api/messages';

  constructor(private http: HttpClient) {}

  submitMessage(payload: NewMessagePayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.apiUrl, payload);
  }

  getMessages(): Observable<ContactMessage[]> {
    return this.http
      .get<{ messages: ContactMessage[] }>(this.apiUrl)
      .pipe(map((res) => res?.messages ?? res));
  }

  updateStatus(id: string, status: MessageStatus): Observable<ContactMessage> {
    return this.http.patch<ContactMessage>(`${this.apiUrl}/${id}/status`, { status });
  }

  replyToMessage(id: string, text: string): Observable<{ message: ContactMessage }> {
    return this.http.post<{ message: ContactMessage }>(`${this.apiUrl}/${id}/reply`, { text });
  }

  deleteMessage(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}