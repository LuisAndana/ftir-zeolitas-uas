import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Importar el servicio de backend
import { SpectraBackendService, SpectrumData } from '../../../../core/services/spectra-backend.service';

@Component({
  selector: 'app-cargar-espectro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cargar-espectro.html',
  styleUrl: './cargar-espectro.css'
})
export class CargarEspectro implements OnInit, OnDestroy {

  // Estado
  spectra: SpectrumData[] = [];
  loading = false;
  successMessage = '';
  errorMessage = '';
  
  // Upload
  dragover = false;
  uploadedFile: File | null = null;
  uploadProgress = 0;

  // Información del archivo
  fileInfo: any = null;

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

  ngOnInit() {
    console.log('✅ CargarEspectro inicializado');
    // ✅ Cargar espectros del backend
    this.loadSpectraFromBackend();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar lista de espectros del backend
   */
  private loadSpectraFromBackend() {
    console.log(' Cargando espectros del backend...');
    this.loading = true;
    this.errorMessage = '';

    this.spectraBackendService.getSpectra(this.skip, this.limit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log(' Espectros cargados del backend:', response.data);
          this.spectra = response.data;
          this.total = response.total;
          this.page = response.page;
          this.total_pages = response.total_pages;
          this.loading = false;
        },
        error: (error) => {
          console.error(' Error cargando espectros:', error);
          this.errorMessage = ` Error: ${error.message || 'No se pudo cargar los espectros'}`;
          this.loading = false;
        }
      });
  }

  /**
   * Manejar selección de archivo
   */
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      this.uploadFile(file);
    }
  }

  /**
   * Manejar arrastrar archivo
   */
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragover = true;
  }

  /**
   * Salir de la zona de arrastre
   */
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragover = false;
  }

  /**
   * Soltar archivo
   */
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragover = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadFile(files[0]);
    }
  }

  /**
   * Subir archivo AL BACKEND
   */
  async uploadFile(file: File | null) {
    if (!file) {
      this.errorMessage = ' No hay archivo seleccionado';
      return;
    }

    this.uploadedFile = file;
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.fileInfo = null;

    try {
      // Validar archivo
      this.validateFile(file);

      console.log(' Cargando archivo al backend:', file.name);

      // ✅ Llamar al backend para cargar el espectro
      this.spectraBackendService.uploadSpectrum(
        file,
        this.material || undefined,
        this.technique,
        this.hydrationState,
        this.temperature
      )
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log(' Espectro cargado al backend:', response.data.spectrum);
            
            const spectrum = response.data.spectrum;
            
            // Mostrar información
            this.fileInfo = {
              filename: spectrum.filename,
              points: spectrum.point_count,
              wavenumberMin: spectrum.spectral_range_min?.toFixed(2),
              wavenumberMax: spectrum.spectral_range_max?.toFixed(2),
              absorbanceMin: spectrum.min_absorbance?.toFixed(5),
              absorbanceMax: spectrum.max_absorbance?.toFixed(5),
              material: spectrum.material,
              technique: spectrum.technique
            };

            this.successMessage = ` Espectro "${file.name}" cargado exitosamente (${spectrum.point_count} puntos)`;
            
            // Recargar lista desde backend
            this.loadSpectraFromBackend();
            this.resetForm();
          },
          error: (error) => {
            console.error('❌ Error cargando espectro:', error);
            this.errorMessage = `❌ Error: ${error.message || 'No se pudo cargar el espectro'}`;
            this.loading = false;
          }
        });

    } catch (error) {
      this.errorMessage = `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
      console.error('Error:', error);
      this.loading = false;
    }
  }

  /**
   * Validar archivo
   */
  private validateFile(file: File) {
    const validExtensions = ['.csv', '.txt', '.dpt', '.json', '.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      throw new Error(`Extensión no válida: ${fileExtension}. Usa: ${validExtensions.join(', ')}`);
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error(`Archivo muy grande (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo 50MB.`);
    }
  }

  /**
   * Eliminar espectro DEL BACKEND
   */
  deleteSpectrum(id: number, filename: string) {
    if (confirm(`¿Eliminar espectro "${filename}"?`)) {
      console.log('  Eliminando espectro:', id);
      
      this.spectraBackendService.deleteSpectrum(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            console.log('✅ Espectro eliminado del backend');
            this.successMessage = `✅ Espectro eliminado`;
            this.loadSpectraFromBackend();
          },
          error: (error) => {
            console.error(' Error eliminando espectro:', error);
            this.errorMessage = ` Error: ${error.message}`;
          }
        });
    }
  }

  /**
   * Resetear formulario
   */
  private resetForm() {
    this.uploadedFile = null;
    this.material = '';
    this.technique = 'ATR';
    this.hydrationState = 'As-synthesized';
    this.temperature = '25°C';
    this.description = '';
  }

  /**
   * Obtener espectros filtrados
   */
  get filteredSpectra(): SpectrumData[] {
    return this.spectra.filter(s => {
      const materialMatch = !this.filterMaterial || 
        (s.material || '').toLowerCase().includes(this.filterMaterial.toLowerCase());
      const techniqueMatch = !this.filterTechnique || 
        (s.technique || '').toLowerCase().includes(this.filterTechnique.toLowerCase());
      return materialMatch && techniqueMatch;
    });
  }

  /**
   * Obtener icono de formato
   */
  getFormatIcon(filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const icons: { [key: string]: string } = {
      '.csv': '',
      '.txt': '',
      '.dpt': '',
      '.json': '{}',
      '.xlsx': ''
    };
    return icons[ext] || '📁';
  }

  /**
   * Descargar espectro
   */
  downloadSpectrum(spectrum: SpectrumData, filename: string) {
    if (!spectrum.wavenumbers || !spectrum.absorbance) {
      this.errorMessage = '❌ No hay datos para descargar';
      return;
    }

    // Crear CSV
    let csv = 'wavenumber,absorbance\n';
    for (let i = 0; i < spectrum.wavenumbers.length; i++) {
      csv += `${spectrum.wavenumbers[i]},${spectrum.absorbance[i]}\n`;
    }

    // Descargar
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `${filename.replace(/\.[^.]+$/, '')}_exported.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    this.successMessage = `✅ Espectro descargado`;
  }

  /**
   * Obtener timestamp legible
   */
  getFormattedDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Cambiar página
   */
  changePage(newPage: number) {
    if (newPage < 1 || newPage > this.total_pages) {
      return;
    }
    this.page = newPage;
    this.skip = (newPage - 1) * this.limit;
    this.loadSpectraFromBackend();
  }
}