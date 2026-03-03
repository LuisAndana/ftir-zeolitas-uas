import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EspectroLoaderService {
  
  private spectrosSubject = new BehaviorSubject<any[]>([]);
  public espectros$ = this.spectrosSubject.asObservable();

  constructor() {
    this.loadSpectrosFromStorage();
  }

  /**
   * CU-F-001: Cargar archivo espectral
   */
  loadSpectrumFile(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const spectrum = this.parseSpectrum(content, file.name);
          this.addSpectrum(spectrum);
          resolve(spectrum);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject('Error al leer archivo');
      reader.readAsText(file);
    });
  }

  /**
   * Parsear diferentes formatos
   */
  private parseSpectrum(content: string, filename: string): any {
    const lines = content.split('\n').filter(l => l.trim());
    const wavenumbers: number[] = [];
    const absorbance: number[] = [];

    // Formato simple: wavenumber, absorbance (CSV)
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

    return {
      id: `spec_${Date.now()}`,
      filename: filename,
      wavenumbers: wavenumbers,
      data: absorbance,
      metadata: {
        material: 'Desconocido',
        form: '',
        technique: 'ATR',
        hydrationState: 'As-synthesized',
        temperature: '25°C'
      },
      uploadedDate: new Date().toISOString(),
      uploadedBy: this.getCurrentUserEmail()
    };
  }

  /**
   * Agregar espectro a la lista y guardar
   */
  private addSpectrum(spectrum: any) {
    const current = this.spectrosSubject.value;
    const updated = [...current, spectrum];
    this.spectrosSubject.next(updated);
    this.saveSpectrosToStorage(updated);
  }

  /**
   * Obtener todos los espectros
   */
  getAllSpectra(): any[] {
    return this.spectrosSubject.value;
  }

  /**
   * Obtener espectro por ID
   */
  getSpectrumById(id: string): any {
    return this.spectrosSubject.value.find(s => s.id === id);
  }

  /**
   * Guardar en localStorage
   */
  private saveSpectrosToStorage(spectra: any[]) {
    localStorage.setItem('spectra', JSON.stringify(spectra));
  }

  /**
   * Cargar desde localStorage
   */
  private loadSpectrosFromStorage() {
    const stored = localStorage.getItem('spectra');
    if (stored) {
      try {
        const spectra = JSON.parse(stored);
        this.spectrosSubject.next(spectra);
      } catch (e) {
        console.error('Error cargando espectros:', e);
      }
    }
  }

  /**
   * Eliminar espectro
   */
  deleteSpectrum(id: string) {
    const current = this.spectrosSubject.value;
    const updated = current.filter(s => s.id !== id);
    this.spectrosSubject.next(updated);
    this.saveSpectrosToStorage(updated);
  }

  private getCurrentUserEmail(): string {
    const user = localStorage.getItem('currentUser');
    if (user) {
      return JSON.parse(user).email;
    }
    return 'unknown@example.com';
  }
}