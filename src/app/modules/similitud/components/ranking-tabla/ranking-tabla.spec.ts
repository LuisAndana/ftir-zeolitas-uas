import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RankingTabla } from './ranking-tabla';

describe('RankingTabla', () => {
  let component: RankingTabla;
  let fixture: ComponentFixture<RankingTabla>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RankingTabla]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RankingTabla);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
