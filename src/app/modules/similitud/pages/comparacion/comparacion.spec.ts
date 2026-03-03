import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Comparacion } from './comparacion';

describe('Comparacion', () => {
  let component: Comparacion;
  let fixture: ComponentFixture<Comparacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Comparacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Comparacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
