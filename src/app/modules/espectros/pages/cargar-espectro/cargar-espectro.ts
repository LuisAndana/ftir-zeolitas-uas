import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EspectroLoaderService, Spectrum } from '../../../../core/services/espectro-loader.service';

@Component({
  selector: 'app-cargar-espectro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cargar-espectro.html',
  styleUrl: './cargar-espectro.css'
})
export class CargarEspectro implements OnInit {

  // Estado
  spectra: Spectrum[] = [];
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
  material = 'Desconocido';
  technique = 'ATR';
  hydrationState = 'As-synthesized';
  temperature = '25°C';
  description = '';

  // Filtros
  filterMaterial = '';
  filterTechnique = '';

  constructor(private espectroLoader: EspectroLoaderService) {}

  ngOnInit() {
    this.loadSpectra();
  }

  /**
   * Cargar lista de espectros
   */
  private loadSpectra() {
    this.spectra = this.espectroLoader.getAllSpectra();
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
   * Subir archivo
   */
  async uploadFile(file: File) {
    this.uploadedFile = file;
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.fileInfo = null;

    try {
      // Validar archivo
      this.validateFile(file);

      // Cargar espectro
      const spectrum = await this.espectroLoader.loadSpectrumFile(file);

      // Actualizar metadata
      spectrum.metadata = {
        material: this.material,
        technique: this.technique,
        hydrationState: this.hydrationState,
        temperature: this.temperature
      };

      // Mostrar información
      this.fileInfo = {
        filename: spectrum.filename,
        points: spectrum.wavenumbers.length,
        wavenumberMin: spectrum.wavenumbers[spectrum.wavenumbers.length - 1]?.toFixed(2),
        wavenumberMax: spectrum.wavenumbers[0]?.toFixed(2),
        absorbanceMin: Math.min(...spectrum.data).toFixed(5),
        absorbanceMax: Math.max(...spectrum.data).toFixed(5),
        material: spectrum.metadata.material,
        technique: spectrum.metadata.technique
      };

      this.successMessage = `✅ Espectro "${file.name}" cargado exitosamente (${spectrum.wavenumbers.length} puntos)`;
      this.loadSpectra();
      this.resetForm();

    } catch (error) {
      this.errorMessage = `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
      console.error('Error:', error);
    } finally {
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
   * Eliminar espectro
   */
  deleteSpectrum(id: string, filename: string) {
    if (confirm(`¿Eliminar espectro "${filename}"?`)) {
      this.espectroLoader.deleteSpectrum(id);
      this.loadSpectra();
      this.successMessage = `✅ Espectro eliminado`;
    }
  }

  /**
   * Resetear formulario
   */
  private resetForm() {
    this.uploadedFile = null;
    this.material = 'Desconocido';
    this.technique = 'ATR';
    this.hydrationState = 'As-synthesized';
    this.temperature = '25°C';
    this.description = '';
  }

  /**
   * Obtener espectros filtrados
   */
  get filteredSpectra(): Spectrum[] {
    return this.spectra.filter(s => {
      const materialMatch = !this.filterMaterial || 
        s.metadata.material.toLowerCase().includes(this.filterMaterial.toLowerCase());
      const techniqueMatch = !this.filterTechnique || 
        s.metadata.technique.toLowerCase().includes(this.filterTechnique.toLowerCase());
      return materialMatch && techniqueMatch;
    });
  }

  /**
   * Información de formatos soportados
   */
  get formatInfo() {
    return this.espectroLoader.getSupportedFormatsInfo();
  }

  /**
   * Obtener icono de formato
   */
  getFormatIcon(filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const icons: { [key: string]: string } = {
      '.csv': '📊',
      '.txt': '📄',
      '.dpt': '🔬',
      '.json': '{}',
      '.xlsx': '📈'
    };
    return icons[ext] || '📁';
  }

  /**
   * Descargar espectro
   */
  downloadSpectrum(id: string, filename: string) {
    const spectrum = this.espectroLoader.getSpectrumById(id);
    if (!spectrum) return;

    // Crear CSV
    let csv = 'wavenumber,absorbance\n';
    for (let i = 0; i < spectrum.wavenumbers.length; i++) {
      csv += `${spectrum.wavenumbers[i]},${spectrum.data[i]}\n`;
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
}