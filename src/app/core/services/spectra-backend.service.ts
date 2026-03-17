import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export interface Spectrum {
  id: string;
  user_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface SpectraResponse {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SpectraBackendService {
  private apiUrl = 'http://localhost:8000/spectra';

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
   * CU-ES-001: Cargar nuevo espectro
   */
  uploadSpectrum(file: File, description: string = ''): Observable<SpectraResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    });

    return this.http.post<SpectraResponse>(`${this.apiUrl}/upload`, formData, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  /**
   * CU-ES-002: Obtener lista de espectros del usuario
   */
  getSpectra(skip: number = 0, limit: number = 10): Observable<SpectraResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<SpectraResponse>(
      `${this.apiUrl}?skip=${skip}&limit=${limit}`,
      { headers }
    ).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * CU-ES-003: Obtener un espectro específico
   */
  getSpectrum(id: string): Observable<SpectraResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<SpectraResponse>(`${this.apiUrl}/${id}`, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  /**
   * CU-ES-004: Actualizar información del espectro
   */
  updateSpectrum(id: string, data: any): Observable<SpectraResponse> {
    const headers = this.getAuthHeaders();
    return this.http.put<SpectraResponse>(`${this.apiUrl}/${id}`, data, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  /**
   * CU-ES-005: Eliminar espectro
   */
  deleteSpectrum(id: string): Observable<SpectraResponse> {
    const headers = this.getAuthHeaders();
    return this.http.delete<SpectraResponse>(`${this.apiUrl}/${id}`, { headers })
      .pipe(
        catchError(error => this.handleError(error))
      );
  }

  /**
   * CU-ES-006: Descargar espectro
   */
  downloadSpectrum(id: string): Observable<Blob> {
    const headers = this.getAuthHeaders();
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      headers,
      responseType: 'blob'
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Manejo de errores
   */
  private handleError(error: any) {
    console.error('Spectra error:', error);
    const message = error?.error?.message || 'Error al procesar espectro';
    return throwError(() => new Error(message));
  }
}