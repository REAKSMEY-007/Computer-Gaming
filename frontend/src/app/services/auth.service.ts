import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  role: string;
  authProvider?: string;
  avatar?: string;
}

interface AuthResponse {
  token: string;
  user: AppUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  private tokenKey = 'token';
  private userKey = 'user';
  private currentUserSubject = new BehaviorSubject<AppUser | null>(this.restoreUser());

  currentUser$: Observable<AppUser | null> = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  register(username: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { username, email, password });
  }

  googleLogin(idToken: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/google`, { idToken })
      .pipe(tap((res) => this.setSession(res)));
  }

  updateProfile(username: string): Observable<{ user: AppUser }> {
    return this.http.put<{ user: AppUser }>(`${this.apiUrl}/profile`, { username }).pipe(
      tap((res) => this.updateCurrentUser(res.user))
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/profile/password`, { currentPassword, newPassword });
  }

  private setSession(res: AuthResponse): void {
    localStorage.setItem(this.tokenKey, res.token);
    localStorage.setItem(this.userKey, JSON.stringify(res.user));
    this.currentUserSubject.next(res.user);
  }

  private updateCurrentUser(user: AppUser): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): AppUser | null {
    try {
      const raw = localStorage.getItem(this.userKey);
      return raw ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      return null;
    }
  }

  get currentUser(): AppUser | null {
    return this.currentUserSubject.getValue();
  }

  isLoggedIn(): boolean {
    return this.isTokenValid();
  }

  isAdmin(): boolean {
    const user = this.currentUser ?? this.restoreUser();
    return !!user && user.role === 'admin';
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
  }

  private restoreUser(): AppUser | null {
    if (!this.isTokenValid()) {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
      return null;
    }
    return this.getUser();
  }

  private isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;
    const exp = this.getTokenExpiry(token);
    return exp === null || exp > Date.now();
  }

  private getTokenExpiry(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }
}
