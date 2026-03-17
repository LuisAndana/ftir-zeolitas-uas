import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthBackendService } from '../../../../core/services/auth-backend.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login-modal.html',
  styleUrls: ['./login-modal.css']
})
export class LoginModal implements OnDestroy {
  @Output() closeRequest = new EventEmitter<void>();
  @Output() loginSuccess = new EventEmitter<{ email: string; name: string }>();

  form!: FormGroup;
  loading = false;
  errorMessage = '';
  showPassword = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthBackendService
  ) {
    this.initForm();
  }

  private initForm() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  submit() {
    if (this.form.invalid) {
      this.errorMessage = 'Por favor, completa todos los campos correctamente';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { email, password } = this.form.value;

    console.log('🔐 Iniciando sesión:', { email });

    this.authService.login(email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('✅ Login EXITOSO:', response);
          console.log('📦 Tokens guardados en localStorage:', {
            access_token: localStorage.getItem('access_token')?.substring(0, 20) + '...',
            refresh_token: localStorage.getItem('refresh_token')?.substring(0, 20) + '...',
            current_user: localStorage.getItem('current_user')
          });

          this.loginSuccess.emit({
            email: response.data.user.email,
            name: response.data.user.name
          });

          this.loading = false;
          this.form.reset();
        },
        error: (error: any) => {
          console.error('❌ Error en login:', error);

          this.loading = false;

          if (error.status === 401) {
            this.errorMessage = 'Email o contraseña incorrectos';
          } else if (error.status === 422) {
            this.errorMessage = 'Datos inválidos. Verifica el formulario';
          } else {
            this.errorMessage = 'Error en el servidor. Intenta más tarde';
          }

          console.error('Error details:', this.errorMessage);
        }
      });
  }

  close() {
    this.closeRequest.emit();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}