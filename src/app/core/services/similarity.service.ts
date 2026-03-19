/**
 * ✅ SERVICIO DE SIMILITUD ESPECTRAL - VERSIÓN MEJORADA 2024
 * Implementa algoritmos de comparación: coseno, Pearson, euclidea
 * Con validaciones robustas y mejor logging para debugging
 */

import { Injectable } from '@angular/core';
import { SPECTRAL_WINDOWS } from '../guards/data/zeolite-families';

export interface SimilarityResult {
  spectrumId: string;
  filename: string;
  family?: string;
  globalScore: number;
  windowScores: { window: string; score: number }[];
  matchingPeaks: number;
  totalPeaks: number;
}

export interface SimilarityConfig {
  method: 'cosine' | 'pearson' | 'euclidean';
  tolerance: number;          // ± grados de libertad (default 4)
  rangeMin: number;           // Rango mínimo cm⁻¹
  rangeMax: number;           // Rango máximo cm⁻¹
  familyFilter: string | null; // Filtrar por familia
  topN: number;               // Top N resultados
  useWindows: boolean;        // Usar ventanas espectrales
  selectedWindows: string[];  // Ventanas seleccionadas
}

@Injectable({
  providedIn: 'root'
})
export class SimilarityService {

  // ✅ CAMBIO: Método por defecto ahora es Pearson (más robusto)
  defaultConfig: SimilarityConfig = {
    method: 'pearson',
    tolerance: 4,
    rangeMin: 400,
    rangeMax: 4000,
    familyFilter: null,
    topN: 10,
    useWindows: false,
    selectedWindows: []
  };

  /**
   * CU-F-005: Ejecutar búsqueda de similitud
   * ✅ MEJORADO: Validaciones y logging detallados
   */
  calculateSimilarity(
    queryWavenumbers: number[],
    queryData: number[],
    referenceWavenumbers: number[],
    referenceData: number[],
    config: SimilarityConfig
  ): number {

    // ✅ FASE 1: VALIDACIONES DE ENTRADA
    console.log('🔍 DEBUG - Iniciando cálculo de similitud:');
    console.log('   Query WN length:', queryWavenumbers?.length || 0);
    console.log('   Query Data length:', queryData?.length || 0);
    console.log('   Ref WN length:', referenceWavenumbers?.length || 0);
    console.log('   Ref Data length:', referenceData?.length || 0);

    if (!queryWavenumbers?.length || !queryData?.length ||
        !referenceWavenumbers?.length || !referenceData?.length) {
      console.error('❌ Datos incompletos o vacíos en entrada');
      return 0;
    }

    // Validar longitudes correctas
    if (queryWavenumbers.length !== queryData.length) {
      console.error('❌ Query: WN y Data tienen longitudes diferentes');
      return 0;
    }

    if (referenceWavenumbers.length !== referenceData.length) {
      console.error('❌ Reference: WN y Data tienen longitudes diferentes');
      return 0;
    }

    // ✅ FASE 2: FILTRAR POR RANGO
    const { qWn, qData } = this.filterRange(queryWavenumbers, queryData, config.rangeMin, config.rangeMax);
    const { qWn: rWn, qData: rData } = this.filterRange(referenceWavenumbers, referenceData, config.rangeMin, config.rangeMax);

    console.log('   Después de filtrado:');
    console.log('   Query:', qWn.length, 'puntos');
    console.log('   Reference:', rWn.length, 'puntos');

    if (qWn.length === 0 || rWn.length === 0) {
      console.error('❌ Después del filtrado quedaron datos vacíos');
      return 0;
    }

    // ✅ FASE 3: ALINEAR ESPECTROS
    const { alignedQuery, alignedRef } = this.alignSpectra(qWn, qData, rWn, rData, config.tolerance);

    console.log('   Después de alineación:', alignedQuery.length, 'puntos comunes');

    if (alignedQuery.length === 0) {
      console.error('❌ No se pudo alinear los espectros');
      return 0;
    }

    // ✅ FASE 4: CALCULAR SIMILITUD
    let similarity = 0;
    switch (config.method) {
      case 'cosine':
        similarity = this.cosineSimilarity(alignedQuery, alignedRef);
        break;
      case 'pearson':
        similarity = this.pearsonCorrelation(alignedQuery, alignedRef);
        break;
      case 'euclidean':
        similarity = this.euclideanSimilarity(alignedQuery, alignedRef);
        break;
      default:
        similarity = this.pearsonCorrelation(alignedQuery, alignedRef);
    }

    console.log(`✅ Score ${config.method}:`, similarity.toFixed(4), `(${(similarity * 100).toFixed(2)}%)`);

    // Validar rango [0, 1]
    if (similarity < 0 || similarity > 1) {
      console.warn(`⚠️ Score fuera de rango [0-1]: ${similarity}`);
      similarity = Math.max(0, Math.min(1, similarity));
    }

    return similarity;
  }

