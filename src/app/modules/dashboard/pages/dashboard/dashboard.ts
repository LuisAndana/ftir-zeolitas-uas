import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthBackendService, User } from '../../../../core/services/auth-backend.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  menuOpen = false;
  showLogoutModal = false;
  userDropdownOpen = false;

  private destroy$ = new Subject<void>();

  constructor(private router: Router, private auth: AuthBackendService) {}

  ngOnInit() {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (!user) {
        this.router.navigate(['/welcome']);
        return;
      }
      this.currentUser = user;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'administrador';
  }

  get userInitial(): string {
    return this.currentUser?.name?.charAt(0)?.toUpperCase() ?? '?';
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  toggleUserDropdown() {
    this.userDropdownOpen = !this.userDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) {
      this.userDropdownOpen = false;
    }
  }

  openLogoutModal() {
    this.userDropdownOpen = false;
    this.showLogoutModal = true;
  }

  closeLogoutModal() {
    this.showLogoutModal = false;
  }

  confirmLogout() {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/welcome']),
      error: () => this.router.navigate(['/welcome'])
    });
  }
}
