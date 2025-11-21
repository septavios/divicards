import { html, LitElement, TemplateResult, CSSResult, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';

@customElement('e-settings-panel')
export class SettingsPanelElement extends LitElement {
  static override styles: Array<CSSResult> = [css`
    :host { display: inline-block; }
    .panel { 
      padding: 1rem; 
      width: 280px; 
      background: var(--sl-color-neutral-0);
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: 0.5rem;
      box-shadow: var(--sl-shadow-medium);
    }
    :host-context(.sl-theme-dark) .panel {
      background: var(--sl-color-neutral-800);
      border-color: var(--sl-color-neutral-700);
    }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
    .label { font-size: 0.9rem; color: var(--sl-color-neutral-700); font-weight: 500; }
    :host-context(.sl-theme-dark) .label { color: var(--sl-color-neutral-200); }
    sl-input { width: 80px; }
    .actions { display: flex; justify-content: flex-end; margin-top: 1rem; pt: 0.5rem; border-top: 1px solid var(--sl-color-neutral-200); padding-top: 0.75rem; }
    :host-context(.sl-theme-dark) .actions { border-top-color: var(--sl-color-neutral-700); }
  `];

  @property({ type: Number }) concurrency: number = 2;
  @property({ type: Number }) delayMs: number = 2000;

  @state() private loaded = false;

  connectedCallback(): void {
    super.connectedCallback();
    const c = Number(localStorage.getItem('divicards.stashes.bulkConcurrency') || '');
    const d = Number(localStorage.getItem('divicards.stashes.bulkBatchDelayMs') || '');
    if (Number.isFinite(c) && c > 0) this.concurrency = c;
    if (Number.isFinite(d) && d >= 0) this.delayMs = d;
    this.loaded = true;
    this.#emitUpdate();
  }

  protected override render(): TemplateResult {
    return html`
      <sl-dropdown>
        <sl-button slot="trigger" size="small" title="Settings"><sl-icon name="gear" slot="prefix"></sl-icon>Settings</sl-button>
        <div class="panel">
          <div class="row">
            <span class="label">Bulk concurrency</span>
            <sl-input type="number" min="1" max="16" size="small" .value=${String(this.concurrency)} @sl-change=${this.#onConcurrencyChange}></sl-input>
          </div>
          <div class="row">
            <span class="label">Batch delay (ms)</span>
            <sl-input type="number" min="0" max="60000" size="small" .value=${String(this.delayMs)} @sl-change=${this.#onDelayChange}></sl-input>
          </div>
          <div class="actions">
            <sl-button size="small" variant="primary" @click=${this.#apply}>Apply</sl-button>
          </div>
        </div>
      </sl-dropdown>
    `;
  }

  #onConcurrencyChange(e: Event): void {
    const v = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(v) && v >= 1) this.concurrency = Math.floor(v);
  }

  #onDelayChange(e: Event): void {
    const v = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(v) && v >= 0) this.delayMs = Math.floor(v);
  }

  #apply(): void {
    localStorage.setItem('divicards.stashes.bulkConcurrency', String(this.concurrency));
    localStorage.setItem('divicards.stashes.bulkBatchDelayMs', String(this.delayMs));
    this.#emitUpdate();
  }

  #emitUpdate(): void {
    if (!this.loaded) return;
    this.dispatchEvent(new CustomEvent('upd:bulk_settings', {
      detail: { bulkConcurrency: this.concurrency, bulkBatchDelayMs: this.delayMs },
      bubbles: true,
      composed: true
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'e-settings-panel': SettingsPanelElement;
  }
}

