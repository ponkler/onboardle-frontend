import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuessModalComponent } from './guess-modal.component';

describe('GuessModalComponent', () => {
  let component: GuessModalComponent;
  let fixture: ComponentFixture<GuessModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuessModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
