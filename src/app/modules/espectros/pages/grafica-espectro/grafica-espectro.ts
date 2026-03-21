import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SpectraBackendService, SpectrumData } from '../../../../core/services/spectra-backend.service';
import { SpectrumStateService } from '../../../../core/services/spectrum-state.service';

declare var Plotly: any;

@Component({
  selector: 'app-grafica-espectro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './grafica-espectro.html',
  styleUrl: './grafica-espectro.css'
})
export class GraficaEspectro implements OnInit, OnDestroy {

  spectra: SpectrumData[] = [];
  selectedSpectra: SpectrumData[] = [];
  loading = false;
  error: string | null = null;

  // ✅ CAMBIO: invertirX ahora es FALSE por defecto
  invertirX = false;
  mostrarCuadricula = true;
  mostrarLeyenda = true;
  grosorLinea = 2;
  suavizado = 0;

  filterMaterial = '';
  filterTechnique = '';

  skip = 0;
  limit = 100;
  total = 0;
  page = 1;
  total_pages = 1;

  isInitialized = false;

  private destroy$ = new Subject<void>();
  private resizeObserver: ResizeObserver | null = null;

  readonly colors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];

  constructor(
    private spectraService: SpectraBackendService,
    private spectrumStateService: SpectrumStateService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.isInitialized) {
      console.log('⚠️ Componente gráfica ya inicializado');
      return;
    }

    console.log('🚀 Componente Gráfica Espectro inicializado');
    this.isInitialized = true;

    this.loadSpectra();
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) this.selectSpectrumById(parseInt(params['id']));
    });
    this.setupResizeObserver();
    
    setTimeout(() => this.loadSavedGraphState(), 500);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  /**
   * ✅ CARGAR ESTADO GUARDADO DE LA GRÁFICA
   */
/**
 * ✅ CARGAR ESTADO GUARDADO DE LA GRÁFICA
 */
/**
 * ✅ CARGAR ESTADO GUARDADO DE LA GRÁFICA
 */
