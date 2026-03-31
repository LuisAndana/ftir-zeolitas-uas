import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

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

  // Filtros principales
  filterSampleCode = '';
  filterZeolite = '';
  filterEquipment = '';

  // Opciones disponibles para los dropdowns
  uniqueSampleCodes: string[] = [];
  uniqueZeolites: string[] = [];
  uniqueEquipments: string[] = [];

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 0;

  selectedSpectrum: DatasetSpectrum | null = null;
  showDetailsModal = false;

  private destroy$ = new Subject<void>();
  private filterSubject$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Debounce filter to keep rendering smooth with large datasets
    this.filterSubject$
      .pipe(debounceTime(150), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());

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
    const headers: any = { 'Content-Type': 'application/json' };
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
          if (response.success && Array.isArray(response.data)) {
            this.spectra = response.data;
            this.total = response.total || this.spectra.length;
            this.extractFilterOptions();
            this.applyFilters();
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error cargando dataset:', error);
          this.errorMessage = 'Error al cargar espectros del dataset. Verifica que el servidor esté activo.';
          this.loading = false;
        }
      });
  }

  /**
   * Extrae las opciones únicas para cada filtro
   */
  extractFilterOptions() {
    // Extraer códigos de muestra únicos y ordenados
    this.uniqueSampleCodes = Array.from(
      new Set(this.spectra.map(s => s.sample_code))
    ).sort();

    // Extraer tipos de zeolita únicos y ordenados
    this.uniqueZeolites = Array.from(
      new Set(this.spectra.map(s => s.zeolite_name))
    ).sort();

    // Extraer equipos únicos y ordenados
    this.uniqueEquipments = Array.from(
      new Set(this.spectra.map(s => s.equipment).filter(e => e))
    ).sort();
  }

  onFilterChange() {
    this.filterSubject$.next();
  }

  applyFilters() {
    const cFilter = this.filterSampleCode.toLowerCase();
    const zFilter = this.filterZeolite.toLowerCase();
    const eFilter = this.filterEquipment.toLowerCase();

    this.filteredSpectra = this.spectra.filter(s => {
      // Si el filtro está vacío, incluir todas las opciones
      if (cFilter && !s.sample_code.toLowerCase().includes(cFilter)) return false;
      if (zFilter && !s.zeolite_name.toLowerCase().includes(zFilter)) return false;
      if (eFilter && !s.equipment.toLowerCase().includes(eFilter)) return false;
      return true;
    });

    this.totalPages = Math.ceil(this.filteredSpectra.length / this.limit);
    this.page = 1;
  }

  /**
   * Limpia todos los filtros
   */
  clearFilters() {
    this.filterSampleCode = '';
    this.filterZeolite = '';
    this.filterEquipment = '';
    this.onFilterChange();
  }

  viewDetails(spectrum: DatasetSpectrum) {
    this.selectedSpectrum = spectrum;
    this.showDetailsModal = true;
  }

  closeModal() {
    this.showDetailsModal = false;
    this.selectedSpectrum = null;
  }

  downloadSpectrum(spectrum: DatasetSpectrum) {
    if (!spectrum.spectrum_data?.wavenumbers || !spectrum.spectrum_data?.intensities) {
      this.errorMessage = 'No hay datos espectrales disponibles para descargar';
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

    this.successMessage = `Espectro ${spectrum.sample_code} descargado correctamente`;
    setTimeout(() => this.successMessage = '', 3000);
  }

  goToPage(newPage: number) {
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.page = newPage;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  get paginatedSpectra(): DatasetSpectrum[] {
    const start = (this.page - 1) * this.limit;
    return this.filteredSpectra.slice(start, start + this.limit);
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