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

// ========================================
// INTERFACES PARA COMPARACIÓN
// ========================================

export interface SpectrumDataComparison {
  id: number;
  filename: string;
  family: string;
  equipment: string;
  spectrum_data: {
    wavenumbers: number[];
    intensities: number[];
  };
  source: string;
}

export interface SpectrumComparisonResponse {
  success: boolean;
  source: 'dataset' | 'user';
  spectrum: SpectrumDataComparison;
}

// ========================================
// SERVICE
// ========================================

@Injectable({
  providedIn: 'root'
})
export class SpectraBackendService {
  private readonly API_URL = 'http://localhost:8000/api/spectra';
  private readonly SIMILARITY_API_URL = 'http://localhost:8000/api/similarity';
  
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
      console.warn('⚠️ No hay token disponible');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // ========================================
  // MÉTODOS PRINCIPALES (SIN CAMBIOS)
  // ========================================

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
    console.log(`🗑️ DELETE ${url}`);
    
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

  // ========================================
  // ✅ NUEVO MÉTODO PARA COMPARACIÓN
  // ========================================

  getSpectrumForComparison(spectrum_id: number): Observable<SpectrumComparisonResponse> {
    const url = `${this.SIMILARITY_API_URL}/spectrum-for-comparison/${spectrum_id}`;
    
    console.log(`📡 GET ${url}`);
    console.log(`   Buscando espectro ID: ${spectrum_id}`);
    
    return this.http.get<SpectrumComparisonResponse>(url, { headers: this.getHeaders() }).pipe(
      tap(response => {
        console.log(`✅ Espectro cargado exitosamente`);
        console.log(`   Nombre: ${response.spectrum.filename}`);
        console.log(`   Fuente: ${response.source}`);
        console.log(`   Familia: ${response.spectrum.family}`);
        console.log(`   Puntos de datos: ${response.spectrum.spectrum_data.wavenumbers.length}`);
      }),
      catchError(error => this.handleError(error, url))
    );
  }

  // ========================================
  // MÉTODOS AUXILIARES (SIN CAMBIOS)
  // ========================================

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

  private handleError(error: HttpErrorResponse, url: string) {
    let errorMessage = 'Error desconocido';
    
    console.error(`❌ Error HTTP ${error.status}:`);
    console.error(`   URL: ${url}`);
    console.error(`   Message: ${error.message}`);
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
      console.error('   Tipo: Error del cliente');
    } else {
      if (error.status === 404) {
        errorMessage = `Espectro no encontrado (404)`;
        console.error('🔍 El espectro no existe en ninguna base de datos');
      } else if (error.status === 401) {
        errorMessage = 'No autorizado (401)';
        console.error('🔐 Token expirado o inválido');
      } else if (error.status === 403) {
        errorMessage = 'Acceso prohibido (403)';
        console.error('🚫 No tienes permisos');
      } else if (error.status === 500) {
        errorMessage = 'Error en el servidor (500)';
        console.error('⚠️ El servidor encontró un error');
      } else {
        errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }
    
    console.error(`   Mensaje final: ${errorMessage}`);
    
    return throwError(() => new Error(errorMessage));
  }
}