import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EspectroLoaderService } from '../../../../core/services/espectro-loader.service';
import {
  ZEOLITE_FAMILIES,
  ZEOLITE_CATEGORIES,
  ZeoliteFamily
} from '../../../../core/guards/data/zeolite-families';

@Component({
  selector: 'app-listado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './listado.html',
  styleUrl: './listado.css'
})
export class Listado implements OnInit {

  // Espectros cargados
  spectra: any[] = [];

  // Catálogo de zeolitas
  zeoliteFamilies = ZEOLITE_FAMILIES;
  filteredFamilies: ZeoliteFamily[] = [];
  zeoliteCategories = ZEOLITE_CATEGORIES;

  // Filtros
  searchTerm: string = '';
  selectedCategory: string = '';

  // Paginación
  pageSize: number = 25;
  currentPage: number = 1;

  // Vista
  activeTab: 'spectra' | 'catalog' = 'spectra';

  // Stats
  totalFamilies = ZEOLITE_FAMILIES.length;

  constructor(private espectroLoader: EspectroLoaderService) {}

  ngOnInit() {
    this.spectra = this.espectroLoader.getAllSpectra();
    this.filteredFamilies = [...this.zeoliteFamilies];
  }

  // ===== FILTROS =====
  filterCatalog() {
    const term = this.searchTerm.toLowerCase();
    this.filteredFamilies = this.zeoliteFamilies.filter(f => {
      const matchesTerm = !term ||
        f.code.toLowerCase().includes(term) ||
        f.name.toLowerCase().includes(term);
      const matchesCategory = !this.selectedCategory || f.category === this.selectedCategory;
      return matchesTerm && matchesCategory;
    });
    this.currentPage = 1;
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.filterCatalog();
  }

  // ===== PAGINACIÓN =====
  get paginatedFamilies(): ZeoliteFamily[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredFamilies.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredFamilies.length / this.pageSize);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // ===== ESPECTROS =====
  deleteSpectrum(id: string) {
    if (confirm('¿Eliminar este espectro?')) {
      this.espectroLoader.deleteSpectrum(id);
      this.spectra = this.espectroLoader.getAllSpectra();
    }
  }

  getCategoryCount(category: string): number {
    return this.zeoliteFamilies.filter(f => f.category === category).length;
  }

  trackByCode(index: number, family: ZeoliteFamily): string {
    return family.code;
  }
}
