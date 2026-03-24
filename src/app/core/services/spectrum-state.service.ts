import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// ========================================
// INTERFACES
// ========================================

export interface Comparison {
  id: string;
  queryId: number;
  queryFilename: string;
  refId: number;
  refFilename: string;
  method: string;
  tolerance: number;
  globalScore: number;
  timestamp: Date;
}

export interface GraphState {
  selectedSpectraIds: number[];
  selectedMaterial: string | null;
  selectedTechnique: string | null;
  invertirX: boolean;
  mostrarCuadricula: boolean;
  mostrarLeyenda: boolean;
  grosorLinea: number;
  suavizado: number;
}

export interface SpectrumState {
  // Espectros
  querySpectrum: any | null;
  refSpectrum: any | null;
  allSpectra: any[];
  
  // Resultados de comparación actual
  comparisonResults: any | null;
  lastComparison: {
    queryId: number | null;
    refId: number | null;
    timestamp: Date | null;
  };

  // Historial de comparaciones
  comparisonHistory: Comparison[];

  // Resultados de búsqueda
  searchResults: any[];
  lastSearch: {
    spectrumId: number | null;
    method: string | null;
    tolerance: number | null;
    timestamp: Date | null;
  };

  // ✅ Estado de gráfica
  graphState: GraphState;
}

// ========================================
// SERVICE
// ========================================

@Injectable({
  providedIn: 'root'
})
export class SpectrumStateService {
  
  private initialState: SpectrumState = {
    querySpectrum: null,
    refSpectrum: null,
    allSpectra: [],
    comparisonResults: null,
    lastComparison: {
      queryId: null,
      refId: null,
      timestamp: null
    },
    comparisonHistory: [],
    searchResults: [],
    lastSearch: {
      spectrumId: null,
      method: null,
      tolerance: null,
      timestamp: null
    },
    graphState: {
      selectedSpectraIds: [],
      selectedMaterial: null,
      selectedTechnique: null,
      invertirX: false,
      mostrarCuadricula: true,
      mostrarLeyenda: true,
      grosorLinea: 2.5,
      suavizado: 0
    }
  };

  private spectrumState$ = new BehaviorSubject<SpectrumState>(
    this.loadStateFromLocalStorage()
  );

  constructor() {
    this.spectrumState$.subscribe(state => {
      this.saveStateToLocalStorage(state);
    });
  }

  // ========================================
  // OBSERVABLES Y GETTERS
  // ========================================

  /**
   * Obtener el estado actual como Observable
   */
  getSpectrumState(): Observable<SpectrumState> {
    return this.spectrumState$.asObservable();
  }

  /**
   * Obtener el estado actual (snapshot)
   */
  getCurrentState(): SpectrumState {
    return this.spectrumState$.value;
  }

  // ========================================
  // ESPECTROS
  // ========================================

