import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Chart } from 'chart.js/auto';
import { EspectroLoaderService, Spectrum } from '../../../../core/services/espectro-loader.service';
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

  @ViewChild('queryChartCanvas') queryChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('refChartCanvas') refChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overlayChartCanvas') overlayChartCanvas!: ElementRef<HTMLCanvasElement>;

  spectra: Spectrum[] = [];
  queryId: string = '';
  refId: string = '';
  querySpectrum: Spectrum | null = null;
  refSpectrum: Spectrum | null = null;
  compared = false;

  queryChart: Chart | null = null;
  refChart: Chart | null = null;
  overlayChart: Chart | null = null;

  method: string = 'pearson';
  tolerance: number = 4;

  invertirX: boolean = false;
  mostrarCuadricula: boolean = true;
  mostrarLeyenda: boolean = true;
  grosorLinea: number = 2.5;
  modoSeleccion: boolean = false;
  isZoomed: boolean = false;

  private origXMin: number = 400;
  private origXMax: number = 4000;
  private origYMin: number = -0.05;
  private origYMax: number = 1.1;

  private currentXMin: number = 400;
  private currentXMax: number = 4000;
  private currentYMin: number = -0.05;
  private currentYMax: number = 1.1;

  private selectionBox: HTMLDivElement | null = null;
  private selStartX: number = 0;
  private selStartY: number = 0;
  private isSelecting: boolean = false;

  private wheelListener:      (e: WheelEvent) => void = () => {};
  private mouseDownListener:  (e: MouseEvent) => void = () => {};
  private mouseMoveListener:  (e: MouseEvent) => void = () => {};
  private mouseUpListener:    (e: MouseEvent) => void = () => {};
  private mouseLeaveListener: (e: MouseEvent) => void = () => {};
  private dblClickListener:   (e: MouseEvent) => void = () => {};

  private isDragging: boolean = false;
  private lastClientX: number = 0;
  private lastClientY: number = 0;

  globalScore: number = 0;
  allScores: { euclidean: number; cosine: number; pearson: number } | null = null;
  windowScores: { window: string; score: number; range: string }[] = [];
  matchedPeaks:       number[] = [];
  unmatchedPeaks:     number[] = [];
  // ✅ NEW: max/min peaks per spectrum
  queryMaxPeaks:      number[] = [];
  queryMinPeaks:      number[] = [];
  refMaxPeaks:        number[] = [];
  refMinPeaks:        number[] = [];
  tooltipMode: 'single' | 'both' = 'single';
  totalPeaks: number = 0;
  matchingPeaksCount: number = 0;

  isLoadingSpectra: boolean = false;
  isComparingWithBackend: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  comparisonHistory: Comparison[] = [];
  showHistory: boolean = false;
  isInitialized: boolean = false;

  spectralWindows = SPECTRAL_WINDOWS;
  private destroy$ = new Subject<void>();

  constructor(
    private espectroLoader: EspectroLoaderService,
    private similarityBackendService: SimilarityBackendService,
    private similarityService: SimilarityService,
    private spectrumStateService: SpectrumStateService
  ) {}

  ngOnInit() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.loadSpectraFromBackend();
    this.loadSavedState();
    this.loadComparisonHistory();
  }

  private loadComparisonHistory(): void {
    this.spectrumStateService
      .getSpectrumState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.comparisonHistory = state.comparisonHistory || [];
      });
  }

 private loadSavedState(): void {
    this.spectrumStateService
      .getSpectrumState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.querySpectrum) {
          this.querySpectrum = state.querySpectrum;
          this.queryId = this.querySpectrum!.id.toString();
        }
        if (state.refSpectrum) {
          this.refSpectrum = state.refSpectrum;
          this.refId = this.refSpectrum!.id.toString();
        }
        if (state.comparisonResults && !this.compared) {
          const data = state.comparisonResults;
          this.globalScore        = data.global_score || 0;
          this.allScores          = data.all_scores || null;
          this.matchedPeaks       = data.matched_peaks || [];
          this.unmatchedPeaks     = data.unmatched_peaks || [];
          this.totalPeaks         = data.total_peaks || 0;
          this.matchingPeaksCount = data.matching_peaks_count || 0;
          if ((data.window_scores?.length ?? 0) > 0) {
            this.windowScores = (data.window_scores ?? []).map((w: any) => ({
              window: w.window || 'N/A', score: w.score ?? 0, range: '0-4000'
            }));
          }
          this.compared       = true;
          this.successMessage = `Comparación restaurada: ${(this.globalScore * 100).toFixed(1)}%`;

          // ✅ Re-renderizar gráficas al restaurar estado
          if (this.querySpectrum && this.refSpectrum) {
            setTimeout(() => this.renderCharts(), 200);
          }
        }
        this.comparisonHistory = state.comparisonHistory || [];
      });
  }

