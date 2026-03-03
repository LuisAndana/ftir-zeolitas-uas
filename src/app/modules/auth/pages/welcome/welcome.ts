import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { LoginModal } from '../../components/login-modal/login-modal';
import { RegisterModal } from '../../components/register-modal/register-modal';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css']
}) 
export class WelcomeComponent {

  constructor(private dialog: MatDialog) {}

  openLogin() {
    this.dialog.open(LoginModal, {
      width: '400px'
    });
  }

  openRegister() {
    this.dialog.open(RegisterModal, {
      width: '400px'
    });
  }
}