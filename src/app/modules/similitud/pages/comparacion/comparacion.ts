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
  private origYMax: number = 1.0;

  private currentXMin: number = 400;
  private currentXMax: number = 4000;
  private currentYMin: number = -0.05;
  private currentYMax: number = 1.0;

  private selectionBox: HTMLDivElement | null = null;
  private selStartX: number = 0;
  private selStartY: number = 0;
  private isSelecting: boolean = false;

  private wheelListener: ((e: WheelEvent) => void) | null = null;
  private mouseDownListener: ((e: MouseEvent) => void) | null = null;
  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private mouseUpListener: ((e: MouseEvent) => void) | null = null;
  private mouseLeaveListener: (() => void) | null = null;
  private dblClickListener: (() => void) | null = null;

  private isDragging: boolean = false;
  private lastClientX: number = 0;

  globalScore: number = 0;
  allScores: { euclidean: number; cosine: number; pearson: number } | null = null;
  windowScores: { window: string; score: number; range: string }[] = [];
  matchedPeaks: number[] = [];
  unmatchedPeaks: number[] = [];
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
  ) {
    console.log('🚀 Constructor Comparacion ejecutado');
  }

  ngOnInit() {
    if (this.isInitialized) {
      console.log('⚠️ Componente ya inicializado');
      return;
    }

    console.log('='.repeat(70));
    console.log('📊 INICIALIZANDO COMPARACION');
    console.log('='.repeat(70));

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
        // ✅ SOLUCIÓN: Usar non-null assertion (!) después de verificar null
        if (state.querySpectrum) {
          this.querySpectrum = state.querySpectrum;
          this.queryId = this.querySpectrum!.id.toString(); // ✅ Sin error TS2531
        }

        if (state.refSpectrum) {
          this.refSpectrum = state.refSpectrum;
          this.refId = this.refSpectrum!.id.toString(); // ✅ Sin error TS2531
        }

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
        }

        this.comparisonHistory = state.comparisonHistory || [];
      });
  }

  private loadSpectraFromBackend() {
    this.isLoadingSpectra = true;
    console.log('\n' + '='.repeat(70));
    console.log('📊 CARGANDO ESPECTROS DEL BACKEND');
    console.log('='.repeat(70));

    this.espectroLoader.espectros$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (espectros) => {
          console.log(`\n✅ ESPECTROS CARGADOS: ${espectros.length} total`);
          
          if (espectros.length > 0) {
            const first = espectros[0];
            console.log(`📋 PRIMER ESPECTRO: ${first.filename}`);
            console.log(`   Wavenumbers: ${first.wavenumbers?.length || 0} elementos`);
            console.log(`   Data: ${first.data?.length || 0} elementos`);
          }
          
          this.spectra = espectros;
          this.isLoadingSpectra = false;

          if (espectros.length === 0) {
            this.errorMessage = 'No hay espectros disponibles. Carga algunos en "Cargar Espectro"';
          } else {
            this.errorMessage = '';
          }
        },
        error: (error) => {
          console.error('❌ Error conectando:', error);
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

  public renderCharts() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 RENDERIZANDO 3 GRÁFICAS');
    console.log('='.repeat(70));
    
    if (!this.querySpectrum || !this.refSpectrum) {
      console.error('❌ Espectros no disponibles');
      return;
    }

    console.log(`Query: ${this.querySpectrum.filename}`);
    console.log(`Ref: ${this.refSpectrum.filename}`);
    
    this.renderQueryChart();
    this.renderRefChart();
    
    setTimeout(() => {
      this.renderOverlayChart();
    }, 200);
  }

  private renderQueryChart() {
    const canvas = this.queryChartCanvas?.nativeElement;
    if (!canvas || !this.querySpectrum) return;

    if (this.queryChart) {
      this.queryChart.destroy();
      this.queryChart = null;
    }

    const queryWn = this.querySpectrum.wavenumbers;
    const queryData = this.querySpectrum.data;

    if (queryWn.length === 0 || queryData.length === 0) {
      console.error('❌ Sin datos para Query Chart');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log(`📊 Renderizando Query Chart: ${queryWn.length} puntos`);

    this.queryChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `Query: ${this.querySpectrum.filename}`,
            data: queryData.map((y: number, i: number) => ({ x: queryWn[i], y })),
            borderColor: '#2E75B6',
            backgroundColor: 'rgba(46, 117, 182, 0.1)',
            borderWidth: this.grosorLinea,
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: this.mostrarLeyenda,
            position: 'top',
            labels: { usePointStyle: true, padding: 15, font: { size: 11, weight: 'bold' as const } }
          },
          title: {
            display: true,
            text: 'Espectro de Consulta',
            font: { size: 13, weight: 'bold' as const }
          },
          filler: { propagate: true }
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Número de Onda (cm⁻¹)', font: { weight: 'bold' as const, size: 10 } },
            min: 400,
            max: 4000,
            grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.1)' }
          },
          y: {
            title: { display: true, text: 'Absorbancia', font: { weight: 'bold' as const, size: 10 } },
            grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.1)' }
          }
        }
      }
    });

    console.log('✅ Query Chart renderizado');
  }

  private renderRefChart() {
    const canvas = this.refChartCanvas?.nativeElement;
    if (!canvas || !this.refSpectrum) return;

    if (this.refChart) {
      this.refChart.destroy();
      this.refChart = null;
    }

    const refWn = this.refSpectrum.wavenumbers;
    const refData = this.refSpectrum.data;

    if (refWn.length === 0 || refData.length === 0) {
      console.error('❌ Sin datos para Ref Chart');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log(`📊 Renderizando Ref Chart: ${refWn.length} puntos`);

    this.refChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `Reference: ${this.refSpectrum.filename}`,
            data: refData.map((y: number, i: number) => ({ x: refWn[i], y })),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: this.grosorLinea,
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: this.mostrarLeyenda,
            position: 'top',
            labels: { usePointStyle: true, padding: 15, font: { size: 11, weight: 'bold' as const } }
          },
          title: {
            display: true,
            text: 'Espectro de Referencia',
            font: { size: 13, weight: 'bold' as const }
          },
          filler: { propagate: true }
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Número de Onda (cm⁻¹)', font: { weight: 'bold' as const, size: 10 } },
            min: 400,
            max: 4000,
            grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.1)' }
          },
          y: {
            title: { display: true, text: 'Absorbancia', font: { weight: 'bold' as const, size: 10 } },
            grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.1)' }
          }
        }
      }
    });

    console.log('✅ Ref Chart renderizado');
  }

  public renderOverlayChart() {
    const canvas = this.overlayChartCanvas?.nativeElement;
    if (!canvas || !this.querySpectrum || !this.refSpectrum) return;

    if (this.overlayChart) {
      this.overlayChart.destroy();
      this.overlayChart = null;
    }

    const queryWn = this.querySpectrum.wavenumbers;
    const queryData = this.querySpectrum.data;
    const refWn = this.refSpectrum.wavenumbers;
    const refData = this.refSpectrum.data;

    if (queryWn.length === 0 || queryData.length === 0 || refWn.length === 0 || refData.length === 0) {
      console.error('❌ Datos incompletos para Overlay');
      return;
    }

    this.currentXMin = this.origXMin;
    this.currentXMax = this.origXMax;
    this.currentYMin = this.origYMin;
    this.currentYMax = this.origYMax;
    this.isZoomed = false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log(`📊 Renderizando Overlay`);

    this.overlayChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `Query: ${this.querySpectrum.filename}`,
            data: queryData.map((y: number, i: number) => ({ x: queryWn[i], y })),
            borderColor: '#2E75B6',
            backgroundColor: 'rgba(46, 117, 182, 0.1)',
            borderWidth: this.grosorLinea,
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            spanGaps: true
          },
          {
            label: `Reference: ${this.refSpectrum.filename}`,
            data: refData.map((y: number, i: number) => ({ x: refWn[i], y })),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: this.grosorLinea,
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: this.mostrarLeyenda,
            position: 'top',
            labels: { usePointStyle: true, padding: 15, font: { size: 12, weight: 'bold' as const } }
          },
          title: {
            display: true,
            text: `Superposición (Similitud: ${(this.globalScore * 100).toFixed(1)}%)`,
            font: { size: 14, weight: 'bold' as const }
          },
          filler: { propagate: true }
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Número de Onda (cm⁻¹)', font: { weight: 'bold' as const } },
            min: this.currentXMin,
            max: this.currentXMax,
            grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.1)' }
          },
          y: {
            title: { display: true, text: 'Absorbancia', font: { weight: 'bold' as const } },
            min: this.currentYMin,
            max: this.currentYMax,
            grid: { display: this.mostrarCuadricula, color: 'rgba(0,0,0,0.1)' }
          }
        }
      }
    });

    console.log('✅ Overlay Chart renderizado');

    setTimeout(() => {
      this.enableChartInteraction();
    }, 100);
  }

  private enableChartInteraction(): void {
    const canvas = this.overlayChartCanvas?.nativeElement;
    if (!canvas) return;

    canvas.style.cursor = 'grab';

    this.wheelListener = (e: WheelEvent) => {
      e.preventDefault();
      if (this.modoSeleccion) return;
      const rect = canvas.getBoundingClientRect();
      const rawFrac = (e.clientX - rect.left) / rect.width;
      const pivotFrac = this.invertirX ? (1 - rawFrac) : rawFrac;
      this.applyZoom(e.deltaY > 0 ? 1.12 : 0.88, pivotFrac);
    };

    this.mouseDownListener = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (this.modoSeleccion) {
        this.isSelecting = true;
        this.selStartX = px;
        this.selStartY = py;
        this.createSelectionBox(canvas, px, py);
      } else {
        this.isDragging = true;
        this.lastClientX = e.clientX;
        canvas.style.cursor = 'grabbing';
      }
    };

    this.mouseMoveListener = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;

      if (this.modoSeleccion && this.isSelecting) {
        this.updateSelectionBox(this.selStartX, this.selStartY, px, e.clientY - rect.top);
        return;
      }

      if (!this.modoSeleccion && this.isDragging && this.overlayChart) {
        const xRange = this.currentXMax - this.currentXMin;
        const pxPerUnit = xRange / rect.width;
        const sign = this.invertirX ? -1 : 1;
        const delta = (e.clientX - this.lastClientX) * pxPerUnit * sign;
        this.currentXMin += delta;
        this.currentXMax += delta;
        this.writeScales();
        this.overlayChart.update('none');
        this.lastClientX = e.clientX;
        canvas.style.cursor = 'grabbing';
      } else if (!this.modoSeleccion) {
        canvas.style.cursor = 'grab';
      }
    };

    this.mouseUpListener = () => {
      if (this.isSelecting && this.overlayChart) {
        const rect = canvas.getBoundingClientRect();
        const xRange = this.currentXMax - this.currentXMin;
        const yRange = this.currentYMax - this.currentYMin;
        const area = (this.overlayChart as any).chartArea;
        const plotW = area.right - area.left;
        const plotH = area.bottom - area.top;

        const toDataX = (pix: number) => {
          const frac = (pix - area.left) / plotW;
          const f = this.invertirX ? (1 - frac) : frac;
          return this.currentXMin + f * xRange;
        };
        const toDataY = (pix: number) =>
          this.currentYMax - ((pix - area.top) / plotH) * yRange;

        if (Math.abs(this.lastClientX - this.selStartX) > 5) {
          this.applyZoomToRange(
            toDataX(this.selStartX), toDataX(this.lastClientX),
            toDataY(this.selStartY), toDataY(this.lastClientX)
          );
        }
        this.isSelecting = false;
        this.destroySelectionBox();
        this.modoSeleccion = false;
        canvas.style.cursor = 'grab';
      }
      this.isDragging = false;
    };

    this.mouseLeaveListener = () => {
      this.isDragging = false;
      this.isSelecting = false;
      this.destroySelectionBox();
      canvas.style.cursor = 'grab';
    };

    this.dblClickListener = () => { this.zoomReset(); };

    canvas.addEventListener('wheel', this.wheelListener, { passive: false });
    canvas.addEventListener('mousedown', this.mouseDownListener);
    canvas.addEventListener('mousemove', this.mouseMoveListener);
    canvas.addEventListener('mouseup', this.mouseUpListener);
    canvas.addEventListener('mouseleave', this.mouseLeaveListener);
    canvas.addEventListener('dblclick', this.dblClickListener);
  }

  private removeChartListeners(): void {
    const canvas = this.overlayChartCanvas?.nativeElement;
    if (!canvas) return;

    if (this.wheelListener) canvas.removeEventListener('wheel', this.wheelListener);
    if (this.mouseDownListener) canvas.removeEventListener('mousedown', this.mouseDownListener);
    if (this.mouseMoveListener) canvas.removeEventListener('mousemove', this.mouseMoveListener);
    if (this.mouseUpListener) canvas.removeEventListener('mouseup', this.mouseUpListener);
    if (this.mouseLeaveListener) canvas.removeEventListener('mouseleave', this.mouseLeaveListener);
    if (this.dblClickListener) canvas.removeEventListener('dblclick', this.dblClickListener);
  }

  private writeScales(): void {
    if (!this.overlayChart) return;
    (this.overlayChart.options as any).scales['x'].min = this.currentXMin;
    (this.overlayChart.options as any).scales['x'].max = this.currentXMax;
    (this.overlayChart.options as any).scales['y'].min = this.currentYMin;
    (this.overlayChart.options as any).scales['y'].max = this.currentYMax;
  }

  private applyZoom(factor: number, pivotFrac: number = 0.5): void {
    const xRange = this.currentXMax - this.currentXMin;
    const yRange = this.currentYMax - this.currentYMin;

    const newXRange = xRange * factor;
    const newYRange = yRange * factor;

    const pivotX = this.currentXMin + pivotFrac * xRange;
    const pivotY = this.currentYMin + (1 - pivotFrac) * yRange;

    this.currentXMin = pivotX - (pivotFrac * newXRange);
    this.currentXMax = pivotX + ((1 - pivotFrac) * newXRange);
    this.currentYMin = pivotY - ((1 - pivotFrac) * newYRange);
    this.currentYMax = pivotY + (pivotFrac * newYRange);

    this.isZoomed = !(
      this.currentXMin === this.origXMin &&
      this.currentXMax === this.origXMax &&
      this.currentYMin === this.origYMin &&
      this.currentYMax === this.origYMax
    );

    this.writeScales();
    if (this.overlayChart) this.overlayChart.update('none');
  }

  private applyZoomToRange(x1: number, x2: number, y1: number, y2: number): void {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    this.currentXMin = minX;
    this.currentXMax = maxX;
    this.currentYMin = minY;
    this.currentYMax = maxY;

    this.isZoomed = !(
      this.currentXMin === this.origXMin &&
      this.currentXMax === this.origXMax &&
      this.currentYMin === this.origYMin &&
      this.currentYMax === this.origYMax
    );

    this.writeScales();
    if (this.overlayChart) this.overlayChart.update('none');
  }

  private createSelectionBox(canvas: HTMLCanvasElement, x: number, y: number): void {
    this.destroySelectionBox();
    const box = document.createElement('div');
    box.id = 'comparacionSelectionBox';
    box.style.cssText = `
      position: absolute;
      border: 2px dashed #2196F3;
      background: rgba(33,150,243,0.08);
      pointer-events: none;
      z-index: 999;
      left: ${x}px; top: ${y}px;
      width: 0; height: 0;
    `;
    const container = canvas.parentElement;
    if (container) {
      container.style.position = 'relative';
      container.appendChild(box);
    }
    this.selectionBox = box;
  }

  private updateSelectionBox(startX: number, startY: number, curX: number, curY: number): void {
    if (!this.selectionBox) return;
    this.selectionBox.style.left = `${Math.min(startX, curX)}px`;
    this.selectionBox.style.top = `${Math.min(startY, curY)}px`;
    this.selectionBox.style.width = `${Math.abs(curX - startX)}px`;
    this.selectionBox.style.height = `${Math.abs(curY - startY)}px`;
    this.lastClientX = curX;
  }

  private destroySelectionBox(): void {
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
  }

  public zoomIn(): void {
    this.applyZoom(0.6);
  }

  public zoomOut(): void {
    this.applyZoom(1.6);
  }

  public zoomReset(): void {
    this.currentXMin = this.origXMin;
    this.currentXMax = this.origXMax;
    this.currentYMin = this.origYMin;
    this.currentYMax = this.origYMax;
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

  updateSelection() {
    this.errorMessage = '';
    this.successMessage = '';

    const queryIdNum = this.parseId(this.queryId);
    const refIdNum = this.parseId(this.refId);

    this.querySpectrum = this.spectra.find(s => this.parseId(s.id) === queryIdNum) || null;
    this.refSpectrum = this.spectra.find(s => this.parseId(s.id) === refIdNum) || null;

    if (this.querySpectrum) {
      this.spectrumStateService.setQuerySpectrum(this.querySpectrum);
    } else if (queryIdNum > 0) {
      this.errorMessage = `Espectro de consulta (ID ${queryIdNum}) no encontrado`;
    }

    if (this.refSpectrum) {
      this.spectrumStateService.setRefSpectrum(this.refSpectrum);
    } else if (refIdNum > 0) {
      this.errorMessage = `Espectro de referencia (ID ${refIdNum}) no encontrado`;
    }

    this.compared = false;
    this.destroyAllCharts();
    this.removeChartListeners();
  }

  private parseId(id: any): number {
    if (typeof id === 'number') return id;
    if (typeof id === 'string') {
      const parsed = parseInt(id, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  onQueryChange() {
    const queryIdNum = this.parseId(this.queryId);
    this.querySpectrum = this.spectra.find(s => this.parseId(s.id) === queryIdNum) || null;
    if (this.querySpectrum) {
      this.spectrumStateService.setQuerySpectrum(this.querySpectrum);
    }
    this.compared = false;
    this.errorMessage = '';
  }

  onRefChange() {
    const refIdNum = this.parseId(this.refId);
    this.refSpectrum = this.spectra.find(s => this.parseId(s.id) === refIdNum) || null;
    if (this.refSpectrum) {
      this.spectrumStateService.setRefSpectrum(this.refSpectrum);
    }
    this.compared = false;
    this.errorMessage = '';
  }

  compare() {
    if (!this.querySpectrum || !this.refSpectrum) {
      this.errorMessage = 'Debes seleccionar ambos espectros';
      return;
    }

    this.compareWithBackend();
  }

  private compareWithBackend() {
    this.isComparingWithBackend = true;
    this.errorMessage = '';
    this.successMessage = '';

    const queryIdNum = this.parseId(this.queryId);
    const refIdNum = this.parseId(this.refId);

    this.similarityBackendService.compareSpectra(
      queryIdNum,
      refIdNum,
      this.method,
      this.tolerance
    ).subscribe({
      next: (response: ComparisonResponse) => {
        this.handleBackendResponse(response);
        this.isComparingWithBackend = false;
      },
      error: (error: any) => {
        this.handleBackendError(error);
        this.isComparingWithBackend = false;
      }
    });
  }

  private handleBackendResponse(response: ComparisonResponse) {
    if (!response?.success || !response?.data) {
      this.errorMessage = response?.message || 'Error en respuesta del backend';
      return;
    }

    const data = response.data;
    this.globalScore = data.global_score ?? 0;
    this.allScores = data.all_scores || null;
    this.matchedPeaks = Array.isArray(data.matched_peaks) ? data.matched_peaks : [];
    this.unmatchedPeaks = Array.isArray(data.unmatched_peaks) ? data.unmatched_peaks : [];
    this.totalPeaks = data.total_peaks ?? 0;
    this.matchingPeaksCount = data.matching_peaks_count ?? 0;

    if (data.window_scores && Array.isArray(data.window_scores) && data.window_scores.length > 0) {
      this.windowScores = data.window_scores.map((w: any) => ({
        window: w.window || 'N/A',
        score: w.score ?? 0,
        range: '0-4000'
      }));
    }

    this.compared = true;
    this.successMessage = ` Similitud: ${(this.globalScore * 100).toFixed(1)}%`;

    this.spectrumStateService.setComparisonResults(data);
    this.spectrumStateService.addComparisonToHistory(
      this.parseId(this.queryId),
      this.querySpectrum!.filename,
      this.parseId(this.refId),
      this.refSpectrum!.filename,
      this.method,
      this.tolerance,
      this.globalScore
    );

    this.comparisonHistory = this.spectrumStateService.getComparisonHistory();

    setTimeout(() => {
      this.renderCharts();
    }, 100);
  }

  private handleBackendError(error: any) {
    if (error.message) {
      this.errorMessage = error.message;
    } else if (error.statusCode === 0) {
      this.errorMessage = '📡 No se pudo conectar. Backend en localhost:8000?';
    } else if (error.statusCode === 404) {
      this.errorMessage = '🔍 Espectro no encontrado';
    } else if (error.statusCode === 401) {
      this.errorMessage = 'No autenticado. Inicia sesión de nuevo';
    } else {
      this.errorMessage = 'Error en el servidor';
    }
  }

  private destroyAllCharts(): void {
    [this.queryChart, this.refChart, this.overlayChart].forEach(chart => {
      if (chart) chart.destroy();
    });
    this.queryChart = this.refChart = this.overlayChart = null;
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

  clearComparison() {
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
    this.removeChartListeners();
    this.destroyAllCharts();
    this.spectrumStateService.clearComparisonResults();
  }

  clearAllData() {
    this.spectrumStateService.clearAllSpectra();
    this.querySpectrum = null;
    this.refSpectrum = null;
    this.queryId = '';
    this.refId = '';
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
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  loadFromHistory(comparison: Comparison): void {
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
      
      setTimeout(() => {
        this.renderCharts();
      }, 100);
    } else {
      this.errorMessage = 'No se pudieron encontrar los espectros';
    }
  }
}