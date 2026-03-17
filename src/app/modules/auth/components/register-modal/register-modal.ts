import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthBackendService } from '../../../../core/services/auth-backend.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-register-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './register-modal.html',
  styleUrls: ['./register-modal.css']
})
export class RegisterModal implements OnDestroy {
  @Output() closeRequest = new EventEmitter<void>();
  @Output() registerSuccess = new EventEmitter<{ email: string; name: string }>();

  form!: FormGroup;
  loading = false;
  errorMessage = '';
  showPassword = false;
  passwordStrength = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthBackendService
  ) {
    this.initForm();
  }

  private initForm() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const password = group.get('password')?.value;
    const passwordConfirm = group.get('passwordConfirm')?.value;
    return password === passwordConfirm ? null : { passwordMismatch: true };
  }

  checkPasswordStrength() {
    const password = this.form.get('password')?.value || '';
    let strength = 0;

    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    this.passwordStrength = strength;
  }

  submit() {
    if (this.form.invalid) {
      this.errorMessage = 'Por favor, completa todos los campos correctamente';
      console.warn('❌ Formulario inválido');
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { name, email, password } = this.form.value;

    console.log('📝 Registrando usuario:', { name, email });

    this.authService.register(name, email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('✅ Registro EXITOSO:', response);
          console.log('📦 Tokens guardados en localStorage:', {
            access_token: localStorage.getItem('access_token')?.substring(0, 20) + '...',
            refresh_token: localStorage.getItem('refresh_token')?.substring(0, 20) + '...',
            current_user: localStorage.getItem('current_user')
          });

          this.registerSuccess.emit({
            email: response.data.user.email,
            name: response.data.user.name
          });

          this.loading = false;
          this.form.reset();
        },
        error: (error: any) => {
          console.error('❌ Error en registro:', error);

          this.loading = false;

          if (error.status === 400) {
            this.errorMessage = error.error?.detail || 'El email ya está registrado';
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