private loadSavedGraphState(): void {
  console.log(' Cargando estado guardado de gráfica...');

  this.spectrumStateService
    .getSpectrumState()
    .pipe(takeUntil(this.destroy$))
    .subscribe(state => {
      if (state.graphState && state.graphState.selectedSpectraIds.length > 0) {
        console.log(` Restaurando ${state.graphState.selectedSpectraIds.length} espectros`);
        
        this.selectedSpectra = this.spectra.filter(s =>
          state.graphState.selectedSpectraIds.includes(s.id)
        );

        this.filterMaterial = state.graphState.selectedMaterial || '';
        this.filterTechnique = state.graphState.selectedTechnique || '';

        // ✅ NO restaurar invertirX - siempre empezar con false
        this.invertirX = false;
        
        // ✅ Restaurar el resto de opciones normalmente
        this.mostrarCuadricula = state.graphState.mostrarCuadricula;
        this.mostrarLeyenda = state.graphState.mostrarLeyenda;
        this.grosorLinea = state.graphState.grosorLinea;
        this.suavizado = state.graphState.suavizado;

        if (this.selectedSpectra.length > 0) {
          setTimeout(() => {
            this.updateGraph();
            console.log(` Gráfica restaurada: ${this.selectedSpectra.length} espectro${this.selectedSpectra.length !== 1 ? 's' : ''}`);
          }, 300);
        }
      }
    });
}

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const container = document.querySelector('.graph-container-main');
    if (!container) return;
    this.resizeObserver = new ResizeObserver(() => this.resizePlotly());
    this.resizeObserver.observe(container);
  }

  private resizePlotly(): void {
    try {
      const el = document.getElementById('grafico');
      if (!el || !el.querySelector('.js-plotly-plot')) return;
      Plotly.Plots.resize(el);
    } catch (e) {}
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  getSpectrumColor(indexEnFiltrados: number): string {
    return this.colors[indexEnFiltrados % this.colors.length];
  }

  getShortName(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot > -1 ? filename.slice(0, dot) : filename;
  }

  getExt(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot > -1 ? filename.slice(dot + 1).toLowerCase() : '';
  }

  loadSpectra(): void {
    this.loading = true;
    this.error = null;
    this.spectraService.getSpectra(this.skip, this.limit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.spectra = response.data;
          this.total = response.total;
          this.page = response.page;
          this.total_pages = response.total_pages;
          this.loading = false;
          
          this.loadSavedGraphState();
        },
        error: (error) => {
          this.error = error.message || 'Error al cargar espectros';
          this.loading = false;
        }
      });
  }

  onFilterChange(): void {
    this.saveGraphState();
  }

  get filteredSpectra(): SpectrumData[] {
    return this.spectra.filter(s => {
      const materialMatch = !this.filterMaterial ||
        (s.material || '').toLowerCase().includes(this.filterMaterial.toLowerCase());
      const techniqueMatch = !this.filterTechnique ||
        (s.technique || '').toLowerCase() === this.filterTechnique.toLowerCase();
      return materialMatch && techniqueMatch;
    });
  }

  toggleSpectrum(spectrum: SpectrumData): void {
    const index = this.selectedSpectra.findIndex(s => s.id === spectrum.id);
    if (index > -1) this.selectedSpectra.splice(index, 1);
    else this.selectedSpectra.push(spectrum);
    this.updateGraph();
    this.saveGraphState();
  }

  selectSpectrumById(id: number): void {
    const spectrum = this.spectra.find(s => s.id === id);
    if (spectrum && !this.selectedSpectra.find(s => s.id === id)) {
      this.selectedSpectra = [spectrum];
      this.updateGraph();
      this.saveGraphState();
    }
  }

  isSelected(spectrum: SpectrumData): boolean {
    return this.selectedSpectra.some(s => s.id === spectrum.id);
  }

  clearSelection(): void {
    console.log(' Limpiando selección de espectros...');
    this.selectedSpectra = [];
    this.updateGraph();
    this.spectrumStateService.clearGraphState();
    this.error = null;
  }

  selectAll(): void {
    this.selectedSpectra = [...this.filteredSpectra];
    this.updateGraph();
    this.saveGraphState();
  }

  toggleInvertirX(): void {
    const el = document.getElementById('grafico');
    if (!el || !el.querySelector('.js-plotly-plot')) return;
    try {
      // ✅ CAMBIO: Invertir la lógica
      Plotly.relayout('grafico', {
        'xaxis.autorange': this.invertirX ? 'reversed' : true
      });
      this.saveGraphState();
    } catch (e) {}
  }

  updateGraph(): void {
    if (this.selectedSpectra.length === 0) {
      this.clearGraph();
      return;
    }

    const traces: any[] = this.selectedSpectra
      .filter(s => s.wavenumbers && s.absorbance)
      .map((spectrum, index) => {
        const wavenumbers = [...spectrum.wavenumbers!];
        let absorbance = [...spectrum.absorbance!];

        if (this.suavizado > 0) {
          absorbance = this.smoothData(absorbance, this.suavizado);
        }

        const color = this.colors[index % this.colors.length];

        return {
          x: wavenumbers,
          y: absorbance,
          name: spectrum.filename,
          mode: 'lines',
          line: { color, width: this.grosorLinea, shape: 'linear' },
          hoverlabel: {
            bgcolor: this.hexToRgba(color, 0.15),
            bordercolor: this.hexToRgba(color, 0.55),
            font: { color: '#222', size: 11, family: 'Inter, sans-serif' },
            align: 'left'
          },
          hovertemplate:
            `<b>%{data.name}</b><br>` +
            `%{x:.1f} cm⁻¹<br>` +
            `%{y:.4f} A.U.<extra></extra>`,
          connectgaps: true
        };
      });

    const container = document.querySelector('.graph-container-main') as HTMLElement;
    const w = container ? container.clientWidth : 800;
    const h = container ? container.clientHeight : 500;

    const marginBottom = this.mostrarLeyenda ? 80 : 55;

    const layout: any = {
      title: {
        text: `<b>Espectros FTIR</b> — ${this.selectedSpectra.length} serie${this.selectedSpectra.length > 1 ? 's' : ''}`,
        font: { size: 14, family: 'Inter, sans-serif', color: '#333' },
        x: 0.5, xanchor: 'center', y: 0.99, yanchor: 'top'
      },
      xaxis: {
        title: { text: '<b>Wavenumber (cm⁻¹)</b>', font: { size: 12, color: '#333', family: 'Inter, sans-serif' } },
        tickfont: { size: 10, color: '#555', family: 'Inter, sans-serif' },
        zeroline: false,
        showgrid: this.mostrarCuadricula, gridwidth: 1, gridcolor: '#e8e8e8',
        showline: true, linewidth: 1.5, linecolor: '#333', mirror: true,
        automargin: true,
        // ✅ CAMBIO: Aplicar invertirX correctamente
        autorange: this.invertirX ? 'reversed' : true
      },
      yaxis: {
        title: { text: '<b>Absorbance (A.U.)</b>', font: { size: 12, color: '#333', family: 'Inter, sans-serif' }, standoff: 8 },
        tickfont: { size: 10, color: '#555', family: 'Inter, sans-serif' },
        zeroline: false,
        showgrid: this.mostrarCuadricula, gridwidth: 1, gridcolor: '#e8e8e8',
        showline: true, linewidth: 1.5, linecolor: '#333', mirror: true,
        automargin: true
      },
      hovermode: 'closest',
      legend: {
        visible: this.mostrarLeyenda,
        orientation: 'h',
        x: 0.5, y: -0.18,
        xanchor: 'center', yanchor: 'top',
        bgcolor: 'rgba(255,255,255,0)',
        bordercolor: 'rgba(0,0,0,0)',
        borderwidth: 0,
        font: { size: 10, family: 'Inter, sans-serif', color: '#444' }
      },
      margin: { l: 65, r: 20, t: 38, b: marginBottom },
      plot_bgcolor: '#fafafa',
      paper_bgcolor: '#ffffff',
      font: { family: 'Inter, sans-serif', size: 10, color: '#333' },
      showlegend: this.mostrarLeyenda,
      width: w,
      height: h,
      autosize: false
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: `espectro_FTIR_${Date.now()}.png`,
        height: 900, width: 1600, scale: 2
      }
    };

    try {
      Plotly.newPlot('grafico', traces, layout, config);
      this.error = null;
      requestAnimationFrame(() => this.resizePlotly());
    } catch (err) {
      console.error('❌ Error en Plotly:', err);
      this.error = 'Error al graficar espectros';
    }
  }

  clearGraph(): void {
    try { Plotly.purge('grafico'); } catch (e) {}
  }

  resetZoom(): void {
    try {
      Plotly.relayout('grafico', {
        // ✅ CAMBIO: Aplicar correctamente el zoom reset
        'xaxis.autorange': this.invertirX ? 'reversed' : true,
        'yaxis.autorange': true
      });
    } catch (e) {}
  }

  downloadPNG(): void {
    try {
      Plotly.downloadImage('grafico', {
        format: 'png', width: 1600, height: 900,
        filename: `espectro_FTIR_${Date.now()}.png`
      });
    } catch (e) { this.error = 'Error descargando imagen'; }
  }

  private smoothData(data: number[], windowSize: number): number[] {
    if (windowSize <= 1 || windowSize >= data.length) return data;
    const half = Math.floor(windowSize / 2);
    return data.map((_, i) => {
      let sum = 0, count = 0;
      for (let j = -half; j <= half; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < data.length) { sum += data[idx]; count++; }
      }
      return sum / count;
    });
  }

  changePage(newPage: number): void {
    if (newPage < 1 || newPage > this.total_pages) return;
    this.page = newPage;
    this.skip = (newPage - 1) * this.limit;
    this.loadSpectra();
  }

  getFormatIcon(filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return ({ '.csv': '📊', '.txt': '📄', '.dpt': '🔬', '.json': '{}', '.xlsx': '📈' } as any)[ext] || '📁';
  }

  getFormattedDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateString; }
  }

  /**
   * ✅ GUARDAR ESTADO DE LA GRÁFICA
   */
  private saveGraphState(): void {
    this.spectrumStateService.setGraphState(
      this.selectedSpectra.map(s => s.id),
      this.filterMaterial || null,
      this.filterTechnique || null,
      this.invertirX,
      this.mostrarCuadricula,
      this.mostrarLeyenda,
      this.grosorLinea,
      this.suavizado
    );
    console.log(` Estado de gráfica guardado: ${this.selectedSpectra.length} espectros`);
  }
}