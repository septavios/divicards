import { html, nothing, LitElement, TemplateResult, CSSResult } from 'lit';
import { property, state, query, customElement } from 'lit/decorators.js';
import '../e-tab-badge/e-tab-badge.js';
import { type League, isPermanentLeague } from '@divicards/shared/types.js';
import { ACTIVE_LEAGUE } from '@divicards/shared/lib.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/button-group/button-group.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/badge/badge.js';
import '../../e-pagination/e-pagination.js';
import '../../e-help-tip.js';

import type { ErrorLabel, SelectedStashtabs } from '../types.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { NoItemsTab } from 'poe-custom-elements/types.js';
import { PerPageChangeEvent } from '../../events/change/per_page.js';
import { styles } from './e-tab-badge-group.styles.js';

declare global {
    interface HTMLElementTagNameMap {
        'e-tab-badge-group': TabBadgeGroupElement;
    }
}

export const REMOVE_ONLY = '(Remove-only)';

@customElement('e-tab-badge-group')
export class TabBadgeGroupElement extends LitElement {
    static override styles: Array<CSSResult> = [styles];

    @property({ type: Boolean, attribute: 'badges-disabled' }) badgesDisabled = false;
    @property({ type: Boolean }) multiselect = false;
    @property({ type: Array }) stashes: NoItemsTab[] = [];
    @property({ reflect: true }) league: League = ACTIVE_LEAGUE;
    @property({ type: Array }) errors: Array<ErrorLabel> = [];
    @property() hoveredErrorTabId: string | null = null;
    @property({ type: Number, reflect: true }) perPage = 30;
    @property({ type: Number, reflect: true }) page = 1;
    /** Query for searching stashtab by name */
    @property() stashtab_name_query = '';
    @property({ type: Object }) selected_tabs: SelectedStashtabs = new Map();
    @property({ reflect: true }) density: 'ultra' | 'dense' | 'compact' | 'cozy' | 'comfortable' = 'ultra';

    @state() hideRemoveOnly = false;

    @query('sl-input#per-page') perPageInput!: HTMLInputElement;
    @query('sl-input#page') pageInput!: HTMLInputElement;
    @query('sl-input#filter-stashes-by-name') nameQueryInput!: HTMLInputElement;

    #debounceTimer: number | null = null;



    constructor() {
        super();
    }

    connectedCallback(): void {
        super.connectedCallback();
        window.addEventListener('keydown', this.#onKeyDown);
    }

    disconnectedCallback(): void {
        window.removeEventListener('keydown', this.#onKeyDown);
        super.disconnectedCallback();
    }
    get shouldFilter(): boolean {
        return this.stashes.length > 0;
    }
    get withHideRemoveOnly(): boolean {
        return shouldUnlockHideRemoveOnly(this.league, this.stashes);
    }
    get tabsTotal(): number {
        return this._filtered.length;
    }

    @state() private _filtered: NoItemsTab[] = [];
    @state() private _paginated: NoItemsTab[] = [];

    willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('stashtab_name_query') || changed.has('hideRemoveOnly') || changed.has('perPage')) {
            this.page = 1;
        }

        const stashesChanged = changed.has('stashes');
        const queryChanged = changed.has('stashtab_name_query');
        const hideRemoveOnlyChanged = changed.has('hideRemoveOnly');

        if (stashesChanged || queryChanged || hideRemoveOnlyChanged) {
            this._filtered = filter(this.stashes, this.stashtab_name_query, this.shouldFilter, this.hideRemoveOnly);
        }

        if (stashesChanged || queryChanged || hideRemoveOnlyChanged || changed.has('page') || changed.has('perPage')) {
            this._paginated = paginate(this._filtered, this.page, this.perPage);
        }
    }

