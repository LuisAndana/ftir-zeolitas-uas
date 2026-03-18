import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Importar servicios
import { SpectraBackendService, SpectrumData } from '../../../../core/services/spectra-backend.service';

declare var Plotly: any;

@Component({
  selector: 'app-grafica-espectro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './grafica-espectro.html',
  styleUrl: './grafica-espectro.css'
})
export class GraficaEspectro implements OnInit, OnDestroy {
  
  // Estado
  spectra: SpectrumData[] = [];
  selectedSpectra: SpectrumData[] = [];
  loading = false;
  error: string | null = null;
  
  // Opciones de gráfica
  invertirX = true;
  mostrarCuadricula = true;
  mostrarLeyenda = true;
  grosorLinea = 2;
  suavizado = 0;
  
  // Filtros
  filterMaterial = '';
  filterTechnique = '';
  
  // Paginación
  skip = 0;
  limit = 100;
  total = 0;
  page = 1;
  total_pages = 1;
  
  private destroy$ = new Subject<void>();

  constructor(
    private spectraService: SpectraBackendService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    console.log('✅ GraficaEspectro inicializado');
    
    // Cargar espectros del backend
    this.loadSpectra();
    
    // Si viene un ID en la ruta, seleccionar ese espectro
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['id']) {
          console.log(`📍 Parámetro ID detectado: ${params['id']}`);
          this.selectSpectrumById(parseInt(params['id']));
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar lista de espectros del backend
   */
  loadSpectra(): void {
    console.log('📊 Cargando espectros del backend...');
    this.loading = true;
    this.error = null;

    this.spectraService.getSpectra(this.skip, this.limit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ Espectros cargados:', response.data);
          this.spectra = response.data;
          this.total = response.total;
          this.page = response.page;
          this.total_pages = response.total_pages;
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error cargando espectros:', error);
          this.error = error.message || 'Error al cargar espectros';
          this.loading = false;
        }
      });
  }

  /**
   * Cuando cambian los filtros, actualizar gráfica
   */
  onFilterChange(): void {
    console.log(`🔍 Filtros cambiados: material="${this.filterMaterial}", technique="${this.filterTechnique}"`);
    console.log(`📊 Espectros filtrados: ${this.filteredSpectra.length}`);
    // La gráfica se actualiza automáticamente gracias a *ngFor
  }

  /**
   * Obtener espectros filtrados
   */
  get filteredSpectra(): SpectrumData[] {
    return this.spectra.filter(s => {
      // Filtro por material (búsqueda parcial, sin importar mayúsculas)
      const materialMatch = !this.filterMaterial || 
        (s.material || '').toLowerCase().includes(this.filterMaterial.toLowerCase());
      
      // Filtro por técnica (coincidencia exacta)
      const techniqueMatch = !this.filterTechnique || 
        (s.technique || '').toLowerCase() === this.filterTechnique.toLowerCase();
      
      return materialMatch && techniqueMatch;
    });
  }

  /**
   * Seleccionar/deseleccionar espectro
   */
  toggleSpectrum(spectrum: SpectrumData): void {
    const index = this.selectedSpectra.findIndex(s => s.id === spectrum.id);
    
    if (index > -1) {
      // Deseleccionar
      this.selectedSpectra.splice(index, 1);
      console.log(`❌ Espectro deseleccionado: ${spectrum.filename}`);
    } else {
      // Seleccionar
      this.selectedSpectra.push(spectrum);
      console.log(`✅ Espectro seleccionado: ${spectrum.filename}`);
    }
    
    // Redibujar gráfica
    this.updateGraph();
  }

  /**
   * Seleccionar espectro por ID (desde parámetros de ruta)
   */
  selectSpectrumById(id: number): void {
    const spectrum = this.spectra.find(s => s.id === id);
    
    if (spectrum && !this.selectedSpectra.find(s => s.id === id)) {
      this.selectedSpectra = [spectrum];
      console.log(`✅ Espectro seleccionado por ID: ${spectrum.filename}`);
      this.updateGraph();
    }
  }

  /**
   * Verificar si un espectro está seleccionado
   */
  isSelected(spectrum: SpectrumData): boolean {
    return this.selectedSpectra.some(s => s.id === spectrum.id);
  }

  /**
   * Limpiar selección
   */
  clearSelection(): void {
    console.log('🧹 Limpiando selección');
    this.selectedSpectra = [];
    this.updateGraph();
  }

  /**
   * Seleccionar todos los espectros filtrados
   */
  selectAll(): void {
    console.log('✅ Seleccionando todos los espectros');
    this.selectedSpectra = [...this.filteredSpectra];
    this.updateGraph();
  }

  /**
   * Actualizar gráfica con espectros seleccionados
   */
  updateGraph(): void {
    console.log(`📈 Actualizando gráfica con ${this.selectedSpectra.length} espectros`);
    
    if (this.selectedSpectra.length === 0) {
      this.clearGraph();
      return;
    }

    // Preparar datos para Plotly
    const traces: any[] = [];
    const colors = [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
      '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ];

    this.selectedSpectra.forEach((spectrum, index) => {
      if (!spectrum.wavenumbers || !spectrum.absorbance) {
        console.warn(`⚠️  Espectro ${spectrum.filename} sin datos`);
        return;
      }

      let wavenumbers = [...spectrum.wavenumbers];
      let absorbance = [...spectrum.absorbance];

      // ✅ Invertir eje X si está habilitado
      if (this.invertirX) {
        wavenumbers = wavenumbers.reverse();
        absorbance = absorbance.reverse();
      }

      // ✅ Suavizado (media móvil simple)
      if (this.suavizado > 0) {
        absorbance = this.smoothData(absorbance, this.suavizado);
      }

      const trace = {
        x: wavenumbers,
        y: absorbance,
        name: spectrum.filename,
        mode: 'lines',
        line: {
          color: colors[index % colors.length],
          width: this.grosorLinea,
          shape: 'linear'
        },
        hovertemplate: `<b>${spectrum.filename}</b><br>Wavenumber: %{x:.2f} cm⁻¹<br>Absorbance: %{y:.5f} A.U.<extra></extra>`,
        connectgaps: true
      };

      traces.push(trace);
      console.log(`✅ Trace agregado: ${spectrum.filename}`);
    });

    // Configuración de layout - MEJORADA
    const layout = {
      title: {
        text: `<b>Espectros FTIR</b> (${this.selectedSpectra.length} seleccionado${this.selectedSpectra.length > 1 ? 's' : ''})`,
        font: { size: 20, family: 'Inter, sans-serif', color: '#333' },
        x: 0.5,
        xanchor: 'center'
      },
      xaxis: {
        title: {
          text: '<b>Wavenumber (cm⁻¹)</b>',
          font: { size: 14, color: '#333' }
        },
        zeroline: false,
        showgrid: this.mostrarCuadricula,
        gridwidth: 1,
        gridcolor: '#f0f0f0',
        showline: true,
        linewidth: 2,
        linecolor: '#333',
        mirror: true
      },
      yaxis: {
        title: {
          text: '<b>Absorbance (A.U.)</b>',
          font: { size: 14, color: '#333' }
        },
        zeroline: false,
        showgrid: this.mostrarCuadricula,
        gridwidth: 1,
        gridcolor: '#f0f0f0',
        showline: true,
        linewidth: 2,
        linecolor: '#333',
        mirror: true
      },
      hovermode: 'x unified',
      legend: {
        visible: this.mostrarLeyenda,
        x: 1.02,
        y: 1,
        xanchor: 'left',
        yanchor: 'top',
        bgcolor: 'rgba(255, 255, 255, 0.8)',
        bordercolor: '#ddd',
        borderwidth: 1,
        font: { size: 12 }
      },
      margin: { l: 80, r: 250, t: 100, b: 80 },
      plot_bgcolor: '#fafafa',
      paper_bgcolor: '#ffffff',
      font: { family: 'Inter, sans-serif', size: 12, color: '#333' },
      showlegend: this.mostrarLeyenda,
      autosize: true,
      height: 600
    };

    // Configuración de opciones
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: `espectro_FTIR_${Date.now()}.png`,
        height: 800,
        width: 1400,
        scale: 2
      }
    };

    // Redibujar
    try {
      Plotly.newPlot('grafico', traces, layout, config);
      console.log('✅ Gráfica actualizada');
      this.error = null;
    } catch (error) {
      console.error('❌ Error en Plotly:', error);
      this.error = 'Error al graficar espectros';
    }
  }

  /**
   * Limpiar gráfica
   */
  clearGraph(): void {
    console.log('🧹 Limpiando gráfica');
    try {
      Plotly.purge('grafico');
      const element = document.getElementById('grafico');
      if (element) {
        element.innerHTML = '<p style="text-align: center; padding: 50px;">Selecciona uno o más espectros para visualizar</p>';
      }
    } catch (error) {
      console.error('❌ Error limpiando gráfica:', error);
    }
  }

  /**
   * Resetear zoom
   */
  resetZoom(): void {
    console.log('🔍 Reseteando zoom');
    try {
      Plotly.relayout('grafico', {
        'xaxis.autorange': true,
        'yaxis.autorange': true
      });
    } catch (error) {
      console.error('❌ Error reseteando zoom:', error);
    }
  }

  /**
   * Descargar gráfica como PNG
   */
  downloadPNG(): void {
    console.log('📥 Descargando gráfica como PNG');
    try {
      Plotly.downloadImage('grafico', {
        format: 'png',
        width: 1000,
        height: 600,
        filename: `espectro_${Date.now()}.png`
      });
    } catch (error) {
      console.error('❌ Error descargando PNG:', error);
      this.error = 'Error descargando imagen';
    }
  }

  /**
   * Suavizar datos usando media móvil simple
   */
  private smoothData(data: number[], windowSize: number): number[] {
    if (windowSize <= 1 || windowSize >= data.length) return data;

    const smoothed: number[] = [];
    const half = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = -half; j <= half; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < data.length) {
          sum += data[idx];
          count++;
        }
      }

      smoothed.push(sum / count);
    }

    return smoothed;
  }

  /**
   * Cambiar página
   */
  changePage(newPage: number): void {
    if (newPage < 1 || newPage > this.total_pages) {
      return;
    }
    this.page = newPage;
    this.skip = (newPage - 1) * this.limit;
    this.loadSpectra();
  }

  /**
   * Obtener icono de formato
   */
  getFormatIcon(filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const icons: { [key: string]: string } = {
      '.csv': '📊',
      '.txt': '📄',
      '.dpt': '🔬',
      '.json': '{}',
      '.xlsx': '📈'
    };
    return icons[ext] || '📁';
  }

  /**
   * Obtener timestamp legible
   */
  getFormattedDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }
}