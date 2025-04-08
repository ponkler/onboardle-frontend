import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Component, inject, OnInit } from '@angular/core';
import { HelpModalComponent } from "../help-modal/help-modal.component";
import { GuessModalComponent } from '../guess-modal/guess-modal.component';
import { ActivatedRoute, Router } from '@angular/router';

type DirectionKey = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

@Component({
  selector: 'app-game',
  imports: [CommonModule, ReactiveFormsModule, HelpModalComponent, GuessModalComponent],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent implements OnInit {

  private http = inject(HttpClient);
  private pipe = inject(DecimalPipe);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private now = new Date();
  private date = new Date();
  private dateString: string = "";

  dateOffset = 0;
  private startDate = new Date(2025, 2, 11, 0, 0, 0);

  private directionDict = {
    N: "⬆️",
    NE: "↗️",
    E: "➡️",
    SE: "↘️",
    S: "⬇️",
    SW: "↙️",
    W: "⬅️",
    NW: "↖️",
  }

  private storageKey: string = "";
  
  showHelpModal = false;
  showGuessModal = false;
  
  countdown: string = '';

  guessedArray: boolean[] = [];
  guessModalContent: Array<Object> = [];

  trackHelper: string = "";

  hasGuessed = false;

  game: any;
  gameId: any;
  gameStorage: any;
  image: any;
  drivers: any;
  correctDriverTeam: string | null = null;
  tracks: any;
  countries: any;
  teams: any;
  error: string | null = null;

  closeYear: boolean | null = null;
  closeTrack: boolean | null = null;
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
    setInterval(() => this.updateCountdown(), 1000);

    this.route.paramMap.subscribe((params) => {
      this.dateOffset = Number(params.get('offset'));
    })

    if (this.dateOffset < 0) {
      this.router.navigate(['/']);
    }

    this.date = new Date(Date.UTC(this.now.getUTCFullYear(), this.now.getUTCMonth(), this.now.getUTCDate() - this.dateOffset, this.now.getUTCHours() - 16, this.now.getUTCMinutes(), this.now.getUTCSeconds()));

    if (this.date < this.startDate) {
      this.router.navigate(['/']);
    }

    this.dateString = this.date.toISOString();
    this.storageKey = this.dateString.substring(0, this.dateString.indexOf('T'));

    this.http.get(`/api/games/getid/${this.storageKey}`).subscribe({
      next: (response) => {
        this.gameId = response;

        this.http.get(`/api/games/${this.gameId}`).subscribe({
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

            this.http.get(`/api/drivers/${btoa(this.game.photoInfo.year)}`).subscribe({
              next: (response: any) => {
                this.correctDriverTeam = response.drivers.find((driver: any) => driver.name == this.game.photoInfo.driver).teamName;
              }
            });

            this.guessedArray = [false, false, false, false, false];

            this.http.get('/api/photos/' + this.game.photoInfo.path, { responseType: 'blob' }).subscribe({
              next: (response) => {
                this.image = URL.createObjectURL(response);
              },
              error: (err) => {
                console.error('Error fetching image:', err);
              }
            })

            this.generateGuessModalContent();
          },
          error: (err) => {
            console.error('Error fetching game:', err);
          }
        })
      }
    })

    this.guessForm.get('year')?.valueChanges.subscribe(value => {
      if (value) {
        let b64Year = btoa(String(value));

        this.guessForm.get('track')?.reset();
        this.guessForm.get('driver')?.reset();

        this.http.get(`/api/tracks/${b64Year}`).subscribe({
          next: (response: any) => {
            this.tracks = response.tracks.sort();
            this.countries = response.countries.sort();
          }
        });

        this.http.get(`/api/drivers/${b64Year}`).subscribe({
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
      driver: this.guessForm.get('driver')?.value,
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

      this.updateFeedback(guess, correctGuess);
      this.gameStorage.guesses.push(guess);
      this.updateLocalStorage();

      if (JSON.stringify(guess) === JSON.stringify(correctGuess)) {
        this.gameWon = true;
        this.generateGuessModalContent();
        return;
      }

      this.error = null;
    } else {
      this.error = 'You must select a year, track, and driver before submitting.'
      console.error(this.error);
    }
    this.generateGuessModalContent();
  }

  buildGuessStrings(year: number, track: string, driver: string) {
    // 🟢🟡🔴
    let yearDriverDetails: any;
    let yearTrackDetails: any;

    let guessStrings = {
      yearString: "",
      trackString: "",
      helperString: "",
      driverString: "",
    }

    this.http.get(`/api/drivers/${btoa(year.toString())}`).subscribe({
      next: (response: any) => {
        yearDriverDetails = response;
        this.http.get(`/api/tracks`).subscribe({
          next: (response: any) => {
            yearTrackDetails = response;

            let guess = {
              year: year,
              track: track,
              driver: driver
            }
            let guessTrack = yearTrackDetails.tracks.filter((track: any) => track.name === guess.track)[0];
        
            let correctGuess = {
              year: this.gameStorage.year.toString(),
              track: this.gameStorage.track,
              driver: this.gameStorage.driver
            }

            let correctTrack = yearTrackDetails.tracks.filter((track: any) => track.name === correctGuess.track)[0];

            let distsBetweenTracks = this.calculateHaversineDistance(guessTrack.longitude, guessTrack.latitude, correctTrack.longitude, correctTrack.latitude);
            let directionToActual: DirectionKey = this.calculateBearing(guessTrack.longitude, guessTrack.latitude, correctTrack.longitude, correctTrack.latitude);

            let helperString = "";
            
            if (distsBetweenTracks.km !== 0) {
              helperString = `${this.directionDict[directionToActual]} ${this.pipe.transform(distsBetweenTracks.km, '1.2-2')} km / ${this.pipe.transform(distsBetweenTracks.mi, '1.2-2')} mi`;
            }
        
            let yearString = "";
            let trackString = "";
            let driverString = "";
        
            let closeDrivers = yearDriverDetails.drivers.filter((driver: any) => driver.teamName === this.correctDriverTeam)
              .map((driver: any) => driver.name);
            
            if (guess.year.toString() === correctGuess.year.toString()) {
              yearString = `🟢 ${guess.year}`;
            } else if (Math.abs(guess.year - correctGuess.year) <= 2) {
              yearString = `🟡 ${guess.year}`;
            } else {
              yearString = `🔴 ${guess.year}`;
            }
        
            let guessTrackCountry = yearTrackDetails.tracks.filter((track: any) => track.name === guess.track)[0].country;

            if (guess.track.toString() === correctGuess.track.toString()) {
              trackString = `🟢 ${guess.track}, ${guessTrackCountry}`;
            } else if (distsBetweenTracks.km <= 2000.0) {
              trackString = `🟡 ${guess.track}, ${guessTrackCountry}`;
            } else {
              trackString = `🔴 ${guess.track}, ${guessTrackCountry}`;
            }
        
            let guessDriverTeam = yearDriverDetails.drivers.filter((driver: any) => driver.name === guess.driver)[0].teamName;
        
            if (guess.driver.toString() === correctGuess.driver.toString()) {
              driverString = `🟢 ${guess.driver}, ${guessDriverTeam}`;
            } else if (closeDrivers.includes(guess.driver)) {
              driverString = `🟡 ${guess.driver}, ${guessDriverTeam}`;
            } else {
              driverString = `🔴 ${guess.driver}, ${guessDriverTeam}`;
            }

            guessStrings.yearString = yearString;
            guessStrings.trackString = trackString;
            guessStrings.helperString = helperString;
            guessStrings.driverString = driverString;
          }
        });
      }
    });
    return guessStrings;
  }

  updateFeedback(guess: any, correctGuess: any) {
    let closeDrivers = this.drivers.filter((driver: any) => driver.teamName === this.correctDriverTeam)
      .map((driver: any) => driver.name);

    this.http.get(`/api/tracks`).subscribe({
      next: (response: any) => {
        let allTracks = response;

        let guessTrack = allTracks.tracks.filter((track: any) => track.name === guess.track)[0];
        let correctTrack = allTracks.tracks.filter((track: any) => track.name === correctGuess.track)[0];

        let distsBetweenTracks = this.calculateHaversineDistance(guessTrack.longitude, guessTrack.latitude, correctTrack.longitude, correctTrack.latitude);
        let directionToActual: DirectionKey = this.calculateBearing(guessTrack.longitude, guessTrack.latitude, correctTrack.longitude, correctTrack.latitude);

        this.trackHelper = `${this.directionDict[directionToActual]} ${this.pipe.transform(distsBetweenTracks.km, '1.2-2')} km / ${this.pipe.transform(distsBetweenTracks.mi, '1.2-2')} mi`;


        if (guess.year.toString() === correctGuess.year.toString()) {
          this.correctYear = true;
          this.closeYear = false;
        } else if (Math.abs(guess.year - correctGuess.year) <= 2) {
          this.closeYear = true;
          this.correctYear = false;
        } else {
          this.closeYear = false;
          this.correctYear = false;
        }

        if (guess.track.toString() === correctGuess.track.toString()) {
          this.correctTrack = true;
          this.closeTrack = false;
        } else if (distsBetweenTracks.km <= 2000.0) {
          this.closeTrack = true;
          this.correctTrack = false;
        } else {
          this.correctTrack = false;
          this.closeTrack = false;
        }

        if (guess.driver.toString() === correctGuess.driver.toString()) {
          this.correctDriver = true;
          this.closeDriver = false;
        } else if (closeDrivers.includes(guess.driver)) {
          this.closeDriver = true;
          this.correctDriver = false;
        } else {
          this.closeDriver = false;
          this.correctDriver = false;
        }
      }
    })
  }

  updateLocalStorage() {
    localStorage.setItem(this.storageKey, btoa(JSON.stringify(this.gameStorage)));
  }

  private updateCountdown() {
    let now = new Date();
    const nextGameTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, -8, 0, 0));
    
    const timeDifference = nextGameTime.getTime() - now.getTime();

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
    if (!this.hasGuessed) return 'border-gray-500 border';
    if (this.correctYear === true) return 'border-emerald-500 border-4';
    if (this.closeYear === true) return 'border-amber-300 border-4';
    if (this.correctYear === false) return 'border-rose-700 border-4';
    return 'border-gray-500 border';
  }
  
  getTrackBorderClass(): string {
    if (!this.hasGuessed) return 'border-gray-500 border';
    if (this.correctTrack === true) return 'border-emerald-500 border-4';
    if (this.closeTrack === true) return 'border-amber-300 border-4';
    if (this.correctTrack === false) return 'border-rose-700 border-4';
    return 'border-gray-500 border';
  }
  
  getDriverBorderClass(): string {
    if (!this.hasGuessed) return 'border-gray-500 border';
    if (this.correctDriver === true) return 'border-emerald-500 border-4';
    if (this.closeDriver === true) return 'border-amber-300 border-4';
    if (this.correctDriver === false) return 'border-rose-700 border-4';
    return 'border-gray-500 border';
  }

  getGameDate(): string {
    return this.storageKey;
  }

  openHelpModal() {
    this.showHelpModal = true;
  }

  closeHelpModal() {
    this.showHelpModal = false;
  }

  openGuessModal() {
    this.showGuessModal = true;
  }

  closeGuessModal() {
    this.showGuessModal = false;
  }

  generateGuessModalContent() {
    this.gameStorage.guesses.forEach((element: any, index: number) => {
      let content = this.buildGuessStrings(element.year, element.track, element.driver);
      this.guessModalContent[index] = content;
    });
  }

  calculateBearing(
    guessLon: number, 
    guessLat: number, 
    actualLon: number, 
    actualLat: number): DirectionKey {
    let radians = Math.atan2((actualLon - guessLon), (actualLat - guessLat));

    var compassReading = radians * (180 / Math.PI);

    var coordNames: Array<DirectionKey> = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
    var coordIndex = Math.round(compassReading / 45);
    if (coordIndex < 0) {
      coordIndex = coordIndex + 8
    };

    return coordNames[coordIndex];
  }

  calculateHaversineDistance(
    guessLon: number, 
    guessLat: number, 
    actualLon: number, 
    actualLat: number) {
      const R = 6371000;
      
      let guessPhi = this.degreesToRadians(guessLat);
      let actualPhi = this.degreesToRadians(actualLat);

      let deltaPhi = this.degreesToRadians(actualLat - guessLat);
      let deltaLambda = this.degreesToRadians(actualLon - guessLon);

      let a = Math.sin(deltaPhi / 2.0) * Math.sin(deltaPhi / 2.0)
        + Math.cos(guessPhi) * Math.cos(actualPhi) 
        * Math.sin(deltaLambda / 2.0) * Math.sin(deltaLambda / 2.0);

      let c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));

      let distInKm = (R * c) / 1000.0;
      let distInMi = distInKm / 1.609344;

      return {km: distInKm, mi: distInMi};
  }

  degreesToRadians(deg: number) {
    return deg * (Math.PI / 180);
  }

  hasPreviousGame() {
    let previousDate = new Date(this.date.getFullYear(), this.date.getMonth(), this.date.getDate() - 1);

    if (previousDate >= this.startDate) {
      return true;
    }
    return false;
  }

  previousGame() {
    this.router.navigate([`/offset/${this.dateOffset + 1}`])
    .then(() => {
      window.location.reload();
    });
  }

  nextGame() {
    this.router.navigate([`/offset/${this.dateOffset - 1}`])
    .then(() => {
      window.location.reload();
    });
  }
}
