type OnAvailabilityChange = (available: number) => void;
type OnWaitMessage = (message: string) => void;

export class DataLoader {
  loadsAvailable: number;
  cooldownMs: number;
  timeoutMs: number;
  #onAvailabilityChange?: OnAvailabilityChange;
  #onWaitMessage?: OnWaitMessage;

  constructor(opts: { initialLoads: number; cooldownMs: number; timeoutMs?: number; onAvailabilityChange?: OnAvailabilityChange; onWaitMessage?: OnWaitMessage }) {
    this.loadsAvailable = Math.max(0, opts.initialLoads);
    this.cooldownMs = Math.max(0, opts.cooldownMs);
    this.timeoutMs = Math.max(1, opts.timeoutMs ?? 30000);
    this.#onAvailabilityChange = opts.onAvailabilityChange;
    this.#onWaitMessage = opts.onWaitMessage;
  }

  async request<T>(fn: () => Promise<T>): Promise<T> {
    await this.#waitForAvailability();
    this.loadsAvailable = Math.max(0, this.loadsAvailable - 1);
    this.#onAvailabilityChange?.(this.loadsAvailable);
    setTimeout(() => {
      this.loadsAvailable++;
      this.#onAvailabilityChange?.(this.loadsAvailable);
    }, this.cooldownMs);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), this.timeoutMs));
      const result = await Promise.race([fn(), timeoutPromise]);
      return result as T;
    } finally {
      this.#waitForAvailability();
    }
  }

  async #waitForAvailability(): Promise<void> {
    while (this.loadsAvailable === 0) {
      this.#onWaitMessage?.('Loads available: 0. Waiting for cooldown.');
      await new Promise(r => setTimeout(r, 500));
    }
    this.#onWaitMessage?.('');
  }
}

export default DataLoader;
