import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, AdminUser } from '../../../../core/services/admin.service';
import { AuthBackendService } from '../../../../core/services/auth-backend.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.css'
})
export class AdminPanelComponent implements OnInit {
  users: AdminUser[] = [];
  loading = true;
  errorMsg = '';
  successMsg = '';
  currentUserId: number | null = null;
  confirmDeleteId: number | null = null;

  constructor(
    private adminService: AdminService,
    private auth: AuthBackendService
  ) {}

  ngOnInit() {
    this.currentUserId = this.auth.getCurrentUserSync()?.id ?? null;
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.errorMsg = '';
    this.adminService.getUsers().subscribe({
      next: (res) => {
        this.users = res.data;
        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'Error al cargar los usuarios';
        this.loading = false;
      }
    });
  }

  toggleActive(user: AdminUser) {
    this.adminService.updateUser(user.id, { is_active: !user.is_active }).subscribe({
      next: (res) => {
        user.is_active = res.data.is_active;
        this.showSuccess(
          user.is_active
            ? `Cuenta de ${user.name} activada`
            : `Cuenta de ${user.name} desactivada`
        );
      },
      error: () => this.showError('No se pudo actualizar el usuario')
    });
  }

  changeRole(user: AdminUser, role: 'investigador' | 'administrador') {
    this.adminService.updateUser(user.id, { role }).subscribe({
      next: (res) => {
        user.role = res.data.role;
        this.showSuccess(`Rol de ${user.name} actualizado a ${role}`);
      },
      error: () => this.showError('No se pudo actualizar el rol')
    });
  }

  confirmDelete(userId: number) {
    this.confirmDeleteId = userId;
  }

  cancelDelete() {
    this.confirmDeleteId = null;
  }

  deleteUser(user: AdminUser) {
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.confirmDeleteId = null;
        this.showSuccess(`Usuario ${user.name} eliminado`);
      },
      error: () => this.showError('No se pudo eliminar el usuario')
    });
  }

  getStatusLabel(user: AdminUser): string {
    if (!user.is_verified) return 'Sin verificar';
    if (!user.is_active) return 'Pendiente';
    return 'Activo';
  }

  getStatusClass(user: AdminUser): string {
    if (!user.is_verified) return 'badge-unverified';
    if (!user.is_active) return 'badge-pending';
    return 'badge-active';
  }

  activeCount(): number {
    return this.users.filter(u => u.is_active).length;
  }

  pendingCount(): number {
    return this.users.filter(u => u.is_verified && !u.is_active).length;
  }

  private showSuccess(msg: string) {
    this.successMsg = msg;
    this.errorMsg = '';
    setTimeout(() => (this.successMsg = ''), 3500);
  }

  private showError(msg: string) {
    this.errorMsg = msg;
    setTimeout(() => (this.errorMsg = ''), 4000);
  }
}