private loadSpectraFromBackend() {
    this.isLoadingSpectra = true;
    this.espectroLoader.espectros$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (espectros) => {
          this.spectra = espectros;
          this.isLoadingSpectra = false;
          this.errorMessage = espectros.length === 0
            ? 'No hay espectros disponibles. Carga algunos en "Cargar Espectro"'
            : '';

          // ✅ Si hay comparación guardada y espectros cargados, re-renderizar
          if (this.compared && this.querySpectrum && this.refSpectrum && espectros.length > 0) {
            const qId = this.parseId(this.queryId);
            const rId = this.parseId(this.refId);
            this.querySpectrum = espectros.find(s => this.parseId(s.id) === qId) || this.querySpectrum;
            this.refSpectrum   = espectros.find(s => this.parseId(s.id) === rId) || this.refSpectrum;
            setTimeout(() => this.renderCharts(), 300);
          }
        },
        error: () => {
          this.isLoadingSpectra = false;
          if (!this.compared) {
            this.errorMessage = 'Error al conectar. Backend debe estar en localhost:8000';
          }
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.removeChartListeners();
    this.destroySelectionBox();
    this.destroyAllCharts();
  }

  // ============================================================
  // CHART DATA HELPERS
  // ============================================================

  private buildChartPoints(spectrum: Spectrum): { x: number; y: number }[] {
    const wn   = spectrum.wavenumbers || [];
    const vals = spectrum.data || [];
    if (wn.length === 0 || vals.length === 0) return [];

    const len = Math.min(wn.length, vals.length);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < len; i++) {
      const x = Number(wn[i]);
      const y = Number(vals[i]);
      if (isFinite(x) && isFinite(y)) points.push({ x, y });
    }
    points.sort((a, b) => a.x - b.x);
    return points;
  }

  private computeYBounds(points: { x: number; y: number }[]): { yMin: number; yMax: number } {
    if (points.length === 0) return { yMin: -0.1, yMax: 1.2 };
    const ys     = points.map(p => p.y);
    const rawMin = Math.min(...ys);
    const rawMax = Math.max(...ys);
    const margin = (rawMax - rawMin) * 0.25 || 0.90;
    return { yMin: rawMin - margin, yMax: rawMax + margin };
  }

  // ✅ Detect local maxima (peaks)
  private detectPeaks(wavenumbers: number[], intensities: number[], threshold = 0.05): number[] {
    if (wavenumbers.length < 3 || intensities.length < 3) return [];
    const len  = Math.min(wavenumbers.length, intensities.length);
    const ints = intensities.slice(0, len).map(Number);
    const minV = Math.min(...ints);
    const maxV = Math.max(...ints);
    if (maxV - minV === 0) return [];
    const norm     = ints.map(v => (v - minV) / (maxV - minV));
    const smoothed = norm.map((_, i, arr) => {
      const s = Math.max(0, i - 2);
      const e = Math.min(arr.length - 1, i + 2);
      let sum = 0;
      for (let j = s; j <= e; j++) sum += arr[j];
      return sum / (e - s + 1);
    });
    const peaks: number[] = [];
    for (let i = 1; i < len - 1; i++) {
      if (smoothed[i] > smoothed[i - 1] && smoothed[i] > smoothed[i + 1] && smoothed[i] > threshold) {
        peaks.push(Number(wavenumbers[i]));
      }
    }
    const filtered: number[] = [];
    for (const p of peaks) {
      if (filtered.length === 0 || Math.abs(p - filtered[filtered.length - 1]) > 10) filtered.push(p);
    }
    return filtered;
  }

  // ✅ Detect local minima (valleys)
  private detectValleys(wavenumbers: number[], intensities: number[], threshold = 0.05): number[] {
    if (wavenumbers.length < 3 || intensities.length < 3) return [];
    const len  = Math.min(wavenumbers.length, intensities.length);
    const ints = intensities.slice(0, len).map(Number);
    const minV = Math.min(...ints);
    const maxV = Math.max(...ints);
    if (maxV - minV === 0) return [];
    const norm     = ints.map(v => (v - minV) / (maxV - minV));
    const smoothed = norm.map((_, i, arr) => {
      const s = Math.max(0, i - 2);
      const e = Math.min(arr.length - 1, i + 2);
      let sum = 0;
      for (let j = s; j <= e; j++) sum += arr[j];
      return sum / (e - s + 1);
    });
    const valleys: number[] = [];
    for (let i = 1; i < len - 1; i++) {
      if (smoothed[i] < smoothed[i - 1] && smoothed[i] < smoothed[i + 1] && smoothed[i] < (1 - threshold)) {
        valleys.push(Number(wavenumbers[i]));
      }
    }
    const filtered: number[] = [];
    for (const v of valleys) {
      if (filtered.length === 0 || Math.abs(v - filtered[filtered.length - 1]) > 10) filtered.push(v);
    }
    return filtered;
  }

  private matchPeaks(
    queryPeaks: number[], refPeaks: number[], tol: number
  ): { matched: number[]; unmatched: number[] } {
    if (!queryPeaks.length || !refPeaks.length) return { matched: [], unmatched: [...queryPeaks] };
    const matched: number[]   = [];
    const unmatched: number[] = [];
    for (const qp of queryPeaks) {
      refPeaks.some(rp => Math.abs(qp - rp) <= tol) ? matched.push(qp) : unmatched.push(qp);
    }
    return { matched, unmatched };
  }

  // ============================================================
  // CHART RENDERING
  // ============================================================

  public renderCharts() {
    if (!this.querySpectrum || !this.refSpectrum) return;

    const queryPts = this.buildChartPoints(this.querySpectrum);
    const refPts   = this.buildChartPoints(this.refSpectrum);
    if (queryPts.length === 0 || refPts.length === 0) {
      this.errorMessage = '⚠️ Los espectros no tienen datos de wavenumbers válidos para graficar.';
      return;
    }

    const { yMin, yMax } = this.computeYBounds([...queryPts, ...refPts]);
    this.origYMin = yMin; this.origYMax = yMax;
    this.currentYMin = yMin; this.currentYMax = yMax;

    this.renderQueryChart(queryPts);
    this.renderRefChart(refPts);

    const qWn   = this.querySpectrum.wavenumbers || [];
    const qVals = this.querySpectrum.data || [];
    const rWn   = this.refSpectrum.wavenumbers || [];
    const rVals = this.refSpectrum.data || [];

    const queryPeaks = this.detectPeaks(qWn, qVals);
    const refPeaks   = this.detectPeaks(rWn, rVals);
    const { matched, unmatched } = this.matchPeaks(queryPeaks, refPeaks, this.tolerance);

    // ✅ Siempre actualizar peaks
    this.matchedPeaks       = matched;
    this.unmatchedPeaks     = unmatched;
    this.totalPeaks         = queryPeaks.length;
    this.matchingPeaksCount = matched.length;

    // ✅ Store max/min peaks for both spectra
    this.queryMaxPeaks = queryPeaks;
    this.queryMinPeaks = this.detectValleys(qWn, qVals);
    this.refMaxPeaks   = refPeaks;
    this.refMinPeaks   = this.detectValleys(rWn, rVals);

    setTimeout(() => this.renderOverlayChart(queryPts, refPts, queryPeaks), 150);
  }

  private getChartOptions(title: string, points: { x: number; y: number }[]): any {
    const { yMin, yMax } = this.computeYBounds(points);
    return {
      responsive: true,
      maintainAspectRatio: true,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: this.mostrarLeyenda, position: 'top',
          labels: { usePointStyle: true, padding: 15, font: { size: 11, weight: 'bold' as const } }
        },
        title: { display: true, text: title, font: { size: 13, weight: 'bold' as const } },
        filler: { propagate: true },
        tooltip: {
          callbacks: {
            label: (ctx: any) =>
              `Wavenumber: ${ctx.parsed.x?.toFixed(1) ?? ''} cm⁻¹  |  Abs: ${ctx.parsed.y?.toFixed(4) ?? ''}`
          }
        }
      },
      scales: {
        x: {
          type: 'linear', reverse: this.invertirX,
          title: { display: true, text: 'Número de Onda (cm⁻¹)', font: { weight: 'bold' as const, size: 10 } },
          min: 400, max: 4000,
          grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.08)' }
        },
        y: {
          title: { display: true, text: 'Absorbancia', font: { weight: 'bold' as const, size: 10 } },
          min: yMin, max: yMax,
          grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.08)' }
        }
      }
    };
  }

  private renderQueryChart(points: { x: number; y: number }[]) {
    const canvas = this.queryChartCanvas?.nativeElement;
    if (!canvas || !this.querySpectrum) return;
    if (this.queryChart) { this.queryChart.destroy(); this.queryChart = null; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const qWn   = this.querySpectrum.wavenumbers || [];
    const qVals = this.querySpectrum.data || [];
    const peaks  = this.detectPeaks(qWn, qVals);

    this.queryChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `Query: ${this.querySpectrum.filename}`,
            data: points,
            borderColor: '#2E75B6', backgroundColor: 'rgba(46,117,182,0.08)',
            borderWidth: this.grosorLinea, showLine: true, fill: true,
            tension: 0.1, pointRadius: 0, pointHoverRadius: 5, spanGaps: true
          },
          {
            label: 'Picos',
            data: peaks.map(wn => {
              const idx = (qWn as number[]).findIndex((w: number) => Math.abs(w - wn) < 2);
              return { x: wn, y: idx >= 0 ? Number(qVals[idx]) : null };
            }).filter((p): p is { x: number; y: number } => p.y !== null),
            borderColor: '#ef4444', backgroundColor: '#ef4444',
            pointRadius: 5, pointStyle: 'triangle' as const, showLine: false, fill: false
          }
        ]
      },
      options: this.getChartOptions(`Espectro de Consulta — ${this.querySpectrum.filename}`, points)
    });
  }

  private renderRefChart(points: { x: number; y: number }[]) {
    const canvas = this.refChartCanvas?.nativeElement;
    if (!canvas || !this.refSpectrum) return;
    if (this.refChart) { this.refChart.destroy(); this.refChart = null; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rWn   = this.refSpectrum.wavenumbers || [];
    const rVals = this.refSpectrum.data || [];
    const peaks  = this.detectPeaks(rWn, rVals);

    this.refChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `Reference: ${this.refSpectrum.filename}`,
            data: points,
            borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)',
            borderWidth: this.grosorLinea, showLine: true, fill: true,
            tension: 0.1, pointRadius: 0, pointHoverRadius: 5, spanGaps: true
          },
          {
            label: 'Picos',
            data: peaks.map(wn => {
              const idx = (rWn as number[]).findIndex((w: number) => Math.abs(w - wn) < 2);
              return { x: wn, y: idx >= 0 ? Number(rVals[idx]) : null };
            }).filter((p): p is { x: number; y: number } => p.y !== null),
            borderColor: '#ef4444', backgroundColor: '#ef4444',
            pointRadius: 5, pointStyle: 'triangle' as const, showLine: false, fill: false
          }
        ]
      },
      options: this.getChartOptions(`Espectro de Referencia — ${this.refSpectrum.filename}`, points)
    });
  }

