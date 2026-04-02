import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type State = 'loading' | 'success' | 'already' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="verify-page">
      <div class="card">
        <!-- Logo -->
        <div class="logo">🔬 FTIR Zeolitas UAS</div>

        <!-- Loading -->
        <ng-container *ngIf="state === 'loading'">
          <div class="spinner"></div>
          <h2>Verificando tu correo...</h2>
          <p>Por favor espera un momento.</p>
        </ng-container>

        <!-- Success -->
        <ng-container *ngIf="state === 'success'">
          <div class="icon success">✓</div>
          <h2>¡Correo verificado!</h2>
          <p>Tu dirección de correo ha sido verificada exitosamente.</p>
          <div class="info-box">
            Un administrador revisará tu solicitud y activará tu cuenta pronto. Recibirás un correo cuando tu cuenta esté lista.
          </div>
          <a routerLink="/welcome" class="btn">Ir al inicio de sesión</a>
        </ng-container>

        <!-- Already verified -->
        <ng-container *ngIf="state === 'already'">
          <div class="icon info">ℹ</div>
          <h2>Ya verificado</h2>
          <p>Tu correo ya fue verificado anteriormente.</p>
          <a routerLink="/welcome" class="btn">Ir al inicio de sesión</a>
        </ng-container>

        <!-- Error -->
        <ng-container *ngIf="state === 'error'">
          <div class="icon error">✕</div>
          <h2>Enlace inválido</h2>
          <p>El enlace de verificación es inválido o ya fue utilizado.</p>
          <p class="sub">Si el problema persiste, contacta al administrador.</p>
          <a routerLink="/welcome" class="btn secondary">Volver al inicio</a>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .verify-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #f0f4f8 0%, #e8eef5 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      font-family: system-ui, Arial, sans-serif;
    }

    .card {
      background: white;
      border-radius: 1.25rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.1);
      padding: 3rem 2.5rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }

    .logo {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: bold;
      margin: 0 auto 1.5rem;
    }

    .icon.success { background: #dcfce7; color: #16a34a; }
    .icon.info    { background: #dbeafe; color: #2563eb; }
    .icon.error   { background: #fee2e2; color: #dc2626; }

    h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.75rem;
    }

    p {
      color: #6b7280;
      line-height: 1.6;
      margin: 0 0 1rem;
    }

    .sub { font-size: 0.9rem; }

    .info-box {
      background: #eef7ff;
      border-left: 4px solid #2E75B6;
      border-radius: 0 8px 8px 0;
      padding: 1rem 1.25rem;
      color: #1e3a5f;
      font-size: 0.9rem;
      line-height: 1.6;
      text-align: left;
      margin: 1.5rem 0;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e5e7eb;
      border-top-color: #1e3a5f;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.5rem;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #1e3a5f, #2E75B6);
      color: white;
      padding: 0.875rem 2rem;
      border-radius: 0.75rem;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
      margin-top: 1rem;
      transition: opacity 0.2s;
    }

    .btn:hover { opacity: 0.9; }

    .btn.secondary {
      background: #f3f4f6;
      color: #374151;
    }
  `]
})
export class VerifyEmailComponent implements OnInit {
  state: State = 'loading';

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state = 'error';
      return;
    }

    this.http.get<{ success: boolean; message: string }>(
      `http://localhost:8000/api/auth/verify-email?token=${token}`
    ).subscribe({
      next: (res) => {
        this.state = res.message.includes('previamente') ? 'already' : 'success';
      },
      error: () => {
        this.state = 'error';
      }
    });
  }
}
