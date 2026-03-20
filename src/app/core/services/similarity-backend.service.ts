import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const API_URL = 'http://localhost:8000/api';

// ✅ CONFIGURACIÓN PARA BÚSQUEDA
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

// ✅ RESULTADO INDIVIDUAL EN BÚSQUEDA
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

// ✅ RESPUESTA DE BÚSQUEDA DE SIMILITUD
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

// ✅ RESPUESTA DE COMPARACIÓN - MEJORADA CON TODOS LOS CAMPOS DEL BACKEND
export interface ComparisonResponse {
  success: boolean;
  message: string;
  data?: {
    // ✅ SCORES
    global_score: number;
    all_scores?: {
      euclidean: number;
      cosine: number;
      pearson: number;
    };
    method_used?: string;

    // ✅ PICOS
    matched_peaks: number[];
    unmatched_peaks: number[];
    total_peaks: number;
    matching_peaks_count?: number;

    // ✅ INFORMACIÓN DE ESPECTROS
    query_spectrum: {
      id: number;
      filename: string;
      zeolite?: string;
      source?: string;
      points?: number;
    };
    reference_spectrum: {
      id: number;
      filename: string;
      zeolite?: string;
      source?: string;
      points?: number;
    };

    // ✅ VENTANAS ESPECTRALES (OPCIONAL)
    window_scores?: { window: string; score: number }[];
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
   * ✅ MEJORADO: Logging completo y manejo de errores
   */
  searchSimilarSpectra(
    querySpectrumId: string,
    config: SimilarityConfig
  ): Observable<SimilaritySearchResponse> {
    console.log('🔍 BÚSQUEDA DE SIMILITUD');
    console.log('📤 Enviando al backend:', {
      querySpectrumId,
      method: config.method,
      tolerance: config.tolerance,
      range: `${config.range_min}-${config.range_max}`,
      topN: config.top_n
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
        if (response.success && response.data) {
          console.log('✅ Búsqueda completada:', {
            resultsFound: response.data.results_found,
            executionTime: response.data.execution_time_ms + 'ms'
          });
          console.log('📊 Top resultados:', response.data.results.slice(0, 3));
        }
      }),
      catchError(error => this.handleError(error, 'búsqueda'))
    );
  }

  /**
   * CU-F-006: Comparar dos espectros específicos
   * ✅ MEJORADO: Validación de parámetros y logging detallado
   */
  compareSpectra(
    queryId: number | string,
    referenceId: number | string,
    method: string = 'pearson',
    tolerance: number = 4
  ): Observable<ComparisonResponse> {
    // ✅ VALIDAR PARÁMETROS
    if (!queryId || !referenceId) {
      console.error('❌ IDs inválidos para comparación');
      return throwError(() => new Error('IDs de espectros inválidos'));
    }

    console.log('\n' + '='.repeat(70));
    console.log('🔄 COMPARACIÓN DE ESPECTROS');
    console.log('='.repeat(70));
    console.log('📤 Enviando al backend:');
    console.log(`   Query ID: ${queryId}`);
    console.log(`   Reference ID: ${referenceId}`);
    console.log(`   Método: ${method}`);
    console.log(`   Tolerancia: ±${tolerance} cm⁻¹`);

    const headers = this.getAuthHeaders();

    // ✅ PARÁMETROS COMO QUERY STRINGS
    const params = {
      query_id: queryId.toString(),
      reference_id: referenceId.toString(),
      method: method,
      tolerance: tolerance.toString()
    };

    return this.http.post<ComparisonResponse>(
      `${this.apiUrl}/compare`,
      {}, // body vacío
      { headers, params }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          console.log('\n✅ COMPARACIÓN COMPLETADA');
          console.log('📊 Resultados:');
          console.log(`   Global Score: ${(response.data.global_score * 100).toFixed(2)}%`);
          console.log(`   Método usado: ${response.data.method_used || method}`);
          console.log(`   Picos coincidentes: ${response.data.matching_peaks_count || 0}/${response.data.total_peaks}`);

          if (response.data.all_scores) {
            console.log('   Todos los scores:');
            console.log(`     - Pearson: ${(response.data.all_scores.pearson * 100).toFixed(2)}%`);
            console.log(`     - Coseno: ${(response.data.all_scores.cosine * 100).toFixed(2)}%`);
            console.log(`     - Euclidiana: ${(response.data.all_scores.euclidean * 100).toFixed(2)}%`);
          }

          console.log(`   Query: ${response.data.query_spectrum.filename} (${response.data.query_spectrum.source || 'N/A'})`);
          console.log(`   Reference: ${response.data.reference_spectrum.filename} (${response.data.reference_spectrum.source || 'N/A'})`);
          console.log('='.repeat(70));
        }
      }),
      catchError(error => this.handleError(error, 'comparación'))
    );
  }

  /**
   * ✅ OBTENER HEADERS CON AUTENTICACIÓN
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      console.warn('⚠️ No hay token en localStorage');
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * ✅ MANEJO DE ERRORES MEJORADO
   */
  private handleError(error: any, context: string = 'operación') {
    console.error(`\n❌ ERROR EN ${context.toUpperCase()}`);
    console.error('Status:', error.status);
    console.error('Error completo:', error);

    let message = `Error en ${context}`;
    let statusCode = error.status;

    // ✅ EXTRAER MENSAJE DEL BACKEND
    if (error.error?.detail) {
      message = error.error.detail;
    } else if (error.error?.message) {
      message = error.error.message;
    } else if (error.status === 0) {
      message = 'No se pudo conectar al servidor. ¿Está el backend ejecutándose en localhost:8000?';
    } else if (error.status === 400) {
      message = 'Solicitud inválida: ' + (error.error?.detail || 'Parámetros incorrectos');
    } else if (error.status === 401) {
      message = 'No autenticado. Por favor inicia sesión.';
    } else if (error.status === 403) {
      message = 'No tienes permiso para acceder a este espectro.';
    } else if (error.status === 404) {
      message = 'Espectro no encontrado.';
    } else if (error.status === 422) {
      message = 'Error de validación: ' + (error.error?.detail || 'Datos inválidos');
    } else if (error.status === 500) {
      message = 'Error del servidor: ' + (error.error?.detail || 'Intenta más tarde');
    }

    console.error(`📋 Mensaje: ${message}`);

    return throwError(() => ({
      message: message,
      statusCode: statusCode,
      originalError: error
    } as any));
  }

  /**
   * ✅ VERIFICAR CONEXIÓN AL BACKEND
   */
  checkBackendConnection(): Observable<any> {
    console.log('🔗 Verificando conexión al backend...');
    
    return this.http.get(`${API_URL}/health`).pipe(
      tap(() => console.log('✅ Backend disponible')),
      catchError(error => {
        console.error('❌ Backend no disponible:', error.message);
        return throwError(() => new Error('Backend no disponible en localhost:8000'));
      })
    );
  }
}