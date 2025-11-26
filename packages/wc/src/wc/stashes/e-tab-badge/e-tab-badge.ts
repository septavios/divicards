import { html, LitElement, CSSResult, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { REMOVE_ONLY } from '../e-tab-badge-group/e-tab-badge-group.js';
import type { NoItemsTab } from 'poe-custom-elements/types.js';
import { styles } from './e-tab-badge.styles.js';
import { TabClickEvent } from './events.js';

@customElement('e-tab-badge')
export class TabBadgeElement extends LitElement {
	static styles: Array<CSSResult> = [styles];

	@property({ type: Object }) tab!: NoItemsTab;
	@property({ type: Boolean }) disabled = false;
	@property({ type: Boolean, reflect: true }) selected = false;
	/** Any valid CSS color */
	@property({ reflect: true, attribute: 'color' }) color?: string;

	@state() tabState!: NoItemsTab;

	protected override render(): TemplateResult {
		const cssProps = styleMap({
			'--badge-color': `${this.computedColor}`,
			'--tab-index': `' ${this.tab.index} '`,
		});

		return html`<button
			.disabled=${this.disabled}
			@click=${this.#emit_tab_click}
			style=${cssProps}
			class="tab-badge-as-button"
		>
			${this.nameLabel()}
		</button>`;
	}

	get computedColor(): string {
        if (this.color) {
            return this.color;
        }
        if (this.tab.metadata?.colour) {
            return `#${this.tab.metadata?.colour?.padStart(6, '0')}`;
        }
        return 'var(--sl-color-neutral-500)';
    }

	protected nameLabel(): TemplateResult {
		const removeOnly = this.tab.name.includes(REMOVE_ONLY);

		if (removeOnly) {
			const [name] = this.tab.name.split(REMOVE_ONLY);
			return html`<label for=${this.tab.id} class="name">${name}<span class="remove-only">R</span></label>`;
		}

		return html`<label for=${this.tab.id} class="name">${this.tab.name}</label>`;
	}

	#emit_tab_click() {
		this.dispatchEvent(new TabClickEvent(this.tab, { composed: true }));
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'e-tab-badge': TabBadgeElement;
	}
}
