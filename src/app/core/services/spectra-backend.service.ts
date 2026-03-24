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
  private readonly API_URL = 'http://localhost:8000/api/spectra';
  
  private spectraSubject = new BehaviorSubject<SpectrumData[]>([]);
  public spectra$ = this.spectraSubject.asObservable();

  private cache: Map<string, SpectraResponse> = new Map();

  constructor(
    private http: HttpClient,
    private authService: AuthBackendService
  ) {}

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

  getSpectra(skip: number = 0, limit: number = 20): Observable<SpectraResponse> {
    skip = Math.max(0, skip);
    limit = Math.max(1, Math.min(100, limit));
    
    const cacheKey = `skip=${skip}&limit=${limit}`;
    
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
      retry(1),
      tap(response => {
        console.log(`✅ Espectros cargados: ${response.data.length} de ${response.total}`);
        
        this.cache.set(cacheKey, response);
        
        this.spectraSubject.next(response.data);
      }),
      catchError(error => {
        console.error(`❌ Error cargando espectros (${url}):`, error);
        return throwError(() => error);
      })
    );
  }

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
   * ✅ CAMBIO: Asegurar que SIEMPRE se envíen los metadatos
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
    console.log(`   Material recibido: "${material}" (tipo: ${typeof material})`);
    console.log(`   Técnica recibida: "${technique}" (tipo: ${typeof technique})`);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // ✅ CAMBIO: SIEMPRE enviar los valores, nunca dejarlos null/undefined
    const finalMaterial = material && material.trim() ? material.trim() : 'Desconocido';
    const finalTechnique = technique && technique.trim() ? technique.trim() : 'ATR';
    const finalHydration = hydration_state && hydration_state.trim() ? hydration_state.trim() : 'As-synthesized';
    const finalTemperature = temperature && temperature.trim() ? temperature.trim() : '25°C';
    
    console.log(`   ✅ Valores finales a enviar en FormData:`);
    console.log(`      - material: "${finalMaterial}"`);
    console.log(`      - technique: "${finalTechnique}"`);
    console.log(`      - hydration_state: "${finalHydration}"`);
    console.log(`      - temperature: "${finalTemperature}"`);
    
    formData.append('material', finalMaterial);
    formData.append('technique', finalTechnique);
    formData.append('hydration_state', finalHydration);
    formData.append('temperature', finalTemperature);

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
        console.log(`   Material guardado en BD: ${response.data.spectrum.material}`);
        console.log(`   Técnica guardada en BD: ${response.data.spectrum.technique}`);
        
        this.cache.clear();
        
        this.getSpectra().subscribe();
      }),
      catchError(error => {
        console.error(`❌ Error cargando archivo (${url}):`, error);
        return throwError(() => error);
      })
    );
  }

  deleteSpectrum(id: number): Observable<any> {
    const url = `${this.API_URL}/${id}`;
    console.log(`🗑️  DELETE ${url}`);
    
    return this.http.delete<any>(
      url,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        console.log(`✅ Espectro eliminado (ID ${id})`);
        
        this.cache.clear();
        
        this.getSpectra().subscribe();
      }),
      catchError(error => {
        console.error(`❌ Error eliminando espectro (${url}):`, error);
        return throwError(() => error);
      })
    );
  }

  getSpectraFromCache(): Observable<SpectrumData[]> {
    return this.spectra$;
  }

  getLastSpectrum(): SpectrumData | null {
    const spectra = this.spectraSubject.value;
    return spectra.length > 0 ? spectra[spectra.length - 1] : null;
  }

  clearCache(): void {
    console.log('🧹 Limpiando cache de espectros');
    this.cache.clear();
  }

  convertToPlotlyFormat(spectrum: SpectrumData): { x: number[], y: number[], name: string } {
    const wavenumbers = spectrum.wavenumbers || [];
    const absorbance = spectrum.absorbance || [];
    
    return {
      x: wavenumbers,
      y: absorbance,
      name: spectrum.filename
    };
  }

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