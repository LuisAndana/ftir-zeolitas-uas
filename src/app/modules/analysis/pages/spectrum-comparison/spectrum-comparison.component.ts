import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-spectrum-comparison',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spectrum-comparison.component.html',
  styleUrls: ['./spectrum-comparison.component.css']
})
export class SpectrumComparisonComponent implements OnInit, OnDestroy {
  
  referenceSpectrum: any;
  comparisonSpectrum: any;
  similarityScore: number = 0;
  loading: boolean = true;
  error: string = '';
  
  chartReference: Chart | null = null;
  chartComparison: Chart | null = null;
  
  referenceId: number = 0;
  comparisonId: number = 0;
  method: string = 'cosine';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.referenceId = params['referenceId'];
      this.comparisonId = params['comparisonId'];
      this.method = params['method'] || 'cosine';
      
      if (this.referenceId && this.comparisonId) {
        this.loadSpectra();
      }
    });
  }

  loadSpectra(): void {
    this.loading = true;
    this.error = '';
    
    console.log(`Cargando espectros: ${this.referenceId} vs ${this.comparisonId}`);
    
    // Obtener espectro de referencia
    this.http.get(`http://localhost:8000/api/similarity/spectrum/${this.referenceId}`).subscribe(
      (response: any) => {
        console.log('Respuesta espectro referencia:', response);
        if (response.success) {
          this.referenceSpectrum = response.spectrum;
          
          // Obtener espectro de comparación
          this.http.get(`http://localhost:8000/api/similarity/spectrum/${this.comparisonId}`).subscribe(
            (compResponse: any) => {
              console.log('Respuesta espectro comparación:', compResponse);
              if (compResponse.success) {
                this.comparisonSpectrum = compResponse.spectrum;
                this.loading = false;
                this.renderCharts();
              }
            },
            error => {
              console.error('Error espectro comparación:', error);
              this.error = 'Error cargando espectro de comparación: ' + error.message;
              this.loading = false;
            }
          );
        }
      },
      error => {
        console.error('Error espectro referencia:', error);
        this.error = 'Error cargando espectro de referencia: ' + error.message;
        this.loading = false;
      }
    );
  }

  renderCharts(): void {
    if (this.referenceSpectrum && this.referenceSpectrum.spectrum_data) {
      this.createChart('chartReference', this.referenceSpectrum, 'Espectro de Referencia');
    }
    
    if (this.comparisonSpectrum && this.comparisonSpectrum.spectrum_data) {
      this.createChart('chartComparison', this.comparisonSpectrum, 'Espectro Encontrado');
    }
  }

  createChart(canvasId: string, spectrum: any, title: string): void {
    setTimeout(() => {
      const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!ctx) {
        console.error(`Canvas ${canvasId} no encontrado`);
        return;
      }

      const data = spectrum.spectrum_data;
      const wavenumbers = data.wavenumbers || [];
      const intensities = data.intensities || [];

      if (wavenumbers.length === 0 || intensities.length === 0) {
        console.error(`No hay datos para el gráfico ${canvasId}`);
        return;
      }

      const config: any = {
        type: 'line',
        data: {
          labels: wavenumbers.map((wn: number) => wn.toFixed(0)),
          datasets: [
            {
              label: title,
              data: intensities,
              borderColor: canvasId === 'chartReference' ? '#2196F3' : '#FF6B6B',
              backgroundColor: canvasId === 'chartReference' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(255, 107, 107, 0.1)',
              borderWidth: 2,
              tension: 0.1,
              pointRadius: 0,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              labels: {
                boxWidth: 10,
                padding: 20,
                font: { size: 12 }
              }
            },
            title: {
              display: true,
              text: title,
              font: { size: 14, weight: 'bold' }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Wavenumber (cm⁻¹)'
              },
              ticks: {
                maxTicksLimit: 10
              }
            },
            y: {
              title: {
                display: true,
                text: 'Intensity'
              },
              beginAtZero: true,
              max: 1
            }
          }
        }
      };

      if (canvasId === 'chartReference' && this.chartReference) {
        this.chartReference.destroy();
      } else if (canvasId === 'chartComparison' && this.chartComparison) {
        this.chartComparison.destroy();
      }

      try {
        const chart = new Chart(ctx, config);
        
        if (canvasId === 'chartReference') {
          this.chartReference = chart;
        } else {
          this.chartComparison = chart;
        }
      } catch (error) {
        console.error(`Error creando gráfico ${canvasId}:`, error);
      }
    }, 100);
  }

  goBack(): void {
    this.location.back();
  }

  downloadComparison(): void {
    const data = {
      reference: this.referenceSpectrum,
      comparison: this.comparisonSpectrum,
      method: this.method
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

  ngOnDestroy(): void {
    if (this.chartReference) {
      this.chartReference.destroy();
    }
    if (this.chartComparison) {
      this.chartComparison.destroy();
    }
  }
}