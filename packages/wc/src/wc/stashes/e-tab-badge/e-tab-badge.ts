import { html, LitElement, CSSResult, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { REMOVE_ONLY } from '../e-tab-badge-group/e-tab-badge-group.js';
import type { NoItemsTab } from 'poe-custom-elements/types.js';
import { styles } from './e-tab-badge.styles.js';
import { TabClickEvent } from './events.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/badge/badge.js';

@customElement('e-tab-badge')
export class TabBadgeElement extends LitElement {
	static styles: Array<CSSResult> = [styles];

	@property({ type: Object }) tab!: NoItemsTab;
	@property({ type: Boolean }) disabled = false;
	@property({ type: Boolean, reflect: true }) selected = false;
	/** Any valid CSS color */
	@property({ reflect: true, attribute: 'color' }) color?: string;
    /** Whether this tab is pinned */
    @property({ type: Boolean }) pinned = false;
    /** Auxiliary quantity indicator (e.g., MapStash children count) */
    @property({ type: Number }) childCount: number | null = null;

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
			<span class="type-icon"><sl-icon name="${this.#iconForType(this.tab.type as unknown as string)}"></sl-icon></span>
			${this.nameLabel()}
			${this.childCount && this.childCount > 0 ? html`<sl-badge class="count-badge" variant="neutral" pill>${this.childCount}</sl-badge>` : null}
			<sl-icon class="pin-icon" name="${this.pinned ? 'star-fill' : 'star'}" @click=${this.#togglePin} title="${this.pinned ? 'Unpin tab' : 'Pin tab'}"></sl-icon>
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

    #iconForType(type: string | undefined): string {
        switch (type) {
            case 'CurrencyStash': return 'currency-exchange';
            case 'MapStash': return 'map';
            case 'FragmentStash': return 'layout-three-columns';
            case 'EssenceStash': return 'droplet-half';
            case 'GemStash': return 'gem';
            case 'DivinationCardStash': return 'collection';
            case 'PremiumStash': return 'box';
            case 'QuadStash': return 'boxes';
            default: return 'folder2';
        }
    }

	protected nameLabel(): TemplateResult {
		const removeOnly = this.tab.name.includes(REMOVE_ONLY);

		if (removeOnly) {
			const [name] = this.tab.name.split(REMOVE_ONLY);
			return html`<label for=${this.tab.id} class="name">${name}<span class="remove-only">R</span></label>`;
		}

		return html`<label for=${this.tab.id} class="name">${this.tab.name}</label>`;
	}

    #togglePin(e: Event) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('e-tab-badge__toggle-pin', {
            detail: { id: this.tab.id, pinned: !this.pinned },
            bubbles: true,
            composed: true
        }));
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
