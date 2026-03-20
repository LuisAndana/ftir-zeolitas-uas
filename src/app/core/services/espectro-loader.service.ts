import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

const API_URL = 'http://localhost:8000/api';

export interface Spectrum {
  id: string | number;
  filename: string;
  wavenumbers: number[];
  data: number[];
  metadata: {
    material: string;
    technique: string;
    hydrationState: string;
    temperature: string;
  };
  uploadedDate: string;
  uploadedBy?: string;
}

export interface SpectrumResponse {
  success: boolean;
  message: string;
  spectrum?: Spectrum;
  spectra?: Spectrum[];
}

@Injectable({
  providedIn: 'root'
})
export class EspectroLoaderService {

  private spectrosSubject = new BehaviorSubject<Spectrum[]>([]);
  public espectros$ = this.spectrosSubject.asObservable();
  private apiUrl = `${API_URL}/spectra`;

  // Formatos soportados
  SUPPORTED_FORMATS = {
    csv: { extensions: ['.csv'], mimeTypes: ['text/csv', 'application/csv'] },
    txt: { extensions: ['.txt'], mimeTypes: ['text/plain'] },
    dpt: { extensions: ['.dpt'], mimeTypes: ['text/plain', 'application/octet-stream'] },
    xlsx: { extensions: ['.xlsx'], mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
    json: { extensions: ['.json'], mimeTypes: ['application/json'] }
  };

  constructor(private http: HttpClient) {
    this.loadSpectraFromBackend();
  }

  /**
   * ✅ CARGAR ESPECTROS DESDE BACKEND
   */
  private loadSpectraFromBackend() {
    console.log('🌐 EspectroLoaderService: Iniciando carga desde backend...');
    const headers = this.getAuthHeaders();

    this.http.get<any>(`${this.apiUrl}?skip=0&limit=100`, { headers })
      .pipe(
        tap((response: any) => {
          console.log('📡 Respuesta del backend:', response);

          let spectra: Spectrum[] = [];

          // ✅ VERIFICAR ESTRUCTURA - Backend retorna 'data', no 'spectra'
          if (response.success && response.data && Array.isArray(response.data)) {
            console.log(`📊 Backend retornó ${response.data.length} espectros`);
            spectra = response.data.map((s: any, index: number) => {
              console.log(`   [${index}] Procesando: ${s.filename} (ID: ${s.id})`);
              return this.formatFromBackend(s);
            });
            console.log(`✅ ${spectra.length} espectros formateados exitosamente`);
          } else if (response.spectra && Array.isArray(response.spectra)) {
            // Fallback: por si viene en 'spectra'
            console.log(`⚠️ Backend retornó datos en 'spectra' (fallback)`);
            spectra = response.spectra.map((s: any) => this.formatFromBackend(s));
          } else {
            console.warn('⚠️ Estructura inesperada del backend:', response);
          }

          // ✅ EMITIR ESPECTROS
          this.spectrosSubject.next(spectra);
          console.log(`📊 BehaviorSubject actualizado: ${spectra.length} espectros`);

          if (spectra.length === 0) {
            console.warn('⚠️ La BD está vacía - Carga espectros en "Cargar Espectro"');
          }
        }),
        catchError((error: any) => {
          console.error('❌ Error cargando espectros del backend:', error.status, error.message);

          if (error.status === 401) {
            console.error('🔐 Error 401: Autenticación fallida - Inicia sesión de nuevo');
          } else if (error.status === 0) {
            console.error('📡 Error 0: Backend no disponible en localhost:8000');
          } else if (error.status === 403) {
            console.error('🚫 Error 403: No tienes permiso para acceder');
          } else {
            console.error('Error:', error.error?.detail || error.message);
          }

          // ✅ FALLBACK: cargar desde localStorage
          console.log('📦 Intentando cargar desde localStorage...');
          this.loadSpectraFromStorage();
          return throwError(() => error);
        })
      )
      .subscribe();
  }

  /**
   * ✅ FORMATEAR ESPECTRO DEL BACKEND
   * Maneja múltiples formatos de datos
   */
  private formatFromBackend(backendSpectrum: any): Spectrum {
    let wavenumbers: number[] = [];
    let absorbance: number[] = [];

    // ✅ OPCIÓN 1: Datos ya parseados como arrays (respuesta new)
    if (Array.isArray(backendSpectrum.wavenumbers)) {
      console.log(`       ✅ Wavenumbers: array con ${backendSpectrum.wavenumbers.length} puntos`);
      wavenumbers = backendSpectrum.wavenumbers;
    }

    if (Array.isArray(backendSpectrum.absorbance)) {
      console.log(`       ✅ Absorbance: array con ${backendSpectrum.absorbance.length} puntos`);
      absorbance = backendSpectrum.absorbance;
    }

    // ✅ OPCIÓN 2: Datos en wavenumber_data como JSON string (respuesta old)
    if ((wavenumbers.length === 0 || absorbance.length === 0) && backendSpectrum.wavenumber_data) {
      console.log(`       📄 Parseando wavenumber_data (JSON string)...`);
      try {
        let data: any;

        if (typeof backendSpectrum.wavenumber_data === 'string') {
          data = JSON.parse(backendSpectrum.wavenumber_data);
        } else {
          data = backendSpectrum.wavenumber_data;
        }

        if (data.wavenumbers && Array.isArray(data.wavenumbers)) {
          wavenumbers = data.wavenumbers;
          console.log(`       ✅ Wavenumbers del JSON: ${wavenumbers.length} puntos`);
        }

        if (data.absorbance && Array.isArray(data.absorbance)) {
          absorbance = data.absorbance;
          console.log(`       ✅ Absorbance del JSON: ${absorbance.length} puntos`);
        }
      } catch (e) {
        console.warn(`       ⚠️ Error parseando wavenumber_data:`, e);
      }
    }

    // ✅ OPCIÓN 3: Acceso directo (compatibility)
    if (wavenumbers.length === 0 && backendSpectrum.wavenumbers) {
      wavenumbers = backendSpectrum.wavenumbers;
    }
    if (absorbance.length === 0 && backendSpectrum.absorbance) {
      absorbance = backendSpectrum.absorbance;
    }

    // ✅ VALIDACIÓN FINAL
    if (wavenumbers.length === 0 || absorbance.length === 0) {
      console.warn(`       ⚠️ Espectro ${backendSpectrum.filename}: Sin datos válidos`);
      console.warn(`          WN: ${wavenumbers.length}, ABS: ${absorbance.length}`);
    }

    return {
      id: backendSpectrum.id || `spec_${Date.now()}`,
      filename: backendSpectrum.filename || 'Desconocido',
      wavenumbers: wavenumbers,
      data: absorbance,
      metadata: {
        material: backendSpectrum.material || 'Desconocido',
        technique: backendSpectrum.technique || 'ATR',
        hydrationState: backendSpectrum.hydration_state || 'As-synthesized',
        temperature: backendSpectrum.temperature || '25°C'
      },
      uploadedDate: backendSpectrum.created_at || new Date().toISOString(),
      uploadedBy: backendSpectrum.user_id
    };
  }

  /**
   * Cargar archivo espectral en múltiples formatos
   */
  loadSpectrumFile(file: File): Promise<Spectrum> {
    return new Promise((resolve, reject) => {
      const filename = file.name.toLowerCase();

      // Validar extensión
      const isSupportedFormat = this.isSupportedFormat(filename);
      if (!isSupportedFormat) {
        reject('Formato no soportado. Use: CSV, TXT, DPT, XLSX, JSON');
        return;
      }

      // Validar tamaño (máx 50MB para archivos grandes)
      if (file.size > 50 * 1024 * 1024) {
        reject('Archivo muy grande (máximo 50MB)');
        return;
      }

      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const content = e.target?.result as string;
          let spectrum: Spectrum;

          // Parsear según formato
          if (filename.endsWith('.dpt') || filename.endsWith('.txt')) {
            spectrum = this.parseSpectrumFile(content, file.name);
          } else if (filename.endsWith('.csv')) {
            spectrum = this.parseCSV(content, file.name);
          } else if (filename.endsWith('.json')) {
            spectrum = this.parseJSON(content, file.name);
          } else if (filename.endsWith('.xlsx')) {
            // Para XLSX necesitamos una librería especial
            this.parseXLSX(file).then(spec => {
              this.uploadSpectrumToBackend(spec, file)
                .subscribe({
                  next: (response) => resolve(response.spectrum || spec),
                  error: reject
                });
            }).catch(reject);
            return;
          } else {
            spectrum = this.parseSpectrumFile(content, file.name);
          }

          // Enviar al backend
          this.uploadSpectrumToBackend(spectrum, file)
            .subscribe({
              next: (response) => {
                console.log('✅ Espectro cargado:', response);
                this.loadSpectraFromBackend();
                resolve(response.spectrum || spectrum);
              },
              error: reject
            });

        } catch (error) {
          reject(`Error al parsear archivo: ${error}`);
        }
      };

      reader.onerror = () => reject('Error al leer archivo');
      reader.readAsText(file);
    });
  }

  /**
   * Verificar si el formato es soportado
   */
  private isSupportedFormat(filename: string): boolean {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return Object.values(this.SUPPORTED_FORMATS).some(format =>
      format.extensions.includes(ext)
    );
  }

  /**
   * Parsear formato DPT/TXT (formato Perkin Elmer y genérico)
   */
  private parseSpectrumFile(content: string, filename: string): Spectrum {
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const wavenumbers: number[] = [];
    const absorbance: number[] = [];

    let foundValidData = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const parts = trimmedLine.split(/\s+/).filter(p => p && p.length > 0);

      if (parts.length < 2) {
        continue;
      }

      try {
        let wn: number;
        let abs: number;

        if (parts.length === 3) {
          const firstCol = parseFloat(parts[0]);
          
          if (!isNaN(firstCol) && firstCol > 0 && firstCol < 10000 && Number.isInteger(firstCol)) {
            wn = parseFloat(parts[1]);
            abs = parseFloat(parts[2]);
          } else {
            wn = parseFloat(parts[1]);
            abs = parseFloat(parts[2]);
          }
        } else if (parts.length === 2) {
          wn = parseFloat(parts[0]);
          abs = parseFloat(parts[1]);
        } else {
          wn = parseFloat(parts[parts.length - 2]);
          abs = parseFloat(parts[parts.length - 1]);
        }

        if (!isNaN(wn) && !isNaN(abs)) {
          if (wn > 0 && ((abs >= 0 && abs <= 1) || (abs >= 0 && abs <= 100))) {
            wavenumbers.push(wn);
            absorbance.push(abs);
            foundValidData = true;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!foundValidData || wavenumbers.length === 0) {
      throw new Error(`No se encontraron datos válidos en el archivo DPT. Se requiere formato: wavenumber absorbance`);
    }

    return this.createSpectrum(wavenumbers, absorbance, filename);
  }

  /**
   * Parsear formato CSV
   */
  private parseCSV(content: string, filename: string): Spectrum {
    const lines = content.split('\n').filter(l => l.trim());
    const wavenumbers: number[] = [];
    const absorbance: number[] = [];

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const wn = parseFloat(parts[0]);
        const abs = parseFloat(parts[1]);

        if (!isNaN(wn) && !isNaN(abs)) {
          wavenumbers.push(wn);
          absorbance.push(abs);
        }
      }
    }

    if (wavenumbers.length === 0) {
      throw new Error('No se encontraron datos válidos en el archivo CSV');
    }

    return this.createSpectrum(wavenumbers, absorbance, filename);
  }

  /**
   * Parsear formato JSON
   */
  private parseJSON(content: string, filename: string): Spectrum {
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      const wavenumbers = data.map((d: any) => d.wavenumber || d.wn || d[0]).filter((v: any) => !isNaN(v));
      const absorbance = data.map((d: any) => d.absorbance || d.abs || d[1]).filter((v: any) => !isNaN(v));

      if (wavenumbers.length > 0 && absorbance.length > 0) {
        return this.createSpectrum(wavenumbers, absorbance, filename);
      }
    } else if (data.wavenumbers && data.absorbance) {
      return this.createSpectrum(data.wavenumbers, data.absorbance, filename);
    }

    throw new Error('Formato JSON no reconocido. Use {wavenumbers: [], absorbance: []} o Array de objetos');
  }

  /**
   * Parsear formato XLSX (requiere SheetJS)
   */
  private parseXLSX(file: File): Promise<Spectrum> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          reject('Para XLSX instala: npm install xlsx');
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Crear objeto Spectrum
   */
  private createSpectrum(
    wavenumbers: number[],
    absorbance: number[],
    filename: string
  ): Spectrum {
    const minLength = Math.min(wavenumbers.length, absorbance.length);
    wavenumbers = wavenumbers.slice(0, minLength);
    absorbance = absorbance.slice(0, minLength);

    const indices = wavenumbers.map((_, i) => i)
      .sort((a, b) => wavenumbers[b] - wavenumbers[a]);
    wavenumbers = indices.map(i => wavenumbers[i]);
    absorbance = indices.map(i => absorbance[i]);

    return {
      id: `spec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: filename,
      wavenumbers: wavenumbers,
      data: absorbance,
      metadata: {
        material: 'Desconocido',
        technique: 'ATR',
        hydrationState: 'As-synthesized',
        temperature: '25°C'
      },
      uploadedDate: new Date().toISOString(),
      uploadedBy: this.getCurrentUserEmail()
    };
  }

  /**
   * Subir espectro al backend
   */
  private uploadSpectrumToBackend(spectrum: Spectrum, file: File): Observable<any> {
    const headers = this.getAuthHeaders();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', spectrum.filename);
    formData.append('material', spectrum.metadata.material);
    formData.append('technique', spectrum.metadata.technique);
    formData.append('hydration_state', spectrum.metadata.hydrationState);
    formData.append('temperature', spectrum.metadata.temperature);
    formData.append('wavenumber_data', JSON.stringify({
      wavenumbers: spectrum.wavenumbers,
      absorbance: spectrum.data
    }));

    const headersWithoutContentType = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    });

    return this.http.post<any>(
      `${this.apiUrl}/upload`,
      formData,
      { headers: headersWithoutContentType }
    ).pipe(
      tap((response: any) => {
        if (response.success) {
          console.log('✅ Espectro guardado en BD');
        }
      }),
      catchError((error: any) => {
        console.error('❌ Error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener todos los espectros
   */
  getAllSpectra(): Spectrum[] {
    return this.spectrosSubject.value;
  }

  /**
   * Obtener espectro por ID
   */
  getSpectrumById(id: string | number): Spectrum | undefined {
    return this.spectrosSubject.value.find(s => s.id === id || String(s.id) === String(id));
  }

  /**
   * Eliminar espectro
   */
  deleteSpectrum(id: string) {
    const headers = this.getAuthHeaders();

    this.http.delete(`${this.apiUrl}/${id}`, { headers })
      .subscribe({
        next: () => this.loadSpectraFromBackend(),
        error: (error: any) => {
          const current = this.spectrosSubject.value;
          const updated = current.filter(s => s.id !== id);
          this.spectrosSubject.next(updated);
          this.saveSpectraToStorage(updated);
        }
      });
  }

  /**
   * Obtener headers con autenticación
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Guardar en localStorage (fallback)
   */
  private saveSpectraToStorage(spectra: Spectrum[]) {
    localStorage.setItem('spectra', JSON.stringify(spectra));
  }

  /**
   * Cargar desde localStorage
   */
  private loadSpectraFromStorage() {
    const stored = localStorage.getItem('spectra');
    if (stored) {
      try {
        const spectra = JSON.parse(stored);
        this.spectrosSubject.next(spectra);
        console.log(`📦 ${spectra.length} espectros cargados desde localStorage`);
      } catch (e) {
        console.error('Error cargando localStorage:', e);
      }
    }
  }

  /**
   * Obtener email del usuario
   */
  private getCurrentUserEmail(): string {
    const user = localStorage.getItem('current_user');
    if (user) {
      try {
        return JSON.parse(user).email;
      } catch {
        return 'unknown@example.com';
      }
    }
    return 'unknown@example.com';
  }

  /**
   * Obtener información sobre formatos soportados
   */
  getSupportedFormatsInfo(): string {
    return `Formatos soportados:
    • CSV: wavenumber,absorbance
    • TXT/DPT: números separados por espacios
    • JSON: {wavenumbers: [], absorbance: []}
    • XLSX: requiere npm install xlsx`;
  }
}