  /**
   * CU-F-008: Calcular similitud por ventanas espectrales
   * ✅ MEJORADO: Mejor logging
   */
  calculateWindowSimilarity(
    queryWavenumbers: number[],
    queryData: number[],
    referenceWavenumbers: number[],
    referenceData: number[],
    config: SimilarityConfig
  ): { window: string; score: number }[] {

    console.log('📊 Calculando similitud por ventanas espectrales...');

    const windows = config.selectedWindows.length > 0
      ? SPECTRAL_WINDOWS.filter(w => config.selectedWindows.includes(w.name))
      : SPECTRAL_WINDOWS;

    return windows.map(window => {
      const windowConfig = { ...config, rangeMin: window.min, rangeMax: window.max };
      const score = this.calculateSimilarity(
        queryWavenumbers, queryData,
        referenceWavenumbers, referenceData,
        windowConfig
      );
      console.log(`   Ventana ${window.name} (${window.min}-${window.max}): ${score.toFixed(4)}`);
      return { window: window.name, score };
    });
  }

  /**
   * CU-T-004: Aplicar tolerancia ±N grados
   * ✅ MEJORADO: Mejor logging
   */
  matchPeaksWithTolerance(
    queryPeaks: number[],
    referencePeaks: number[],
    tolerance: number
  ): { matched: number[]; unmatched: number[]; total: number } {
    const matched: number[] = [];
    const unmatched: number[] = [];

    console.log(`🎯 Emparejando picos con tolerancia ±${tolerance} cm⁻¹`);
    console.log(`   Query picos: ${queryPeaks.length}, Reference picos: ${referencePeaks.length}`);

    for (const qPeak of queryPeaks) {
      const found = referencePeaks.some(rPeak => Math.abs(qPeak - rPeak) <= tolerance);
      if (found) {
        matched.push(qPeak);
      } else {
        unmatched.push(qPeak);
      }
    }

    console.log(`   Coincidencias: ${matched.length}/${queryPeaks.length}`);

    return { matched, unmatched, total: queryPeaks.length };
  }

  /**
   * Detectar picos en un espectro
   * ✅ MEJORADO: Normalización automática y mejor threshold
   */
  detectPeaks(wavenumbers: number[], data: number[], threshold: number = 0.01): number[] {
    const peaks: number[] = [];

    if (data.length < 3) {
      console.warn(`⚠️ Espectro muy corto: ${data.length} puntos`);
      return [];
    }

    try {
      // ✅ NORMALIZAR DATA A RANGO 0-1
      const minVal = Math.min(...data);
      const maxVal = Math.max(...data);

      if (maxVal === minVal) {
        console.warn('⚠️ Todos los valores de absorbance son iguales');
        return [];
      }

      const normalizedData = data.map(v => (v - minVal) / (maxVal - minVal));

      // ✅ DETECTAR MÁXIMOS LOCALES
      for (let i = 1; i < normalizedData.length - 1; i++) {
        if (normalizedData[i] > normalizedData[i - 1] &&
            normalizedData[i] > normalizedData[i + 1] &&
            normalizedData[i] > threshold) {
          peaks.push(wavenumbers[i]);
        }
      }

      console.log(`🎯 Picos detectados: ${peaks.length}`);
      return peaks;

    } catch (error) {
      console.error('❌ Error detectando picos:', error);
      return [];
    }
  }

  // ===== MÉTODOS INTERNOS =====

  /**
   * ✅ MEJORADO: Filtrar por rango con validaciones
   */
  private filterRange(wn: number[], data: number[], min: number, max: number) {
    console.log(`   Filtrando por rango ${min}-${max}...`);

    if (!wn?.length || !data?.length) {
      console.warn('⚠️ filterRange: Datos vacíos');
      return { qWn: [], qData: [] };
    }

    const indices = wn.reduce<number[]>((acc, w, i) => {
      if (w >= min && w <= max) acc.push(i);
      return acc;
    }, []);

    if (indices.length === 0) {
      console.warn(`⚠️ Sin datos en rango ${min}-${max}`);
      console.log(`   Rango actual: ${Math.min(...wn)}-${Math.max(...wn)}`);
      return { qWn: [], qData: [] };
    }

    return {
      qWn: indices.map(i => wn[i]),
      qData: indices.map(i => data[i])
    };
  }

