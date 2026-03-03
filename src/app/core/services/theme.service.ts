import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  toggleDarkMode() {
    document.body.classList.toggle('dark-theme');
  }
}