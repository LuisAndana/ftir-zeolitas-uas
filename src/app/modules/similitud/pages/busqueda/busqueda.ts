import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SimilarityBackendService, SimilarityConfig } from '../../../../core/services/similarity-backend.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-busqueda',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './busqueda.html',
  styleUrls: [
    './busqueda.css'
    // Los estilos globales se cargan automáticamente desde styles.css del proyecto
  ]
})
export class BusquedaComponent implements OnInit {

  // ========================================
  // DATOS DE BÚSQUEDA
  // ========================================

  spectra: any[] = [];
  selectedSpectrumId: string | number = '';
  selectedSpectrum: any = null;
  loadingSpectra: boolean = true;
  errorLoadingSpectra: string = '';

  // ========================================
  // CONFIGURACIÓN DE SIMILITUD
  // ========================================

  config: SimilarityConfig = {
    method: 'cosine',
    tolerance: 4,
    range_min: 400,
    range_max: 4000,
    top_n: 10,
    family_filter: null,
    use_windows: false,
    selected_windows: []
  };

  // ========================================
  // RESULTADOS
  // ========================================

  results: any[] = [];
  searching: boolean = false;
  searchDone: boolean = false;
  totalSearched: number = 0;
  totalFound: number = 0;
  executionTimeMs: number = 0;

  // ========================================
  // VENTANAS ESPECTRALES
  // ========================================

  windowOptions = [
    { id: 'band_950', label: 'Banda 950 cm⁻¹ (940-980)' },
    { id: 'asymmetric_tot', label: 'T-O-T asimétrico (950-1250)' },
    { id: 'symmetric_tot', label: 'T-O-T simétrico (650-850)' },
    { id: 'double_ring', label: 'Anillo doble (500-650)' },
    { id: 'tot_bending', label: 'T-O flexión (400-500)' },
    { id: 'oh_region', label: 'Región OH (3200-3800)' },
    { id: 'water', label: 'Agua (1600-1700)' },
    { id: 'full_fingerprint', label: 'Huella completa (400-1400)' }
  ];

  // ========================================
  // CONSTRUCTOR
  // ========================================

  constructor(
    private similarityBackend: SimilarityBackendService,
    private http: HttpClient
  ) {
    this.loadSpectra();
  }

  // ========================================
  // CICLO DE VIDA
  // ========================================

  ngOnInit() {
    console.log(' Componente Búsqueda iniciado');
  }

  // ========================================
  // CARGA DE ESPECTROS DESDE BASE DE DATOS
  // ========================================

  loadSpectra() {
    this.loadingSpectra = true;
    this.errorLoadingSpectra = '';

    console.log(' Cargando espectros desde base de datos...');

    // Obtener token si existe (para autenticación)
    const token = this.getAuthToken();
    const headers: any = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Llamar al endpoint /api/spectra
    this.http.get('http://localhost:8000/api/spectra', { headers })
      .subscribe({
        next: (response: any) => {
          console.log(' Respuesta de espectros:', response);

          if (response.success && response.data) {
            this.spectra = response.data;
            console.log(` Cargados ${this.spectra.length} espectros desde BD`);
          } else if (Array.isArray(response)) {
            // Si la respuesta es directamente un array
            this.spectra = response;
            console.log(` Cargados ${this.spectra.length} espectros desde BD`);
          } else {
            console.warn('Formato de respuesta no esperado:', response);
            this.spectra = [];
            this.errorLoadingSpectra = 'Formato de respuesta incorrecto';
          }

          this.loadingSpectra = false;
        },
        error: (error: any) => {
          console.error(' Error al cargar espectros:', error);

          // Mostrar error específico
          if (error.status === 403) {
            this.errorLoadingSpectra = 'Error 403: Acceso prohibido. Verifica autenticación.';
          } else if (error.status === 401) {
            this.errorLoadingSpectra = 'Error 401: No autenticado. Inicia sesión primero.';
          } else if (error.status === 404) {
            this.errorLoadingSpectra = 'Error 404: Endpoint no encontrado.';
          } else if (error.status === 500) {
            this.errorLoadingSpectra = 'Error 500: Error del servidor.';
          } else {
            this.errorLoadingSpectra = `Error: ${error.message || 'Error desconocido'}`;
          }

          console.error('Detalles del error:', error);

          // Datos de prueba si falla (para desarrollo)
          this.spectra = [
            { id: 1, filename: 'zeolita_test_1.csv', family: 'Zeolita A' },
            { id: 2, filename: 'zeolita_test_2.csv', family: 'Zeolita X' }
          ];

          this.loadingSpectra = false;
        }
      });
  }

