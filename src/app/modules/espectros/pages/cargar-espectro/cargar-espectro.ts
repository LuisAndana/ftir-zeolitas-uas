import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EspectroLoaderService } from '../../../../core/services/espectro-loader.service';

@Component({
  selector: 'app-cargar-espectro',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cargar-espectro.html',
  styleUrl: './cargar-espectro.css'
})
export class CargarEspectro implements OnInit {
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  spectra: any[] = [];
  uploading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private espectroLoader: EspectroLoaderService) {}

  ngOnInit() {
    this.loadSpectra();
  }

  loadSpectra() {
    this.spectra = this.espectroLoader.getAllSpectra();
  }

  /**
   * CU-F-001: Cargar archivo
   */
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.errorMessage = '';
    this.successMessage = '';
    this.uploading = true;

    // Validar extensión
    const validExtensions = ['.csv', '.txt', '.xlsx', '.json'];
    const filename = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => filename.endsWith(ext));

    if (!isValid) {
      this.errorMessage = `Formato no soportado. Use: ${validExtensions.join(', ')}`;
      this.uploading = false;
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Archivo muy grande (máximo 5MB)';
      this.uploading = false;
      return;
    }

    // Cargar archivo
    this.espectroLoader.loadSpectrumFile(file)
      .then(spectrum => {
        console.log('✅ Espectro cargado:', spectrum);
        this.successMessage = `Espectro "${file.name}" cargado correctamente`;
        this.loadSpectra();
        input.value = '';
      })
      .catch(error => {
        console.error('❌ Error:', error);
        this.errorMessage = `Error al cargar: ${error}`;
      })
      .finally(() => {
        this.uploading = false;
      });
  }

  /**
   * Drag & Drop: Cuando el usuario arrastra archivos sobre la zona
   */
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as HTMLElement;
    target.closest('.upload-zone')?.classList.add('drag-over');
  }

  /**
   * Drag & Drop: Cuando el usuario saca los archivos de la zona
   */
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as HTMLElement;
    target.closest('.upload-zone')?.classList.remove('drag-over');
  }

  /**
   * Drag & Drop: Cuando el usuario suelta los archivos
   */
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target as HTMLElement;
    target.closest('.upload-zone')?.classList.remove('drag-over');
    
    const files = event.dataTransfer?.files;
    if (files && files[0]) {
      // Crear un evento falso para reutilizar onFileSelected
      const fakeEvent = {
        target: {
          files: files
        }
      } as any;
      this.onFileSelected(fakeEvent);
    }
  }

  deleteSpectrum(id: string) {
    if (confirm('¿Estás seguro de eliminar este espectro?')) {
      this.espectroLoader.deleteSpectrum(id);
      this.loadSpectra();
    }
  }
}