import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface DatasetSpectrum {
  id: number;
  filename: string;
  sample_code: string;
  zeolite_name: string;
  equipment: string;
  measurement_date: string;
  spectrum_data?: {
    wavenumbers: number[];
    intensities: number[];
  };
}

@Component({
  selector: 'app-biblioteca-dataset',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './biblioteca-dataset.component.html',
  styleUrl: './biblioteca-dataset.component.css'
})
export class BibliotecaDatasetComponent implements OnInit, OnDestroy {

  spectra: DatasetSpectrum[] = [];
  filteredSpectra: DatasetSpectrum[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  filterZeolite = '';
  filterEquipment = '';
  filterSampleCode = '';
  
  page = 1;
  limit = 20;
  total = 0;
  totalPages = 0;

  selectedSpectrum: DatasetSpectrum | null = null;
  showDetailsModal = false;

  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  ngOnInit() {
    console.log('📚 Biblioteca Dataset cargada');
    this.loadDatasetSpectra();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDatasetSpectra() {
    this.loading = true;
    this.errorMessage = '';

    const token = localStorage.getItem('access_token');
    const headers: any = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.get<any>(
      'http://localhost:8000/api/similarity/dataset/spectra?limit=5000',
      { headers }
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ Espectros del dataset cargados:', response);

          if (response.success && Array.isArray(response.data)) {
            this.spectra = response.data;
            this.total = response.total || this.spectra.length;
            this.totalPages = Math.ceil(this.total / this.limit);
            this.applyFilters();
          }

          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error cargando dataset:', error);
          this.errorMessage = '❌ Error al cargar espectros del dataset';
          this.loading = false;
        }
      });
  }

  applyFilters() {
    this.filteredSpectra = this.spectra.filter(s => {
      const zeoliteMatch = !this.filterZeolite ||
        s.zeolite_name.toLowerCase().includes(this.filterZeolite.toLowerCase());
      
      const equipmentMatch = !this.filterEquipment ||
        s.equipment.toLowerCase().includes(this.filterEquipment.toLowerCase());
      
      const sampleMatch = !this.filterSampleCode ||
        s.sample_code.toLowerCase().includes(this.filterSampleCode.toLowerCase());
      
      return zeoliteMatch && equipmentMatch && sampleMatch;
    });

    this.totalPages = Math.ceil(this.filteredSpectra.length / this.limit);
    this.page = 1;
  }

  viewDetails(spectrum: DatasetSpectrum) {
    this.selectedSpectrum = spectrum;
    this.showDetailsModal = true;
    console.log('👁️ Ver detalles:', spectrum);
  }

  closeModal() {
    this.showDetailsModal = false;
    this.selectedSpectrum = null;
  }

  downloadSpectrum(spectrum: DatasetSpectrum) {
    if (!spectrum.spectrum_data?.wavenumbers || !spectrum.spectrum_data?.intensities) {
      this.errorMessage = '❌ No hay datos para descargar';
      return;
    }

    let csv = 'wavenumber,intensity\n';
    for (let i = 0; i < spectrum.spectrum_data.wavenumbers.length; i++) {
      csv += `${spectrum.spectrum_data.wavenumbers[i]},${spectrum.spectrum_data.intensities[i]}\n`;
    }

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `${spectrum.sample_code}_spectrum.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    this.successMessage = '✅ Espectro descargado';
  }

  goToPage(newPage: number) {
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.page = newPage;
    }
  }

  get paginatedSpectra(): DatasetSpectrum[] {
    const start = (this.page - 1) * this.limit;
    return this.filteredSpectra.slice(start, start + this.limit);
  }

  get pageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  get statistics() {
    return {
      total: this.spectra.length,
      filtered: this.filteredSpectra.length,
      zeoliteTypes: new Set(this.spectra.map(s => s.zeolite_name)).size,
      equipmentTypes: new Set(this.spectra.map(s => s.equipment)).size
    };
  }
}