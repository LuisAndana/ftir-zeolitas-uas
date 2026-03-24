import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SpectraBackendService, SpectrumData } from '../../../../core/services/spectra-backend.service';

// Estado de cada archivo en la cola
export interface UploadQueueItem {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message: string;
  fileInfo?: any;
}

@Component({
  selector: 'app-cargar-espectro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cargar-espectro.html',
  styleUrl: './cargar-espectro.css'
})
export class CargarEspectro implements OnInit, OnDestroy {

  // Estado
  spectra: SpectrumData[] = [];
  loading = false;
  successMessage = '';
  errorMessage = '';

  // Upload múltiple
  dragover = false;
  uploadQueue: UploadQueueItem[] = [];
  isProcessingQueue = false;

  // Opciones de carga
  material = '';
  technique = 'ATR';
  hydrationState = 'As-synthesized';
  temperature = '25°C';
  description = '';

  // Filtros y paginación
  filterMaterial = '';
  filterTechnique = '';
  skip = 0;
  limit = 20;
  total = 0;
  page = 1;
  total_pages = 1;

  private destroy$ = new Subject<void>();

  constructor(private spectraBackendService: SpectraBackendService) {}

  // ─── MANEJO DE ERRORES ─────────────────────────────────────────────────────

  /**
   * Traduce errores HTTP a mensajes amigables, sin exponer URLs ni detalles técnicos
   */
  private getErrorMessage(error: any): string {
    const status = error?.status ?? error?.statusCode;
    switch (status) {
      case 0:   return 'No se pudo conectar con el servidor. Verifica tu conexión.';
      case 401: return 'Sesión expirada o no autorizada. Por favor inicia sesión nuevamente.';
      case 403: return 'No tienes permisos para realizar esta acción.';
      case 404: return 'El recurso solicitado no fue encontrado.';
      case 413: return 'El archivo es demasiado grande para el servidor.';
      case 422: return 'El archivo no pudo procesarse. Verifica el formato.';
      case 500: return 'Error interno del servidor. Intenta más tarde.';
      case 503: return 'Servicio no disponible. Intenta más tarde.';
      default:  return error?.error?.detail || error?.error?.message || 'Ocurrió un error inesperado.';
    }
  }

