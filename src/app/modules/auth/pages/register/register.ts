import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { RegisterModal } from '../../components/register-modal/register-modal';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, RouterModule, RegisterModal],
  template: `
    <div class="register-page">
      <div class="page-background">
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
      </div>

      <app-register-modal
        *ngIf="showRegisterModal"
        (closeRequest)="closeRegisterModal()"
        (registerSuccess)="handleRegisterSuccess($event)">
      </app-register-modal>

      <div *ngIf="!showRegisterModal" class="page-container">
        <div class="centered-message">
          <h2>El formulario de registro se cerró</h2>
          <p>Si deseas registrarte, puedes volver a abrir el formulario.</p>
          
          <button (click)="showRegisterModal = true" class="btn btn-primary">
            Abrir Formulario de Registro
          </button>
          
          <a routerLink="/welcome" class="back-link">← Volver a la página principal</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .register-page {
      position: relative;
      min-height: 100vh;
      width: 100%;
      background: linear-gradient(135deg, #FFFFFF 0%, #F0F4F8 100%);
      overflow: hidden;
    }

    .page-background {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
    }

    .gradient-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.12;
      animation: float 15s ease-in-out infinite;
    }

    .orb-1 {
      width: 400px;
      height: 400px;
      background: linear-gradient(135deg, #2E75B6, #1F4E79);
      top: -100px;
      left: -100px;
    }

    .orb-2 {
      width: 300px;
      height: 300px;
      background: linear-gradient(135deg, #FFC107, #FFB300);
      bottom: -50px;
      right: -50px;
      animation-delay: -7s;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-40px); }
    }

    .page-container {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }

    .centered-message {
      background: white;
      padding: 3rem 2rem;
      border-radius: 1.25rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
      max-width: 450px;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.8);
    }

    .centered-message h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 1rem 0;
    }

    .centered-message p {
      font-size: 1rem;
      color: #6b7280;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }

    .btn {
      padding: 0.875rem 1.5rem;
      border-radius: 0.875rem;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-block;
      margin-bottom: 1rem;
      font-family: inherit;
    }

    .btn-primary {
      background: linear-gradient(135deg, #2E75B6, #1F4E79);
      color: white;
      box-shadow: 0 8px 20px rgba(46, 117, 182, 0.3);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(46, 117, 182, 0.4);
    }

    .back-link {
      display: inline-block;
      color: #2E75B6;
      text-decoration: none;
      font-weight: 500;
      font-size: 0.95rem;
      transition: color 0.2s ease;
      margin-top: 0.5rem;
    }

    .back-link:hover {
      color: #1F4E79;
      text-decoration: underline;
    }
  `]
})
export class Register implements OnInit {
  showRegisterModal = false;

  constructor(private router: Router) {}

  ngOnInit() {
    this.showRegisterModal = true;
  }

  closeRegisterModal() {
    this.showRegisterModal = false;
    this.router.navigate(['/welcome']);
  }

  handleRegisterSuccess(event: any) {
    console.log('✅ Registro exitoso:', event);
    this.showRegisterModal = false;
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 500);
  }
}