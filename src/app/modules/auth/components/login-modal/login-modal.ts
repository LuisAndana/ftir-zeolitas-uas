import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthBackendService } from '../../../../core/services/auth-backend.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

type ErrorState = 'generic' | 'email_not_verified' | 'account_pending';

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
  errorState: ErrorState | null = null;
  errorMessage = '';
  showPassword = false;

  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder, private authService: AuthBackendService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  submit() {
    if (this.form.invalid) {
      this.errorState = 'generic';
      this.errorMessage = 'Por favor, completa todos los campos correctamente';
      return;
    }

    this.loading = true;
    this.errorState = null;
    this.errorMessage = '';

    const { email, password } = this.form.value;

    this.authService.login(email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.loginSuccess.emit({
            email: response.data!.user.email,
            name: response.data!.user.name
          });
          this.form.reset();
        },
        error: (error) => {
          this.loading = false;
          const detail: string = error?.error?.detail ?? error?.detail ?? '';

          if (detail === 'EMAIL_NOT_VERIFIED') {
            this.errorState = 'email_not_verified';
          } else if (detail === 'ACCOUNT_PENDING_APPROVAL') {
            this.errorState = 'account_pending';
          } else if (error?.status === 401 || detail.includes('Credenciales')) {
            this.errorState = 'generic';
            this.errorMessage = 'Email o contraseña incorrectos';
          } else {
            this.errorState = 'generic';
            this.errorMessage = 'Error en el servidor. Intenta más tarde';
          }
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
