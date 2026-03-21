import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EspectroLoaderService } from '../../../../core/services/espectro-loader.service';
import { SimilarityBackendService, ComparisonResponse } from '../../../../core/services/similarity-backend.service';
import { SimilarityService, SimilarityConfig } from '../../../../core/services/similarity.service';
import { SpectrumStateService, Comparison } from '../../../../core/services/spectrum-state.service';
import { SPECTRAL_WINDOWS } from '../../../../core/guards/data/zeolite-families';

@Component({
  selector: 'app-comparacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comparacion.html',
  styleUrl: './comparacion.css'
})
export class Comparacion implements OnInit, OnDestroy {

  // ===== DATOS DE CARGA =====
  spectra: any[] = [];
  queryId: string = '';
  refId: string = '';
  querySpectrum: any = null;
  refSpectrum: any = null;
  compared = false;

  // ===== CONFIGURACIÓN =====
  method: string = 'pearson';
  tolerance: number = 4;

  // ===== RESULTADOS =====
  globalScore: number = 0;
  allScores: { euclidean: number; cosine: number; pearson: number } | null = null;
  windowScores: { window: string; score: number; range: string }[] = [];
  matchedPeaks: number[] = [];
  unmatchedPeaks: number[] = [];
  totalPeaks: number = 0;
  matchingPeaksCount: number = 0;

  // ===== ESTADO UI =====
  isLoadingSpectra: boolean = false;
  isComparingWithBackend: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  // ✅ NUEVO: Historial de comparaciones
  comparisonHistory: Comparison[] = [];
  showHistory: boolean = false;
  
  // ✅ NUEVO: Flag para evitar múltiples cargas
  isInitialized: boolean = false;

  spectralWindows = SPECTRAL_WINDOWS;
  private destroy$ = new Subject<void>();

  constructor(
    private espectroLoader: EspectroLoaderService,
    private similarityBackendService: SimilarityBackendService,
    private similarityService: SimilarityService,
    private spectrumStateService: SpectrumStateService
  ) {
    console.log('🚀 Constructor Comparacion ejecutado');
  }

  ngOnInit() {
    // ✅ SOLO EJECUTAR UNA VEZ
    if (this.isInitialized) {
      console.log('⚠️ Componente ya inicializado, saltando ngOnInit');
      return;
    }

    console.log('='.repeat(70));
    console.log(' INICIALIZANDO COMPONENTE DE COMPARACIÓN (PRIMERA VEZ)');
    console.log('='.repeat(70));

    this.isInitialized = true;
    this.loadSpectraFromBackend();
    this.loadSavedState();
    this.loadComparisonHistory();
  }

