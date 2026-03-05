import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EspectroLoaderService } from '../../../../core/services/espectro-loader.service';

declare var Chart: any;

@Component({
  selector: 'app-grafica-espectro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './grafica-espectro.html',
  styleUrl: './grafica-espectro.css'
})
export class GraficaEspectro implements OnInit, OnDestroy {

  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  spectra: any[] = [];
  selectedSpectrumIds: string[] = [];
  chart: any = null;

  // Opciones de visualización
  invertX: boolean = true;  // FTIR convención: 4000 → 400
  showGrid: boolean = true;
  lineWidth: number = 2;

  // Colores para múltiples espectros
  colors = [
    '#2E75B6', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD',
    '#16A085', '#D35400', '#2C3E50', '#C0392B', '#1ABC9C'
  ];

  constructor(private espectroLoader: EspectroLoaderService) {}

  ngOnInit() {
    this.spectra = this.espectroLoader.getAllSpectra();
  }

  ngOnDestroy() {
    if (this.chart) this.chart.destroy();
  }

  onSpectrumToggle(id: string) {
    const idx = this.selectedSpectrumIds.indexOf(id);
    if (idx >= 0) {
      this.selectedSpectrumIds.splice(idx, 1);
    } else {
      this.selectedSpectrumIds.push(id);
    }
    this.updateChart();
  }

  isSelected(id: string): boolean {
    return this.selectedSpectrumIds.includes(id);
  }

  selectAll() {
    this.selectedSpectrumIds = this.spectra.map(s => s.id);
    this.updateChart();
  }

  clearAll() {
    this.selectedSpectrumIds = [];
    this.updateChart();
  }

  updateChart() {
    if (!this.chartCanvas) return;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    if (this.selectedSpectrumIds.length === 0) return;

    const datasets = this.selectedSpectrumIds.map((id, i) => {
      const spectrum = this.spectra.find(s => s.id === id);
      if (!spectrum) return null;

      const data = spectrum.wavenumbers.map((wn: number, j: number) => ({
        x: wn,
        y: spectrum.data[j]
      }));

      return {
        label: spectrum.filename,
        data: data,
        borderColor: this.colors[i % this.colors.length],
        backgroundColor: 'transparent',
        borderWidth: this.lineWidth,
        pointRadius: 0,
        tension: 0.1
      };
    }).filter(Boolean);

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { usePointStyle: true, padding: 15 }
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)} @ ${ctx.parsed.x.toFixed(1)} cm⁻¹`
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            reverse: this.invertX,
            title: { display: true, text: 'Número de onda (cm⁻¹)', font: { size: 13, weight: 'bold' } },
            grid: { display: this.showGrid, color: '#f0f0f0' }
          },
          y: {
            title: { display: true, text: 'Absorbancia / Transmitancia', font: { size: 13, weight: 'bold' } },
            grid: { display: this.showGrid, color: '#f0f0f0' }
          }
        }
      }
    });
  }
}