    protected override render(): TemplateResult {
        return html`
			<div class="tab-badge-group">
				${this.shouldFilter
                ? html`<header class="header-compact">
							<div class="header-left">
                                <sl-input
                                    size="small"
                                    type="text"
                                    id="filter-stashes-by-name"
                                    placeholder="Search tabs..."
                                    .value=${this.stashtab_name_query}
                                    @input=${this.#change_query}
                                    clearable
                                    aria-label="Search stash tabs by name"
                                    style="width: 240px;"
                                >
                                    <sl-icon name="search" slot="prefix"></sl-icon>
                                </sl-input>
								
								<div class="stats-badge">
									<span class="tab-count">${this.tabsTotal} tabs</span>
								</div>
								
								<div class="selection-controls">
									<sl-button size="small" variant="primary" outline @click=${this.#selectAll}>
										<sl-icon name="check-all" slot="prefix"></sl-icon>
										Select All
									</sl-button>
									<sl-button size="small" variant="primary" outline @click=${this.#clearAll} ?disabled=${this.selected_tabs.size === 0}>
										<sl-icon name="x-circle" slot="prefix"></sl-icon>
										Clear All
									</sl-button>
								</div>
							</div>
							
							<div class="header-center">
                                <sl-button-group>
                                    <sl-button 
                                        size="small"
                                        ?disabled=${this.page <= 1}
                                        @click=${this.decreasePage}
                                    >
                                        <sl-icon name="chevron-left"></sl-icon>
                                    </sl-button>
                                    <sl-button size="small" disabled class="page-display">
                                        ${this.page} / ${Math.ceil(this.tabsTotal / this.perPage)}
                                    </sl-button>
                                    <sl-button 
                                        size="small"
                                        ?disabled=${this.page >= Math.ceil(this.tabsTotal / this.perPage)}
                                        @click=${this.increasePage}
                                    >
                                        <sl-icon name="chevron-right"></sl-icon>
                                    </sl-button>
                                </sl-button-group>

                                <sl-select 
                                    size="small" 
                                    value="${this.perPage}" 
                                    @sl-change=${(e: any) => this.#handle_per_page_change(new PerPageChangeEvent(Number(e.target.value)))}
                                    hoist
                                    style="width: 80px;"
                                >
                                    <sl-option value="20">20</sl-option>
                                    <sl-option value="30">30</sl-option>
                                    <sl-option value="50">50</sl-option>
                                    <sl-option value="100">100</sl-option>
                                </sl-select>
							</div>
							
							                            <div class="header-right">
								
                                ${this.withHideRemoveOnly ? html`
                                    <sl-tooltip content="${this.hideRemoveOnly ? 'Show remove-only tabs' : 'Hide remove-only tabs'}">
                                        <sl-icon-button 
                                            name="${this.hideRemoveOnly ? 'eye-slash' : 'eye'}"
                                            @click=${() => { this.hideRemoveOnly = !this.hideRemoveOnly; }}
                                            style="font-size: 1.1rem;"
                                        ></sl-icon-button>
                                    </sl-tooltip>
                                ` : nothing}

                                <sl-select size="small" value=${this.density} hoist @sl-change=${(e: any) => { this.density = e.target.value; }} style="width: 100px;">
                                    <sl-option value="ultra">Ultra</sl-option>
                                    <sl-option value="dense">Dense</sl-option>
                                    <sl-option value="compact">Compact</sl-option>
                                    <sl-option value="cozy">Cozy</sl-option>
                                    <sl-option value="comfortable">Comfortable</sl-option>
                                </sl-select>
                                <e-help-tip>
                                    <p><strong>Keyboard shortcuts</strong></p>
                                    <ul>
                                        <li>/ Focus search</li>
                                        <li>Esc Clear search</li>
                                        <li>←/→ Page navigation</li>
                                    </ul>
                                </e-help-tip>
                            </div>
                      </header>`
                : nothing
            }
                <div role="list" class="list-compact">
                    ${repeat(this._paginated, (tab) => tab.id, (tab) => html`
                        <div
                            class=${classMap({
                error: this.errors.some(({ noItemsTab }) => noItemsTab.id === tab.id),
                'hovered-error': this.hoveredErrorTabId === tab.id,
                selected: this.selected_tabs.has(tab.id),
            })}
                            role="listitem"
                        >
                            <e-tab-badge
                                .as=${'button'}
                                .tab=${tab}
                                .selected=${this.selected_tabs.has(tab.id)}
                                .disabled=${this.badgesDisabled}
                            ></e-tab-badge>
                        </div>
                    `)}
                </div>
            </div>`;
    }

    #handle_per_page_change({ per_page }: PerPageChangeEvent): void {
        this.perPage = per_page;
        this.dispatchEvent(new PerPageChangeEvent(per_page));
    }
    #change_query(e: InputEvent): void {
        const value = (e.target as HTMLInputElement).value;
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }
        this.#debounceTimer = window.setTimeout(() => {
            this.stashtab_name_query = value;
            this.#debounceTimer = null;
        }, 200);
    }



    decreasePage(): void {
        if (this.page > 1) {
            this.page--;
        }
    }
    increasePage(): void {
        this.page++;
    }

    #selectAll() {
        const newSelected = new Map(this.selected_tabs);
        for (const t of this.stashes) {
            newSelected.set(t.id, { id: t.id, name: t.name });
        }
        this.selected_tabs = newSelected;
        this.dispatchEvent(new CustomEvent('e-tab-badge-group__selected-tabs-change', {
            detail: { selected_tabs: this.selected_tabs },
            bubbles: true,
            composed: true
        }));
    }

    #clearAll() {
        this.selected_tabs = new Map();
        this.dispatchEvent(new CustomEvent('e-tab-badge-group__selected-tabs-change', {
            detail: { selected_tabs: this.selected_tabs },
            bubbles: true,
            composed: true
        }));
    }



    #onKeyDown = (e: KeyboardEvent) => {
        const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        const isTyping = targetTag === 'input' || targetTag === 'textarea';

        if (e.key === '/' && !isTyping) {
            this.nameQueryInput?.focus();
            e.preventDefault();
        }
        if (e.key === 'Escape') {
            if (this.nameQueryInput) {
                this.nameQueryInput.value = '';
                this.stashtab_name_query = '';
            }
        }
        if (!isTyping) {
            if (e.key === 'ArrowLeft') {
                this.decreasePage();
                e.preventDefault();
            }
            if (e.key === 'ArrowRight') {
                this.increasePage();
                e.preventDefault();
            }
        }
    };
}

function filter(
    stashes: NoItemsTab[],
    nameQuery: string,
    shouldFilter: boolean,
    hideRemoveOnly: boolean
): NoItemsTab[] {
    if (!shouldFilter) return stashes;

    return stashes.filter(({ name }) => {
        if (hideRemoveOnly) {
            if (name.includes(REMOVE_ONLY)) return false;
        }
        return name.toLowerCase().includes(nameQuery.toLowerCase());
    });
}

function paginate(stashes: NoItemsTab[], page: number, perPage: number) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return stashes.slice(start, end);
}

function shouldUnlockHideRemoveOnly(league: League, stashes: NoItemsTab[]) {
    return isPermanentLeague(league) && stashes.some(({ name }) => name.includes(REMOVE_ONLY));
}