  /**
   * ✅ MEJORADO: Alineación con mejor validación
   * Usa nearest neighbor con tolerancia
   */
  private alignSpectra(
    qWn: number[], qData: number[],
    rWn: number[], rData: number[],
    tolerance: number
  ) {
    console.log(`   Alineando con tolerancia ±${tolerance}...`);

    const alignedQuery: number[] = [];
    const alignedRef: number[] = [];

    if (!qWn?.length || !rWn?.length) {
      console.error('❌ alignSpectra: Datos vacíos');
      return { alignedQuery: [], alignedRef: [] };
    }

    // ✅ ENCONTRAR RANGO COMÚN
    const minWn = Math.max(Math.min(...qWn), Math.min(...rWn));
    const maxWn = Math.min(Math.max(...qWn), Math.max(...rWn));

    if (minWn >= maxWn) {
      console.error(`❌ No hay solapamiento: [${Math.min(...qWn)}, ${Math.max(...qWn)}] vs [${Math.min(...rWn)}, ${Math.max(...rWn)}]`);
      return { alignedQuery: [], alignedRef: [] };
    }

    console.log(`   Rango común: ${minWn.toFixed(2)} - ${maxWn.toFixed(2)}`);

    // ✅ ALINEACIÓN POR NEAREST NEIGHBOR
    for (let i = 0; i < qWn.length; i++) {
      const targetWn = qWn[i];

      // Solo procesar si está en rango común
      if (targetWn < minWn || targetWn > maxWn) {
        continue;
      }

      let bestIdx = -1;
      let bestDist = Infinity;

      for (let j = 0; j < rWn.length; j++) {
        const dist = Math.abs(rWn[j] - targetWn);
        if (dist < bestDist && dist <= tolerance) {
          bestDist = dist;
          bestIdx = j;
        }
      }

      if (bestIdx >= 0) {
        alignedQuery.push(qData[i]);
        alignedRef.push(rData[bestIdx]);
      }
    }

    console.log(`   ✅ Alineados ${alignedQuery.length} puntos`);

    return { alignedQuery, alignedRef };
  }

  /**
   * ✅ MEJORADO: Similitud coseno con validaciones
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    const result = denominator === 0 ? 0 : dotProduct / denominator;

    console.log(`   Cosine similarity raw: ${result.toFixed(4)}`);
    return result;
  }

  /**
   * ✅ MEJORADO: Correlación de Pearson con mejor normalización
   * Rango: [-1, 1] → [0, 1]
   */
  private pearsonCorrelation(a: number[], b: number[]): number {
    const n = a.length;
    
    if (n < 2) {
      console.warn('⚠️ Pearson: Datos insuficientes');
      return 0;
    }

    try {
      // Calcular medias
      const meanA = a.reduce((s, v) => s + v, 0) / n;
      const meanB = b.reduce((s, v) => s + v, 0) / n;

      // Calcular desviaciones
      let numerator = 0;
      let denomA = 0;
      let denomB = 0;

      for (let i = 0; i < n; i++) {
        const devA = a[i] - meanA;
        const devB = b[i] - meanB;
        numerator += devA * devB;
        denomA += devA * devA;
        denomB += devB * devB;
      }

      // Validar denominador
      if (denomA === 0 || denomB === 0) {
        console.warn('⚠️ Pearson: Desviación estándar es 0');
        return 0;
      }

      const denominator = Math.sqrt(denomA * denomB);
      
      // Correlación de Pearson [-1, 1]
      const correlation = numerator / denominator;
      
      // ✅ NORMALIZAR A [0, 1]
      const result = (correlation + 1) / 2;

      console.log(`   Pearson raw: ${correlation.toFixed(4)}, normalized: ${result.toFixed(4)}`);
      return result;

    } catch (error) {
      console.error('❌ Error en pearsonCorrelation:', error);
      return 0;
    }
  }

  /**
   * ✅ MEJORADO: Similitud euclidiana con mejor manejo
   */
  private euclideanSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    try {
      let sum = 0;
      for (let i = 0; i < a.length; i++) {
        sum += (a[i] - b[i]) ** 2;
      }
      
      const distance = Math.sqrt(sum / a.length);
      const result = 1 / (1 + distance);

      console.log(`   Euclidean distance: ${distance.toFixed(4)}, similarity: ${result.toFixed(4)}`);
      return result;

    } catch (error) {
      console.error('❌ Error en euclideanSimilarity:', error);
      return 0;
    }
  }
}