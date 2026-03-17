import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EspectroLoaderService, Spectrum } from '../../../../core/services/espectro-loader.service';

declare var Plotly: any;

interface SpectrumSelection {
  id: string;
  name: string;
  selected: boolean;
  color: string;
}

@Component({
  selector: 'app-grafica-espectro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './grafica-espectro.html',
  styleUrl: './grafica-espectro.css'
})
export class GraficaEspectro implements OnInit, OnDestroy {

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef<HTMLDivElement>;

  // Datos
  spectra: Spectrum[] = [];
  selectedSpectra: SpectrumSelection[] = [];

  // Opciones de visualización
  invertX: boolean = true;
  showGrid: boolean = true;
  showLegend: boolean = true;
  lineWidth: number = 2;
  smoothing: number = 0;
  title: string = 'Espectros FTIR';

  // Colores para múltiples espectros
  colors = [
    '#2E75B6', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD',
    '#16A085', '#D35400', '#2C3E50', '#C0392B', '#1ABC9C'
  ];

  // Estado
  loading = false;
  hasData = false;
  selectedCount = 0;

  constructor(private espectroLoader: EspectroLoaderService) {}

  ngOnInit() {
    this.loadSpectra();
    this.loadPlotly();
  }

  ngOnDestroy() {
    if (this.chartContainer) {
      Plotly.purge(this.chartContainer.nativeElement);
    }
  }

  /**
   * Cargar librería Plotly desde CDN
   */
  private loadPlotly() {
    if (typeof Plotly === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-latest.min.js';
      document.head.appendChild(script);
      script.onload = () => {
        console.log('✅ Plotly cargado');
      };
    }
  }

  /**
   * Cargar espectros disponibles
   */
  private loadSpectra() {
    this.spectra = this.espectroLoader.getAllSpectra();
    this.selectedSpectra = this.spectra.map((s: Spectrum, i: number) => ({
      id: s.id,
      name: s.filename,
      selected: false,
      color: this.colors[i % this.colors.length]
    }));
    this.updateSelectedCount();
  }

  /**
   * Actualizar contador de espectros seleccionados
   */
  private updateSelectedCount() {
    this.selectedCount = this.selectedSpectra.filter(s => s.selected).length;
  }

  /**
   * Alternar selección de espectro
   */
  onSpectrumToggle(id: string) {
    const selection = this.selectedSpectra.find(s => s.id === id);
    if (selection) {
      selection.selected = !selection.selected;
      this.updateSelectedCount();
      this.updateChart();
    }
  }

  /**
   * Verificar si espectro está seleccionado
   */
  isSelected(id: string): boolean {
    return this.selectedSpectra.some(s => s.id === id && s.selected);
  }

  /**
   * Seleccionar todos los espectros
   */
  selectAll() {
    this.selectedSpectra.forEach(s => s.selected = true);
    this.updateSelectedCount();
    this.updateChart();
  }

  /**
   * Deseleccionar todos
   */
  clearAll() {
    this.selectedSpectra.forEach(s => s.selected = false);
    this.updateSelectedCount();
    this.updateChart();
  }

  /**
   * Actualizar gráfica
   */
  updateChart() {
    if (!this.chartContainer) return;

    const selectedIds = this.selectedSpectra
      .filter(s => s.selected)
      .map(s => s.id);

    if (selectedIds.length === 0) {
      Plotly.purge(this.chartContainer.nativeElement);
      this.hasData = false;
      return;
    }

    const traces: any[] = [];

    selectedIds.forEach((id: string, index: number) => {
      const spectrum = this.espectroLoader.getSpectrumById(id);
      if (spectrum) {
        const selection = this.selectedSpectra.find(s => s.id === id);
        const color = selection?.color || this.colors[index % this.colors.length];

        // Preparar datos
        let xData = spectrum.wavenumbers;
        let yData = spectrum.data;

        if (this.invertX) {
          xData = [...xData].reverse();
          yData = [...yData].reverse();
        }

        // Crear trace de Plotly
        traces.push({
          x: xData,
          y: yData,
          name: spectrum.filename,
          type: 'scatter',
          mode: 'lines',
          line: {
            color: color,
            width: this.lineWidth,
            shape: this.smoothing > 0 ? 'spline' : 'linear'
          },
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                         'Wavenumber: %{x:.2f} cm⁻¹<br>' +
                         'Absorbance: %{y:.5f}<br>' +
                         '<extra></extra>'
        });
      }
    });

    // Configuración de la gráfica
    const layout = {
      title: {
        text: this.title,
        font: { size: 18, color: '#0f172a' }
      },
      xaxis: {
        title: 'Número de onda (cm⁻¹)',
        showgrid: this.showGrid,
        zeroline: false,
        gridcolor: '#e5e7eb',
        showline: true,
        linewidth: 2,
        linecolor: '#0f172a',
        font: { size: 12 }
      },
      yaxis: {
        title: 'Absorbancia / Transmitancia',
        showgrid: this.showGrid,
        zeroline: false,
        gridcolor: '#e5e7eb',
        showline: true,
        linewidth: 2,
        linecolor: '#0f172a',
        font: { size: 12 }
      },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#f8fafc',
      margin: { l: 80, r: 40, t: 60, b: 80 },
      legend: {
        visible: this.showLegend,
        bgcolor: 'rgba(255, 255, 255, 0.8)',
        bordercolor: '#e5e7eb',
        borderwidth: 1,
        font: { size: 11 },
        yanchor: 'top',
        y: 0.99,
        xanchor: 'right',
        x: 0.99
      },
      hovermode: 'x unified',
      showlegend: this.showLegend
    };

    // Configuración interactiva
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: `espectro_${new Date().toISOString().split('T')[0]}`,
        height: 600,
        width: 1200,
        scale: 2
      }
    };

    // Renderizar gráfica
    Plotly.newPlot(
      this.chartContainer.nativeElement,
      traces,
      layout,
      config
    );

    this.hasData = true;
  }

  /**
   * Obtener información del espectro
   */
  getSpectrumInfo(id: string): string {
    const spectrum = this.espectroLoader.getSpectrumById(id);
    if (!spectrum) return '';
    return `${spectrum.wavenumbers.length} pts`;
  }

  /**
   * Descargar gráfica como imagen
   */
  downloadChart() {
    if (this.chartContainer) {
      Plotly.downloadImage(this.chartContainer.nativeElement, {
        format: 'png',
        width: 1200,
        height: 600,
        filename: `espectro_${new Date().toISOString().split('T')[0]}`
      });
    }
  }

  /**
   * Resetear zoom
   */
  resetZoom() {
    if (this.chartContainer) {
      Plotly.relayout(this.chartContainer.nativeElement, {
        'xaxis.autorange': true,
        'yaxis.autorange': true
      });
    }
  }

  /**
   * Cambiar escala del eje X
   */
  toggleInvertX() {
    this.invertX = !this.invertX;
    this.updateChart();
  }

  /**
   * Cambiar visibilidad de leyenda
   */
  toggleLegend() {
    this.showLegend = !this.showLegend;
    this.updateChart();
  }

  /**
   * Cambiar visibilidad de cuadrícula
   */
  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.updateChart();
  }

  /**
   * Evento cuando cambian opciones
   */
  onOptionChange() {
    this.updateChart();
  }
}