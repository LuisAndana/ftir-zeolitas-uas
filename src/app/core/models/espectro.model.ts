export interface Espectro {
  id?: number;
  nombre: string;
  familia?: string;
  frecuencias: number[];
  intensidades: number[];
  tecnica?: string;
}