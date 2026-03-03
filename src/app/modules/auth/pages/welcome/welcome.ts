import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LoginModal } from '../../components/login-modal/login-modal';
import { RegisterModal } from '../../components/register-modal/register-modal';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, LoginModal, RegisterModal],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css']
})
export class WelcomeComponent implements OnInit {
  showLoginModal = false;
  showRegisterModal = false;
  currentUser: any = null;

  constructor(private router: Router) {}

  ngOnInit() {
    // Verificar si hay usuario logueado
    this.checkCurrentUser();
  }

  checkCurrentUser() {
    const user = localStorage.getItem('currentUser');
    if (user) {
      try {
        this.currentUser = JSON.parse(user);
        console.log('Usuario autenticado:', this.currentUser);
        // Redirigir al dashboard
        this.router.navigate(['/dashboard']);
      } catch (e) {
        console.error('Error al cargar usuario:', e);
      }
    }
  }

  openLogin() {
    this.showLoginModal = true;
  }

  openRegister() {
    this.showRegisterModal = true;
  }

  closeLoginModal() {
    this.showLoginModal = false;
  }

  closeRegisterModal() {
    this.showRegisterModal = false;
  }

  handleLoginSuccess(event: { email: string; name: string }) {
    console.log('✅ Login exitoso:', event.name);
    this.currentUser = event;
    this.showLoginModal = false;
    // Redirigir al dashboard
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 500);
  }

  handleRegisterSuccess(event: { email: string; name: string }) {
    console.log('✅ Registro exitoso:', event.name);
    this.showRegisterModal = false;
    // Mostrar mensaje y abrir login
    alert(`¡Bienvenido ${event.name}! Ya puedes iniciar sesión.`);
    setTimeout(() => this.openLogin(), 500);
  }
}