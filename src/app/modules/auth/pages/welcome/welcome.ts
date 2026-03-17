import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { LoginModal } from '../../components/login-modal/login-modal';
import { RegisterModal } from '../../components/register-modal/register-modal';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule, LoginModal, RegisterModal],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css']
})
export class WelcomeComponent {
  showLoginModal = false;
  showRegisterModal = false;

  constructor(private router: Router) {}

  openLoginModal() {
    this.showLoginModal = true;
  }

  openRegisterModal() {
    this.showRegisterModal = true;
  }

  closeLoginModal() {
    this.showLoginModal = false;
  }

  closeRegisterModal() {
    this.showRegisterModal = false;
  }

  handleLoginSuccess(event: any) {
    console.log('✅ Login exitoso:', event);
    this.showLoginModal = false;
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 500);
  }

  handleRegisterSuccess(event: any) {
    console.log('✅ Registro exitoso:', event);
    this.showRegisterModal = false;
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 500);
  }
}