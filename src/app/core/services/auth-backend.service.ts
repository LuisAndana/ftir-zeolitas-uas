import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

const API_URL = 'http://localhost:8000/api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'investigador' | 'administrador';
  is_active: boolean;
  is_verified: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  } | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthBackendService {
  private apiUrl = `${API_URL}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkTokenExpiration();
  }

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, { name, email, password }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.setTokens(
            response.data.access_token,
            response.data.refresh_token,
            response.data.expires_in
          );
          this.setCurrentUser(response.data.user);
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  getCurrentUser(): Observable<AuthResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<AuthResponse>(`${this.apiUrl}/me`, { headers }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.setCurrentUser(response.data.user);
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  refreshAccessToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token found'));
    }
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {
      refresh_token: refreshToken
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          localStorage.setItem('access_token', response.data.access_token);
        }
      }),
      catchError(error => {
        this.clearTokens();
        this.currentUserSubject.next(null);
        return this.handleError(error);
      })
    );
  }

  logout(): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(`${this.apiUrl}/logout`, {}, { headers }).pipe(
      tap(() => {
        this.clearTokens();
        this.currentUserSubject.next(null);
      }),
      catchError(() => {
        // Si falla el logout del servidor, limpiar localmente de todas formas
        this.clearTokens();
        this.currentUserSubject.next(null);
        return throwError(() => new Error('Logout fallback'));
      })
    );
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!token || !expiresAt) return false;
    return Date.now() < parseInt(expiresAt);
  }

  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'administrador';
  }

  getCurrentUserSync(): User | null {
    return this.currentUserSubject.value;
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getAccessToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('token_expires_at', (Date.now() + expiresIn * 1000).toString());
  }

  private clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('current_user');
  }

  private setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
    localStorage.setItem('current_user', JSON.stringify(user));
  }

  private getUserFromStorage(): User | null {
    const user = localStorage.getItem('current_user');
    return user ? JSON.parse(user) : null;
  }

  private checkTokenExpiration(): void {
    setInterval(() => {
      if (this.isAuthenticated() && this.willExpireSoon()) {
        this.refreshAccessToken().subscribe({ error: () => {} });
      }
    }, 60000);
  }

  private willExpireSoon(): boolean {
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!expiresAt) return false;
    return parseInt(expiresAt) - Date.now() < 5 * 60 * 1000;
  }

  private handleError(error: any) {
    const message = error?.error?.detail || error?.error?.message || 'Error de autenticación';
    return throwError(() => ({ ...error, detail: message }));
  }
}
