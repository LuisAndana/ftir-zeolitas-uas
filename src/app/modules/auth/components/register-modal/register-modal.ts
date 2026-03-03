import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-modal.html',
  styleUrl: './register-modal.css'
})
export class RegisterModal {
  @Output() closeRequest = new EventEmitter<void>();
  @Output() registerSuccess = new EventEmitter<{ email: string; name: string }>();

  name: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  acceptTerms: boolean = false;
  showPassword: boolean = false;
  showTermsError: boolean = false;
  errorMessage: string = '';

  passwordStrength: number = 0;
  passwordStrengthClass: string = '';
  passwordStrengthText: string = '';

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  updatePasswordStrength() {
    let strength = 0;

    // Longitud
    if (this.password.length >= 8) strength++;
    if (this.password.length >= 12) strength++;

    // Tipos de caracteres
    if (/[a-z]/.test(this.password)) strength++;
    if (/[A-Z]/.test(this.password)) strength++;
    if (/[0-9]/.test(this.password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.password)) strength++;

    this.passwordStrength = strength;
    this.updatePasswordStrengthDisplay();
  }

  updatePasswordStrengthDisplay() {
    if (this.passwordStrength <= 2) {
      this.passwordStrengthClass = 'strength-weak';
      this.passwordStrengthText = 'Débil';
    } else if (this.passwordStrength <= 4) {
      this.passwordStrengthClass = 'strength-medium';
      this.passwordStrengthText = 'Medio';
    } else {
      this.passwordStrengthClass = 'strength-strong';
      this.passwordStrengthText = 'Fuerte';
    }
  }

  isFormValid(): boolean {
    return (
      this.name.length >= 3 &&
      this.isValidEmail(this.email) &&
      this.password.length >= 8 &&
      this.password === this.confirmPassword &&
      this.acceptTerms
    );
  }

  register() {
    this.errorMessage = '';
    this.showTermsError = false;

    // Validar términos
    if (!this.acceptTerms) {
      this.showTermsError = true;
      this.errorMessage = 'Debes aceptar los términos y condiciones';
      return;
    }

    // Validar formulario
    if (!this.isFormValid()) {
      this.errorMessage = 'Por favor completa todos los campos correctamente';
      return;
    }

    // Obtener usuarios existentes
    const users = this.getAllUsers();

    // Verificar si el email ya existe
    if (users.some(user => user.email === this.email)) {
      this.errorMessage = 'Este email ya está registrado. Intenta con otro.';
      return;
    }

    // Crear nuevo usuario
    const newUser = {
      id: Date.now().toString(),
      name: this.name,
      email: this.email,
      password: this.hashPassword(this.password),
      createdAt: new Date().toISOString()
    };

    // Guardar usuario
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    // Establecer sesión
    const userData = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('currentUser', JSON.stringify(userData));

    console.log('✅ Usuario registrado:', newUser);
    this.registerSuccess.emit({ email: this.email, name: this.name });
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

  private hashPassword(password: string): string {
    // En producción: usar bcrypt en el backend
    return btoa(password);
  }

  closeModal() {
    this.closeRequest.emit();
  }
}