import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Component, inject, OnInit } from '@angular/core';

@Component({
  selector: 'app-game',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent implements OnInit {
  private http = inject(HttpClient);
  private date = new Date(Date.now()).toISOString();
  private storageKey = this.date.substring(0, this.date.indexOf('T'));
  private intervalId: any;
  
  countdown: string = '';

  guessedArray: boolean[] = [];

  hasGuessed = false;

  game: any;
  gameStorage: any;
  image: any;
  drivers: any;
  correctDriverTeam: string | null = null;
  tracks: any;
  teams: any;
  error: string | null = null;

  closeYear: boolean | null = null;
  closeDriver: boolean | null = null;

  correctYear: boolean | null = null;
  correctTrack: boolean | null = null;
  correctDriver: boolean | null = null;

  gameWon: boolean = false;

  years: number[] = Array.from({length: 2025-1985}, (_, i: number) => 1985 + i);

  guessForm = new FormGroup({
    year: new FormControl(0, [Validators.required]),
    driver: new FormControl('', [Validators.required]),
    track: new FormControl('', [Validators.required])
  })

  ngOnInit() {
    this.updateCountdown();
    this.intervalId = setInterval(() => this.updateCountdown(), 1000);

    this.http.get('http://18.119.120.216:5000/games').subscribe({
      next: (response) => {
        this.game = response;
        if (localStorage.getItem(this.storageKey) != null) {
          this.gameStorage = JSON.parse(atob(localStorage.getItem(this.storageKey)!));
          if (this.gameStorage.guesses.length > 0) {
            this.hasGuessed = true;
          };
          let alreadyWon = this.gameStorage.guesses.some(
            (item: any) => JSON.stringify(item) === JSON.stringify({
              year: this.gameStorage.year.toString(),
              track: this.gameStorage.track,
              driver: this.gameStorage.driver
            })
          )
          if (alreadyWon) {
            this.gameWon = true;
          }
        } else {
          this.gameStorage = {
            year: this.game.photoInfo.year,
            track: this.game.photoInfo.track,
            driver: this.game.photoInfo.driver,
            guesses: []
          };
          localStorage.setItem(this.storageKey, btoa(JSON.stringify(this.gameStorage)));
        }
        this.http.get(`http://18.119.120.216:5000/drivers/${this.game.photoInfo.year}`).subscribe({
          next: (response: any) => {
            this.correctDriverTeam = response.drivers.find((driver: any) => driver.name == this.game.photoInfo.driver).teamName;
          }
        });
        this.guessedArray = [false, false, false, false, false];
        this.http.get('http://18.119.120.216:5000' + this.game.photoInfo.path, { responseType: 'blob' }).subscribe({
          next: (response) => {
            this.image = URL.createObjectURL(response);
          },
          error: (err) => {
            console.error('Error fetching image:', err);
          }
        })
      },
      error: (err) => {
        console.error('Error fetching game:', err);
      }
    })

    this.guessForm.get('year')?.valueChanges.subscribe(value => {
      if (value) {
        this.guessForm.get('track')?.reset();
        this.guessForm.get('driver')?.reset();
        this.http.get(`http://18.119.120.216:5000/tracks/${value}`).subscribe({
          next: (response) => {
            this.tracks = response;
          }
        });
        this.http.get(`http://18.119.120.216:5000/drivers/${value}`).subscribe({
          next: (response: any) => {
            this.drivers = response.drivers;
            this.teams = response.teams;
          }
        });
      }
    });
  }

  submitGuess() {
    let guess = {
      year: this.guessForm.get('year')?.value,
      track: this.guessForm.get('track')?.value,
      driver: this.guessForm.get('driver')?.value
    }

    let correctGuess = {
      year: this.gameStorage.year.toString(),
      track: this.gameStorage.track,
      driver: this.gameStorage.driver
    }

    if (this.guessForm.valid) {
      this.hasGuessed = true;

      for (let item of this.gameStorage.guesses) {
        if (JSON.stringify(item) === JSON.stringify(guess)) {
          this.error = 'Already guessed.';
          console.error(this.error);
          return;
        }
      }

      this.gameStorage.guesses.push(guess);
      this.updateLocalStorage();

      if (JSON.stringify(guess) === JSON.stringify(correctGuess)) {
        console.log("Game won");
        this.gameWon = true;
        return;
      }

      this.updateFeedback(guess, correctGuess);
      this.error = null;
    } else {
      this.error = 'You must select a year, track, and driver before submitting.'
      console.error(this.error);
    }
  }

  updateFeedback(guess: any, correctGuess: any) {
    let closeDrivers = this.drivers.filter((driver: any) => driver.teamName === this.correctDriverTeam)
      .map((driver: any) => driver.name);

    if (guess.year.toString() === correctGuess.year.toString()) {
      console.log("correct year");
      this.correctYear = true;
      this.closeYear = false;
    } else if (Math.abs(guess.year - correctGuess.year) <= 2) {
      this.closeYear = true;
      this.correctYear = false;
    } else {
      this.closeYear = false;
      this.correctYear = false;
    }

    if (guess.driver.toString() === correctGuess.driver.toString()) {
      console.log("correct driver");
      this.correctDriver = true;
      this.closeDriver = false;
    } else if (closeDrivers.includes(guess.driver)) {
      this.closeDriver = true;
      this.correctDriver = false;
    } else {
      this.closeDriver = false;
      this.correctDriver = false;
    }

    if (guess.track.toString() === correctGuess.track.toString()) {
      this.correctTrack = true;
    } else {
      this.correctTrack = false;
    }
  }

  updateLocalStorage() {
    localStorage.setItem(this.storageKey, btoa(JSON.stringify(this.gameStorage)));
  }

  private updateCountdown() {
    const now = new Date();
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    
    const timeDifference = utcMidnight.getTime() - now.getTime();

    if (timeDifference > 0) {
      const hours = Math.floor(timeDifference / (1000 * 60 * 60));
      const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

      this.countdown = `${hours}:${this.padZero(minutes)}:${this.padZero(seconds)}`;
    } else {
      this.countdown = "00:00:00";
    }
  }

  private padZero(num: number): string {
    return num < 10 ? '0' + num : num.toString();
  }

  getYearBorderClass(): string {
    if (!this.hasGuessed) return 'dark:border-gray-500 border';
    if (this.correctYear) return 'dark:border-emerald-500 border-4';
    if (this.closeYear) return 'dark:border-amber-300 border-4';
    return 'dark:border-rose-700 border-4';
  }
  
  getTrackBorderClass(): string {
    if (!this.hasGuessed) return 'dark:border-gray-500 border';
    return this.correctTrack ? 'dark:border-emerald-500 border-4' : 'dark:border-rose-700 border-4';
  }
  
  getDriverBorderClass(): string {
    if (!this.hasGuessed) return 'dark:border-gray-500 border';
    if (this.correctDriver) return 'dark:border-emerald-500 border-4';
    if (this.closeDriver) return 'dark:border-amber-300 border-4';
    return 'dark:border-rose-700 border-4';
  }
  
}