  // ========================================
  // OBTENER TOKEN DE AUTENTICACIÓN
  // ========================================

  private getAuthToken(): string | null {
    // Buscar token en localStorage
    const token = localStorage.getItem('access_token');
    if (token) {
      console.log(' Token de autenticación encontrado');
      return token;
    }

    console.warn(' No se encontró token de autenticación');
    return null;
  }

  // ========================================
  // SELECCIONAR ESPECTRO
  // ========================================

  onSpectrumSelected(event: any) {
    const id = parseInt(this.selectedSpectrumId.toString());
    this.selectedSpectrum = this.spectra.find((s: any) => s.id === id);
    this.results = [];
    this.searchDone = false;
    console.log('Espectro seleccionado:', this.selectedSpectrum);
  }

  // ========================================
  // BÚSQUEDA POR SIMILITUD
  // ========================================

  search() {
    if (!this.selectedSpectrum || !this.selectedSpectrumId) {
      alert('Por favor selecciona un espectro');
      return;
    }

    this.searching = true;
    const spectrumId = this.selectedSpectrumId.toString();

    console.log(' Iniciando búsqueda:', {
      spectrum_id: spectrumId,
      config: this.config
    });

    // Llamar al método CORRECTO: searchSimilarSpectra
    this.similarityBackend.searchSimilarSpectra(spectrumId, this.config).subscribe({
      next: (response: any) => {
        console.log(' Respuesta recibida:', response);

        if (response.success && response.data) {
          this.results = response.data.results || [];
          this.searchDone = true;
          this.totalSearched = response.data.total_spectra_searched || 0;
          this.totalFound = response.data.results_found || 0;
          this.executionTimeMs = response.data.execution_time_ms || 0;

          console.log(
            ` Búsqueda completada: ${this.totalFound}/${this.totalSearched} en ${this.executionTimeMs}ms`
          );
        } else {
          alert('Error en la búsqueda: ' + (response.message || 'Desconocido'));
          console.error('Error en respuesta:', response);
        }

        this.searching = false;
      },
      error: (error: any) => {
        this.searching = false;
        console.error(' Error al buscar:', error);
        const errorMsg = error.message || 'Error desconocido';
        alert(`Error: ${errorMsg}`);
      }
    });
  }

  // ========================================
  // VISUALIZAR RESULTADO
  // ========================================

  viewResult(spectrumId: number) {
    console.log('Ver resultado:', spectrumId);
    alert(`Ver espectro ${spectrumId}`);
  }

  // ========================================
  // TOGGLE VENTANAS ESPECTRALES
  // ========================================

  toggleWindow(windowId: string) {
    // Asegurar que selected_windows está definido
    if (!this.config.selected_windows) {
      this.config.selected_windows = [];
    }

    const index = this.config.selected_windows.indexOf(windowId);
    if (index > -1) {
      this.config.selected_windows.splice(index, 1);
    } else {
      this.config.selected_windows.push(windowId);
    }
    console.log('Ventanas seleccionadas:', this.config.selected_windows);
  }

  isWindowSelected(windowId: string): boolean {
    if (!this.config.selected_windows) {
      return false;
    }
    return this.config.selected_windows.includes(windowId);
  }

  // ========================================
  // RESET BÚSQUEDA
  // ========================================

  resetSearch() {
    this.selectedSpectrumId = '';
    this.selectedSpectrum = null;
    this.results = [];
    this.searchDone = false;
    if (this.config.selected_windows) {
      this.config.selected_windows = [];
    }
    console.log('Búsqueda reseteada');
  }

  // ========================================
  // EXPORTAR RESULTADOS
  // ========================================

  exportResults() {
    if (this.results.length === 0) {
      alert('No hay resultados para exportar');
      return;
    }

    const csv = this.convertToCSV(this.results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `similitud-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private convertToCSV(data: any[]): string {
    const headers = ['ID', 'Archivo', 'Familia', 'Similitud (%)', 'Picos Match'];
    const rows = data.map((r: any) => [
      r.spectrum_id,
      r.filename,
      r.family || 'N/D',
      (r.global_score * 100).toFixed(2),
      `${r.matching_peaks}/${r.total_peaks}`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row: any) => row.join(','))].join(
      '\n'
    );

    return csvContent;
  }
}