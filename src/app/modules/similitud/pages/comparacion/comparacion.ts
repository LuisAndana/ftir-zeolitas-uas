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
  method: string = 'cosine';
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

    this.route.queryParams.subscribe(params => {
      if (params['query']) this.queryId = params['query'];
      if (params['ref']) this.refId = params['ref'];
      this.updateSelection();
    });
  }

  updateSelection() {
    this.querySpectrum = this.spectra.find(s => s.id === this.queryId) || null;
    this.refSpectrum = this.spectra.find(s => s.id === this.refId) || null;
    this.compared = false;
  }

  onQueryChange() {
    this.querySpectrum = this.spectra.find(s => s.id === this.queryId) || null;
    this.compared = false;
  }

  onRefChange() {
    this.refSpectrum = this.spectra.find(s => s.id === this.refId) || null;
    this.compared = false;
  }

  compare() {
    if (!this.querySpectrum || !this.refSpectrum) return;

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

    // Por ventanas
    this.windowScores = this.spectralWindows.map(w => {
      const wConfig = { ...config, rangeMin: w.min, rangeMax: w.max };
      const score = this.similarityService.calculateSimilarity(
        this.querySpectrum.wavenumbers, this.querySpectrum.data,
        this.refSpectrum.wavenumbers, this.refSpectrum.data,
        wConfig
      );
      return { window: w.name, score, range: `${w.min}-${w.max}` };
    });

    // Match de picos
    const qPeaks = this.similarityService.detectPeaks(this.querySpectrum.wavenumbers, this.querySpectrum.data);
    const rPeaks = this.similarityService.detectPeaks(this.refSpectrum.wavenumbers, this.refSpectrum.data);
    const match = this.similarityService.matchPeaksWithTolerance(qPeaks, rPeaks, this.tolerance);
    this.matchedPeaks = match.matched;
    this.unmatchedPeaks = match.unmatched;
    this.totalPeaks = match.total;

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
