import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-help-modal',
  imports: [],
  templateUrl: './help-modal.component.html',
  styleUrl: './help-modal.component.css'
})
export class HelpModalComponent {
  @Output() close = new EventEmitter<void>();

  closeHelp() {
    this.close.emit();
  }
}
