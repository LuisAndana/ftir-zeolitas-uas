import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FiltrosAvanzados } from './filtros-avanzados';

describe('FiltrosAvanzados', () => {
  let component: FiltrosAvanzados;
  let fixture: ComponentFixture<FiltrosAvanzados>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiltrosAvanzados]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FiltrosAvanzados);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
