import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  menuOpen = false;

  constructor(private router: Router) {}

  ngOnInit() {
    this.loadCurrentUser();
  }

  loadCurrentUser() {
    const user = localStorage.getItem('currentUser');
    if (user) {
      this.currentUser = JSON.parse(user);
    } else {
      this.router.navigate(['/welcome']);
    }
  }

  logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      localStorage.removeItem('currentUser');
      this.router.navigate(['/welcome']);
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
}