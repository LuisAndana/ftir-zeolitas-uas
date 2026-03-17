import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

const API_URL = 'http://localhost:8000/api';

export interface Spectrum {
  id: string;
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
   * Formatos soportados:
   * - Tres columnas (índice | wavenumber | absorbance): ignora primera columna
   * - Dos columnas (wavenumber | absorbance): usa ambas
   * 
   * Ejemplo DPT (Perkin Elmer):
   * 1    3997.23779   0.99338
   * 2    3995.82083   0.99338
   * 3    3994.40387   0.99338
   */
  private parseSpectrumFile(content: string, filename: string): Spectrum {
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const wavenumbers: number[] = [];
    const absorbance: number[] = [];

    let dataStartIndex = 0;
    let foundValidData = false;

    for (const line of lines) {
      // Limpiar espacios y tabs
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Intentar parsear diferentes formatos
      const parts = trimmedLine.split(/\s+/).filter(p => p && p.length > 0);

      if (parts.length < 2) {
        continue;
      }

      try {
        let wn: number;
        let abs: number;

        // Detectar formato basado en número de columnas
        if (parts.length === 3) {
          // Formato DPT: índice | wavenumber | absorbance
          // Primera columna es número, ignorar
          const firstCol = parseFloat(parts[0]);
          
          // Verificar si primera columna es un índice (número entero pequeño)
          if (!isNaN(firstCol) && firstCol > 0 && firstCol < 10000 && Number.isInteger(firstCol)) {
            // Probablemente es un índice
            wn = parseFloat(parts[1]);
            abs = parseFloat(parts[2]);
          } else {
            // Podría ser datos reales en 3 columnas, tomar último 2
            wn = parseFloat(parts[1]);
            abs = parseFloat(parts[2]);
          }
        } else if (parts.length === 2) {
          // Formato simple: wavenumber | absorbance
          wn = parseFloat(parts[0]);
          abs = parseFloat(parts[1]);
        } else {
          // Más de 3 columnas, tomar últimas 2
          wn = parseFloat(parts[parts.length - 2]);
          abs = parseFloat(parts[parts.length - 1]);
        }

        // Validar que ambos valores sean números válidos
        if (!isNaN(wn) && !isNaN(abs)) {
          // Validar rangos razonables para FTIR
          // Wavenumber típicamente 400-4000 cm⁻¹
          // Absorbance/Transmitancia típicamente 0-1 o 0-100
          if (wn > 0 && (abs >= 0 && abs <= 1) || (abs >= 0 && abs <= 100)) {
            wavenumbers.push(wn);
            absorbance.push(abs);
            foundValidData = true;
          }
        }
      } catch (e) {
        // Ignorar líneas que no se puedan parsear
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
      // Formato: Array de objetos con {wavenumber, absorbance}
      const wavenumbers = data.map((d: any) => d.wavenumber || d.wn || d[0]).filter((v: any) => !isNaN(v));
      const absorbance = data.map((d: any) => d.absorbance || d.abs || d[1]).filter((v: any) => !isNaN(v));

      if (wavenumbers.length > 0 && absorbance.length > 0) {
        return this.createSpectrum(wavenumbers, absorbance, filename);
      }
    } else if (data.wavenumbers && data.absorbance) {
      // Formato: {wavenumbers: [...], absorbance: [...]}
      return this.createSpectrum(data.wavenumbers, data.absorbance, filename);
    }

    throw new Error('Formato JSON no reconocido. Use {wavenumbers: [], absorbance: []} o Array de objetos');
  }

  /**
   * Parsear formato XLSX (requiere SheetJS)
   */
  private parseXLSX(file: File): Promise<Spectrum> {
    return new Promise((resolve, reject) => {
      // Para XLSX, usaríamos SheetJS library
      // import * as XLSX from 'xlsx';
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          // Este es un placeholder - en producción usarías SheetJS
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
    // Validar que tenemos la misma cantidad de datos
    const minLength = Math.min(wavenumbers.length, absorbance.length);
    wavenumbers = wavenumbers.slice(0, minLength);
    absorbance = absorbance.slice(0, minLength);

    // Ordenar por wavenumber descendente (convención FTIR)
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
   * Cargar espectros desde el backend
   */
  private loadSpectraFromBackend() {
    const headers = this.getAuthHeaders();

    this.http.get<any>(`${this.apiUrl}?skip=0&limit=100`, { headers })
      .pipe(
        tap((response: any) => {
          if (response.success && response.spectra) {
            const spectra = response.spectra.map((s: any) => this.formatFromBackend(s));
            this.spectrosSubject.next(spectra);
          }
        }),
        catchError((error: any) => {
          console.warn('No backend available, using localStorage');
          this.loadSpectraFromStorage();
          return throwError(() => error);
        })
      )
      .subscribe();
  }

  /**
   * Formatear espectro del backend
   */
  private formatFromBackend(backendSpectrum: any): Spectrum {
    return {
      id: backendSpectrum.id,
      filename: backendSpectrum.filename,
      wavenumbers: backendSpectrum.wavenumber_data?.wavenumbers || [],
      data: backendSpectrum.wavenumber_data?.absorbance || [],
      metadata: {
        material: backendSpectrum.material || 'Desconocido',
        technique: backendSpectrum.technique || 'ATR',
        hydrationState: backendSpectrum.hydration_state || 'As-synthesized',
        temperature: backendSpectrum.temperature || '25°C'
      },
      uploadedDate: backendSpectrum.created_at,
      uploadedBy: backendSpectrum.user_id
    };
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
  getSpectrumById(id: string): Spectrum | undefined {
    return this.spectrosSubject.value.find(s => s.id === id);
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
      'Authorization': `Bearer ${token}`,
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