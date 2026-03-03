import { Injectable } from '@angular/core';
import { Espectro } from '../models/espectro.model';

@Injectable({
  providedIn: 'root'
})
export class EspectroService {

  private espectroActual!: Espectro;

  setEspectro(e: Espectro) {
    this.espectroActual = e;
  }

  getEspectro(): Espectro {
    return this.espectroActual;
  }
}