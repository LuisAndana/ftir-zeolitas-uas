import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-modal.html',
  styleUrl: './login-modal.css'
})
export class LoginModal implements OnInit {
  @Output() closeRequest = new EventEmitter<void>();
  @Output() loginSuccess = new EventEmitter<{ email: string; name: string }>();

  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  showPassword: boolean = false;
  errorMessage: string = '';

  ngOnInit() {
    this.loadSavedCredentials();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  loadSavedCredentials() {
    const savedLogin = localStorage.getItem('loginCredentials');
    if (savedLogin) {
      try {
        const credentials = JSON.parse(savedLogin);
        this.email = credentials.email;
        this.rememberMe = true;
      } catch (e) {
        console.error('Error al cargar credenciales guardadas:', e);
      }
    }
  }

  login() {
    this.errorMessage = '';

    // Validaciones
    if (!this.email) {
      this.errorMessage = 'Por favor ingresa tu correo electrónico';
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage = 'Por favor ingresa un correo válido';
      return;
    }

    if (!this.password) {
      this.errorMessage = 'Por favor ingresa tu contraseña';
      return;
    }

    // Obtener usuarios registrados
    const users = this.getAllUsers();
    
    // Buscar usuario con ese email
    const user = users.find(u => u.email === this.email);

    if (!user) {
      this.errorMessage = 'Usuario no encontrado. Por favor regístrate primero.';
      return;
    }

    // Verificar contraseña
    if (!this.verifyPassword(this.password, user.password)) {
      this.errorMessage = 'Contraseña incorrecta';
      return;
    }

    // Login exitoso
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('currentUser', JSON.stringify(userData));

    // Guardar credenciales si se marcó "Recuérdame"
    if (this.rememberMe) {
      localStorage.setItem('loginCredentials', JSON.stringify({ email: this.email }));
    } else {
      localStorage.removeItem('loginCredentials');
    }

    console.log('✅ Login exitoso:', userData);
    this.loginSuccess.emit({ email: user.email, name: user.name });
    this.closeModal();
  }

  private getAllUsers(): any[] {
    try {
      const users = localStorage.getItem('users');
      return users ? JSON.parse(users) : [];
    } catch (e) {
      console.error('Error al leer usuarios:', e);
      return [];
    }
  }

  private verifyPassword(inputPassword: string, hashedPassword: string): boolean {
    // Comparar el hash (en producción usarías bcrypt en backend)
    return btoa(inputPassword) === hashedPassword;
  }

  closeModal() {
    this.closeRequest.emit();
  }
}