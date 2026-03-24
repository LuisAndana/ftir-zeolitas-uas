import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SimilarityBackendService, SimilarityConfig } from '../../../../core/services/similarity-backend.service';
import { SpectrumStateService } from '../../../../core/services/spectrum-state.service';
import { SPECTRAL_WINDOWS } from '../../../../core/guards/data/zeolite-families';

@Component({
  selector: 'app-busqueda',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './busqueda.html',
  styleUrls: ['./busqueda.css']
})
export class BusquedaComponent implements OnInit, OnDestroy {

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
  errorMessage: string = '';
  successMessage: string = '';
  resultsFromCache: boolean = false;

  windowOptions: any[] = [];
  totalFound: number = 0;
  totalSearched: number = 0;
  totalUserSpectra: number = 0;
  totalDatasetSpectra: number = 0;
  userResults: number = 0;
  datasetResults: number = 0;
  executionTimeMs: number = 0;

  spectralWindows = SPECTRAL_WINDOWS;
  private destroy$ = new Subject<void>();

  constructor(
    private similarityBackend: SimilarityBackendService,
    private spectrumStateService: SpectrumStateService,
    private http: HttpClient,
    private router: Router
  ) {
    this.loadSpectra();
    this.initializeWindowOptions();
  }

  ngOnInit() {
    console.log('🚀 Componente Búsqueda iniciado');
    this.loadSavedState();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // INICIALIZAR VENTANAS ESPECTRALES
  // ========================================

  private initializeWindowOptions(): void {
    this.windowOptions = SPECTRAL_WINDOWS.map(window => ({
      id: window.name,
      label: `${window.name} (${window.min}-${window.max} cm⁻¹)`
    }));
    console.log('✅ Ventanas espectrales inicializadas:', this.windowOptions.length);
  }

  // ========================================
  // CARGAR ESTADO GUARDADO
  // ========================================

  private loadSavedState(): void {
    console.log('🔍 Cargando estado guardado de búsqueda...');
    
    this.spectrumStateService
      .getSpectrumState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        // Restaurar espectro seleccionado
        if (state.querySpectrum) {
          this.selectedSpectrum = state.querySpectrum;
          this.selectedSpectrumId = this.selectedSpectrum.id;
          console.log(`✓ Espectro restaurado: ${this.selectedSpectrum.filename}`);
        }

        // ✅ RESTAURAR RESULTADOS EN CACHÉ
        if (state.searchResults && state.searchResults.length > 0) {
          this.results = state.searchResults;
          this.searchDone = true;
          this.resultsFromCache = true;
          this.totalFound = this.results.length;
          console.log(`✓ ${this.results.length} resultados restaurados desde caché`);
          
          const lastSearch = state.lastSearch;
          if (lastSearch.timestamp) {
            const timestamp = new Date(lastSearch.timestamp);
            const now = new Date();
            const minutesAgo = Math.floor((now.getTime() - timestamp.getTime()) / 60000);
            this.successMessage = `📦 Resultados en caché (hace ${minutesAgo} minuto${minutesAgo !== 1 ? 's' : ''})`;
          }
        }
      });
  }

  // ========================================
  // CARGA DE ESPECTROS DEL USUARIO
  // ========================================

  loadSpectra() {
    this.loadingSpectra = true;
    this.errorLoadingSpectra = '';

    console.log('📊 Cargando espectros del usuario desde base de datos...');

    const token = this.getAuthToken();
    const headers: any = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // ✅ CARGAR ESPECTROS DEL USUARIO (para usar como query)
    this.http.get('http://localhost:8000/api/spectra', { headers })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('✅ Respuesta de espectros:', response);

          if (response.success && response.data && Array.isArray(response.data)) {
            this.spectra = response.data;
            console.log(`✓ Cargados ${this.spectra.length} espectros del usuario desde BD`);
          } else if (Array.isArray(response)) {
            this.spectra = response;
            console.log(`✓ Cargados ${this.spectra.length} espectros del usuario desde BD`);
          } else {
            console.warn('⚠️ Formato de respuesta no esperado:', response);
            this.spectra = [];
            this.errorLoadingSpectra = 'Formato de respuesta incorrecto';
          }

          this.loadingSpectra = false;
        },
        error: (error: any) => {
          console.error('❌ Error al cargar espectros:', error);

          if (error.status === 403) {
            this.errorLoadingSpectra = '🔒 Error 403: Acceso prohibido';
          } else if (error.status === 401) {
            this.errorLoadingSpectra = '🔐 Error 401: No autenticado';
          } else if (error.status === 404) {
            this.errorLoadingSpectra = '🔍 Error 404: Endpoint no encontrado';
          } else if (error.status === 500) {
            this.errorLoadingSpectra = '⚠️ Error 500: Error del servidor';
          } else {
            this.errorLoadingSpectra = `❌ Error: ${error.message || 'Error desconocido'}`;
          }

          console.error('Detalles del error:', error);
          this.loadingSpectra = false;
        }
      });
  }

  // ========================================
  // OBTENER TOKEN DE AUTENTICACIÓN
  // ========================================

  private getAuthToken(): string | null {
    const token = localStorage.getItem('access_token');
    if (token) {
      console.log('🔐 Token de autenticación encontrado');
      return token;
    }

    console.warn('⚠️ No se encontró token de autenticación');
    return null;
  }

  // ========================================
  // SELECCIONAR ESPECTRO
  // ========================================

  onSpectrumSelected(event: any) {
    const id = parseInt(this.selectedSpectrumId.toString());
    this.selectedSpectrum = this.spectra.find((s: any) => s.id === id);
    
    if (this.selectedSpectrum) {
      console.log('✓ Espectro seleccionado:', this.selectedSpectrum);
      // ✅ GUARDAR ESPECTRO EN ESTADO GLOBAL
      this.spectrumStateService.setQuerySpectrum(this.selectedSpectrum);
    }

    // ✅ LIMPIAR RESULTADOS ANTERIORES AL CAMBIAR ESPECTRO
    this.results = [];
    this.searchDone = false;
    this.resultsFromCache = false;
    this.totalFound = 0;
    this.totalSearched = 0;
    this.userResults = 0;
    this.datasetResults = 0;
    this.errorMessage = '';
    this.successMessage = '';
    console.log('✓ Espectro seleccionado:', this.selectedSpectrum);
  }

  // ========================================
  // BÚSQUEDA POR SIMILITUD (USER + DATASET)
  // ========================================

  search() {
    if (!this.selectedSpectrum || !this.selectedSpectrumId) {
      this.errorMessage = 'Por favor selecciona un espectro';
      console.error('❌ ' + this.errorMessage);
      return;
    }

    this.searching = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.resultsFromCache = false;
    const spectrumId = this.selectedSpectrumId.toString();

    console.log('🔍 Iniciando búsqueda de similitud:', {
      spectrum_id: spectrumId,
      config: this.config,
      message: '🔎 Buscando en: Espectros del usuario + Dataset de zeolitas FTIR'
    });

    // ✅ LLAMAR AL BACKEND QUE BUSCA EN AMBOS LUGARES
    this.similarityBackend.searchSimilarSpectra(spectrumId, this.config)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('✅ Respuesta de búsqueda recibida:', response);

          if (response.success && response.data) {
            this.results = response.data.results || [];
            this.totalFound = response.data.results_found || this.results.length;
            
            // ✅ INFORMACIÓN SEPARADA: USUARIO vs DATASET
            this.totalUserSpectra = response.data.total_user_spectra_searched || 0;
            this.totalDatasetSpectra = response.data.total_dataset_spectra_searched || 0;
            this.userResults = response.data.user_results || 0;
            this.datasetResults = response.data.dataset_results || 0;
            this.totalSearched = this.totalUserSpectra + this.totalDatasetSpectra;
            this.executionTimeMs = response.data.execution_time_ms || 0;
            this.searchDone = true;
            
            // ✅ GUARDAR RESULTADOS EN CACHÉ
            this.spectrumStateService.setSearchResults(
              this.results,
              parseInt(spectrumId),
              this.config.method,
              this.config.tolerance
            );

            console.log(`📊 Búsqueda completada:`);
            console.log(`   - Espectros del usuario buscados: ${this.totalUserSpectra}`);
            console.log(`   - Espectros del dataset buscados: ${this.totalDatasetSpectra}`);
            console.log(`   - Resultados del usuario: ${this.userResults}`);
            console.log(`   - Resultados del dataset: ${this.datasetResults}`);
            console.log(`   - Tiempo total: ${this.executionTimeMs}ms`);

            this.successMessage = `✅ Búsqueda completada: ${this.totalFound} espectros encontrados (${this.userResults} usuario + ${this.datasetResults} dataset) en ${this.executionTimeMs}ms`;
            
          } else {
            this.errorMessage = '❌ Error: respuesta inválida del servidor';
            console.error('Respuesta inválida:', response);
          }

          this.searching = false;
        },
        error: (error: any) => {
          console.error('❌ Error en búsqueda:', error);
          this.errorMessage = error.error?.detail || '❌ Error al conectar con el servidor de búsqueda';
          this.searching = false;
        }
      });
  }

  // ========================================
  // NAVEGAR A COMPARACIÓN ✅
  // ========================================

  viewResult(spectrumId: number) {
    console.log('👁️ Ver resultado:', spectrumId);
    
    const querySpectrum = this.selectedSpectrum;
    const refSpectrum = this.spectra.find((s: any) => s.id === spectrumId);

    if (refSpectrum && querySpectrum) {
      // ✅ GUARDAR ESPECTROS EN ESTADO GLOBAL ANTES DE NAVEGAR
      this.spectrumStateService.setQuerySpectrum(querySpectrum);
      this.spectrumStateService.setRefSpectrum(refSpectrum);
      
      console.log('✓ Espectros guardados, navegando a spectrum-comparison...');
      console.log(`  📊 Query: ${querySpectrum.filename} (ID: ${querySpectrum.id})`);
      console.log(`  📊 Reference: ${refSpectrum.filename} (ID: ${refSpectrum.id})`);
      
      // ✅ NAVEGAR A SPECTRUM-COMPARISON CON LOS PARÁMETROS CORRECTOS
      const referenceId = querySpectrum.id;
      const comparisonId = spectrumId;
      const method = this.config.method;
      
      this.router.navigate([
        '/dashboard/comparacion-espectros',
        referenceId,
        comparisonId,
        method
      ]);
    } else {
      console.error('❌ No se encontraron los espectros');
      this.errorMessage = '❌ No se pudo cargar el espectro seleccionado';
    }
  }

  // ========================================
  // TOGGLE VENTANAS ESPECTRALES
  // ========================================

  toggleWindow(windowId: string) {
    if (!this.config.selected_windows) {
      this.config.selected_windows = [];
    }

    const index = this.config.selected_windows.indexOf(windowId);
    if (index > -1) {
      this.config.selected_windows.splice(index, 1);
      console.log(`✓ Ventana removida: ${windowId}`);
    } else {
      this.config.selected_windows.push(windowId);
      console.log(`✓ Ventana agregada: ${windowId}`);
    }
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
    this.resultsFromCache = false;
    this.totalFound = 0;
    this.totalSearched = 0;
    this.totalUserSpectra = 0;
    this.totalDatasetSpectra = 0;
    this.userResults = 0;
    this.datasetResults = 0;
    this.executionTimeMs = 0;
    this.errorMessage = '';
    this.successMessage = '';
    
    if (this.config.selected_windows) {
      this.config.selected_windows = [];
    }

    // ✅ LIMPIAR ESPECTRO Y RESULTADOS
    this.spectrumStateService.clearQuerySpectrum();
    console.log('🔄 Búsqueda reseteada');
  }

  // ========================================
  // EXPORTAR RESULTADOS
  // ========================================

  exportResults() {
    if (this.results.length === 0) {
      this.errorMessage = 'No hay resultados para exportar';
      return;
    }

    const csv = this.generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `busqueda_similitud_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    console.log('📥 Resultados exportados');
    this.successMessage = '✅ Resultados exportados correctamente';
  }

  private generateCSV(): string {
    const headers = ['Ranking', 'Archivo', 'Familia', 'Similitud (%)', 'Picos Match', 'Fuente'];
    const rows = this.results.map((r, i) => [
      (i + 1).toString(),
      r.filename,
      r.family || '—',
      (r.global_score * 100).toFixed(2),
      `${r.matching_peaks}/${r.total_peaks}`,
      r.source === 'user_database' ? 'Usuario' : 'Dataset'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // ========================================
  // UTILIDADES UI
  // ========================================

  getScoreClass(score: number): string {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  getScorePercent(score: number): string {
    return (score * 100).toFixed(1);
  }

  getSourceBadge(source: string): string {
    return source === 'user_database' ? '👤 Usuario' : '📚 Dataset';
  }

  // ✅ LIMPIAR TODOS LOS DATOS GUARDADOS
  clearAllData() {
    console.log('🗑️ Limpiando todos los datos guardados...');
    this.spectrumStateService.clearAllSpectra();
    this.resetSearch();
  }
}