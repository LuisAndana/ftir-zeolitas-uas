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

  defaultConfig: SimilarityConfig = {
    method: 'cosine',
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
   */
  calculateSimilarity(
    queryWavenumbers: number[],
    queryData: number[],
    referenceWavenumbers: number[],
    referenceData: number[],
    config: SimilarityConfig
  ): number {

    // Filtrar por rango
    const { qWn, qData } = this.filterRange(queryWavenumbers, queryData, config.rangeMin, config.rangeMax);
    const { qWn: rWn, qData: rData } = this.filterRange(referenceWavenumbers, referenceData, config.rangeMin, config.rangeMax);

    if (qWn.length === 0 || rWn.length === 0) return 0;

    // Interpolar para alinear los datos
    const { alignedQuery, alignedRef } = this.alignSpectra(qWn, qData, rWn, rData, config.tolerance);

    if (alignedQuery.length === 0) return 0;

    switch (config.method) {
      case 'cosine':
        return this.cosineSimilarity(alignedQuery, alignedRef);
      case 'pearson':
        return this.pearsonCorrelation(alignedQuery, alignedRef);
      case 'euclidean':
        return this.euclideanSimilarity(alignedQuery, alignedRef);
      default:
        return this.cosineSimilarity(alignedQuery, alignedRef);
    }
  }

  /**
   * CU-F-008: Calcular similitud por ventanas espectrales
   */
  calculateWindowSimilarity(
    queryWavenumbers: number[],
    queryData: number[],
    referenceWavenumbers: number[],
    referenceData: number[],
    config: SimilarityConfig
  ): { window: string; score: number }[] {

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
      return { window: window.name, score };
    });
  }

  /**
   * CU-T-004: Aplicar tolerancia ±N grados
   */
  matchPeaksWithTolerance(
    queryPeaks: number[],
    referencePeaks: number[],
    tolerance: number
  ): { matched: number[]; unmatched: number[]; total: number } {
    const matched: number[] = [];
    const unmatched: number[] = [];

    for (const qPeak of queryPeaks) {
      const found = referencePeaks.some(rPeak => Math.abs(qPeak - rPeak) <= tolerance);
      if (found) {
        matched.push(qPeak);
      } else {
        unmatched.push(qPeak);
      }
    }

    return { matched, unmatched, total: queryPeaks.length };
  }

  /**
   * Detectar picos en un espectro
   */
  detectPeaks(wavenumbers: number[], data: number[], threshold: number = 0.05): number[] {
    const peaks: number[] = [];

    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > threshold) {
        peaks.push(wavenumbers[i]);
      }
    }

    return peaks;
  }

  // ===== MÉTODOS INTERNOS =====

  private filterRange(wn: number[], data: number[], min: number, max: number) {
    const indices = wn.reduce<number[]>((acc, w, i) => {
      if (w >= min && w <= max) acc.push(i);
      return acc;
    }, []);

    return {
      qWn: indices.map(i => wn[i]),
      qData: indices.map(i => data[i])
    };
  }

  private alignSpectra(
    qWn: number[], qData: number[],
    rWn: number[], rData: number[],
    tolerance: number
  ) {
    // Usar interpolación lineal para alinear al grid del query
    const alignedQuery: number[] = [];
    const alignedRef: number[] = [];

    for (let i = 0; i < qWn.length; i++) {
      const targetWn = qWn[i];
      // Buscar el punto más cercano en referencia dentro de la tolerancia
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

    return { alignedQuery, alignedRef };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private pearsonCorrelation(a: number[], b: number[]): number {
    const n = a.length;
    if (n === 0) return 0;

    const meanA = a.reduce((s, v) => s + v, 0) / n;
    const meanB = b.reduce((s, v) => s + v, 0) / n;

    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < n; i++) {
      const dA = a[i] - meanA;
      const dB = b[i] - meanB;
      num += dA * dB;
      denA += dA * dA;
      denB += dB * dB;
    }

    const den = Math.sqrt(denA) * Math.sqrt(denB);
    return den === 0 ? 0 : num / den;
  }

  private euclideanSimilarity(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    const distance = Math.sqrt(sum / a.length);
    // Convertir distancia a similitud (0-1)
    return 1 / (1 + distance);
  }
}
