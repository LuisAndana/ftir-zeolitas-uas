import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  menuOpen = false;
  showLogoutModal = false;

  constructor(private router: Router) {}

  ngOnInit() {
    this.loadCurrentUser();
  }

  loadCurrentUser() {
    const user = localStorage.getItem('current_user');
    if (user) {
      try {
        this.currentUser = JSON.parse(user);
        console.log('✅ Usuario cargado:', this.currentUser.name);
      } catch (e) {
        console.error('Error al cargar usuario:', e);
        this.router.navigate(['/welcome']);
      }
    } else {
      console.warn('No hay usuario en localStorage');
      this.router.navigate(['/welcome']);
    }
  }

  openLogoutModal() {
    this.showLogoutModal = true;
  }

  closeLogoutModal() {
    this.showLogoutModal = false;
  }

  confirmLogout() {
    // Limpiar localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('token_expires_at');

    console.log('✅ Sesión cerrada');
    this.router.navigate(['/welcome']);
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
}