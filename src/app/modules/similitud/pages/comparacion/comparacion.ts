/**
 * ✅ COMPONENTE DE COMPARACIÓN ESPECTRAL - VERSIÓN MEJORADA 2024
 * Implementa comparación de espectros FTIR con validaciones robustas
 * Logging detallado y manejo de errores completo
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EspectroLoaderService } from '../../../../core/services/espectro-loader.service';
import { SimilarityService, SimilarityConfig } from '../../../../core/services/similarity.service';
import { SPECTRAL_WINDOWS } from '../../../../core/guards/data/zeolite-families';

@Component({
  selector: 'app-comparacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './comparacion.html',
  styleUrl: './comparacion.css'
})
export class Comparacion implements OnInit {

  // ===== DATOS DE CARGA =====
  spectra: any[] = [];
  queryId: string = '';
  refId: string = '';
  querySpectrum: any = null;
  refSpectrum: any = null;
  compared = false;

  // ===== CONFIGURACIÓN =====
  method: string = 'pearson';  // ✅ PEARSON (más robusto que coseno)
  tolerance: number = 4;        // Tolerancia en cm⁻¹

  // ===== RESULTADOS =====
  globalScore: number = 0;
  windowScores: { window: string; score: number; range: string }[] = [];
  matchedPeaks: number[] = [];
  unmatchedPeaks: number[] = [];
  totalPeaks: number = 0;

  // ===== ESTADO UI =====
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  spectralWindows = SPECTRAL_WINDOWS;

  constructor(
    private espectroLoader: EspectroLoaderService,
    private similarityService: SimilarityService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    console.log('='.repeat(70));
    console.log('📊 INICIALIZANDO COMPONENTE DE COMPARACIÓN');
    console.log('='.repeat(70));

    // ✅ FASE 1: CARGAR ESPECTROS
    this.spectra = this.espectroLoader.getAllSpectra();
    console.log(`✅ Espectros cargados: ${this.spectra.length}`);

    if (this.spectra.length === 0) {
      console.error('❌ No hay espectros disponibles');
      this.errorMessage = 'No hay espectros disponibles en la base de datos';
      return;
    }

    // ✅ FASE 2: OBTENER PARÁMETROS DE URL
    this.route.queryParams.subscribe(params => {
      console.log('\n📌 Parámetros recibidos:', params);

      if (params['query']) this.queryId = params['query'];
      if (params['ref']) this.refId = params['ref'];

      console.log(`   Query ID: ${this.queryId}`);
      console.log(`   Ref ID: ${this.refId}`);

      this.updateSelection();
    });
  }

  /**
   * ✅ MEJORADO: Buscar y validar espectros con logging detallado
   */
  updateSelection() {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 BUSCANDO ESPECTROS EN LISTA LOCAL');
    console.log('='.repeat(70));

    this.errorMessage = '';
    this.successMessage = '';

    // ✅ CONVERTIR IDS A NÚMERO PARA COMPARACIÓN SEGURA
    const queryIdNum = this.parseId(this.queryId);
    const refIdNum = this.parseId(this.refId);

    console.log(`\n📋 Buscando en ${this.spectra.length} espectros:`);
    console.log(`   Query ID: ${queryIdNum} (type: ${typeof queryIdNum})`);
    console.log(`   Ref ID: ${refIdNum} (type: ${typeof refIdNum})`);

    // Buscar Query
    this.querySpectrum = this.spectra.find(s => {
      const specId = this.parseId(s.id);
      return specId === queryIdNum;
    }) || null;

    // Buscar Reference
    this.refSpectrum = this.spectra.find(s => {
      const specId = this.parseId(s.id);
      return specId === refIdNum;
    }) || null;

    // ✅ VALIDAR BÚSQUEDA
    if (this.querySpectrum) {
      console.log(`✅ Query encontrado: ${this.querySpectrum.filename || 'N/A'}`);
      this.validateSpectrum(this.querySpectrum, 'Query');
    } else {
      console.warn(`⚠️ Query NO encontrado para ID ${queryIdNum}`);
      this.errorMessage = `Espectro de consulta con ID ${queryIdNum} no encontrado`;
    }

    if (this.refSpectrum) {
      console.log(`✅ Reference encontrado: ${this.refSpectrum.filename || 'N/A'}`);
      this.validateSpectrum(this.refSpectrum, 'Reference');
    } else {
      console.warn(`⚠️ Reference NO encontrado para ID ${refIdNum}`);
      this.errorMessage = `Espectro de referencia con ID ${refIdNum} no encontrado`;
    }

    this.compared = false;
    console.log('='.repeat(70));
  }

  /**
   * ✅ VALIDAR ESTRUCTURA Y DATOS DEL ESPECTRO
   */
  private validateSpectrum(spectrum: any, type: string): boolean {
    console.log(`\n📊 Validando ${type} spectrum:`);

    // Validación 1: Estructura básica
    if (!spectrum) {
      console.error(`❌ ${type} spectrum es null`);
      return false;
    }

    // Validación 2: Wavenumbers
    if (!spectrum.wavenumbers) {
      console.warn(`⚠️ ${type}: Sin array 'wavenumbers'`);
    } else if (Array.isArray(spectrum.wavenumbers)) {
      console.log(`   ✅ Wavenumbers: ${spectrum.wavenumbers.length} puntos`);
    } else {
      console.warn(`⚠️ ${type}: wavenumbers no es array`);
    }

    // Validación 3: Data
    if (!spectrum.data) {
      console.warn(`⚠️ ${type}: Sin array 'data'`);
    } else if (Array.isArray(spectrum.data)) {
      console.log(`   ✅ Data: ${spectrum.data.length} puntos`);
    } else {
      console.warn(`⚠️ ${type}: data no es array`);
    }

    // Validación 4: Longitudes iguales
    if (spectrum.wavenumbers?.length !== spectrum.data?.length) {
      console.error(
        `❌ ${type}: Longitudes diferentes - ` +
        `wavenumbers=${spectrum.wavenumbers?.length}, data=${spectrum.data?.length}`
      );
      return false;
    }

    // Validación 5: Datos válidos
    if (spectrum.wavenumbers?.length > 0) {
      const validWn = spectrum.wavenumbers.every((w: any) => typeof w === 'number' && !isNaN(w));
      const validData = spectrum.data?.every((d: any) => typeof d === 'number' && !isNaN(d));

      if (!validWn) console.warn(`⚠️ ${type}: Hay wavenumbers inválidos (NaN)`);
      if (!validData) console.warn(`⚠️ ${type}: Hay datos inválidos (NaN)`);

      console.log(`   ✅ Rango WN: ${Math.min(...spectrum.wavenumbers).toFixed(2)}-${Math.max(...spectrum.wavenumbers).toFixed(2)}`);
      console.log(`   ✅ Rango Data: ${Math.min(...spectrum.data).toFixed(4)}-${Math.max(...spectrum.data).toFixed(4)}`);
    }

    return true;
  }

  /**
   * ✅ PARSEAR ID DE FORMA SEGURA
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
   * ✅ CAMBIO DE ESPECTRO QUERY
   */
  onQueryChange() {
    console.log(`\n🔄 Query espectro cambió a: ${this.queryId}`);
    const queryIdNum = this.parseId(this.queryId);
    
    this.querySpectrum = this.spectra.find(s => {
      const specId = this.parseId(s.id);
      return specId === queryIdNum;
    }) || null;

    if (this.querySpectrum) {
      console.log(`✅ Query actualizado: ${this.querySpectrum.filename}`);
    } else {
      console.error(`❌ Query no encontrado para ID ${queryIdNum}`);
    }

    this.compared = false;
    this.errorMessage = '';
  }

  /**
   * ✅ CAMBIO DE ESPECTRO REFERENCE
   */
  onRefChange() {
    console.log(`\n🔄 Reference espectro cambió a: ${this.refId}`);
    const refIdNum = this.parseId(this.refId);
    
    this.refSpectrum = this.spectra.find(s => {
      const specId = this.parseId(s.id);
      return specId === refIdNum;
    }) || null;

    if (this.refSpectrum) {
      console.log(`✅ Reference actualizado: ${this.refSpectrum.filename}`);
    } else {
      console.error(`❌ Reference no encontrado para ID ${refIdNum}`);
    }

    this.compared = false;
    this.errorMessage = '';
  }

  /**
   * ✅ MÉTODO PRINCIPAL: REALIZAR COMPARACIÓN
   */
  compare() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 INICIANDO COMPARACIÓN DE ESPECTROS');
    console.log('='.repeat(70));

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      // ✅ FASE 1: VALIDAR ESPECTROS SELECCIONADOS
      if (!this.querySpectrum) {
        this.errorMessage = 'Debes seleccionar un espectro de consulta';
        console.error('❌ ' + this.errorMessage);
        this.isLoading = false;
        return;
      }

      if (!this.refSpectrum) {
        this.errorMessage = 'Debes seleccionar un espectro de referencia';
        console.error('❌ ' + this.errorMessage);
        this.isLoading = false;
        return;
      }

      console.log('\n📋 Espectros seleccionados:');
      console.log(`   Query: ${this.querySpectrum.filename} (${this.querySpectrum.data?.length || 0} puntos)`);
      console.log(`   Ref: ${this.refSpectrum.filename} (${this.refSpectrum.data?.length || 0} puntos)`);

      // ✅ FASE 2: VALIDAR ESTRUCTURA DE DATOS
      if (!this.validateDataStructure()) {
        this.isLoading = false;
        return;
      }

      // ✅ FASE 3: CREAR CONFIGURACIÓN
      console.log('\n⚙️ Configuración:');
      console.log(`   Método: ${this.method}`);
      console.log(`   Tolerancia: ±${this.tolerance} cm⁻¹`);

      const config: SimilarityConfig = {
        method: this.method as 'cosine' | 'pearson' | 'euclidean',
        tolerance: this.tolerance,
        rangeMin: 400,
        rangeMax: 4000,
        familyFilter: null,
        topN: 1,
        useWindows: true,
        selectedWindows: []
      };

      // ✅ FASE 4: CALCULAR SIMILITUD GLOBAL
      console.log('\n🔢 Calculando similitud global...');
      this.globalScore = this.similarityService.calculateSimilarity(
        this.querySpectrum.wavenumbers,
        this.querySpectrum.data,
        this.refSpectrum.wavenumbers,
        this.refSpectrum.data,
        config
      );

      console.log(`✅ Global score: ${this.globalScore.toFixed(4)} (${this.getScorePercent(this.globalScore)}%)`);

      // Validar que no sea 0 sin razón
      if (this.globalScore === 0) {
        console.warn('⚠️ El score es 0 - Verificar datos de entrada');
      }

      // ✅ FASE 5: CALCULAR SIMILITUD POR VENTANAS
      console.log('\n📊 Calculando similitud por ventanas espectrales...');
      this.windowScores = this.spectralWindows.map(w => {
        const wConfig = { ...config, rangeMin: w.min, rangeMax: w.max };
        const score = this.similarityService.calculateSimilarity(
          this.querySpectrum.wavenumbers,
          this.querySpectrum.data,
          this.refSpectrum.wavenumbers,
          this.refSpectrum.data,
          wConfig
        );
        console.log(`   ${w.name} (${w.min}-${w.max}): ${score.toFixed(4)} (${(score * 100).toFixed(1)}%)`);
        return { 
          window: w.name, 
          score, 
          range: `${w.min}-${w.max}` 
        };
      });

      // ✅ FASE 6: DETECTAR Y EMPAREJAR PICOS
      console.log('\n🎯 Detectando picos...');
      const qPeaks = this.similarityService.detectPeaks(
        this.querySpectrum.wavenumbers,
        this.querySpectrum.data,
        0.01  // threshold
      );
      
      const rPeaks = this.similarityService.detectPeaks(
        this.refSpectrum.wavenumbers,
        this.refSpectrum.data,
        0.01  // threshold
      );

      console.log(`   Picos Query: ${qPeaks.length}`);
      console.log(`   Picos Reference: ${rPeaks.length}`);

      console.log('\n🔗 Emparejando picos...');
      const match = this.similarityService.matchPeaksWithTolerance(
        qPeaks,
        rPeaks,
        this.tolerance
      );

      this.matchedPeaks = match.matched;
      this.unmatchedPeaks = match.unmatched;
      this.totalPeaks = match.total;

      console.log(`   Coincidencias: ${this.matchedPeaks.length}/${this.totalPeaks}`);

      // ✅ MARCAR COMO COMPLETADO
      this.compared = true;
      this.successMessage = `✅ Comparación completada. Similitud: ${this.getScorePercent(this.globalScore)}%`;

      console.log('\n' + '='.repeat(70));
      console.log('✅ COMPARACIÓN COMPLETADA EXITOSAMENTE');
      console.log('='.repeat(70) + '\n');

    } catch (error) {
      console.error('❌ ERROR EN COMPARACIÓN:', error);
      this.errorMessage = `Error durante la comparación: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * ✅ VALIDAR ESTRUCTURA DE DATOS COMPLETA
   */
  private validateDataStructure(): boolean {
    console.log('\n📊 Validando estructura de datos:');

    // Query
    if (!this.querySpectrum.wavenumbers || !Array.isArray(this.querySpectrum.wavenumbers)) {
      this.errorMessage = 'Query: wavenumbers inválido';
      console.error('❌ ' + this.errorMessage);
      return false;
    }

    if (!this.querySpectrum.data || !Array.isArray(this.querySpectrum.data)) {
      this.errorMessage = 'Query: data inválido';
      console.error('❌ ' + this.errorMessage);
      return false;
    }

    if (this.querySpectrum.wavenumbers.length !== this.querySpectrum.data.length) {
      this.errorMessage = `Query: Longitudes diferentes (${this.querySpectrum.wavenumbers.length} vs ${this.querySpectrum.data.length})`;
      console.error('❌ ' + this.errorMessage);
      return false;
    }

    // Reference
    if (!this.refSpectrum.wavenumbers || !Array.isArray(this.refSpectrum.wavenumbers)) {
      this.errorMessage = 'Reference: wavenumbers inválido';
      console.error('❌ ' + this.errorMessage);
      return false;
    }

    if (!this.refSpectrum.data || !Array.isArray(this.refSpectrum.data)) {
      this.errorMessage = 'Reference: data inválido';
      console.error('❌ ' + this.errorMessage);
      return false;
    }

    if (this.refSpectrum.wavenumbers.length !== this.refSpectrum.data.length) {
      this.errorMessage = `Reference: Longitudes diferentes (${this.refSpectrum.wavenumbers.length} vs ${this.refSpectrum.data.length})`;
      console.error('❌ ' + this.errorMessage);
      return false;
    }

    // Validar valores numéricos
    const queryWnValid = this.querySpectrum.wavenumbers.every((w: any) => typeof w === 'number' && !isNaN(w));
    const queryDataValid = this.querySpectrum.data.every((d: any) => typeof d === 'number' && !isNaN(d));
    const refWnValid = this.refSpectrum.wavenumbers.every((w: any) => typeof w === 'number' && !isNaN(w));
    const refDataValid = this.refSpectrum.data.every((d: any) => typeof d === 'number' && !isNaN(d));

    if (!queryWnValid || !queryDataValid || !refWnValid || !refDataValid) {
      this.errorMessage = 'Hay valores inválidos (NaN) en los datos';
      console.error('❌ ' + this.errorMessage);
      return false;
    }

    console.log('✅ Todas las validaciones pasadas');
    return true;
  }

  /**
   * ✅ OBTENER CLASE CSS SEGÚN SCORE
   */
  getScoreClass(score: number): string {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * ✅ CONVERTIR SCORE A PORCENTAJE
   */
  getScorePercent(score: number): string {
    return (score * 100).toFixed(1);
  }

  /**
   * ✅ INTERCAMBIAR ESPECTROS
   */
  swapSpectra() {
    console.log('\n🔄 Intercambiando espectros...');
    const temp = this.queryId;
    this.queryId = this.refId;
    this.refId = temp;

    this.onQueryChange();
    this.onRefChange();
    this.compared = false;
  }

  /**
   * ✅ LIMPIAR COMPARACIÓN
   */
  clearComparison() {
    console.log('\n🗑️ Limpiando comparación...');
    this.compared = false;
    this.globalScore = 0;
    this.windowScores = [];
    this.matchedPeaks = [];
    this.unmatchedPeaks = [];
    this.totalPeaks = 0;
    this.errorMessage = '';
    this.successMessage = '';
  }
}