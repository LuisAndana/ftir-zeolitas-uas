/**
 * SPECTRUM COMPARISON COMPONENT - ✅ COMPLETAMENTE ACTUALIZADO
 * Carga gráficas correctamente usando el nuevo endpoint /spectrum-for-comparison/{id}
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { Chart } from 'chart.js/auto';
import { SimilarityService, SimilarityConfig } from '../../../../core/services/similarity.service';
import { SpectrumStateService } from '../../../../core/services/spectrum-state.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-spectrum-comparison',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './spectrum-comparison.component.html',
  styleUrls: ['./spectrum-comparison.component.css']
})
export class SpectrumComparisonComponent implements OnInit, OnDestroy {

  private readonly MIN_WAVENUMBER = 400;
  private readonly MAX_WAVENUMBER = 4000;

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

  private wheelListener: ((e: WheelEvent) => void) | null = null;
  private mouseDownListener: ((e: MouseEvent) => void) | null = null;
  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private mouseUpListener: ((e: MouseEvent) => void) | null = null;
  private mouseLeaveListener: (() => void) | null = null;
  private dblClickListener: (() => void) | null = null;

  private isDragging: boolean = false;
  private lastClientX: number = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private location: Location,
    private similarityService: SimilarityService,
    private spectrumStateService: SpectrumStateService
  ) {}

  ngOnInit(): void {
    console.log('🚀 Spectrum Comparison Component iniciado');
    
    // ✅ PRIMERO: Intenta cargar desde SpectrumStateService
    this.loadSpectraFromState();

    // ✅ SEGUNDO: Obtiene parámetros de ruta
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        // ✅ CORRECCIÓN: queryId PRIMERO, referenceId SEGUNDO
        this.referenceId = parseInt(params['queryId']);
        this.comparisonId = parseInt(params['referenceId']);
        this.method = params['method'] || 'pearson';

        console.log('📍 Route params:', {
          queryId: this.referenceId,
          referenceId: this.comparisonId,
          method: this.method
        });

        // ✅ Si no tiene datos del state, carga desde backend
        if (!this.referenceSpectrum || !this.comparisonSpectrum) {
          console.log('⚠️ No hay datos en State, cargando desde backend...');
          this.loadSpectra();
        } else {
          console.log('✅ Usando espectros del State Service');
          this.loading = false;
          setTimeout(() => {
            this.renderCharts();
            this.calculateSimilarity();
          }, 100);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.removeChartListeners();
    this.destroySelectionBox();
    if (this.chartReference) this.chartReference.destroy();
    if (this.chartComparison) this.chartComparison.destroy();
    if (this.chartOverlay) this.chartOverlay.destroy();
  }

  // ========================================
  // ✅ CARGAR DESDE STATE SERVICE
  // ========================================

  private loadSpectraFromState(): void {
    console.log('📦 Intentando cargar espectros desde SpectrumStateService...');
    
    this.spectrumStateService
      .getSpectrumState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.querySpectrum && state.refSpectrum) {
          console.log('✅ Espectros encontrados en State');
          
          this.referenceSpectrum = this.processSpectrum(state.querySpectrum);
          this.comparisonSpectrum = this.processSpectrum(state.refSpectrum);
          
          console.log('✓ Espectro de referencia procesado:', this.referenceSpectrum);
          console.log('✓ Espectro de comparación procesado:', this.comparisonSpectrum);
        }
      });
  }

  // ========================================
  // AUTENTICACIÓN
  // ========================================

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('⚠️ No hay token de autenticación en localStorage');
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    });
  }

  // ========================================
  // CARGA DE DATOS DESDE BACKEND
  // ========================================

  loadSpectra(): void {
    this.loading = true;
    this.error = '';

    console.log('📡 Cargando espectros desde backend...');
    console.log('  Reference ID:', this.referenceId);
    console.log('  Comparison ID:', this.comparisonId);

    const headers = this.getAuthHeaders();

    // ✅ USAR NUEVO ENDPOINT QUE BUSCA EN AMBAS BDs
    this.http.get(`http://localhost:8000/api/similarity/spectrum-for-comparison/${this.referenceId}`, { headers })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('✅ Respuesta de referencia recibida');

          if (response.success && response.spectrum) {
            this.referenceSpectrum = this.processSpectrum(response.spectrum);
            console.log('✓ Espectro de referencia procesado:', this.referenceSpectrum);

            // ✅ CARGAR ESPECTRO DE COMPARACIÓN CON NUEVO ENDPOINT
            this.http.get(`http://localhost:8000/api/similarity/spectrum-for-comparison/${this.comparisonId}`, { headers })
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (compResponse: any) => {
                  console.log('✅ Respuesta de comparación recibida');

                  if (compResponse.success && compResponse.spectrum) {
                    this.comparisonSpectrum = this.processSpectrum(compResponse.spectrum);
                    console.log('✓ Espectro de comparación procesado:', this.comparisonSpectrum);
                    
                    this.loading = false;
                    setTimeout(() => {
                      this.renderCharts();
                      this.calculateSimilarity();
                    }, 100);
                  }
                },
                error: (error: any) => {
                  console.error('❌ Error cargando comparación:', error);
                  this.error = `❌ Error: ${error.message}`;
                  this.loading = false;
                }
              });
          }
        },
        error: (error: any) => {
          console.error('❌ Error cargando referencia:', error);
          this.error = `❌ Error: ${error.message}`;
          this.loading = false;
        }
      });
  }

  // ========================================
  // ✅ PROCESAR ESPECTRO - OPTIMIZADO
  // ========================================

  private processSpectrum(spectrum: any): any {
    console.log('🔍 Processing spectrum:', spectrum);

    if (!spectrum) {
      console.error('❌ Espectro es null/undefined');
      return null;
    }

    // ========================================
    // CASO 1: Estructura con spectrum_data (dataset correcto)
    // ========================================
    if (spectrum.spectrum_data && typeof spectrum.spectrum_data === 'object') {
      console.log('📊 Caso 1: spectrum_data como objeto');

      const data = spectrum.spectrum_data;
      let intensities: number[] = data.intensities || data.absorbance || [];
      let wavenumbers: number[] = data.wavenumbers || [];

      console.log(`  Wavenumbers: ${wavenumbers.length}, Intensities: ${intensities.length}`);

      if (!wavenumbers || wavenumbers.length === 0) {
        const step = (this.MAX_WAVENUMBER - this.MIN_WAVENUMBER) / (Math.max(intensities.length - 1, 1));
        wavenumbers = intensities.map((_: any, i: number) => this.MIN_WAVENUMBER + i * step);
        console.log(`  Wavenumbers generados: ${wavenumbers.length}`);
      }

      if (intensities.length > 0) {
        const minLen = Math.min(wavenumbers.length, intensities.length);
        const processed = {
          filename: spectrum.sample_code || spectrum.filename || 'Unknown',
          source: spectrum.source || 'dataset',
          family: spectrum.zeolite_name || spectrum.family || 'N/A',
          equipment: spectrum.equipment || 'N/A',
          spectrum_data: {
            wavenumbers: wavenumbers.slice(0, minLen),
            intensities: intensities.slice(0, minLen)
          }
        };
        console.log('✓ Caso 1: Espectro procesado correctamente');
        console.log(`  Final: ${processed.spectrum_data.wavenumbers.length} puntos`);
        return processed;
      }

      console.warn('⚠️ Caso 1: spectrum_data vacío, continuando búsqueda...');
    }

    // ========================================
    // CASO 2: Array directo en wavenumber_data
    // ========================================
    if (Array.isArray(spectrum.wavenumber_data)) {
      console.log('👤 Caso 2: wavenumber_data como array directo');

      const intensities: number[] = spectrum.wavenumber_data;
      const wavenumbers: number[] = intensities.map((_, i) => this.MIN_WAVENUMBER + (i * (this.MAX_WAVENUMBER - this.MIN_WAVENUMBER)) / Math.max(intensities.length, 1));
      const minLen = Math.min(wavenumbers.length, intensities.length);

      console.log(`  Final: ${minLen} puntos`);
      return {
        filename: spectrum.filename || 'Unknown',
        source: 'user_database',
        family: spectrum.material || spectrum.family || 'N/A',
        equipment: spectrum.equipment || spectrum.technique || 'N/A',
        spectrum_data: {
          wavenumbers: wavenumbers.slice(0, minLen),
          intensities: intensities.slice(0, minLen)
        }
      };
    }

    // ========================================
    // CASO 3: Objeto en wavenumber_data con sub-propiedades
    // (también maneja JSON string almacenado desde el backend)
    // ========================================
    if (spectrum.wavenumber_data != null) {
      console.log('📦 Caso 3: wavenumber_data como objeto/string');

      let wavedata: any = spectrum.wavenumber_data;

      if (typeof wavedata === 'string') {
        try {
          wavedata = JSON.parse(wavedata);
          console.log('  JSON parseado correctamente');
        } catch (e: any) {
          console.warn('  ⚠️ Error parseando wavenumber_data como JSON:', e?.message || e);
          wavedata = null;
        }
      }

      if (wavedata && typeof wavedata === 'object') {
        let intensities: number[] = wavedata.intensities || wavedata.absorbance || wavedata.data || [];
        let wavenumbers: number[] = wavedata.wavenumbers || wavedata.wavenumber || [];

        console.log(`  Wavenumbers: ${wavenumbers.length}, Intensities: ${intensities.length}`);

        if (!wavenumbers || wavenumbers.length === 0) {
          const step = (this.MAX_WAVENUMBER - this.MIN_WAVENUMBER) / (Math.max(intensities.length - 1, 1));
          wavenumbers = intensities.map((_: any, i: number) => this.MIN_WAVENUMBER + i * step);
        }

        if (intensities.length > 0) {
          const minLen = Math.min(wavenumbers.length, intensities.length);
          console.log(`  Final: ${minLen} puntos`);
          return {
            filename: spectrum.filename || 'Unknown',
            source: 'user_database',
            family: spectrum.material || spectrum.family || 'N/A',
            equipment: spectrum.equipment || spectrum.technique || 'N/A',
            spectrum_data: {
              wavenumbers: wavenumbers.slice(0, minLen),
              intensities: intensities.slice(0, minLen)
            }
          };
        }
      }

      console.warn('⚠️ Caso 3: sin datos válidos en wavenumber_data, continuando búsqueda...');
    }

    // ========================================
    // CASO 4: Búsqueda robusta en propiedades raíz
    // ========================================
    console.log('🔎 Caso 4: Búsqueda en propiedades raíz');
    console.log('  spectrum.wavenumber_data:', spectrum.wavenumber_data);
    console.log('  spectrum.intensities:', Array.isArray(spectrum.intensities) ? `array[${spectrum.intensities.length}]` : spectrum.intensities);
    console.log('  spectrum.data:', Array.isArray(spectrum.data) ? `array[${spectrum.data.length}]` : spectrum.data);
    console.log('  spectrum.absorbance:', Array.isArray(spectrum.absorbance) ? `array[${spectrum.absorbance.length}]` : spectrum.absorbance);

    const intensities: number[] = spectrum.intensities || spectrum.data || spectrum.absorbance || [];
    let wavenumbers: number[] = spectrum.wavenumbers || spectrum.wavenumber || [];

    if (intensities.length === 0) {
      // Returning null signals the caller to invoke loadSpectra() and fetch
      // the full spectrum data from the /spectrum-for-comparison/{id} endpoint.
      console.warn('❌ Caso 4: Sin datos de intensidad en ninguna propiedad. Se cargará desde backend.');
      return null;
    }

    if (!wavenumbers || wavenumbers.length === 0) {
      const step = (this.MAX_WAVENUMBER - this.MIN_WAVENUMBER) / (Math.max(intensities.length - 1, 1));
      wavenumbers = intensities.map((_: any, i: number) => this.MIN_WAVENUMBER + i * step);
    }

    const minLen = Math.min(wavenumbers.length, intensities.length);

    console.log(`✓ Caso 4: Datos encontrados en propiedades raíz (${minLen} puntos)`);
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
    console.log('🎨 Renderizando gráficas...');
    console.log('  Reference valid:', !!this.referenceSpectrum?.spectrum_data?.wavenumbers?.length);
    console.log('  Comparison valid:', !!this.comparisonSpectrum?.spectrum_data?.wavenumbers?.length);
    
    if (this.referenceSpectrum?.spectrum_data?.wavenumbers?.length) {
      this.createSeparatedChart('chartReference', this.referenceSpectrum, 'Espectro de Referencia', '#2196F3');
    }

    if (this.comparisonSpectrum?.spectrum_data?.wavenumbers?.length) {
      this.createSeparatedChart('chartComparison', this.comparisonSpectrum, 'Espectro Encontrado', '#FF6B6B');
    }

    if (this.referenceSpectrum?.spectrum_data?.wavenumbers?.length && 
        this.comparisonSpectrum?.spectrum_data?.wavenumbers?.length) {
      this.createOverlayChart();
    }
  }

  // ========================================
  // CHARTS SEPARADOS
  // ========================================

  private createSeparatedChart(canvasId: string, spectrum: any, title: string, color: string): void {
    setTimeout(() => {
      try {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
          console.error(`Canvas not found: ${canvasId}`);
          return;
        }

        const { wavenumbers, intensities } = spectrum.spectrum_data;
        if (!wavenumbers?.length) {
          console.error(`No wavenumbers en ${canvasId}`);
          return;
        }

        if (canvasId === 'chartReference' && this.chartReference) {
          this.chartReference.destroy();
          this.chartReference = null;
        } else if (canvasId === 'chartComparison' && this.chartComparison) {
          this.chartComparison.destroy();
          this.chartComparison = null;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

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
              borderWidth: this.grosorLinea,
              tension: this.suavizado / 10,
              pointRadius: 0,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: { display: this.mostrarLeyenda, labels: { boxWidth: 10, padding: 20, font: { size: 12 } } },
              title: { display: true, text: title, font: { size: 14, weight: 'bold' } }
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

        if (canvasId === 'chartReference') this.chartReference = chart;
        else this.chartComparison = chart;

        console.log(`✅ ${canvasId} renderizado: ${wavenumbers.length} puntos`);

      } catch (err) {
        console.error(`Error en ${canvasId}:`, err);
        this.error = `Error renderizando gráfica: ${err}`;
      }
    }, 50);
  }

  // ========================================
  // CHART SUPERPUESTO
  // ========================================

  private createOverlayChart(): void {
    setTimeout(() => {
      try {
        const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
        if (!canvas) {
          console.error('Canvas chartOverlay not found');
          return;
        }

        const { datasets, xMin, xMax, yMin, yMax } = this.buildOverlayDatasets();

        this.origXMin = this.currentXMin = xMin;
        this.origXMax = this.currentXMax = xMax;
        this.origYMin = this.currentYMin = yMin;
        this.origYMax = this.currentYMax = yMax;

        if (this.chartOverlay) {
          this.chartOverlay.destroy();
          this.chartOverlay = null;
        }
        this.removeChartListeners();

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

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
                padding: 12
              }
            },
            scales: {
              x: {
                type: 'linear',
                position: 'bottom',
                min: xMin,
                max: xMax,
                reverse: this.invertirX,
                title: { display: true, text: 'Wavenumber (cm⁻¹)', font: { size: 12, weight: 'bold' } },
                grid: { color: this.mostrarCuadricula ? 'rgba(200,200,200,0.15)' : 'rgba(0,0,0,0)' }
              },
              y: {
                min: yMin,
                max: yMax,
                title: { display: true, text: 'Absorbance', font: { size: 12, weight: 'bold' } },
                grid: { color: this.mostrarCuadricula ? 'rgba(200,200,200,0.15)' : 'rgba(0,0,0,0)' }
              }
            }
          }
        });

        this.enableChartInteraction();
        console.log('✅ Overlay chart renderizado');

      } catch (err) {
        console.error('Error creando overlay:', err);
        this.error = `Error: ${err}`;
      }
    }, 100);
  }

  private buildOverlayDatasets(): {
    datasets: any[];
    xMin: number; xMax: number;
    yMin: number; yMax: number;
  } {
    const refData = this.referenceSpectrum.spectrum_data;
    const compData = this.comparisonSpectrum.spectrum_data;

    const refWn: number[] = refData.wavenumbers || [];
    const refInt: number[] = refData.intensities || [];
    const compWn: number[] = compData.wavenumbers || [];
    const compInt: number[] = compData.intensities || [];

    const compIntOffset = compInt.map((v: number) => v + this.spectralOffsetAmount);
    const allInt = [...refInt, ...compIntOffset];

    const xMin = Math.min(...refWn, ...compWn);
    const xMax = Math.max(...refWn, ...compWn);
    const yMin = Math.min(...allInt) - 0.05;
    const yMax = Math.max(...allInt) + 0.05;

    return {
      datasets: [
        {
          label: 'Espectro de Referencia',
          data: refWn.map((wn: number, i: number) => ({ x: wn, y: refInt[i] })),
          borderColor: '#2196F3',
          backgroundColor: 'transparent',
          borderWidth: this.grosorLinea,
          pointRadius: 0,
          fill: false,
          showLine: true,
          tension: this.suavizado / 10
        },
        {
          label: 'Espectro Encontrado',
          data: compWn.map((wn: number, i: number) => ({ x: wn, y: compIntOffset[i] })),
          borderColor: '#FF6B6B',
          backgroundColor: 'transparent',
          borderWidth: this.grosorLinea,
          pointRadius: 0,
          fill: false,
          showLine: true,
          tension: this.suavizado / 10
        }
      ],
      xMin,
      xMax,
      yMin,
      yMax
    };
  }

  updateOverlayChart(): void {
    if (!this.chartOverlay) return;
    const gridColor = this.mostrarCuadricula ? 'rgba(200,200,200,0.15)' : 'rgba(0,0,0,0)';
    (this.chartOverlay.options as any).plugins.legend.display = this.mostrarLeyenda;
    (this.chartOverlay.options as any).scales['x'].grid.color = gridColor;
    (this.chartOverlay.options as any).scales['y'].grid.color = gridColor;
    this.chartOverlay.data.datasets.forEach(ds => {
      (ds as any).borderWidth = this.grosorLinea;
      (ds as any).tension = this.suavizado / 10;
    });
    this.chartOverlay.update('none');
  }

  onInvertirXChange(): void {
    if (this.chartOverlay) {
      (this.chartOverlay.options as any).scales['x'].reverse = this.invertirX;
      this.chartOverlay.update('none');
    }

    if (this.referenceSpectrum?.spectrum_data)
      this.createSeparatedChart('chartReference', this.referenceSpectrum, 'Espectro de Referencia', '#2196F3');
    if (this.comparisonSpectrum?.spectrum_data)
      this.createSeparatedChart('chartComparison', this.comparisonSpectrum, 'Espectro Encontrado', '#FF6B6B');
  }

  toggleModoSeleccion(): void {
    this.modoSeleccion = !this.modoSeleccion;
    const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (canvas) canvas.style.cursor = this.modoSeleccion ? 'crosshair' : 'grab';
    if (!this.modoSeleccion) this.destroySelectionBox();
  }

  private applyZoom(factor: number, pivotFrac: number = 0.5): void {
    if (!this.chartOverlay) return;

    const effectivePivot = this.invertirX ? (1 - pivotFrac) : pivotFrac;
    const xRange = this.currentXMax - this.currentXMin;
    const yRange = this.currentYMax - this.currentYMin;
    const pivot = this.currentXMin + effectivePivot * xRange;
    const newXRange = xRange * factor;
    const newYRange = yRange * factor;

    this.currentXMin = pivot - effectivePivot * newXRange;
    this.currentXMax = pivot + (1 - effectivePivot) * newXRange;

    const yCtr = (this.currentYMin + this.currentYMax) / 2;
    this.currentYMin = yCtr - newYRange / 2;
    this.currentYMax = yCtr + newYRange / 2;

    this.writeScales();
    this.isZoomed = true;
    this.chartOverlay.update('none');
  }

  private applyZoomToRange(x1: number, x2: number, y1: number, y2: number): void {
    if (!this.chartOverlay) return;
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

  zoomIn(): void { this.applyZoom(0.6); this.successMessage = 'Zoom in activado'; }
  zoomOut(): void { this.applyZoom(1.6); this.successMessage = 'Zoom out activado'; }

  zoomReset(): void {
    if (!this.chartOverlay) return;
    this.currentXMin = this.origXMin;
    this.currentXMax = this.origXMax;
    this.currentYMin = this.origYMin;
    this.currentYMax = this.origYMax;
    this.writeScales();
    this.isZoomed = false;
    this.modoSeleccion = false;
    const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (canvas) canvas.style.cursor = 'grab';
    this.chartOverlay.update('none');
    this.successMessage = 'Zoom reseteado';
  }

  private enableChartInteraction(): void {
    const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
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
      const py = e.clientY - rect.top;

      if (this.modoSeleccion && this.isSelecting) {
        this.updateSelectionBox(this.selStartX, this.selStartY, px, py);
        return;
      }

      if (!this.modoSeleccion && this.isDragging && this.chartOverlay) {
        const xRange = this.currentXMax - this.currentXMin;
        const pxPerUnit = xRange / rect.width;
        const sign = this.invertirX ? -1 : 1;
        const delta = (e.clientX - this.lastClientX) * pxPerUnit * sign;
        this.currentXMin -= delta;
        this.currentXMax -= delta;
        this.lastClientX = e.clientX;
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
        const area = (this.chartOverlay as any).chartArea;
        const plotW = area.right - area.left;
        const plotH = area.bottom - area.top;

        const toDataX = (pix: number) => {
          const frac = (pix - area.left) / plotW;
          const f = this.invertirX ? (1 - frac) : frac;
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
        this.isSelecting = false;
        this.destroySelectionBox();
        this.modoSeleccion = false;
        canvas.style.cursor = 'grab';
      }
      this.isDragging = false;
      if (!this.modoSeleccion) canvas.style.cursor = 'grab';
    };

    this.mouseLeaveListener = () => {
      this.isDragging = false;
      this.isSelecting = false;
      this.destroySelectionBox();
      if (!this.modoSeleccion) canvas.style.cursor = 'grab';
    };

    this.dblClickListener = () => { this.zoomReset(); };

    canvas.addEventListener('wheel', this.wheelListener, { passive: false });
    canvas.addEventListener('mousedown', this.mouseDownListener);
    canvas.addEventListener('mousemove', this.mouseMoveListener);
    canvas.addEventListener('mouseup', this.mouseUpListener);
    canvas.addEventListener('mouseleave', this.mouseLeaveListener);
    canvas.addEventListener('dblclick', this.dblClickListener);
  }

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
    this.selectionBox.style.left = `${Math.min(startX, curX)}px`;
    this.selectionBox.style.top = `${Math.min(startY, curY)}px`;
    this.selectionBox.style.width = `${Math.abs(curX - startX)}px`;
    this.selectionBox.style.height = `${Math.abs(curY - startY)}px`;
  }

  private destroySelectionBox(): void {
    if (this.selectionBox) { this.selectionBox.remove(); this.selectionBox = null; }
  }

  private removeChartListeners(): void {
    const canvas = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (!canvas) return;
    if (this.wheelListener) { canvas.removeEventListener('wheel', this.wheelListener); this.wheelListener = null; }
    if (this.mouseDownListener) { canvas.removeEventListener('mousedown', this.mouseDownListener); this.mouseDownListener = null; }
    if (this.mouseMoveListener) { canvas.removeEventListener('mousemove', this.mouseMoveListener); this.mouseMoveListener = null; }
    if (this.mouseUpListener) { canvas.removeEventListener('mouseup', this.mouseUpListener); this.mouseUpListener = null; }
    if (this.mouseLeaveListener) { canvas.removeEventListener('mouseleave', this.mouseLeaveListener); this.mouseLeaveListener = null; }
    if (this.dblClickListener) { canvas.removeEventListener('dblclick', this.dblClickListener); this.dblClickListener = null; }
  }

  downloadPNG(): void {
    const el = document.getElementById('chartOverlay') as HTMLCanvasElement;
    if (!el) return;
    const link = document.createElement('a');
    link.href = el.toDataURL('image/png');
    link.download = `comparacion_espectros_${new Date().toISOString().split('T')[0]}.png`;
    link.click();
    this.successMessage = 'Gráfica descargada como PNG';
  }

  downloadComparison(): void {
    const data = {
      reference: { filename: this.referenceSpectrum?.filename, family: this.referenceSpectrum?.family, source: this.referenceSpectrum?.source },
      comparison: { filename: this.comparisonSpectrum?.filename, family: this.comparisonSpectrum?.family, source: this.comparisonSpectrum?.source },
      method: this.method,
      similarity_score: this.similarityScore,
      matched_peaks: this.matchedPeaks.length,
      total_peaks: this.totalPeaks,
      tolerance: this.tolerance,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison_${this.referenceId}_vs_${this.comparisonId}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.successMessage = 'Comparación descargada como JSON';
  }

  calculateSimilarity(): void {
    this.calculating = true;
    this.error = '';
    this.successMessage = '';
    
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
      
      this.successMessage = `✅ Similitud: ${(this.similarityScore * 100).toFixed(1)}%`;
      console.log('✅ Similitud calculada:', this.successMessage);
    } catch (err) {
      this.error = `❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`;
      console.error(this.error);
    } finally { 
      this.calculating = false; 
    }
  }

  private validateData(): boolean {
    if (!this.referenceSpectrum?.spectrum_data?.wavenumbers?.length) { 
      this.error = '❌ Espectro de referencia inválido'; 
      return false; 
    }
    if (!this.comparisonSpectrum?.spectrum_data?.wavenumbers?.length) { 
      this.error = '❌ Espectro de comparación inválido'; 
      return false; 
    }
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