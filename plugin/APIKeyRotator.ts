export class APIKeyRotator {
  private keys: string[];
  private index: number = 0;

  constructor(keys: string[]) {
    this.keys = keys;
  }

  getNextKey(): string {
    const key = this.keys[this.index];
    this.index = (this.index + 1) % this.keys.length;
    return key;
  }
}