  /**
   * Establecer espectro de consulta
   */
  setQuerySpectrum(spectrum: any): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      querySpectrum: spectrum
    });
    console.log(`✅ Espectro de consulta establecido: ${spectrum?.filename}`);
  }

  /**
   * Establecer espectro de referencia
   */
  setRefSpectrum(spectrum: any): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      refSpectrum: spectrum
    });
    console.log(`✅ Espectro de referencia establecido: ${spectrum?.filename}`);
  }

  /**
   * Establecer la lista completa de espectros
   */
  setAllSpectra(spectra: any[]): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      allSpectra: spectra
    });
    console.log(`✅ ${spectra.length} espectros cargados en el estado`);
  }

  // ========================================
  // COMPARACIONES
  // ========================================

  /**
   * Guardar resultados de comparación
   */
  setComparisonResults(results: any): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      comparisonResults: results,
      lastComparison: {
        queryId: currentState.querySpectrum?.id || null,
        refId: currentState.refSpectrum?.id || null,
        timestamp: new Date()
      }
    });
    console.log(`✅ Resultados de comparación guardados`);
  }

  /**
   * Agregar comparación al historial
   */
  addComparisonToHistory(
    queryId: number,
    queryFilename: string,
    refId: number,
    refFilename: string,
    method: string,
    tolerance: number,
    globalScore: number
  ): void {
    const currentState = this.spectrumState$.value;
    
    const newComparison: Comparison = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      queryId,
      queryFilename,
      refId,
      refFilename,
      method,
      tolerance,
      globalScore,
      timestamp: new Date()
    };

    const history = [newComparison, ...currentState.comparisonHistory].slice(0, 10);

    this.spectrumState$.next({
      ...currentState,
      comparisonHistory: history
    });

    console.log(`📊 Comparación agregada al historial (${history.length} total)`);
  }

  /**
   * Obtener historial de comparaciones
   */
  getComparisonHistory(): Comparison[] {
    return this.spectrumState$.value.comparisonHistory;
  }

  /**
   * Cargar comparación desde historial
   */
  loadComparisonFromHistory(comparisonId: string): Comparison | undefined {
    const comparison = this.spectrumState$.value.comparisonHistory.find(c => c.id === comparisonId);
    if (comparison) {
      console.log(`✅ Comparación cargada del historial: ${comparison.queryFilename} vs ${comparison.refFilename}`);
    }
    return comparison;
  }

  /**
   * Limpiar historial de comparaciones
   */
  clearComparisonHistory(): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      comparisonHistory: []
    });
    console.log(`🧹 Historial de comparaciones limpiado`);
  }

  /**
   * Limpiar solo los resultados de comparación actual
   */
  clearComparisonResults(): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      comparisonResults: null
    });
    console.log(`🧹 Resultados de comparación actual limpiados`);
  }

  // ========================================
  // BÚSQUEDAS
  // ========================================

  /**
   * Guardar resultados de búsqueda
   */
  setSearchResults(results: any[], spectrumId: number, method: string, tolerance: number): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      searchResults: results,
      lastSearch: {
        spectrumId,
        method,
        tolerance,
        timestamp: new Date()
      }
    });
    console.log(`🔍 Resultados de búsqueda guardados: ${results.length} espectros`);
  }

  /**
   * Obtener resultados de búsqueda en caché
   */
  getSearchResults(): any[] {
    return this.spectrumState$.value.searchResults;
  }

  /**
   * Obtener metadata de última búsqueda
   */
  getLastSearch(): any {
    return this.spectrumState$.value.lastSearch;
  }

  /**
   * Limpiar solo los resultados de búsqueda
   */
  clearSearchResults(): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      searchResults: [],
      lastSearch: {
        spectrumId: null,
        method: null,
        tolerance: null,
        timestamp: null
      }
    });
    console.log(`🧹 Resultados de búsqueda limpiados`);
  }

  // ========================================
  // ESTADO DE GRÁFICA
  // ========================================

  /**
   * ✅ Guardar estado de gráfica
   */
  setGraphState(
    selectedSpectraIds: number[],
    selectedMaterial: string | null,
    selectedTechnique: string | null,
    invertirX: boolean = false,
    mostrarCuadricula: boolean = true,
    mostrarLeyenda: boolean = true,
    grosorLinea: number = 2.5,
    suavizado: number = 0
  ): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      graphState: {
        selectedSpectraIds,
        selectedMaterial,
        selectedTechnique,
        invertirX,
        mostrarCuadricula,
        mostrarLeyenda,
        grosorLinea,
        suavizado
      }
    });
    console.log(`📊 Estado de gráfica guardado: ${selectedSpectraIds.length} espectros seleccionados`);
  }

  /**
   * ✅ Obtener estado de gráfica
   */
  getGraphState(): GraphState {
    return this.spectrumState$.value.graphState;
  }

  /**
   * ✅ Limpiar estado de gráfica
   */
  clearGraphState(): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      graphState: {
        selectedSpectraIds: [],
        selectedMaterial: null,
        selectedTechnique: null,
        invertirX: false,
        mostrarCuadricula: true,
        mostrarLeyenda: true,
        grosorLinea: 2.5,
        suavizado: 0
      }
    });
    console.log(`🧹 Estado de gráfica limpiado`);
  }

  // ========================================
  // LIMPIEZAS GENERALES
  // ========================================

  /**
   * Limpiar espectro de consulta
   */
  clearQuerySpectrum(): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      querySpectrum: null,
      searchResults: [],
      lastSearch: {
        spectrumId: null,
        method: null,
        tolerance: null,
        timestamp: null
      }
    });
    console.log(`🧹 Espectro de consulta limpiado`);
  }

  /**
   * Limpiar espectro de referencia
   */
  clearRefSpectrum(): void {
    const currentState = this.spectrumState$.value;
    this.spectrumState$.next({
      ...currentState,
      refSpectrum: null
    });
    console.log(`🧹 Espectro de referencia limpiado`);
  }

  /**
   * Limpiar todos los espectros y resultados
   */
  clearAllSpectra(): void {
    this.spectrumState$.next(this.initialState);
    console.log(`🧹 Todos los espectros y estado limpiados`);
  }

  // ========================================
  // PERSISTENCIA (localStorage)
  // ========================================

  /**
   * Guardar estado en localStorage
   */
  private saveStateToLocalStorage(state: SpectrumState): void {
    try {
      localStorage.setItem('spectrum_state', JSON.stringify(state));
      console.log(`💾 Estado guardado en localStorage`);
    } catch (error) {
      console.error(`❌ Error guardando estado en localStorage:`, error);
    }
  }

  /**
   * Cargar estado desde localStorage
   */
  private loadStateFromLocalStorage(): SpectrumState {
    try {
      const saved = localStorage.getItem('spectrum_state');
      
      if (saved) {
        const state = JSON.parse(saved);
        
        // Convertir timestamps de string a Date
        if (state.comparisonHistory && Array.isArray(state.comparisonHistory)) {
          state.comparisonHistory = state.comparisonHistory.map((c: any) => ({
            ...c,
            timestamp: new Date(c.timestamp)
          }));
        }
        
        if (state.lastComparison?.timestamp) {
          state.lastComparison.timestamp = new Date(state.lastComparison.timestamp);
        }
        
        if (state.lastSearch?.timestamp) {
          state.lastSearch.timestamp = new Date(state.lastSearch.timestamp);
        }
        
        console.log(`✅ Estado cargado desde localStorage`);
        return state;
      }
      
      console.log(`📝 Usando estado inicial (localStorage vacío)`);
      return this.initialState;
    } catch (error) {
      console.error(`❌ Error cargando estado desde localStorage:`, error);
      return this.initialState;
    }
  }

  /**
   * Limpiar localStorage completamente
   */
  clearLocalStorage(): void {
    try {
      localStorage.removeItem('spectrum_state');
      console.log(`🧹 Estado removido de localStorage`);
    } catch (error) {
      console.error(`❌ Error limpiando localStorage:`, error);
    }
  }

  /**
   * Exportar estado actual como JSON (para debugging)
   */
  exportState(): string {
    return JSON.stringify(this.spectrumState$.value, null, 2);
  }

  /**
   * Importar estado desde JSON (para debugging)
   */
  importState(stateJson: string): void {
    try {
      const state = JSON.parse(stateJson);
      this.spectrumState$.next(state);
      console.log(`✅ Estado importado correctamente`);
    } catch (error) {
      console.error(`❌ Error importando estado:`, error);
    }
  }
}