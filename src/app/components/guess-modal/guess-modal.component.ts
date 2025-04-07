import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

// 🟢🟡🔴
@Component({
  selector: 'app-guess-modal',
  imports: [],
  templateUrl: './guess-modal.component.html',
  styleUrl: './guess-modal.component.css'
})
export class GuessModalComponent {
  @Output() close = new EventEmitter<void>();
  @Input() content: any;

  closeGuess() {
    this.close.emit();
  }
}