  ngOnInit() {
    this.loadSpectraFromBackend();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── CARGA DE LISTA ────────────────────────────────────────────────────────

  private loadSpectraFromBackend() {
    this.loading = true;
    this.errorMessage = '';

    this.spectraBackendService.getSpectra(this.skip, this.limit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.spectra = response.data;
          this.total = response.total;
          this.page = response.page;
          this.total_pages = response.total_pages;
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error);
          this.loading = false;
        }
      });
  }

  // ─── SELECCIÓN DE ARCHIVOS ─────────────────────────────────────────────────

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.addFilesToQueue(Array.from(files));
      // Limpiar input para permitir re-selección del mismo archivo
      input.value = '';
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragover = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragover = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragover = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.addFilesToQueue(Array.from(files));
    }
  }

  // ─── GESTIÓN DE LA COLA ────────────────────────────────────────────────────

  /**
   * Añade archivos a la cola validando cada uno
   */
  addFilesToQueue(files: File[]) {
    const validExtensions = ['.csv', '.txt', '.dpt', '.json', '.xlsx'];

    for (const file of files) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const alreadyInQueue = this.uploadQueue.some(item => item.file.name === file.name && item.status !== 'error');

      if (!validExtensions.includes(ext)) {
        this.uploadQueue.push({
          file,
          status: 'error',
          message: `Extensión no válida: ${ext}`
        });
        continue;
      }

      if (file.size > 50 * 1024 * 1024) {
        this.uploadQueue.push({
          file,
          status: 'error',
          message: `Archivo demasiado grande (máx 50MB)`
        });
        continue;
      }

      if (alreadyInQueue) {
        continue; // Ignorar duplicados
      }

      this.uploadQueue.push({
        file,
        status: 'pending',
        message: 'En espera...'
      });
    }

    // Iniciar procesamiento automático
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Procesa la cola secuencialmente
   */
  private async processQueue() {
    this.isProcessingQueue = true;

    for (const item of this.uploadQueue) {
      if (item.status !== 'pending') continue;

      item.status = 'uploading';
      item.message = 'Subiendo...';

      await this.uploadSingleFile(item);
    }

    this.isProcessingQueue = false;

    // Recargar lista al finalizar
    this.loadSpectraFromBackend();

    // Mensaje resumen
    const succeeded = this.uploadQueue.filter(i => i.status === 'success').length;
    const failed = this.uploadQueue.filter(i => i.status === 'error').length;

    if (succeeded > 0 && failed === 0) {
      this.successMessage = `${succeeded} espectro${succeeded > 1 ? 's' : ''} cargado${succeeded > 1 ? 's' : ''} correctamente`;
    } else if (succeeded > 0 && failed > 0) {
      this.successMessage = `${succeeded} cargado${succeeded > 1 ? 's' : ''}, ${failed} con error`;
    }
  }

  /**
   * Sube un archivo individual al backend
   */
  private uploadSingleFile(item: UploadQueueItem): Promise<void> {
    return new Promise((resolve) => {
      this.spectraBackendService.uploadSpectrum(
        item.file,
        this.material || undefined,
        this.technique,
        this.hydrationState,
        this.temperature
      )
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            const spectrum = response.data.spectrum;
            item.status = 'success';
            item.message = `${spectrum.point_count} puntos`;
            item.fileInfo = {
              filename: spectrum.filename,
              points: spectrum.point_count,
              wavenumberMin: spectrum.spectral_range_min?.toFixed(2),
              wavenumberMax: spectrum.spectral_range_max?.toFixed(2),
              material: spectrum.material,
              technique: spectrum.technique
            };
            resolve();
          },
          error: (error) => {
            item.status = 'error';
            item.message = this.getErrorMessage(error);
            resolve();
          }
        });
    });
  }

  /**
   * Reintentar archivos con error
   */
  retryFailed() {
    this.uploadQueue
      .filter(item => item.status === 'error' && this.isValidFile(item.file))
      .forEach(item => {
        item.status = 'pending';
        item.message = 'En espera...';
      });

    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  private isValidFile(file: File): boolean {
    const validExtensions = ['.csv', '.txt', '.dpt', '.json', '.xlsx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return validExtensions.includes(ext) && file.size <= 50 * 1024 * 1024;
  }

  /**
   * Eliminar un archivo de la cola
   */
  removeFromQueue(index: number) {
    this.uploadQueue.splice(index, 1);
  }

  /**
   * Limpiar la cola (solo elementos terminados)
   */
  clearFinishedQueue() {
    this.uploadQueue = this.uploadQueue.filter(item => item.status === 'pending' || item.status === 'uploading');
    this.successMessage = '';
  }

  /**
   * Getters de estado de la cola
   */
  get queuePending(): number {
    return this.uploadQueue.filter(i => i.status === 'pending').length;
  }

  get queueUploading(): number {
    return this.uploadQueue.filter(i => i.status === 'uploading').length;
  }

  get queueSuccess(): number {
    return this.uploadQueue.filter(i => i.status === 'success').length;
  }

  get queueError(): number {
    return this.uploadQueue.filter(i => i.status === 'error').length;
  }

  get queueHasFinished(): boolean {
    return this.uploadQueue.some(i => i.status === 'success' || i.status === 'error');
  }

  // ─── ELIMINAR ESPECTRO ─────────────────────────────────────────────────────

  deleteSpectrum(id: number, filename: string) {
    if (confirm(`¿Eliminar espectro "${filename}"?`)) {
      this.spectraBackendService.deleteSpectrum(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.successMessage = `Espectro eliminado`;
            this.loadSpectraFromBackend();
          },
          error: (error) => {
            this.errorMessage = this.getErrorMessage(error);
          }
        });
    }
  }

  // ─── UTILIDADES ────────────────────────────────────────────────────────────

  get filteredSpectra(): SpectrumData[] {
    return this.spectra.filter(s => {
      const materialMatch = !this.filterMaterial ||
        (s.material || '').toLowerCase().includes(this.filterMaterial.toLowerCase());
      const techniqueMatch = !this.filterTechnique ||
        (s.technique || '').toLowerCase().includes(this.filterTechnique.toLowerCase());
      return materialMatch && techniqueMatch;
    });
  }

  getFormatIcon(filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const icons: { [key: string]: string } = {
      '.csv': '📊',
      '.txt': '📄',
      '.dpt': '📈',
      '.json': '{}',
      '.xlsx': '📗'
    };
    return icons[ext] || '📁';
  }

  downloadSpectrum(spectrum: SpectrumData, filename: string) {
    if (!spectrum.wavenumbers || !spectrum.absorbance) {
      this.errorMessage = 'No hay datos para descargar';
      return;
    }

    let csv = 'wavenumber,absorbance\n';
    for (let i = 0; i < spectrum.wavenumbers.length; i++) {
      csv += `${spectrum.wavenumbers[i]},${spectrum.absorbance[i]}\n`;
    }

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `${filename.replace(/\.[^.]+$/, '')}_exported.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    this.successMessage = `Espectro descargado`;
  }

  getFormattedDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  changePage(newPage: number) {
    if (newPage < 1 || newPage > this.total_pages) return;
    this.page = newPage;
    this.skip = (newPage - 1) * this.limit;
    this.loadSpectraFromBackend();
  }
}