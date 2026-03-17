import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export interface ZeoliteFamily {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  chemical_formula: string;
}

export interface ZeoliteResponse {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ZeolitesService {
  private apiUrl = 'http://localhost:8000/zeolites';

  constructor(private http: HttpClient) {}

  /**
   * Obtener headers con autenticación
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Obtener todas las familias de zeolitas
   */
  getAllFamilies(): Observable<ZeoliteResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<ZeoliteResponse>(`${this.apiUrl}`, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  /**
   * Obtener una familia de zeolita específica por código
   */
  getFamilyByCode(code: string): Observable<ZeoliteResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<ZeoliteResponse>(`${this.apiUrl}/${code}`, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  /**
   * Obtener categorías de zeolitas
   */
  getCategories(): Observable<ZeoliteResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<ZeoliteResponse>(`${this.apiUrl}/data/categories`, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  /**
   * Obtener estadísticas de zeolitas
   */
  getStatistics(): Observable<ZeoliteResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<ZeoliteResponse>(`${this.apiUrl}/data/statistics`, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  /**
   * Buscar zeolitas por nombre o código
   */
  searchZeolites(query: string): Observable<ZeoliteResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<ZeoliteResponse>(
      `${this.apiUrl}/search?q=${encodeURIComponent(query)}`,
      { headers }
    ).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Manejo de errores
   */
  private handleError(error: any) {
    console.error('Zeolites error:', error);
    const message = error?.error?.message || 'Error al obtener zeolitas';
    return throwError(() => new Error(message));
  }
}