public renderOverlayChart(
    queryPts:   { x: number; y: number }[],
    refPts:     { x: number; y: number }[],
    queryPeaks: number[] = []
  ) {
    const canvas = this.overlayChartCanvas?.nativeElement;
    if (!canvas || !this.querySpectrum || !this.refSpectrum) return;
    if (this.overlayChart) { this.overlayChart.destroy(); this.overlayChart = null; }

    this.isZoomed = false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const qWn   = this.querySpectrum.wavenumbers || [];
    const qVals = this.querySpectrum.data || [];
    const rWn   = this.refSpectrum.wavenumbers || [];
    const rVals = this.refSpectrum.data || [];

    const allY   = [...queryPts, ...refPts].map(p => p.y);
    const rawMin = Math.min(...allY);
    const rawMax = Math.max(...allY);
    const range  = rawMax - rawMin;
    const offset = range * 0.6;

    const queryPtsShifted = queryPts.map(p => ({ x: p.x, y: p.y + offset }));
    const refPtsShifted   = refPts.map(p =>   ({ x: p.x, y: p.y - offset }));

    // ✅ Calcular bounds REALES con offset aplicado y guardarlos como origen
    const { yMin, yMax } = this.computeYBounds([...queryPtsShifted, ...refPtsShifted]);

    const allX       = [...queryPtsShifted, ...refPtsShifted].map(p => p.x);
    const dataXMin   = Math.min(...allX);
    const dataXMax   = Math.max(...allX);

    // ✅ Guardar como origen para zoomReset()
    this.origXMin    = dataXMin;
    this.origXMax    = dataXMax;
    this.origYMin    = yMin;
    this.origYMax    = yMax;
    this.currentXMin = dataXMin;
    this.currentXMax = dataXMax;
    this.currentYMin = yMin;
    this.currentYMax = yMax;

    const queryPeakPoints = queryPeaks.map(wn => {
      const idx = (qWn as number[]).findIndex((w: number) => Math.abs(w - wn) < 2);
      return { x: wn, y: idx >= 0 ? Number(qVals[idx]) + offset : null };
    }).filter((p): p is { x: number; y: number } => p.y !== null);

    const refPeaks      = this.detectPeaks(rWn, rVals);
    const refPeakPoints = refPeaks.map(wn => {
      const idx = (rWn as number[]).findIndex((w: number) => Math.abs(w - wn) < 2);
      return { x: wn, y: idx >= 0 ? Number(rVals[idx]) - offset : null };
    }).filter((p): p is { x: number; y: number } => p.y !== null);

    this.overlayChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `Query: ${this.querySpectrum.filename}`,
            data: queryPtsShifted,
            borderColor: '#2E75B6', backgroundColor: 'rgba(46,117,182,0.07)',
            borderWidth: this.grosorLinea, showLine: true, fill: true,
            tension: 0.1, pointRadius: 0, pointHoverRadius: 5, spanGaps: true
          },
          {
            label: `Reference: ${this.refSpectrum.filename}`,
            data: refPtsShifted,
            borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.07)',
            borderWidth: this.grosorLinea, showLine: true, fill: true,
            tension: 0.1, pointRadius: 0, pointHoverRadius: 5, spanGaps: true
          },
          {
            label: 'Picos Coincidentes (Query)',
            data: queryPeakPoints.filter(p => this.matchedPeaks.some(m => Math.abs(m - p.x) <= this.tolerance)),
            borderColor: '#10b981', backgroundColor: '#10b981',
            pointRadius: 6, pointStyle: 'triangle' as const, showLine: false, fill: false
          },
          {
            label: 'Picos No Coincidentes (Query)',
            data: queryPeakPoints.filter(p => !this.matchedPeaks.some(m => Math.abs(m - p.x) <= this.tolerance)),
            borderColor: '#ef4444', backgroundColor: '#ef4444',
            pointRadius: 6, pointStyle: 'rectRot' as const, showLine: false, fill: false
          },
          {
            label: 'Picos Coincidentes (Ref)',
            data: refPeakPoints.filter(p => this.matchedPeaks.some(m => Math.abs(m - p.x) <= this.tolerance)),
            borderColor: '#10b981', backgroundColor: '#10b981',
            pointRadius: 6, pointStyle: 'triangle' as const, showLine: false, fill: false
          },
          {
            label: 'Picos No Coincidentes (Ref)',
            data: refPeakPoints.filter(p => !this.matchedPeaks.some(m => Math.abs(m - p.x) <= this.tolerance)),
            borderColor: '#ef4444', backgroundColor: '#ef4444',
            pointRadius: 6, pointStyle: 'rectRot' as const, showLine: false, fill: false
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: true, animation: false,
        interaction: {
          mode: 'index' as const,
          intersect: false,
          axis: 'x' as const
        },
        layout: { padding: { top: 5, bottom: 5, left: 10, right: 10 } },
        plugins: {
          legend: {
            display: this.mostrarLeyenda,
            position: 'bottom',
            align: 'center',
            labels: {
              usePointStyle: true,
              pointStyleWidth: 10,
              padding: 20,
              font: { size: 11, weight: 'bold' as const },
              color: '#374151',
              filter: (item: any) => {
                const label = item.text;
                if (label === 'Picos Coincidentes (Ref)')    return false;
                if (label === 'Picos No Coincidentes (Ref)') return false;
                if (label === 'Picos Coincidentes (Query)')    item.text = '▲ Picos Coincidentes';
                if (label === 'Picos No Coincidentes (Query)') item.text = '◆ Picos No Coincidentes';
                return true;
              },
              boxWidth: 12,
              boxHeight: 12
            }
          },
          title: {
            display: true,
            text: `Superposición — Similitud: ${(this.globalScore * 100).toFixed(1)}%`,
            font: { size: 14, weight: 'bold' as const },
            color: '#1f2937',
            padding: { top: 10, bottom: 15 }
          },
          filler: { propagate: true },
          tooltip: {
            mode: 'index' as const,
            intersect: false,
            position: 'nearest' as const,
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderColor: 'rgba(0,0,0,0.08)',
            borderWidth: 1,
            padding: { top: 4, bottom: 4, left: 8, right: 8 },
            boxPadding: 3,
            usePointStyle: true,
            callbacks: {
              title: () => '',
              label: (ctx: any) => {
                if (ctx.datasetIndex > 1) return '';
                if (this.tooltipMode === 'single' && ctx.datasetIndex === 1) return '';
                const wn  = ctx.parsed.x?.toFixed(1) ?? '';
                const raw = ctx.datasetIndex === 0
                  ? (ctx.parsed.y - offset).toFixed(4)
                  : (ctx.parsed.y + offset).toFixed(4);
                const name = ctx.dataset.label
                  .replace('Query: ', '')
                  .replace('Reference: ', '');
                return `${name}   ${wn} cm⁻¹   ${raw} A.U.`;
              },
              afterLabel: () => '',
              labelColor: (ctx: any) => {
                if (ctx.datasetIndex > 1) return { borderColor: 'transparent', backgroundColor: 'transparent' };
                return {
                  borderColor:     ctx.dataset.borderColor as string,
                  backgroundColor: ctx.dataset.borderColor as string,
                  borderWidth: 2,
                  borderRadius: 3
                };
              },
              labelTextColor: () => '#1f2937'
            }
          }
        },
        scales: {
          x: {
            type: 'linear', reverse: this.invertirX,
            title: { display: true, text: 'Número de Onda (cm⁻¹)', font: { weight: 'bold' as const }, color: '#374151' },
            min: this.currentXMin, max: this.currentXMax,
            grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.06)' },
            ticks: { color: '#6b7280', font: { size: 11 } }
          },
          y: {
            title: { display: true, text: 'Absorbancia (apilada)', font: { weight: 'bold' as const }, color: '#374151' },
            min: this.currentYMin, max: this.currentYMax,
            grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.06)' },
            ticks: { color: '#6b7280', font: { size: 11 } }
          }
        }
      }
    });

    setTimeout(() => this.enableChartInteraction(), 100);
  }

  // ============================================================
  // INTERACTION — zoom, drag, selection
  // ============================================================

  private enableChartInteraction(): void {
    const canvas = this.overlayChartCanvas?.nativeElement;
    if (!canvas) return;

    this.removeChartListeners();
    canvas.style.cursor = 'grab';

    let selStartCanvasX = 0;
    let selStartCanvasY = 0;
    let selEndCanvasX   = 0;
    let selEndCanvasY   = 0;

    this.wheelListener = (e: WheelEvent) => {
      e.preventDefault();
      if (this.modoSeleccion) return;
      const rect      = canvas.getBoundingClientRect();
      const rawFrac   = (e.clientX - rect.left) / rect.width;
      const pivotFrac = this.invertirX ? (1 - rawFrac) : rawFrac;
      this.applyZoom(e.deltaY > 0 ? 1.12 : 0.88, pivotFrac);
    };

    this.mouseDownListener = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const px   = e.clientX - rect.left;
      const py   = e.clientY - rect.top;

      if (this.modoSeleccion) {
        this.isSelecting = true;
        selStartCanvasX  = px; selStartCanvasY = py;
        selEndCanvasX    = px; selEndCanvasY   = py;
        this.createSelectionBox(canvas, px, py);
      } else {
        this.isDragging  = true;
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;
        canvas.style.cursor = 'grabbing';
      }
    };

    this.mouseMoveListener = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px   = e.clientX - rect.left;
      const py   = e.clientY - rect.top;

      if (this.modoSeleccion && this.isSelecting) {
        selEndCanvasX = px; selEndCanvasY = py;
        this.updateSelectionBox(selStartCanvasX, selStartCanvasY, selEndCanvasX, selEndCanvasY);
        return;
      }

      if (!this.modoSeleccion && this.isDragging && this.overlayChart) {
        if (e.buttons !== 1) {
          this.isDragging = false;
          canvas.style.cursor = 'grab';
          return;
        }

        const area = (this.overlayChart as any).chartArea;
        if (!area) return;

        const plotW = area.right  - area.left;
        const plotH = area.bottom - area.top;

        const xRange   = this.currentXMax - this.currentXMin;
        const xPerPx   = xRange / plotW;
        const deltaXPx = e.clientX - this.lastClientX;
        const xShift   = this.invertirX ? deltaXPx * xPerPx : -deltaXPx * xPerPx;
        this.currentXMin += xShift;
        this.currentXMax += xShift;

        const yRange   = this.currentYMax - this.currentYMin;
        const yPerPx   = yRange / plotH;
        const deltaYPx = e.clientY - this.lastClientY;
        const yShift   = deltaYPx * yPerPx;
        this.currentYMin += yShift;
        this.currentYMax += yShift;

        this.writeScales();
        this.overlayChart.update('none');
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;
        canvas.style.cursor = 'grabbing';

      } else if (!this.modoSeleccion) {
        this.isDragging = false;
        canvas.style.cursor = 'grab';
      }
    };

    this.mouseUpListener = (e: MouseEvent) => {
      if (this.isSelecting && this.overlayChart) {
        const rect    = canvas.getBoundingClientRect();
        selEndCanvasX = e.clientX - rect.left;
        selEndCanvasY = e.clientY - rect.top;

        const area = (this.overlayChart as any).chartArea;
        if (area) {
          const plotW = area.right  - area.left;
          const plotH = area.bottom - area.top;

          const canvasToDataX = (cpx: number): number => {
            const clamped = Math.max(area.left, Math.min(area.right, cpx));
            const frac    = (clamped - area.left) / plotW;
            return this.invertirX
              ? this.currentXMax - frac * (this.currentXMax - this.currentXMin)
              : this.currentXMin + frac * (this.currentXMax - this.currentXMin);
          };

          const canvasToDataY = (cpy: number): number => {
            const clamped = Math.max(area.top, Math.min(area.bottom, cpy));
            const frac    = (clamped - area.top) / plotH;
            return this.currentYMax - frac * (this.currentYMax - this.currentYMin);
          };

          const dx1 = canvasToDataX(selStartCanvasX);
          const dx2 = canvasToDataX(selEndCanvasX);
          const dy1 = canvasToDataY(selStartCanvasY);
          const dy2 = canvasToDataY(selEndCanvasY);

          if (Math.abs(selEndCanvasX - selStartCanvasX) > 10 &&
              Math.abs(selEndCanvasY - selStartCanvasY) > 10) {
            this.applyZoomToRange(dx1, dx2, dy1, dy2);
          }
        }

        this.isSelecting   = false;
        this.modoSeleccion = false;
        this.destroySelectionBox();
        canvas.style.cursor = 'grab';
      }

      this.isDragging = false;
    };

    this.mouseLeaveListener = () => {
      this.isDragging = false;
      if (this.isSelecting) { this.isSelecting = false; this.destroySelectionBox(); }
      canvas.style.cursor = 'grab';
    };

    this.dblClickListener = () => this.zoomReset();

    canvas.addEventListener('wheel',      this.wheelListener,      { passive: false });
    canvas.addEventListener('mousedown',  this.mouseDownListener);
    canvas.addEventListener('mousemove',  this.mouseMoveListener);
    canvas.addEventListener('mouseup',    this.mouseUpListener);
    canvas.addEventListener('mouseleave', this.mouseLeaveListener);
    canvas.addEventListener('dblclick',   this.dblClickListener);
  }

  private removeChartListeners(): void {
    const canvas = this.overlayChartCanvas?.nativeElement;
    if (!canvas) return;
    canvas.removeEventListener('wheel',      this.wheelListener);
    canvas.removeEventListener('mousedown',  this.mouseDownListener);
    canvas.removeEventListener('mousemove',  this.mouseMoveListener);
    canvas.removeEventListener('mouseup',    this.mouseUpListener);
    canvas.removeEventListener('mouseleave', this.mouseLeaveListener);
    canvas.removeEventListener('dblclick',   this.dblClickListener);
  }

  private writeScales(): void {
    if (!this.overlayChart) return;
    (this.overlayChart.options as any).scales['x'].min = this.currentXMin;
    (this.overlayChart.options as any).scales['x'].max = this.currentXMax;
    (this.overlayChart.options as any).scales['y'].min = this.currentYMin;
    (this.overlayChart.options as any).scales['y'].max = this.currentYMax;
  }

  private applyZoom(factor: number, pivotFrac = 0.5): void {
    const xRange    = this.currentXMax - this.currentXMin;
    const yRange    = this.currentYMax - this.currentYMin;
    const newXRange = xRange * factor;
    const newYRange = yRange * factor;
    const pivotX    = this.currentXMin + pivotFrac * xRange;
    const pivotY    = this.currentYMin + (1 - pivotFrac) * yRange;
    this.currentXMin = pivotX - pivotFrac * newXRange;
    this.currentXMax = pivotX + (1 - pivotFrac) * newXRange;
    this.currentYMin = pivotY - (1 - pivotFrac) * newYRange;
    this.currentYMax = pivotY + pivotFrac * newYRange;
    this.isZoomed = true;
    this.writeScales();
    if (this.overlayChart) this.overlayChart.update('none');
  }

  private applyZoomToRange(x1: number, x2: number, y1: number, y2: number): void {
    const newXMin = Math.min(x1, x2);
    const newXMax = Math.max(x1, x2);
    const newYMin = Math.min(y1, y2);
    const newYMax = Math.max(y1, y2);
    if (newXMax - newXMin < 1 || newYMax - newYMin < 0.001) return;
    this.currentXMin = newXMin; this.currentXMax = newXMax;
    this.currentYMin = newYMin; this.currentYMax = newYMax;
    this.isZoomed = true;
    this.writeScales();
    if (this.overlayChart) this.overlayChart.update('none');
  }

  private createSelectionBox(canvas: HTMLCanvasElement, x: number, y: number): void {
    this.destroySelectionBox();
    const wrapper = canvas.parentElement;
    if (!wrapper) return;
    if (window.getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';

    const offL = canvas.offsetLeft;
    const offT = canvas.offsetTop;

    const box = document.createElement('div');
    box.id = 'comparacionSelectionBox';
    box.style.cssText = `
      position: absolute;
      border: 2px dashed #2196F3;
      background: rgba(33,150,243,0.10);
      pointer-events: none;
      z-index: 999;
      left: ${x + offL}px;
      top:  ${y + offT}px;
      width: 0px; height: 0px;
      box-sizing: border-box;
    `;
    wrapper.appendChild(box);
    this.selectionBox = box;
    (this.selectionBox as any).__offL = offL;
    (this.selectionBox as any).__offT = offT;
  }

  private updateSelectionBox(sx: number, sy: number, cx: number, cy: number): void {
    if (!this.selectionBox) return;
    const offL = (this.selectionBox as any).__offL ?? 0;
    const offT = (this.selectionBox as any).__offT ?? 0;
    this.selectionBox.style.left   = `${Math.min(sx, cx) + offL}px`;
    this.selectionBox.style.top    = `${Math.min(sy, cy) + offT}px`;
    this.selectionBox.style.width  = `${Math.abs(cx - sx)}px`;
    this.selectionBox.style.height = `${Math.abs(cy - sy)}px`;
  }

  private destroySelectionBox(): void {
    if (this.selectionBox) { this.selectionBox.remove(); this.selectionBox = null; }
  }

  public zoomIn():  void { this.applyZoom(0.6); }
  public zoomOut(): void { this.applyZoom(1.6); }

  public zoomReset(): void {
    this.currentXMin = this.origXMin; this.currentXMax = this.origXMax;
    this.currentYMin = this.origYMin; this.currentYMax = this.origYMax;
    this.isZoomed = false;
    this.writeScales();
    if (this.overlayChart) this.overlayChart.update('none');
  }

  public toggleModoSeleccion(): void {
    this.modoSeleccion = !this.modoSeleccion;
    const canvas = this.overlayChartCanvas?.nativeElement;
    if (canvas) canvas.style.cursor = this.modoSeleccion ? 'crosshair' : 'grab';
    if (!this.modoSeleccion) this.destroySelectionBox();
  }

  public onToggleLeyenda(): void {
    if (!this.overlayChart) return;
    (this.overlayChart.options as any).plugins.legend.display = this.mostrarLeyenda;
    this.overlayChart.update();
  }

  public onToggleInvertirX(): void {
    if (!this.overlayChart) return;
    (this.overlayChart.options as any).scales['x'].reverse = this.invertirX;
    this.overlayChart.update();
  }

  public onToggleCuadricula(): void {
    if (!this.overlayChart) return;
    (this.overlayChart.options as any).scales['x'].grid.display = this.mostrarCuadricula;
    (this.overlayChart.options as any).scales['y'].grid.display = this.mostrarCuadricula;
    this.overlayChart.update();
  }

  public onToggleTooltipMode(): void {
    this.tooltipMode = this.tooltipMode === 'single' ? 'both' : 'single';
    if (!this.querySpectrum || !this.refSpectrum) return;
    const queryPts = this.buildChartPoints(this.querySpectrum);
    const refPts   = this.buildChartPoints(this.refSpectrum);
    const qWn      = this.querySpectrum.wavenumbers || [];
    const qVals    = this.querySpectrum.data || [];
    const peaks    = this.detectPeaks(qWn, qVals);
    this.renderOverlayChart(queryPts, refPts, peaks);
  }

  // ============================================================
  // SPECTRA SELECTION & COMPARISON
  // ============================================================

  updateSelection() {
    this.errorMessage = ''; this.successMessage = '';
    const qId = this.parseId(this.queryId);
    const rId = this.parseId(this.refId);
    this.querySpectrum = this.spectra.find(s => this.parseId(s.id) === qId) || null;
    this.refSpectrum   = this.spectra.find(s => this.parseId(s.id) === rId) || null;
    if (this.querySpectrum) this.spectrumStateService.setQuerySpectrum(this.querySpectrum);
    if (this.refSpectrum)   this.spectrumStateService.setRefSpectrum(this.refSpectrum);
    this.compared = false;
    this.destroyAllCharts();
    this.removeChartListeners();
  }

  private parseId(id: any): number {
    if (typeof id === 'number') return id;
    if (typeof id === 'string') { const p = parseInt(id, 10); return isNaN(p) ? 0 : p; }
    return 0;
  }

  onQueryChange() {
    this.querySpectrum = this.spectra.find(s => this.parseId(s.id) === this.parseId(this.queryId)) || null;
    if (this.querySpectrum) this.spectrumStateService.setQuerySpectrum(this.querySpectrum);
    this.compared = false; this.errorMessage = '';
  }

  onRefChange() {
    this.refSpectrum = this.spectra.find(s => this.parseId(s.id) === this.parseId(this.refId)) || null;
    if (this.refSpectrum) this.spectrumStateService.setRefSpectrum(this.refSpectrum);
    this.compared = false; this.errorMessage = '';
  }

  compare() {
    if (!this.querySpectrum || !this.refSpectrum) {
      this.errorMessage = 'Debes seleccionar ambos espectros'; return;
    }
    this.compareWithBackend();
  }

  private compareWithBackend() {
    this.isComparingWithBackend = true;
    this.errorMessage = ''; this.successMessage = '';
    this.similarityBackendService.compareSpectra(
      this.parseId(this.queryId), this.parseId(this.refId), this.method, this.tolerance
    ).subscribe({
      next:  (r: ComparisonResponse) => { this.handleBackendResponse(r); this.isComparingWithBackend = false; },
      error: (e: any)                => { this.handleBackendError(e);    this.isComparingWithBackend = false; }
    });
  }

  private handleBackendResponse(response: ComparisonResponse) {
    if (!response?.success || !response?.data) {
      this.errorMessage = response?.message || 'Error en respuesta del backend'; return;
    }
    const data = response.data;
    this.globalScore        = data.global_score ?? 0;
    this.allScores          = data.all_scores || null;
    this.matchedPeaks       = Array.isArray(data.matched_peaks)   ? data.matched_peaks   : [];
    this.unmatchedPeaks     = Array.isArray(data.unmatched_peaks) ? data.unmatched_peaks : [];
    this.totalPeaks         = data.total_peaks ?? 0;
    this.matchingPeaksCount = data.matching_peaks_count ?? 0;

    if ((data.window_scores?.length ?? 0) > 0) {
      this.windowScores = (data.window_scores ?? []).map((w: any) => ({
        window: w.window || 'N/A', score: w.score ?? 0, range: '0-4000'
      }));
    }

    this.compared       = true;
    this.successMessage = `Similitud: ${(this.globalScore * 100).toFixed(1)}%`;
    this.spectrumStateService.setComparisonResults(data);
    this.spectrumStateService.addComparisonToHistory(
      this.parseId(this.queryId), this.querySpectrum!.filename,
      this.parseId(this.refId),   this.refSpectrum!.filename,
      this.method, this.tolerance, this.globalScore
    );
    this.comparisonHistory = this.spectrumStateService.getComparisonHistory();
    setTimeout(() => this.renderCharts(), 100);
  }

  private handleBackendError(error: any) {
    this.errorMessage =
      error.message            ? error.message
      : error.statusCode === 0   ? ' No se pudo conectar. Backend en localhost:8000?'
      : error.statusCode === 404 ? ' Espectro no encontrado'
      : error.statusCode === 401 ? 'No autenticado. Inicia sesión de nuevo'
      : 'Error en el servidor';
  }

  private destroyAllCharts(): void {
    [this.queryChart, this.refChart, this.overlayChart].forEach(c => { if (c) c.destroy(); });
    this.queryChart = this.refChart = this.overlayChart = null;
  }

  getScoreClass(score: number): string {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  getScorePercent(score: number): string { return (score * 100).toFixed(1); }

  swapSpectra() {
    [this.queryId, this.refId] = [this.refId, this.queryId];
    this.onQueryChange(); this.onRefChange(); this.compared = false;
  }

clearComparison() {
    this.compared = false; this.globalScore = 0; this.allScores = null;
    this.windowScores = []; this.matchedPeaks = []; this.unmatchedPeaks = [];
    this.queryMaxPeaks = []; this.queryMinPeaks = [];
    this.refMaxPeaks   = []; this.refMinPeaks   = [];
    this.totalPeaks = 0; this.matchingPeaksCount = 0;
    this.tooltipMode = 'single';
    this.errorMessage = ''; this.successMessage = '';
    this.removeChartListeners(); this.destroyAllCharts();
    this.spectrumStateService.clearComparisonResults();
    // ✅ NO limpiar querySpectrum ni refSpectrum — mantener selección
  }

  clearAllData() {
    this.spectrumStateService.clearAllSpectra();
    this.querySpectrum = null; this.refSpectrum = null;
    this.queryId = ''; this.refId = '';
    this.comparisonHistory = [];
    this.clearComparison();
  }

  clearHistory() {
    this.spectrumStateService.clearComparisonHistory();
    this.comparisonHistory = [];
    this.successMessage = 'Historial limpiado';
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  loadFromHistory(comparison: Comparison): void {
    this.queryId   = comparison.queryId.toString();
    this.refId     = comparison.refId.toString();
    this.method    = comparison.method;
    this.tolerance = comparison.tolerance;

    const query = this.spectra.find(s => s.id === comparison.queryId);
    const ref   = this.spectra.find(s => s.id === comparison.refId);

    if (query && ref) {
      this.querySpectrum  = query; this.refSpectrum = ref;
      this.globalScore    = comparison.globalScore;
      this.compared       = true;
      this.successMessage = `Comparación restaurada: ${(comparison.globalScore * 100).toFixed(1)}%`;
      setTimeout(() => this.renderCharts(), 100);
    } else {
      this.errorMessage = 'No se pudieron encontrar los espectros';
    }
  }
}