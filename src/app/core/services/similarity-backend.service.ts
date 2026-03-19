import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const API_URL = 'http://localhost:8000/api';

export interface SimilarityConfig {
  method: 'cosine' | 'pearson' | 'euclidean';
  tolerance: number;
  range_min: number;
  range_max: number;
  top_n: number;
  family_filter?: string | null;
  use_windows: boolean;
  selected_windows?: string[];
}

export interface SimilarityResult {
  spectrum_id: string;
  filename: string;
  family?: string;
  global_score: number;
  window_scores?: { window: string; score: number }[];
  matching_peaks: number;
  total_peaks: number;
  rank: number;
}

export interface SimilaritySearchResponse {
  success: boolean;
  message: string;
  data?: {
    query_spectrum_id: string;
    search_method: string;
    tolerance: number;
    results: SimilarityResult[];
    total_spectra_searched: number;
    results_found: number;
    execution_time_ms: number;
    searched_at?: string;
  };
}

export interface ComparisonResponse {
  success: boolean;
  message: string;
  data?: {
    global_score: number;
    window_scores: { window: string; score: number }[];
    matched_peaks: number[];
    unmatched_peaks: number[];
    total_peaks: number;
    query_spectrum: { id: number; filename: string; points: number };
    reference_spectrum: { id: number; filename: string; points: number };
  };
}

@Injectable({
  providedIn: 'root'
})
export class SimilarityBackendService {
  private apiUrl = `${API_URL}/similarity`;

  constructor(private http: HttpClient) {}

  /**
   * CU-F-005: Ejecutar búsqueda de similitud contra el backend
   */
  searchSimilarSpectra(
    querySpectrumId: string,
    config: SimilarityConfig
  ): Observable<SimilaritySearchResponse> {
    console.log('🔍 Enviando búsqueda de similitud al backend:', {
      querySpectrumId,
      config
    });

    const headers = this.getAuthHeaders();

    const payload = {
      query_spectrum_id: parseInt(querySpectrumId),
      config: {
        method: config.method,
        tolerance: config.tolerance,
        range_min: config.range_min,
        range_max: config.range_max,
        top_n: config.top_n,
        family_filter: config.family_filter || null,
        use_windows: config.use_windows,
        selected_windows: config.selected_windows || []
      }
    };

    return this.http.post<SimilaritySearchResponse>(
      `${this.apiUrl}/search`,
      payload,
      { headers }
    ).pipe(
      tap(response => {
        console.log('✅ Respuesta recibida del backend:', response);
      }),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * CU-F-006: Comparar dos espectros específicos
   */
  compareSpectra(
    queryId: string,
    referenceId: string,
    method: string = 'cosine',
    tolerance: number = 4
  ): Observable<ComparisonResponse> {
    console.log('🔄 Enviando comparación al backend:', {
      queryId,
      referenceId,
      method,
      tolerance
    });

    const headers = this.getAuthHeaders();

    const params = {
      query_id: queryId,
      reference_id: referenceId,
      method: method,
      tolerance: tolerance.toString()
    };

    return this.http.post<ComparisonResponse>(
      `${this.apiUrl}/compare`,
      {},
      { headers, params }
    ).pipe(
      tap(response => {
        console.log('✅ Comparación completada:', response);
      }),
      catchError(error => this.handleError(error))
    );
  }

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
   * Manejo de errores
   */
  private handleError(error: any) {
    console.error('❌ Error en servicio de similitud:', error);

    let message = 'Error en búsqueda de similitud';

    if (error.error?.detail) {
      message = error.error.detail;
    } else if (error.error?.message) {
      message = error.error.message;
    } else if (error.status === 401) {
      message = 'No autenticado';
    } else if (error.status === 404) {
      message = 'Espectro no encontrado';
    } else if (error.status === 500) {
      message = 'Error del servidor';
    }

    return throwError(() => new Error(message));
  }
}