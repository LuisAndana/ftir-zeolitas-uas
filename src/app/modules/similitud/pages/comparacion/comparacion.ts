import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EspectroLoaderService } from '../../../../core/services/espectro-loader.service';
import { SimilarityService } from '../../../../core/services/similarity.service';
import { SPECTRAL_WINDOWS } from '../../../../core/guards/data/zeolite-families';

@Component({
  selector: 'app-comparacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './comparacion.html',
  styleUrl: './comparacion.css'
})
export class Comparacion implements OnInit {

  spectra: any[] = [];
  queryId: string = '';
  refId: string = '';
  querySpectrum: any = null;
  refSpectrum: any = null;
  compared = false;

  // Resultados
  globalScore: number = 0;
  method: string = 'pearson';  // ✅ CAMBIADO A PEARSON (como el backend)
  tolerance: number = 4;
  windowScores: { window: string; score: number; range: string }[] = [];
  matchedPeaks: number[] = [];
  unmatchedPeaks: number[] = [];
  totalPeaks: number = 0;

  spectralWindows = SPECTRAL_WINDOWS;

  constructor(
    private espectroLoader: EspectroLoaderService,
    private similarityService: SimilarityService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.spectra = this.espectroLoader.getAllSpectra();
    console.log('✅ Espectros cargados:', this.spectra.length);

    this.route.queryParams.subscribe(params => {
      console.log('🔍 Query params recibidos:', params);
      
      if (params['query']) this.queryId = params['query'];
      if (params['ref']) this.refId = params['ref'];
      
      console.log(`📊 IDs recibidos: query=${this.queryId}, ref=${this.refId}`);
      
      this.updateSelection();
    });
  }

  updateSelection() {
    console.log('🔄 Buscando espectros en lista local...');
    console.log(`   Total de espectros: ${this.spectra.length}`);
    
    // ✅ SOLUCIÓN: Convertir IDs a número y buscar
    const queryIdNum = parseInt(this.queryId, 10);
    const refIdNum = parseInt(this.refId, 10);
    
    console.log(`   Buscando: query ID=${queryIdNum} (type: ${typeof queryIdNum}), ref ID=${refIdNum} (type: ${typeof refIdNum})`);

    this.querySpectrum = this.spectra.find(s => {
      // Asegurar que comparamos con el mismo tipo
      const specId = typeof s.id === 'string' ? parseInt(s.id, 10) : s.id;
      return specId === queryIdNum;
    }) || null;

    this.refSpectrum = this.spectra.find(s => {
      const specId = typeof s.id === 'string' ? parseInt(s.id, 10) : s.id;
      return specId === refIdNum;
    }) || null;

    if (this.querySpectrum) {
      console.log(`✅ Query spectrum encontrado: ${this.querySpectrum.filename}`);
    } else {
      console.warn(`❌ Query spectrum NO encontrado para ID ${queryIdNum}`);
    }

    if (this.refSpectrum) {
      console.log(`✅ Reference spectrum encontrado: ${this.refSpectrum.filename}`);
    } else {
      console.warn(`❌ Reference spectrum NO encontrado para ID ${refIdNum}`);
    }

    this.compared = false;
  }

  onQueryChange() {
    console.log('🔄 Query espectro cambió a:', this.queryId);
    const queryIdNum = parseInt(this.queryId, 10);
    this.querySpectrum = this.spectra.find(s => {
      const specId = typeof s.id === 'string' ? parseInt(s.id, 10) : s.id;
      return specId === queryIdNum;
    }) || null;
    this.compared = false;
  }

  onRefChange() {
    console.log('🔄 Reference espectro cambió a:', this.refId);
    const refIdNum = parseInt(this.refId, 10);
    this.refSpectrum = this.spectra.find(s => {
      const specId = typeof s.id === 'string' ? parseInt(s.id, 10) : s.id;
      return specId === refIdNum;
    }) || null;
    this.compared = false;
  }

  compare() {
    console.log('🔄 Iniciando comparación...');
    
    if (!this.querySpectrum) {
      console.error('❌ Query spectrum no seleccionado');
      return;
    }
    if (!this.refSpectrum) {
      console.error('❌ Reference spectrum no seleccionado');
      return;
    }

    console.log(`📊 Comparando:`);
    console.log(`   Query: ${this.querySpectrum.filename} (${this.querySpectrum.data?.length || 0} puntos)`);
    console.log(`   Reference: ${this.refSpectrum.filename} (${this.refSpectrum.data?.length || 0} puntos)`);
    console.log(`   Método: ${this.method} | Tolerancia: ${this.tolerance} cm⁻¹`);

    // ✅ VALIDAR DATOS
    if (!this.querySpectrum.wavenumbers || !this.querySpectrum.data) {
      console.error('❌ Query spectrum sin wavenumbers o data');
      return;
    }
    if (!this.refSpectrum.wavenumbers || !this.refSpectrum.data) {
      console.error('❌ Reference spectrum sin wavenumbers o data');
      return;
    }

    const config = {
      method: this.method as 'cosine' | 'pearson' | 'euclidean',
      tolerance: this.tolerance,
      rangeMin: 400,
      rangeMax: 4000,
      familyFilter: null,
      topN: 1,
      useWindows: true,
      selectedWindows: [] as string[]
    };

    // Similitud global
    this.globalScore = this.similarityService.calculateSimilarity(
      this.querySpectrum.wavenumbers, this.querySpectrum.data,
      this.refSpectrum.wavenumbers, this.refSpectrum.data,
      config
    );

    console.log(`✅ Global score calculado: ${this.globalScore.toFixed(4)} (${(this.globalScore * 100).toFixed(2)}%)`);

    // Por ventanas
    this.windowScores = this.spectralWindows.map(w => {
      const wConfig = { ...config, rangeMin: w.min, rangeMax: w.max };
      const score = this.similarityService.calculateSimilarity(
        this.querySpectrum.wavenumbers, this.querySpectrum.data,
        this.refSpectrum.wavenumbers, this.refSpectrum.data,
        wConfig
      );
      console.log(`   Ventana ${w.name} (${w.min}-${w.max}): ${score.toFixed(4)}`);
      return { window: w.name, score, range: `${w.min}-${w.max}` };
    });

    // Match de picos
    const qPeaks = this.similarityService.detectPeaks(this.querySpectrum.wavenumbers, this.querySpectrum.data);
    const rPeaks = this.similarityService.detectPeaks(this.refSpectrum.wavenumbers, this.refSpectrum.data);
    
    console.log(`🎯 Picos detectados: Query=${qPeaks.length}, Reference=${rPeaks.length}`);
    
    const match = this.similarityService.matchPeaksWithTolerance(qPeaks, rPeaks, this.tolerance);
    this.matchedPeaks = match.matched;
    this.unmatchedPeaks = match.unmatched;
    this.totalPeaks = match.total;

    console.log(`   Coincidencias: ${this.matchedPeaks.length}/${this.totalPeaks}`);

    this.compared = true;
  }

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
    const temp = this.queryId;
    this.queryId = this.refId;
    this.refId = temp;
    this.onQueryChange();
    this.onRefChange();
    this.compared = false;
  }
}