  /**
   * ✅ CARGAR HISTORIAL DE COMPARACIONES
   */
  private loadComparisonHistory(): void {
    console.log(' Cargando historial de comparaciones...');
    this.spectrumStateService
      .getSpectrumState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.comparisonHistory = state.comparisonHistory || [];
        console.log(` ${this.comparisonHistory.length} comparaciones en historial`);
      });
  }

  /**
   * ✅ CARGAR COMPARACIÓN DESDE HISTORIAL
   */
  loadFromHistory(comparison: Comparison): void {
    console.log(' Cargando comparación desde historial:', comparison.id);
    
    this.queryId = comparison.queryId.toString();
    this.refId = comparison.refId.toString();
    this.method = comparison.method;
    this.tolerance = comparison.tolerance;

    const query = this.spectra.find(s => s.id === comparison.queryId);
    const ref = this.spectra.find(s => s.id === comparison.refId);

    if (query && ref) {
      this.querySpectrum = query;
      this.refSpectrum = ref;
      this.globalScore = comparison.globalScore;
      this.compared = true;
      this.successMessage = ` Comparación restaurada: ${(comparison.globalScore * 100).toFixed(1)}%`;
      console.log('✅ Comparación cargada desde historial');
    } else {
      this.errorMessage = 'No se pudieron encontrar los espectros';
      console.error('Espectros no encontrados');
    }
  }

  /**
   * ✅ CARGAR ESTADO GUARDADO DE ESPECTROS (sin resetear)
   */
  private loadSavedState(): void {
    console.log(' Cargando estado guardado de espectros...');
    
    this.spectrumStateService
      .getSpectrumState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        // ✅ Solo cargar si hay datos guardados Y el componente está vacío
        if (state.querySpectrum && !this.querySpectrum) {
          this.querySpectrum = state.querySpectrum;
          this.queryId = this.querySpectrum.id.toString();
          console.log(` Query restaurado: ${this.querySpectrum.filename}`);
        }

        if (state.refSpectrum && !this.refSpectrum) {
          this.refSpectrum = state.refSpectrum;
          this.refId = this.refSpectrum.id.toString();
          console.log(` Reference restaurado: ${this.refSpectrum.filename}`);
        }

        // ✅ Restaurar resultados de comparación
        if (state.comparisonResults && !this.compared) {
          const data = state.comparisonResults;
          this.globalScore = data.global_score || 0;
          this.allScores = data.all_scores || null;
          this.matchedPeaks = data.matched_peaks || [];
          this.unmatchedPeaks = data.unmatched_peaks || [];
          this.totalPeaks = data.total_peaks || 0;
          this.matchingPeaksCount = data.matching_peaks_count || 0;
          
          if (data.window_scores && data.window_scores.length > 0) {
            this.windowScores = data.window_scores.map((w: any) => ({
              window: w.window,
              score: w.score,
              range: '0-4000'
            }));
          }
          
          this.compared = true;
          this.successMessage = ` Comparación restaurada: ${(this.globalScore * 100).toFixed(1)}%`;
          console.log(` Resultados de comparación restaurados`);
        }

        // ✅ Cargar historial
        this.comparisonHistory = state.comparisonHistory || [];
      });
  }

  /**
   * ✅ CARGAR ESPECTROS DESDE BACKEND (sin limpiar datos)
   */
  private loadSpectraFromBackend() {
    this.isLoadingSpectra = true;
    console.log(' Conectando con el backend para cargar espectros...');

    this.espectroLoader.espectros$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (espectros) => {
          console.log(` Respuesta del backend recibida: ${espectros.length} espectros`);
          
          this.spectra = espectros;
          this.isLoadingSpectra = false;

          if (espectros.length === 0) {
            console.warn(' El backend no retornó espectros');
            this.errorMessage = 'No hay espectros disponibles. Carga algunos en "Cargar Espectro"';
          } else {
            console.log(` ${espectros.length} espectros cargados correctamente`);
            // ✅ NO LIMPIAR EL MENSAJE DE ÉXITO SI YA HAY COMPARACIÓN
            if (!this.compared) {
              this.errorMessage = '';
            }
          }
        },
        error: (error) => {
          console.error(' Error conectando con backend:', error);
          this.isLoadingSpectra = false;
          // ✅ NO MOSTRAR ERROR SI YA HAY DATOS GUARDADOS
          if (!this.compared) {
            this.errorMessage = ' Error al conectar con el servidor. Verifica que esté ejecutándose en localhost:8000';
          }
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * ✅ ACTUALIZAR SELECCIÓN
   */
  updateSelection() {
    console.log('\n' + '='.repeat(70));
    console.log(' BUSCANDO ESPECTROS');
    console.log('='.repeat(70));

    this.errorMessage = '';
    this.successMessage = '';

    const queryIdNum = this.parseId(this.queryId);
    const refIdNum = this.parseId(this.refId);

    console.log(`\n Buscando en ${this.spectra.length} espectros:`);
    console.log(`   Query ID: ${queryIdNum}`);
    console.log(`   Ref ID: ${refIdNum}`);

    this.querySpectrum = this.spectra.find(s => this.parseId(s.id) === queryIdNum) || null;
    this.refSpectrum = this.spectra.find(s => this.parseId(s.id) === refIdNum) || null;

    if (this.querySpectrum) {
      console.log(` Query encontrado: ${this.querySpectrum.filename}`);
      this.validateSpectrum(this.querySpectrum, 'Query');
      this.spectrumStateService.setQuerySpectrum(this.querySpectrum);
    } else {
      if (queryIdNum > 0) {
        console.warn(` Query NO encontrado para ID ${queryIdNum}`);
        this.errorMessage = `Espectro de consulta (ID ${queryIdNum}) no encontrado`;
      }
    }

    if (this.refSpectrum) {
      console.log(` Reference encontrado: ${this.refSpectrum.filename}`);
      this.validateSpectrum(this.refSpectrum, 'Reference');
      this.spectrumStateService.setRefSpectrum(this.refSpectrum);
    } else {
      if (refIdNum > 0) {
        console.warn(` Reference NO encontrado para ID ${refIdNum}`);
        this.errorMessage = `Espectro de referencia (ID ${refIdNum}) no encontrado`;
      }
    }

    this.compared = false;
    console.log('='.repeat(70));
  }

  /**
   * ✅ VALIDAR ESTRUCTURA DEL ESPECTRO
   */
  private validateSpectrum(spectrum: any, type: string): boolean {
    console.log(`\n Validando ${type}:`);

    if (!spectrum) {
      console.error(` ${type} es null`);
      return false;
    }

    if (Array.isArray(spectrum.wavenumbers)) {
      console.log(`    Wavenumbers: ${spectrum.wavenumbers.length} puntos`);
    } else {
      console.warn(` ${type}: wavenumbers no es array`);
    }

    if (Array.isArray(spectrum.data)) {
      console.log(`    Data: ${spectrum.data.length} puntos`);
    } else {
      console.warn(` ${type}: data no es array`);
    }

    if (spectrum.wavenumbers?.length !== spectrum.data?.length) {
      console.error(
        ` ${type}: Longitudes diferentes (${spectrum.wavenumbers?.length} vs ${spectrum.data?.length})`
      );
      return false;
    }

    return true;
  }

  /**
   * ✅ PARSEAR ID SEGURO
   */
  private parseId(id: any): number {
    if (typeof id === 'number') return id;
    if (typeof id === 'string') {
      const parsed = parseInt(id, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * ✅ CAMBIO QUERY
   */
  onQueryChange() {
    console.log(`\n Query cambió a: ${this.queryId}`);
    const queryIdNum = this.parseId(this.queryId);
    this.querySpectrum = this.spectra.find(s => this.parseId(s.id) === queryIdNum) || null;
    if (this.querySpectrum) {
      this.spectrumStateService.setQuerySpectrum(this.querySpectrum);
    }
    this.compared = false;
    this.errorMessage = '';
  }

  /**
   * ✅ CAMBIO REFERENCE
   */
  onRefChange() {
    console.log(`\n Reference cambió a: ${this.refId}`);
    const refIdNum = this.parseId(this.refId);
    this.refSpectrum = this.spectra.find(s => this.parseId(s.id) === refIdNum) || null;
    if (this.refSpectrum) {
      this.spectrumStateService.setRefSpectrum(this.refSpectrum);
    }
    this.compared = false;
    this.errorMessage = '';
  }

  /**
   * ✅ COMPARAR - AUTOMÁTICAMENTE VÍA BACKEND
   */
  compare() {
    console.log('\n' + '='.repeat(70));
    console.log(' INICIANDO COMPARACIÓN');
    console.log('='.repeat(70));

    if (!this.querySpectrum || !this.refSpectrum) {
      this.errorMessage = 'Debes seleccionar ambos espectros';
      console.error(' ' + this.errorMessage);
      return;
    }

    console.log('📡 Enviando solicitud al backend...');
    this.compareWithBackend();
  }

  /**
   * ✅ COMPARAR CON BACKEND
   */
  private compareWithBackend() {
    this.isComparingWithBackend = true;
    this.errorMessage = '';
    this.successMessage = '';

    const queryIdNum = this.parseId(this.queryId);
    const refIdNum = this.parseId(this.refId);

    console.log(` IDs: Query=${queryIdNum}, Reference=${refIdNum}`);
    console.log(` Método: ${this.method}, Tolerancia: ${this.tolerance}`);

    this.similarityBackendService.compareSpectra(
      queryIdNum,
      refIdNum,
      this.method,
      this.tolerance
    ).subscribe({
      next: (response: ComparisonResponse) => {
        console.log(' Respuesta recibida del backend');
        this.handleBackendResponse(response);
        this.isComparingWithBackend = false;
      },
      error: (error: any) => {
        console.error(' Error del backend:', error);
        this.handleBackendError(error);
        this.isComparingWithBackend = false;
      }
    });
  }

  /**
   * ✅ PROCESAR RESPUESTA DEL BACKEND
   */
  private handleBackendResponse(response: ComparisonResponse) {
    if (!response.success || !response.data) {
      this.errorMessage = response.message || 'Error en respuesta del backend';
      console.error(' ' + this.errorMessage);
      return;
    }

    const data = response.data;

    this.globalScore = data.global_score || 0;

    if (data.all_scores) {
      this.allScores = data.all_scores;
      console.log(' Scores calculados:');
      console.log(`   Pearson: ${(data.all_scores.pearson * 100).toFixed(2)}%`);
      console.log(`   Coseno: ${(data.all_scores.cosine * 100).toFixed(2)}%`);
      console.log(`   Euclidiana: ${(data.all_scores.euclidean * 100).toFixed(2)}%`);
    }

    this.matchedPeaks = data.matched_peaks || [];
    this.unmatchedPeaks = data.unmatched_peaks || [];
    this.totalPeaks = data.total_peaks || 0;
    this.matchingPeaksCount = data.matching_peaks_count || 0;

    console.log(` Picos: ${this.matchingPeaksCount}/${this.totalPeaks} coincidentes`);

    if (data.window_scores && data.window_scores.length > 0) {
      this.windowScores = data.window_scores.map(w => ({
        window: w.window,
        score: w.score,
        range: '0-4000'
      }));
    }

    this.compared = true;
    this.successMessage = ` Similitud: ${(this.globalScore * 100).toFixed(1)}%`;

    // ✅ GUARDAR RESULTADOS EN ESTADO GLOBAL
    this.spectrumStateService.setComparisonResults(data);

    // ✅ AGREGAR AL HISTORIAL
    this.spectrumStateService.addComparisonToHistory(
      this.parseId(this.queryId),
      this.querySpectrum.filename,
      this.parseId(this.refId),
      this.refSpectrum.filename,
      this.method,
      this.tolerance,
      this.globalScore
    );

    // ✅ RECARGAR HISTORIAL
    this.comparisonHistory = this.spectrumStateService.getComparisonHistory();

    console.log('\n' + '='.repeat(70));
    console.log(' COMPARACIÓN COMPLETADA Y GUARDADA');
    console.log('='.repeat(70) + '\n');
  }

  /**
   * ✅ MANEJAR ERROR DEL BACKEND
   */
  private handleBackendError(error: any) {
    console.error('\n ERROR EN BACKEND');

    if (error.message) {
      this.errorMessage = error.message;
    } else if (error.statusCode === 0) {
      this.errorMessage = '📡 No se pudo conectar. ¿Backend ejecutándose en localhost:8000?';
    } else if (error.statusCode === 404) {
      this.errorMessage = '🔍 Espectro no encontrado en el servidor';
    } else if (error.statusCode === 401) {
      this.errorMessage = ' No autenticado. Inicia sesión de nuevo';
    } else {
      this.errorMessage = 'Error en el servidor. Intenta más tarde.';
    }

    console.error(' ' + this.errorMessage);
  }

  /**
   * ✅ UTILIDADES UI
   */
  getScoreClass(score: number): string {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  getScorePercent(score: number): string {
    return (score * 100).toFixed(1);
  }

  swapSpectra() {
    console.log(' Intercambiando espectros...');
    const temp = this.queryId;
    this.queryId = this.refId;
    this.refId = temp;
    this.onQueryChange();
    this.onRefChange();
    this.compared = false;
  }

  clearComparison() {
    console.log(' Limpiando resultados de esta comparación...');
    this.compared = false;
    this.globalScore = 0;
    this.allScores = null;
    this.windowScores = [];
    this.matchedPeaks = [];
    this.unmatchedPeaks = [];
    this.totalPeaks = 0;
    this.matchingPeaksCount = 0;
    this.errorMessage = '';
    this.successMessage = '';
    this.spectrumStateService.clearComparisonResults();
  }

  /**
   * ✅ LIMPIAR TODOS LOS ESPECTROS Y HISTORIAL
   */
  clearAllData() {
    console.log(' Limpiando todos los espectros guardados...');
    this.spectrumStateService.clearAllSpectra();
    this.querySpectrum = null;
    this.refSpectrum = null;
    this.queryId = '';
    this.refId = '';
    this.comparisonHistory = [];
    this.clearComparison();
  }

  /**
   * ✅ LIMPIAR SOLO HISTORIAL
   */
  clearHistory() {
    console.log(' Limpiando historial de comparaciones...');
    this.spectrumStateService.clearComparisonHistory();
    this.comparisonHistory = [];
    this.successMessage = 'Historial limpiado';
  }

  /**
   * ✅ FORMATEAR TIMESTAMP
   */
  formatTime(date: Date): string {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}