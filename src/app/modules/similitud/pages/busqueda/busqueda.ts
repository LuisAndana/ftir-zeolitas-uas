import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EspectroLoaderService } from '../../../../core/services/espectro-loader.service';
import { SimilarityService, SimilarityConfig, SimilarityResult } from '../../../../core/services/similarity.service';
import {
  ZEOLITE_FAMILIES,
  ZEOLITE_CATEGORIES,
  SPECTRAL_WINDOWS,
  ZeoliteFamily
} from '../../../../core/guards/data/zeolite-families';

@Component({
  selector: 'app-busqueda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './busqueda.html',
  styleUrl: './busqueda.css'
})
export class Busqueda implements OnInit {

  // Datos
  spectra: any[] = [];
  selectedSpectrumId: string = '';
  selectedSpectrum: any = null;
  results: SimilarityResult[] = [];
  searching = false;
  searchDone = false;

  // Familias de zeolitas
  zeoliteFamilies = ZEOLITE_FAMILIES;
  zeoliteCategories = ZEOLITE_CATEGORIES;
  spectralWindows = SPECTRAL_WINDOWS;
  filteredFamilies: ZeoliteFamily[] = [];
  familySearchTerm: string = '';
  selectedCategory: string = '';

  // Configuración de búsqueda
  config: SimilarityConfig = {
    method: 'cosine',
    tolerance: 4,
    rangeMin: 400,
    rangeMax: 4000,
    familyFilter: null,
    topN: 10,
    useWindows: false,
    selectedWindows: []
  };

  // UI
  showAdvancedFilters = false;
  showFamilyDropdown = false;
  selectedFamilyName: string = '';

  constructor(
    private espectroLoader: EspectroLoaderService,
    private similarityService: SimilarityService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.spectra = this.espectroLoader.getAllSpectra();
    this.filteredFamilies = [...this.zeoliteFamilies];

    // Check if a spectrum was pre-selected from route params
    this.route.queryParams.subscribe(params => {
      if (params['spectrum']) {
        this.selectedSpectrumId = params['spectrum'];
        this.onSpectrumSelected();
      }
    });
  }

  onSpectrumSelected() {
    this.selectedSpectrum = this.spectra.find(s => s.id === this.selectedSpectrumId);
    this.results = [];
    this.searchDone = false;
  }

  filterFamilies() {
    const term = this.familySearchTerm.toLowerCase();
    this.filteredFamilies = this.zeoliteFamilies.filter(f => {
      const matchesTerm = !term ||
        f.code.toLowerCase().includes(term) ||
        f.name.toLowerCase().includes(term) ||
        f.category.toLowerCase().includes(term);
      const matchesCategory = !this.selectedCategory || f.category === this.selectedCategory;
      return matchesTerm && matchesCategory;
    });
  }

  selectFamily(family: ZeoliteFamily | null) {
    if (family) {
      this.config.familyFilter = family.code;
      this.selectedFamilyName = `${family.code} - ${family.name}`;
    } else {
      this.config.familyFilter = null;
      this.selectedFamilyName = '';
    }
    this.showFamilyDropdown = false;
  }

  toggleWindow(windowName: string) {
    const idx = this.config.selectedWindows.indexOf(windowName);
    if (idx >= 0) {
      this.config.selectedWindows.splice(idx, 1);
    } else {
      this.config.selectedWindows.push(windowName);
    }
  }

  isWindowSelected(name: string): boolean {
    return this.config.selectedWindows.includes(name);
  }

  trackByCode(index: number, family: ZeoliteFamily): string {
  return family.code;
}
  /**
   * CU-F-005: Ejecutar búsqueda de similitud
   */
  search() {
    if (!this.selectedSpectrum) return;

    this.searching = true;
    this.results = [];

    // Simular tiempo de procesamiento
    setTimeout(() => {
      const query = this.selectedSpectrum;

      // Obtener espectros de referencia (todos los demás)
      const references = this.spectra.filter(s => s.id !== query.id);

      for (const ref of references) {
        // Filtro por familia
        if (this.config.familyFilter && ref.metadata?.family !== this.config.familyFilter) {
          continue;
        }

        // Calcular similitud global
        const globalScore = this.similarityService.calculateSimilarity(
          query.wavenumbers, query.data,
          ref.wavenumbers, ref.data,
          this.config
        );

        // Calcular similitud por ventanas si está habilitado
        let windowScores: { window: string; score: number }[] = [];
        if (this.config.useWindows) {
          windowScores = this.similarityService.calculateWindowSimilarity(
            query.wavenumbers, query.data,
            ref.wavenumbers, ref.data,
            this.config
          );
        }

        // Detectar picos y match con tolerancia
        const queryPeaks = this.similarityService.detectPeaks(query.wavenumbers, query.data);
        const refPeaks = this.similarityService.detectPeaks(ref.wavenumbers, ref.data);
        const peakMatch = this.similarityService.matchPeaksWithTolerance(
          queryPeaks, refPeaks, this.config.tolerance
        );

        this.results.push({
          spectrumId: ref.id,
          filename: ref.filename,
          family: ref.metadata?.family || 'N/D',
          globalScore: globalScore,
          windowScores: windowScores,
          matchingPeaks: peakMatch.matched.length,
          totalPeaks: peakMatch.total
        });
      }

      // Ordenar por score descendente
      this.results.sort((a, b) => b.globalScore - a.globalScore);

      // Limitar a Top-N
      this.results = this.results.slice(0, this.config.topN);

      this.searching = false;
      this.searchDone = true;
    }, 500);
  }

  getScoreClass(score: number): string {
    if (score >= 0.9) return 'score-excellent';
    if (score >= 0.7) return 'score-good';
    if (score >= 0.5) return 'score-medium';
    return 'score-low';
  }

  getScoreLabel(score: number): string {
    if (score >= 0.9) return 'Excelente';
    if (score >= 0.7) return 'Bueno';
    if (score >= 0.5) return 'Moderado';
    return 'Bajo';
  }

  getScorePercent(score: number): string {
    return (score * 100).toFixed(1);
  }

  formatMethod(method: string): string {
    const names: Record<string, string> = {
      'cosine': 'Similitud Coseno',
      'pearson': 'Correlación de Pearson',
      'euclidean': 'Distancia Euclidiana'
    };
    return names[method] || method;
  }
}
