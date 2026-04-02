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
  /** Correo al que se envió la verificación, indica éxito */
  verificationSentTo = '';

  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder, private authService: AuthBackendService) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const pw  = group.get('password')?.value;
    const cpw = group.get('passwordConfirm')?.value;
    return pw === cpw ? null : { passwordMismatch: true };
  }

  checkPasswordStrength() {
    const pw = this.form.get('password')?.value || '';
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^a-zA-Z\d]/.test(pw)) s++;
    this.passwordStrength = s;
  }

  submit() {
    if (this.form.invalid) {
      this.errorMessage = 'Por favor, completa todos los campos correctamente';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { name, email, password } = this.form.value;

    this.authService.register(name, email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.verificationSentTo = email;
          // Emitir para que el padre sepa, pero no redirigir de inmediato
          this.registerSuccess.emit({ email, name });
        },
        error: (error) => {
          this.loading = false;
          const detail: string = error?.error?.detail ?? error?.detail ?? '';
          if (detail.includes('ya está registrado')) {
            this.errorMessage = 'Este correo ya está registrado. ¿Quieres iniciar sesión?';
          } else if (error?.status === 422) {
            this.errorMessage = 'Datos inválidos. Verifica el formulario';
          } else {
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
