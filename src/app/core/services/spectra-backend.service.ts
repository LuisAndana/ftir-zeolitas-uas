import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap, retry } from 'rxjs/operators';
import { AuthBackendService } from './auth-backend.service';

export interface SpectrumData {
  id: number;
  user_id: number;
  filename: string;
  material?: string;
  technique?: string;
  hydration_state?: string;
  temperature?: string;
  wavenumber_data?: string;
  created_at: string;
  updated_at: string;
  wavenumbers?: number[];
  absorbance?: number[];
  point_count?: number;
  spectral_range_min?: number;
  spectral_range_max?: number;
  min_absorbance?: number;
  max_absorbance?: number;
  mean_absorbance?: number;
}

export interface SpectraResponse {
  success: boolean;
  data: SpectrumData[];
  pagination?: {
    skip: number;
    limit: number;
    total: number;
  };
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SpectrumDetailResponse {
  success: boolean;
  message: string;
  data: {
    spectrum: SpectrumData;
  };
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    spectrum: SpectrumData;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SpectraBackendService {
  // ✅ IMPORTANTE: Incluir /api en la URL
  private readonly API_URL = 'http://localhost:8000/api/spectra';
  
  // BehaviorSubject para manejar la lista de espectros
  private spectraSubject = new BehaviorSubject<SpectrumData[]>([]);
  public spectra$ = this.spectraSubject.asObservable();

  // Cache de espectros por página
  private cache: Map<string, SpectraResponse> = new Map();

  constructor(
    private http: HttpClient,
    private authService: AuthBackendService
  ) {}

  /**
   * Obtener headers con autenticación
   */
  private getHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    
    if (!token) {
      console.warn('⚠️  No hay token disponible');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Cargar lista de espectros del usuario
   * ✅ CON VALIDACIÓN DE PARÁMETROS
   */
  getSpectra(skip: number = 0, limit: number = 20): Observable<SpectraResponse> {
    // ✅ Validar parámetros
    skip = Math.max(0, skip);
    limit = Math.max(1, Math.min(100, limit));
    
    const cacheKey = `skip=${skip}&limit=${limit}`;
    
    // Verificar cache
    if (this.cache.has(cacheKey)) {
      console.log(`📦 Usando cache para ${cacheKey}`);
      return new Observable(observer => {
        observer.next(this.cache.get(cacheKey)!);
        observer.complete();
      });
    }

    const url = `${this.API_URL}?skip=${skip}&limit=${limit}`;
    console.log(`📡 GET ${url}`);
    
    return this.http.get<SpectraResponse>(
      url,
      { headers: this.getHeaders() }
    ).pipe(
      retry(1),  // ✅ Reintentar 1 vez en caso de error
      tap(response => {
        console.log(`✅ Espectros cargados: ${response.data.length} de ${response.total}`);
        
        // Guardar en cache
        this.cache.set(cacheKey, response);
        
        // Guardar en BehaviorSubject
        this.spectraSubject.next(response.data);
      }),
      catchError(error => {
        console.error(`❌ Error cargando espectros (${url}):`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cargar espectro específico por ID
   */
  getSpectrumDetail(id: number): Observable<SpectrumDetailResponse> {
    const url = `${this.API_URL}/${id}`;
    console.log(`📡 GET ${url}`);
    
    return this.http.get<SpectrumDetailResponse>(
      url,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        console.log(`✅ Espectro detalle cargado: ${response.data.spectrum.filename}`);
      }),
      catchError(error => {
        console.error(`❌ Error cargando espectro (${url}):`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cargar archivo de espectro
   */
  uploadSpectrum(
    file: File,
    material?: string,
    technique?: string,
    hydration_state?: string,
    temperature?: string
  ): Observable<UploadResponse> {
    const url = `${this.API_URL}/upload`;
    console.log(`📤 POST ${url}`);
    console.log(`   Archivo: ${file.name}`);
    
    const formData = new FormData();
    formData.append('file', file);
    
    if (material) formData.append('material', material);
    if (technique) formData.append('technique', technique);
    if (hydration_state) formData.append('hydration_state', hydration_state);
    if (temperature) formData.append('temperature', temperature);

    // ✅ Para multipart/form-data, no usar Content-Type header
    const token = this.authService.getAccessToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<UploadResponse>(
      url,
      formData,
      { headers }
    ).pipe(
      tap(response => {
        console.log(`✅ Espectro cargado: ${response.data.spectrum.filename}`);
        
        // Limpiar cache
        this.cache.clear();
        
        // Recargar lista
        this.getSpectra().subscribe();
      }),
      catchError(error => {
        console.error(`❌ Error cargando archivo (${url}):`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Eliminar espectro
   */
  deleteSpectrum(id: number): Observable<any> {
    const url = `${this.API_URL}/${id}`;
    console.log(`🗑️  DELETE ${url}`);
    
    return this.http.delete<any>(
      url,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        console.log(`✅ Espectro eliminado (ID ${id})`);
        
        // Limpiar cache
        this.cache.clear();
        
        // Recargar lista
        this.getSpectra().subscribe();
      }),
      catchError(error => {
        console.error(`❌ Error eliminando espectro (${url}):`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener espectros desde BehaviorSubject (sin hacer llamada HTTP)
   */
  getSpectraFromCache(): Observable<SpectrumData[]> {
    return this.spectra$;
  }

  /**
   * Obtener último espectro cargado
   */
  getLastSpectrum(): SpectrumData | null {
    const spectra = this.spectraSubject.value;
    return spectra.length > 0 ? spectra[spectra.length - 1] : null;
  }

  /**
   * Limpiar cache
   */
  clearCache(): void {
    console.log('🧹 Limpiando cache de espectros');
    this.cache.clear();
  }

  /**
   * Helper: Convertir SpectrumData a formato para Plotly
   */
  convertToPlotlyFormat(spectrum: SpectrumData): { x: number[], y: number[], name: string } {
    const wavenumbers = spectrum.wavenumbers || [];
    const absorbance = spectrum.absorbance || [];
    
    return {
      x: wavenumbers,
      y: absorbance,
      name: spectrum.filename
    };
  }

  /**
   * Manejo de errores HTTP
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      console.error(`❌ HTTP Error ${error.status}:`);
      console.error(`   URL: ${error.url}`);
      console.error(`   Message: ${error.message}`);
      
      if (error.status === 401) {
        console.error('🔐 Error 401: Token expirado o inválido');
        errorMessage = 'Token expirado. Por favor, inicia sesión nuevamente.';
      } else if (error.status === 403) {
        console.error('🚫 Error 403: No autorizado');
        errorMessage = 'No tienes permiso para acceder a este recurso.';
      } else if (error.status === 404) {
        console.error('🔍 Error 404: No encontrado');
        errorMessage = 'El recurso no fue encontrado.';
      } else {
        errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
}