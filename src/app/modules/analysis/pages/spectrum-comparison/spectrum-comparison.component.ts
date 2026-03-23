/**
 * SPECTRUM COMPARISON COMPONENT
 * Zoom funcional + Zoom de selección rectangular (rubber-band)
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { Chart } from 'chart.js/auto';
import { SimilarityService, SimilarityConfig } from '../../../../core/services/similarity.service';

@Component({
  selector: 'app-spectrum-comparison',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  // ========================================
  // CONTROLES DE GRÁFICA
  // ========================================

  invertirX: boolean = false;
  mostrarCuadricula: boolean = true;
  mostrarLeyenda: boolean = true;
  grosorLinea: number = 2.5;
  suavizado: number = 0;
  isZoomed: boolean = false;
  modoSeleccion: boolean = false;

  // ========================================
  // ESTADO DE ZOOM
  // Los límites siempre en orden natural (min < max).
  // La inversión visual se maneja con reverse:true en la escala.
  // ========================================

  private currentXMin: number = 400;
  private currentXMax: number = 4000;
  private currentYMin: number = -0.05;
  private currentYMax: number = 1.0;

  private origXMin: number = 400;
  private origXMax: number = 4000;
  private origYMin: number = -0.05;
  private origYMax: number = 1.0;

  chartReference: Chart | null = null;
  chartComparison: Chart | null = null;
  chartOverlay: Chart | null = null;

  spectralOffsetAmount: number = 0.15;

  // ========================================
  // SELECCIÓN RECTANGULAR
  // ========================================

  private selectionBox: HTMLDivElement | null = null;
  private selStartX: number = 0;
  private selStartY: number = 0;
  private isSelecting: boolean = false;

  // ========================================
  // LISTENERS
  // ========================================

  private wheelListener:      ((e: WheelEvent) => void) | null = null;
  private mouseDownListener:  ((e: MouseEvent) => void) | null = null;
  private mouseMoveListener:  ((e: MouseEvent) => void) | null = null;
  private mouseUpListener:    ((e: MouseEvent) => void) | null = null;
  private mouseLeaveListener: (() => void) | null = null;
  private dblClickListener:   (() => void) | null = null;

  private isDragging: boolean = false;
  private lastClientX: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private location: Location,
    private similarityService: SimilarityService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.referenceId  = parseInt(params['referenceId']);
      this.comparisonId = parseInt(params['comparisonId']);
      this.method       = params['method'] || 'pearson';
      this.loadSpectra();
    });
  }

  ngOnDestroy(): void {
    this.removeChartListeners();
    this.destroySelectionBox();
    if (this.chartReference)  this.chartReference.destroy();
    if (this.chartComparison) this.chartComparison.destroy();
    if (this.chartOverlay)    this.chartOverlay.destroy();
  }

  // ========================================
  // CARGA DE DATOS
  // ========================================

  loadSpectra(): void {
    this.loading = true;
    this.error   = '';

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
            (error: any) => { this.error = `Error: ${error.message}`; this.loading = false; }
          );
        }
      },
      (error: any) => { this.error = `Error: ${error.message}`; this.loading = false; }
    );
  }

  private processSpectrum(spectrum: any): any {
    if (!spectrum.spectrum_data) return spectrum;
    const data = spectrum.spectrum_data;
    let intensities: number[] = data.intensities || data.absorbance || [];
    let wavenumbers: number[] = data.wavenumbers || [];
    if (!wavenumbers || wavenumbers.length === 0) {
      const step = (4000 - 400) / (intensities.length - 1);
      wavenumbers = intensities.map((_: any, i: number) => 400 + i * step);
    }
    const minLen = Math.min(wavenumbers.length, intensities.length);
    return {
      ...spectrum,
      spectrum_data: {
        wavenumbers: wavenumbers.slice(0, minLen),
        intensities: intensities.slice(0, minLen)
      }
    };
  }

  // ========================================
  // RENDER INICIAL
  // ========================================

  renderCharts(): void {
    if (this.referenceSpectrum?.spectrum_data)
      this.createSeparatedChart('chartReference',  this.referenceSpectrum,  'Espectro de Referencia', '#2196F3');
    if (this.comparisonSpectrum?.spectrum_data)
      this.createSeparatedChart('chartComparison', this.comparisonSpectrum, 'Espectro Encontrado',    '#FF6B6B');
    if (this.referenceSpectrum?.spectrum_data && this.comparisonSpectrum?.spectrum_data)
      this.createOverlayChart();
  }

  // ========================================
  // CHARTS SEPARADOS
  // Tipo 'line' con labels: la inversión se hace
  // invirtiendo el array de labels + datos.
  // ========================================

  private createSeparatedChart(canvasId: string, spectrum: any, title: string, color: string): void {
    setTimeout(() => {
      try {
        const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!ctx) return;

        const { wavenumbers, intensities } = spectrum.spectrum_data;
        if (!wavenumbers?.length) return;

        if (canvasId === 'chartReference'  && this.chartReference)  { this.chartReference.destroy();  this.chartReference  = null; }
        if (canvasId === 'chartComparison' && this.chartComparison) { this.chartComparison.destroy(); this.chartComparison = null; }

        const labels: string[] = this.invertirX
          ? [...wavenumbers].reverse().map((wn: number) => wn.toFixed(0))
          : wavenumbers.map((wn: number) => wn.toFixed(0));

        const data: number[] = this.invertirX
          ? [...intensities].reverse()
          : [...intensities];

        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: title,
              data,
              borderColor: color,
              backgroundColor: color + '1A',
              borderWidth: 2,
              tension: 0.2,
              pointRadius: 0,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: { display: true, labels: { boxWidth: 10, padding: 20, font: { size: 12 } } },
              title:  { display: true, text: title, font: { size: 14, weight: 'bold' } }
            },
            scales: {
              x: {
                title: { display: true, text: 'Wavenumber (cm⁻¹)', font: { size: 12 } },
                ticks: { maxTicksLimit: 12 }
              },
              y: {
                title: { display: true, text: 'Absorbance', font: { size: 12 } },
                beginAtZero: true
              }
            },
            layout: { padding: { left: 8, right: 16, top: 8, bottom: 8 } }
          }
        });

        if (canvasId === 'chartReference')  this.chartReference  = chart;
        else                                this.chartComparison = chart;

      } catch (err) { console.error(`Error en ${canvasId}:`, err); }
    }, 100);
  }

  // ========================================
  // CHART SUPERPUESTO
  // ========================================

  private createOverlayChart(): void {
    setTimeout(() => {
      try {
        const ctx = document.getElementById('chartOverlay') as HTMLCanvasElement;
        if (!ctx) return;

        const { datasets, xMin, xMax, yMin, yMax } = this.buildOverlayDatasets();

        this.origXMin    = this.currentXMin = xMin;
        this.origXMax    = this.currentXMax = xMax;
        this.origYMin    = this.currentYMin = yMin;
        this.origYMax    = this.currentYMax = yMax;

        if (this.chartOverlay) { this.chartOverlay.destroy(); this.chartOverlay = null; }
        this.removeChartListeners();

        this.chartOverlay = new Chart(ctx, {
          type: 'scatter',
          data: { datasets },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                display: this.mostrarLeyenda,
                position: 'top',
                labels: { boxWidth: 15, padding: 20, font: { size: 13, weight: 'bold' } }
              },
              title: {
                display: true,
                text: 'Comparación Superpuesta de Espectros FTIR',
                font: { size: 16, weight: 'bold' }
              },
              tooltip: {
                enabled: true,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: 12,
                titleFont: { size: 12, weight: 'bold' }
              }
            },
            scales: {
              x: {
                type: 'linear',
                position: 'bottom',
                min: xMin,
                max: xMax,
                // CLAVE: reverse:true invierte visualmente el eje en Chart.js
                reverse: this.invertirX,
                title: { display: true, text: 'Wavenumber (cm⁻¹)', font: { size: 12, weight: 'bold' } },
                grid:  { color: this.mostrarCuadricula ? 'rgba(200,200,200,0.15)' : 'rgba(0,0,0,0)' }
              },
              y: {
                min: yMin,
                max: yMax,
                title: { display: true, text: 'Absorbance (con offset visual)', font: { size: 12, weight: 'bold' } },
                grid:  { color: this.mostrarCuadricula ? 'rgba(200,200,200,0.15)' : 'rgba(0,0,0,0)' }
              }
            }
          }
        });

        this.enableChartInteraction();

      } catch (err) {
        console.error('Error creando overlay:', err);
        this.error = `Error: ${err instanceof Error ? err.message : 'Unknown'}`;
      }
    }, 150);
  }

  private buildOverlayDatasets(): {
    datasets: any[];
    xMin: number; xMax: number;
    yMin: number; yMax: number;
  } {
    const refData  = this.referenceSpectrum.spectrum_data;
    const compData = this.comparisonSpectrum.spectrum_data;

    const refWn:   number[] = refData.wavenumbers  || [];
    const refInt:  number[] = refData.intensities  || [];
    const compWn:  number[] = compData.wavenumbers || [];
    const compInt: number[] = compData.intensities || [];

    const compIntOffset = compInt.map((v: number) => v + this.spectralOffsetAmount);
    const allInt = [...refInt, ...compIntOffset];

    // Los límites siempre en orden natural; reverse:true se ocupa del sentido visual
    const xMin = Math.min(...refWn, ...compWn);
    const xMax = Math.max(...refWn, ...compWn);
    const yMin = Math.min(...allInt) - 0.05;
    const yMax = Math.max(...allInt) + 0.05;

    return {
      datasets: [
        {
          label: 'Espectro de Referencia',
          data: refWn.map((wn: number, i: number) => ({ x: wn, y: refInt[i] })),
          borderColor: '#2196F3', backgroundColor: 'transparent',
          borderWidth: this.grosorLinea, pointRadius: 0,
          fill: false, showLine: true, tension: this.suavizado / 10
        },
        {
          label: 'Espectro Encontrado',
          data: compWn.map((wn: number, i: number) => ({ x: wn, y: compIntOffset[i] })),
          borderColor: '#FF6B6B', backgroundColor: 'transparent',
          borderWidth: this.grosorLinea, pointRadius: 0,
          fill: false, showLine: true, tension: this.suavizado / 10
        }
      ],
      xMin,
      xMax,
      yMin,
      yMax
    };
  }

  // ========================================
  // ACTUALIZAR OPCIONES SIN RECREAR EL CHART
  // ========================================

  updateOverlayChart(): void {
    if (!this.chartOverlay) return;
    const gridColor = this.mostrarCuadricula ? 'rgba(200,200,200,0.15)' : 'rgba(0,0,0,0)';
    (this.chartOverlay.options as any).plugins.legend.display = this.mostrarLeyenda;
    (this.chartOverlay.options as any).scales['x'].grid.color = gridColor;
    (this.chartOverlay.options as any).scales['y'].grid.color = gridColor;
    this.chartOverlay.data.datasets.forEach(ds => {
      (ds as any).borderWidth = this.grosorLinea;
      (ds as any).tension     = this.suavizado / 10;
    });
    this.chartOverlay.update('none');
  }

  // ========================================
  // INVERTIR EJE X
  // ========================================

  /**
   * Overlay  → toggle de reverse en options.scales.x + update('none').
   *            Los datos y límites no cambian.
   * Separados → recrear con labels/datos en orden invertido
   *            (tipo 'line' con categorías no tiene reverse nativo).
   */
  onInvertirXChange(): void {
    // --- Overlay ---
    if (this.chartOverlay) {
      (this.chartOverlay.options as any).scales['x'].reverse = this.invertirX;
      this.chartOverlay.update('none');
    }

    // --- Charts separados ---
    if (this.referenceSpectrum?.spectrum_data)
      this.createSeparatedChart('chartReference',  this.referenceSpectrum,  'Espectro de Referencia', '#2196F3');
    if (this.comparisonSpectrum?.spectrum_data)
      this.createSeparatedChart('chartComparison', this.comparisonSpectrum, 'Espectro Encontrado',    '#FF6B6B');
  }

  // ========================================
  // MODO SELECCIÓN
  // ========================================

  toggleModoSeleccion(): void {
    this.modoSeleccion = !this.modoSeleccion;
    const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (canvas) canvas.style.cursor = this.modoSeleccion ? 'crosshair' : 'grab';
    if (!this.modoSeleccion) this.destroySelectionBox();
  }

  // ========================================
  // ZOOM
  // Los límites siempre en orden natural (min < max).
  // reverse:true se encarga de la dirección visual.
  // ========================================

  private applyZoom(factor: number, pivotFrac: number = 0.5): void {
    if (!this.chartOverlay) return;

    // Si el eje está invertido, el pivote visual está al revés
    const effectivePivot = this.invertirX ? (1 - pivotFrac) : pivotFrac;

    const xRange    = this.currentXMax - this.currentXMin;
    const yRange    = this.currentYMax - this.currentYMin;
    const pivot     = this.currentXMin + effectivePivot * xRange;
    const newXRange = xRange * factor;
    const newYRange = yRange * factor;

    this.currentXMin = pivot - effectivePivot * newXRange;
    this.currentXMax = pivot + (1 - effectivePivot) * newXRange;

    const yCtr       = (this.currentYMin + this.currentYMax) / 2;
    this.currentYMin = yCtr - newYRange / 2;
    this.currentYMax = yCtr + newYRange / 2;

    this.writeScales();
    this.isZoomed = true;
    this.chartOverlay.update('none');
  }

  private applyZoomToRange(x1: number, x2: number, y1: number, y2: number): void {
    if (!this.chartOverlay) return;
    // Los límites siempre en orden natural
    this.currentXMin = Math.min(x1, x2);
    this.currentXMax = Math.max(x1, x2);
    this.currentYMin = Math.min(y1, y2);
    this.currentYMax = Math.max(y1, y2);
    this.writeScales();
    this.isZoomed = true;
    this.chartOverlay.update('none');
  }

  private writeScales(): void {
    if (!this.chartOverlay) return;
    (this.chartOverlay.options as any).scales['x'].min = this.currentXMin;
    (this.chartOverlay.options as any).scales['x'].max = this.currentXMax;
    (this.chartOverlay.options as any).scales['y'].min = this.currentYMin;
    (this.chartOverlay.options as any).scales['y'].max = this.currentYMax;
  }

  zoomIn(): void  { this.applyZoom(0.6);  this.successMessage = 'Zoom in activado'; }
  zoomOut(): void { this.applyZoom(1.6);  this.successMessage = 'Zoom out activado'; }

  zoomReset(): void {
    if (!this.chartOverlay) return;
    this.currentXMin = this.origXMin;
    this.currentXMax = this.origXMax;
    this.currentYMin = this.origYMin;
    this.currentYMax = this.origYMax;
    this.writeScales();
    this.isZoomed      = false;
    this.modoSeleccion = false;
    const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (canvas) canvas.style.cursor = 'grab';
    this.chartOverlay.update('none');
    this.successMessage = 'Zoom reseteado';
  }

  // ========================================
  // INTERACCIÓN CON EL CANVAS
  // ========================================

  private enableChartInteraction(): void {
    const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (!canvas) return;

    canvas.style.cursor = 'grab';

    this.wheelListener = (e: WheelEvent) => {
      e.preventDefault();
      if (this.modoSeleccion) return;
      const rect  = canvas.getBoundingClientRect();
      // El pivote visual se invierte cuando reverse:true está activo
      const rawFrac   = (e.clientX - rect.left) / rect.width;
      const pivotFrac = this.invertirX ? (1 - rawFrac) : rawFrac;
      this.applyZoom(e.deltaY > 0 ? 1.12 : 0.88, pivotFrac);
    };

    this.mouseDownListener = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (this.modoSeleccion) {
        this.isSelecting = true;
        this.selStartX   = px;
        this.selStartY   = py;
        this.createSelectionBox(canvas, px, py);
      } else {
        this.isDragging  = true;
        this.lastClientX = e.clientX;
        canvas.style.cursor = 'grabbing';
      }
    };

    this.mouseMoveListener = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (this.modoSeleccion && this.isSelecting) {
        this.updateSelectionBox(this.selStartX, this.selStartY, px, py);
        return;
      }

      if (!this.modoSeleccion && this.isDragging && this.chartOverlay) {
        const xRange    = this.currentXMax - this.currentXMin;
        const pxPerUnit = xRange / rect.width;
        // Si el eje está invertido, arrastrar a la derecha debe mover hacia valores menores
        const sign  = this.invertirX ? -1 : 1;
        const delta = (e.clientX - this.lastClientX) * pxPerUnit * sign;
        this.currentXMin -= delta;
        this.currentXMax -= delta;
        this.lastClientX  = e.clientX;
        (this.chartOverlay.options as any).scales['x'].min = this.currentXMin;
        (this.chartOverlay.options as any).scales['x'].max = this.currentXMax;
        this.chartOverlay.update('none');
      }
    };

    this.mouseUpListener = (e: MouseEvent) => {
      if (this.modoSeleccion && this.isSelecting) {
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        const xRange = this.currentXMax - this.currentXMin;
        const yRange = this.currentYMax - this.currentYMin;
        const area   = (this.chartOverlay as any).chartArea;
        const plotW  = area.right  - area.left;
        const plotH  = area.bottom - area.top;

        // toDataX tiene en cuenta si el eje está invertido
        const toDataX = (pix: number) => {
          const frac = (pix - area.left) / plotW;
          const f    = this.invertirX ? (1 - frac) : frac;
          return this.currentXMin + f * xRange;
        };
        const toDataY = (pix: number) =>
          this.currentYMax - ((pix - area.top) / plotH) * yRange;

        if (Math.abs(px - this.selStartX) > 5 && Math.abs(py - this.selStartY) > 5) {
          this.applyZoomToRange(
            toDataX(this.selStartX), toDataX(px),
            toDataY(this.selStartY), toDataY(py)
          );
        }
        this.isSelecting   = false;
        this.destroySelectionBox();
        this.modoSeleccion = false;
        canvas.style.cursor = 'grab';
      }
      this.isDragging = false;
      if (!this.modoSeleccion) canvas.style.cursor = 'grab';
    };

    this.mouseLeaveListener = () => {
      this.isDragging  = false;
      this.isSelecting = false;
      this.destroySelectionBox();
      if (!this.modoSeleccion) canvas.style.cursor = 'grab';
    };

    this.dblClickListener = () => { this.zoomReset(); };

    canvas.addEventListener('wheel',      this.wheelListener,      { passive: false });
    canvas.addEventListener('mousedown',  this.mouseDownListener);
    canvas.addEventListener('mousemove',  this.mouseMoveListener);
    canvas.addEventListener('mouseup',    this.mouseUpListener);
    canvas.addEventListener('mouseleave', this.mouseLeaveListener);
    canvas.addEventListener('dblclick',   this.dblClickListener);
  }

  // ========================================
  // RECTÁNGULO DE SELECCIÓN
  // ========================================

  private createSelectionBox(canvas: HTMLCanvasElement, x: number, y: number): void {
    this.destroySelectionBox();
    const box = document.createElement('div');
    box.id = 'spectrumSelectionBox';
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
    if (container) { container.style.position = 'relative'; container.appendChild(box); }
    this.selectionBox = box;
  }

  private updateSelectionBox(startX: number, startY: number, curX: number, curY: number): void {
    if (!this.selectionBox) return;
    this.selectionBox.style.left   = `${Math.min(startX, curX)}px`;
    this.selectionBox.style.top    = `${Math.min(startY, curY)}px`;
    this.selectionBox.style.width  = `${Math.abs(curX - startX)}px`;
    this.selectionBox.style.height = `${Math.abs(curY - startY)}px`;
  }

  private destroySelectionBox(): void {
    if (this.selectionBox) { this.selectionBox.remove(); this.selectionBox = null; }
  }

  // ========================================
  // LIMPIEZA DE LISTENERS
  // ========================================

  private removeChartListeners(): void {
    const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (!canvas) return;
    if (this.wheelListener)      { canvas.removeEventListener('wheel',      this.wheelListener);      this.wheelListener      = null; }
    if (this.mouseDownListener)  { canvas.removeEventListener('mousedown',  this.mouseDownListener);  this.mouseDownListener  = null; }
    if (this.mouseMoveListener)  { canvas.removeEventListener('mousemove',  this.mouseMoveListener);  this.mouseMoveListener  = null; }
    if (this.mouseUpListener)    { canvas.removeEventListener('mouseup',    this.mouseUpListener);    this.mouseUpListener    = null; }
    if (this.mouseLeaveListener) { canvas.removeEventListener('mouseleave', this.mouseLeaveListener); this.mouseLeaveListener = null; }
    if (this.dblClickListener)   { canvas.removeEventListener('dblclick',   this.dblClickListener);   this.dblClickListener   = null; }
  }

  // ========================================
  // DESCARGAS
  // ========================================

  downloadPNG(): void {
    const el = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (!el) return;
    const link = document.createElement('a');
    link.href     = el.toDataURL('image/png');
    link.download = `comparacion_espectros_${new Date().toISOString().split('T')[0]}.png`;
    link.click();
    this.successMessage = 'Gráfica descargada como PNG';
  }

  downloadComparison(): void {
    const data = {
      reference:        { filename: this.referenceSpectrum?.filename,  family: this.referenceSpectrum?.family,  source: this.referenceSpectrum?.source },
      comparison:       { filename: this.comparisonSpectrum?.filename, family: this.comparisonSpectrum?.family, source: this.comparisonSpectrum?.source },
      method:           this.method,
      similarity_score: this.similarityScore,
      matched_peaks:    this.matchedPeaks.length,
      total_peaks:      this.totalPeaks,
      tolerance:        this.tolerance,
      timestamp:        new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `comparison_${this.referenceId}_vs_${this.comparisonId}.json`;
    a.click(); window.URL.revokeObjectURL(url);
    this.successMessage = 'Comparación descargada como JSON';
  }

  // ========================================
  // SIMILITUD
  // ========================================

  calculateSimilarity(): void {
    this.calculating = true;
    try {
      if (!this.validateData()) { this.calculating = false; return; }
      const refData  = this.referenceSpectrum.spectrum_data;
      const compData = this.comparisonSpectrum.spectrum_data;
      const config: SimilarityConfig = {
        method: this.method as 'cosine' | 'pearson' | 'euclidean',
        tolerance: this.tolerance, rangeMin: 400, rangeMax: 4000,
        familyFilter: null, topN: 1, useWindows: true, selectedWindows: []
      };
      this.similarityScore = this.similarityService.calculateSimilarity(
        refData.wavenumbers, refData.intensities,
        compData.wavenumbers, compData.intensities, config
      );
      const refPeaks  = this.similarityService.detectPeaks(refData.wavenumbers,  refData.intensities);
      const compPeaks = this.similarityService.detectPeaks(compData.wavenumbers, compData.intensities);
      const peakMatch = this.similarityService.matchPeaksWithTolerance(refPeaks, compPeaks, this.tolerance);
      this.matchedPeaks = peakMatch.matched; this.unmatchedPeaks = peakMatch.unmatched; this.totalPeaks = peakMatch.total;
      this.successMessage = `Similitud: ${(this.similarityScore * 100).toFixed(1)}%`;
    } catch (err) {
      this.error = `Error: ${err instanceof Error ? err.message : 'Unknown'}`;
    } finally { this.calculating = false; }
  }

  private validateData(): boolean {
    if (!this.referenceSpectrum?.spectrum_data?.wavenumbers?.length)  { this.error = 'Espectro de referencia inválido';  return false; }
    if (!this.comparisonSpectrum?.spectrum_data?.wavenumbers?.length) { this.error = 'Espectro de comparación inválido'; return false; }
    return true;
  }

  getScorePercent(score: number): string { return (score * 100).toFixed(1); }
  getScoreClass(score: number): string {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  goBack(): void { this.location.back(); }
}