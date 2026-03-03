import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CargarEspectro } from './cargar-espectro';

describe('CargarEspectro', () => {
  let component: CargarEspectro;
  let fixture: ComponentFixture<CargarEspectro>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CargarEspectro]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CargarEspectro);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
