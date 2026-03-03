import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficaEspectro } from './grafica-espectro';

describe('GraficaEspectro', () => {
  let component: GraficaEspectro;
  let fixture: ComponentFixture<GraficaEspectro>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficaEspectro]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraficaEspectro);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
