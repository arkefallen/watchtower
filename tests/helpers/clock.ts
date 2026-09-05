export interface Clock { now(): Date; }

export class FakeClock implements Clock {
  constructor(private current: Date = new Date("2026-01-01T00:00:00.000Z")) {}
  now(): Date { return new Date(this.current); }
  advanceMs(milliseconds: number): void { this.current = new Date(this.current.getTime() + milliseconds); }
  set(value: Date): void { this.current = new Date(value); }
}
