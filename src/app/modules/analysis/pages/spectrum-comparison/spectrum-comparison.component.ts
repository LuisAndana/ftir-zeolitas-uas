/**
 * ✅ SOLUCIÓN FINAL: Gráfico superpuesto SIN INTERPOLACIÓN
 * Deja que Chart.js maneje los diferentes grids automáticamente
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { Chart } from 'chart.js/auto';
import { SimilarityService, SimilarityConfig } from '../../../../core/services/similarity.service';

@Component({
  selector: 'app-spectrum-comparison',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spectrum-comparison.component.html',
  styleUrls: ['./spectrum-comparison.component.css']
})
export class SpectrumComparisonComponent implements OnInit, OnDestroy {

  referenceSpectrum: any = null;
  comparisonSpectrum: any = null;

  method: string = 'pearson';
  tolerance: number = 4;

  similarityScore: number = 0;
  matchedPeaks: number[] = [];
  unmatchedPeaks: number[] = [];
  totalPeaks: number = 0;

  loading: boolean = true;
  calculating: boolean = false;
  error: string = '';
  successMessage: string = '';

  referenceId: number = 0;
  comparisonId: number = 0;

  chartReference: Chart | null = null;
  chartComparison: Chart | null = null;
  chartOverlay: Chart | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private location: Location,
    private similarityService: SimilarityService
  ) {}

  ngOnInit(): void {
    console.log('📊 Iniciando comparación');

    this.route.params.subscribe(params => {
      this.referenceId = params['referenceId'];
      this.comparisonId = params['comparisonId'];
      this.method = params['method'] || 'pearson';

      if (this.referenceId && this.comparisonId) {
        this.loadSpectra();
      } else {
        this.error = 'IDs inválidos';
        this.loading = false;
      }
    });
  }

  loadSpectra(): void {
    this.loading = true;
    this.error = '';

    console.log(`🔄 Cargando espectros: ${this.referenceId} vs ${this.comparisonId}`);

    this.http.get(`http://localhost:8000/api/similarity/spectrum/${this.referenceId}`).subscribe(
      (response: any) => {
        if (response.success && response.spectrum) {
          this.referenceSpectrum = this.processSpectrum(response.spectrum);

          this.http.get(`http://localhost:8000/api/similarity/spectrum/${this.comparisonId}`).subscribe(
            (compResponse: any) => {
              if (compResponse.success && compResponse.spectrum) {
                this.comparisonSpectrum = this.processSpectrum(compResponse.spectrum);
                this.loading = false;
                this.renderCharts();
                this.calculateSimilarity();
              }
            },
            error => {
              this.error = `Error: ${error.message}`;
              this.loading = false;
            }
          );
        }
      },
      error => {
        this.error = `Error: ${error.message}`;
        this.loading = false;
      }
    );
  }

  /**
   * ✅ PROCESAR ESPECTRO - SIMPLE Y DIRECTO
   */
  private processSpectrum(spectrum: any): any {
    if (!spectrum.spectrum_data) {
      console.error('Sin spectrum_data');
      return spectrum;
    }

    const data = spectrum.spectrum_data;
    let intensities: number[] = data.intensities || data.absorbance || [];
    let wavenumbers: number[] = data.wavenumbers || [];

    // Generar wavenumbers si no existen
    if (!wavenumbers || wavenumbers.length === 0) {
      wavenumbers = [];
      const step = (400 - 4000) / (intensities.length - 1);
      for (let i = 0; i < intensities.length; i++) {
        wavenumbers.push(4000 + (i * step));
      }
    }

    // Asegurar longitudes iguales
    const minLen = Math.min(wavenumbers.length, intensities.length);
    if (minLen < wavenumbers.length || minLen < intensities.length) {
      wavenumbers = wavenumbers.slice(0, minLen);
      intensities = intensities.slice(0, minLen);
    }

    return {
      ...spectrum,
      spectrum_data: {
        wavenumbers: wavenumbers,
        intensities: intensities
      }
    };
  }

  renderCharts(): void {
    if (this.referenceSpectrum?.spectrum_data) {
      this.createChart('chartReference', this.referenceSpectrum, 'Espectro de Referencia', '#2196F3');
    }

    if (this.comparisonSpectrum?.spectrum_data) {
      this.createChart('chartComparison', this.comparisonSpectrum, 'Espectro Encontrado', '#FF6B6B');
    }

    // ✅ GRÁFICO SUPERPUESTO SIN INTERPOLACIÓN
    if (this.referenceSpectrum?.spectrum_data && this.comparisonSpectrum?.spectrum_data) {
      this.createOverlayChart();
    }
  }

  /**
   * ✅ CREAR GRÁFICO INDIVIDUAL
   */
  private createChart(canvasId: string, spectrum: any, title: string, color: string): void {
    setTimeout(() => {
      try {
        const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!ctx) return;

        const data = spectrum.spectrum_data;
        const wavenumbers: number[] = data.wavenumbers || [];
        const intensities: number[] = data.intensities || [];

        if (wavenumbers.length === 0) return;

        const config: any = {
          type: 'line',
          data: {
            labels: wavenumbers.map((wn: number) => wn.toFixed(0)),
            datasets: [{
              label: title,
              data: intensities,
              borderColor: color,
              backgroundColor: color.replace(')', ', 0.1)'),
              borderWidth: 2,
              tension: 0.2,
              pointRadius: 0,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: true, labels: { boxWidth: 10, padding: 20, font: { size: 12 } } },
              title: { display: true, text: title, font: { size: 14, weight: 'bold' } }
            },
            scales: {
              x: {
                title: { display: true, text: 'Wavenumber (cm⁻¹)', font: { size: 12 } },
                ticks: { maxTicksLimit: 10 }
              },
              y: {
                title: { display: true, text: 'Absorbance', font: { size: 12 } },
                beginAtZero: true
              }
            }
          }
        };

        if (canvasId === 'chartReference' && this.chartReference) {
          this.chartReference.destroy();
        } else if (canvasId === 'chartComparison' && this.chartComparison) {
          this.chartComparison.destroy();
        }

        const chart = new Chart(ctx, config);
        if (canvasId === 'chartReference') this.chartReference = chart;
        else if (canvasId === 'chartComparison') this.chartComparison = chart;

      } catch (error) {
        console.error(`Error en ${canvasId}:`, error);
      }
    }, 100);
  }

  /**
   * ✅ CREAR GRÁFICO SUPERPUESTO - VERSION SIMPLE
   * NO interpola, deja que Chart.js maneje ambos grids
   */
  private createOverlayChart(): void {
    setTimeout(() => {
      try {
        const ctx = document.getElementById('chartOverlay') as HTMLCanvasElement;
        if (!ctx) return;

        const refData = this.referenceSpectrum.spectrum_data;
        const compData = this.comparisonSpectrum.spectrum_data;

        const refWn: number[] = refData.wavenumbers || [];
        const refInt: number[] = refData.intensities || [];
        const compWn: number[] = compData.wavenumbers || [];
        const compInt: number[] = compData.intensities || [];

        if (refWn.length === 0 || compWn.length === 0) return;

        console.log(` Creando overlay:`);
        console.log(`   Ref: ${refWn.length} pts (${Math.min(...refWn).toFixed(0)}-${Math.max(...refWn).toFixed(0)})`);
        console.log(`   Comp: ${compWn.length} pts (${Math.min(...compWn).toFixed(0)}-${Math.max(...compWn).toFixed(0)})`);
        console.log(`   Ref intensity: ${Math.min(...refInt).toFixed(4)}-${Math.max(...refInt).toFixed(4)}`);
        console.log(`   Comp intensity: ${Math.min(...compInt).toFixed(4)}-${Math.max(...compInt).toFixed(4)}`);

        // ✅ CREAR DOS DATASETS INDEPENDIENTES
        // Cada uno con su propio grid de wavenumbers
        const config: any = {
          type: 'scatter',  // ✅ USAR SCATTER EN VEZ DE LINE
          data: {
            datasets: [
              {
                label: ' Espectro de Referencia',
                data: refWn.map((wn: number, idx: number) => ({
                  x: wn,
                  y: refInt[idx]
                })),
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                showLine: true,
                tension: 0.3
              },
              {
                label: ' Espectro Encontrado',
                data: compWn.map((wn: number, idx: number) => ({
                  x: wn,
                  y: compInt[idx]
                })),
                borderColor: '#FF6B6B',
                backgroundColor: 'rgba(255, 107, 107, 0.2)',
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                showLine: true,
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index' as const, intersect: false },
            plugins: {
              legend: {
                display: true,
                position: 'top' as const,
                labels: { boxWidth: 15, padding: 20, font: { size: 13, weight: 'bold' as const } }
              },
              title: {
                display: true,
                text: ' Comparación Superpuesta de Espectros FTIR',
                font: { size: 16, weight: 'bold' as const }
              },
              tooltip: {
                enabled: true,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: 12,
                titleFont: { size: 12, weight: 'bold' as const }
              }
            },
            scales: {
              x: {
                type: 'linear' as const,
                position: 'bottom' as const,
                title: {
                  display: true,
                  text: 'Wavenumber (cm⁻¹)',
                  font: { size: 12, weight: 'bold' as const }
                },
                grid: { color: 'rgba(200,200,200,0.1)' }
              },
              y: {
                title: {
                  display: true,
                  text: 'Absorbance',
                  font: { size: 12, weight: 'bold' as const }
                },
                beginAtZero: true,
                grid: { color: 'rgba(200,200,200,0.15)' }
              }
            }
          }
        };

        if (this.chartOverlay) this.chartOverlay.destroy();
        this.chartOverlay = new Chart(ctx, config);
        console.log(' Overlay creado correctamente');

      } catch (error) {
        console.error('Error:', error);
        this.error = `Error: ${error instanceof Error ? error.message : 'Unknown'}`;
      }
    }, 150);
  }

  calculateSimilarity(): void {
    this.calculating = true;

    try {
      if (!this.validateData()) {
        this.calculating = false;
        return;
      }

      const refData = this.referenceSpectrum.spectrum_data;
      const compData = this.comparisonSpectrum.spectrum_data;

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

      this.similarityScore = this.similarityService.calculateSimilarity(
        refData.wavenumbers,
        refData.intensities,
        compData.wavenumbers,
        compData.intensities,
        config
      );

      const refPeaks = this.similarityService.detectPeaks(refData.wavenumbers, refData.intensities);
      const compPeaks = this.similarityService.detectPeaks(compData.wavenumbers, compData.intensities);

      const peakMatch = this.similarityService.matchPeaksWithTolerance(refPeaks, compPeaks, this.tolerance);
      this.matchedPeaks = peakMatch.matched;
      this.unmatchedPeaks = peakMatch.unmatched;
      this.totalPeaks = peakMatch.total;

      this.calculating = false;
      this.successMessage = ` Similitud: ${(this.similarityScore * 100).toFixed(1)}%`;

    } catch (error) {
      this.error = `Error: ${error instanceof Error ? error.message : 'Unknown'}`;
      this.calculating = false;
    }
  }

  private validateData(): boolean {
    if (!this.referenceSpectrum?.spectrum_data?.wavenumbers || !this.referenceSpectrum?.spectrum_data?.intensities) {
      this.error = 'Espectro inválido';
      return false;
    }
    if (!this.comparisonSpectrum?.spectrum_data?.wavenumbers || !this.comparisonSpectrum?.spectrum_data?.intensities) {
      this.error = 'Espectro inválido';
      return false;
    }
    return true;
  }

  getScorePercent(score: number): string {
    return (score * 100).toFixed(1);
  }

  getScoreClass(score: number): string {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  downloadComparison(): void {
    const data = {
      reference: this.referenceSpectrum,
      comparison: this.comparisonSpectrum,
      method: this.method,
      similarity_score: this.similarityScore,
      timestamp: new Date().toISOString()
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison_${this.referenceId}_vs_${this.comparisonId}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    if (this.chartReference) this.chartReference.destroy();
    if (this.chartComparison) this.chartComparison.destroy();
    if (this.chartOverlay) this.chartOverlay.destroy();
  }
}