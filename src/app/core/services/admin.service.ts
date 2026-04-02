import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthBackendService } from './auth-backend.service';

const API_URL = 'http://localhost:8000/api';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'investigador' | 'administrador';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${API_URL}/admin`;

  constructor(private http: HttpClient, private auth: AuthBackendService) {}

  getUsers(): Observable<{ success: boolean; data: { users: AdminUser[] } }> {
    return this.http.get<{ success: boolean; data: { users: AdminUser[] } }>(
      `${this.apiUrl}/users`,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  updateUser(userId: number, data: { is_active?: boolean; role?: string }): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/users/${userId}`,
      data,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/users/${userId}`,
      { headers: this.auth.getAuthHeaders() }
    );
  }
}
