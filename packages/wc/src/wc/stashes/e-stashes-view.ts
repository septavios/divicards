import type { IStashLoader } from '@divicards/shared/IStashLoader.js';
import { html, PropertyValues, nothing, LitElement, CSSResult, TemplateResult } from 'lit';
import '../e-help-tip';
import DataLoader from './data-loader.js';
import CacheStore from './cache-store.js';
// league select moved to app toolbar
import './e-tab-badge-group/e-tab-badge-group.js';
import './e-stash-tab-errors';
import { property, state, query, customElement } from 'lit/decorators.js';
import { type League } from '@divicards/shared/types.js';
import { ACTIVE_LEAGUE } from '@divicards/shared/lib.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/button-group/button-group.js';
import '@shoelace-style/shoelace/dist/components/radio-button/radio-button.js';
import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
import { isStashTabError } from '@divicards/shared/error.js';
import type { ErrorLabel, SelectedStashtabs } from './types.js';
import { styles } from './e-stashes-view.styles.js';
import './e-stash-tab-container/e-stash-tab-container.js';
import './e-settings-panel.js';
import { Task } from '@lit/task';
import { ExtractCardsEvent as ContainerExtractCardsEvent } from './e-stash-tab-container/events.js';
import { NoItemsTab, TabWithItems } from 'poe-custom-elements/types.js';
// removed league change handler; app controls league
import {
	ExtractCardsEvent,
	SampleFromStashtabEvent,
	SelectedTabsChangeEvent,
	StashtabFetchedEvent,
	StashtabsBadgesFetchedEvent,
	AuthErrorEvent,
	CloseEvent,
	Events,
} from './events.js';
import { DefineComponent } from 'vue';
import { VueEventHandlers } from '../../event-utils.js';
import { TabClickEvent } from './e-tab-badge/events.js';
import { categoryFromKey, PoeGeneralPricedListElement } from './poe-general-priced-list.js';

const SECS_300 = 300 * 1000;

type ToastVariant = 'info' | 'success' | 'neutral' | 'warning' | 'danger';

export interface StashesViewProps {
	league?: League;
	stashLoader: IStashLoader;
}

export type DownloadAs = (typeof DOWNLOAD_AS_VARIANTS)[number];
const DOWNLOAD_AS_VARIANTS = ['divination-cards-sample', 'general-tab'] as const;

interface CachedTab {
	data: TabWithItems;
	timestamp: number;
}

@customElement('e-stashes-view')
export class StashesViewElement extends LitElement {
	static override styles: Array<CSSResult> = [styles];

	@property({ reflect: true }) league: League = ACTIVE_LEAGUE;
	@property() downloadAs: DownloadAs = 'divination-cards-sample';
	@property({ type: Boolean }) multiselect = false;
	@property({ type: Number }) bulkConcurrency: number = 2;
	@property({ type: Number }) bulkBatchDelayMs: number = 2000;

	@state() selected_tabs: SelectedStashtabs = new Map();
	/** PoE /stashes data about all stashtabs in stash (does not include items) */
	@state() stashtabs_badges: NoItemsTab[] = [];
	@state() noStashesMessage: string = '';
	@state() msg: string = '';
	@state() fetchingStashTab: boolean = false;
	@state() fetchingStash: boolean = false;
	@state() stashLoader!: IStashLoader;
	@state() errors: Array<ErrorLabel> = [];
	@state() stashLoadsAvailable = 30;
	@state() hoveredErrorTabId: string | null = null;
	@state() downloadedStashTabs: Array<TabWithItems> = [];
	@state() tabsCache: Map<string, CachedTab> = new Map();
	@state() lastError: { tag: string; message: string } | null = null;
	@state() retryLabel: string = '';
	@state() retryCallback: (() => Promise<void>) | null = null;
	private readonly CACHE_TTL = 5 * 60 * 1000;
	#cache = new CacheStore<TabWithItems>(this.CACHE_TTL);
	#loader = new DataLoader({ initialLoads: this.stashLoadsAvailable, cooldownMs: SECS_300, onAvailabilityChange: n => { this.stashLoadsAvailable = n; }, onWaitMessage: msg => { this.msg = msg; } });
	@state() opened_tab: NoItemsTab | null = null;
	@state() snapshots: Array<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }>; item_prices?: Record<string, number> }> = [];
	/** Indicator whether cards was just extracted. */
	@state() cardsJustExtracted = false;
	@state() showWealth = false;
	@state() hoveredSnapshot: { x: number; y: number; snapshot: any; index: number; align: 'center' | 'left' | 'right' } | null = null;
	@state() snapshotsLoading = false;
	@state() bulkProgress: { started: number; loaded: number; total: number; name: string } | null = null;
	@state() chartMode: 'chaos' | 'divine' = 'chaos';
	@state() chartRange: 'all' | 'recent' = 'all';
	@state() showPriceChanges = false;
	@state() priceChangeMode: 'item' | 'category' = 'category';
	@state() loadingPriceChanges = false;
	@state() priceChangesData: Array<any> = [];
	private lastToastTime = 0;
	@state() private aggregatedMemoKey: string = '';
	@state() private aggregatedTabMemo: TabWithItems | null = null;


	private stashTabTask = new Task(this, {
		task: async ([tab, selectedTabs]: [NoItemsTab | null, SelectedStashtabs]) => {
			if (this.multiselect && selectedTabs && selectedTabs.size === 0) {
				return null;
			}


			if (!tab) {
				return null;
			}
			// If we have this tab in cache, serve it without an API call
			const inCache = this.#cache.get(tab.id);
			if (inCache) {
				return inCache;
			}
			// Aggregate MapStash items across all children regardless of flattening
			if (tab.type === 'MapStash') {
				const parentId = tab.parent ?? tab.id;
				const cachedParent = this.#cache.get(parentId);
				if (cachedParent) {
					return cachedParent;
				}
				let children = this.stashtabs_badges.filter(t => t.parent === parentId);
				if (children.length > 0) {
					const childTabs = await Promise.all(children.map(child => this.stashLoader.tabFromBadge(child, this.league)));
					const items: TabWithItems['items'] = [];
					childTabs.forEach(ct => items.push(...ct.items));
					const aggregated = { ...tab, items, children } as TabWithItems;
					this.#cache.set(parentId, aggregated);
					return aggregated;
				}
				// fallback to existing child array if present
				if (Array.isArray(tab.children) && tab.children.length > 0) {
					const childTabs = await Promise.all(tab.children.map(child => this.stashLoader.tabFromBadge(child, this.league)));
					const items: TabWithItems['items'] = [];
					childTabs.forEach(ct => items.push(...ct.items));
					const aggregated = { ...tab, items, children: tab.children } as TabWithItems;
					this.#cache.set(parentId, aggregated);
					return aggregated;
				}
				// re-fetch badges to discover children and try again
				try {
					const badges = await this.stashLoader.tabs(this.league);
					this.stashtabs_badges = badges;
					children = badges.filter(t => t.parent === parentId);
					if (children.length > 0) {
						const childTabs = await Promise.all(children.map(child => this.stashLoader.tabFromBadge(child, this.league)));
						const items: TabWithItems['items'] = [];
						childTabs.forEach(ct => items.push(...ct.items));
						const aggregated = { ...tab, items, children } as TabWithItems;
						this.#setCachedTab(parentId, aggregated);
						return aggregated;
					}
				} catch (err) {
					this.#handleError('refresh-stashes', err, async () => {
						const badges = await this.stashLoader.tabs(this.league);
						this.stashtabs_badges = badges;
					}, 'Retry fetching stash tabs');
				}
			}
			const loaded = await this.#loadSingleTabContent('general-tab', tab.id, this.league, (_id, _league) => this.stashLoader.tabFromBadge(this.opened_tab!, this.league), false);
			if (loaded && typeof (loaded as any)?.id === 'string') {
				this.#cache.set((loaded as any).id, loaded as any);
			}
			return loaded;
		},
		args: () => [this.opened_tab, this.selected_tabs] as [NoItemsTab | null, SelectedStashtabs],
	});

	// Cache helper methods with TTL support
	#getCachedTab(id: string): TabWithItems | null {
		return this.#cache.get(id);
	}

	#toast(variant: ToastVariant, message: string): void {
		const now = Date.now();
		if (now - this.lastToastTime < 1000 && message === 'Snapshot captured') {
			return;
		}
		this.lastToastTime = now;
		this.dispatchEvent(new CustomEvent('stashes__toast', {
			detail: { variant, message },
			bubbles: true,
			composed: true
		}));
	}

	#setCachedTab(id: string, tab: TabWithItems): void {
		this.#cache.set(id, tab);
		if (this.multiselect && this.selected_tabs.has(id)) {
			this.#updateAggregatedMemo();
		}
		this.requestUpdate();
	}

	#renderAggregatedView(): TemplateResult | typeof nothing {
		if (!this.multiselect || this.selected_tabs.size === 0) return nothing;

		this.#updateAggregatedMemo();
		if (!this.aggregatedTabMemo) {
			return html`<e-stash-tab-container
				status="pending"
				@e-stash-tab-container__close=${this.#handleTabContainerClose}
			></e-stash-tab-container>`;
		}
		return html`<e-stash-tab-container
			.cardsJustExtracted=${this.cardsJustExtracted}
			@e-stash-tab-container__close=${this.#handleTabContainerClose}
			@e-stash-tab-container__extract-cards=${this.#emitExtractCards}
			status="complete"
			.league=${this.league}
			.stashLoader=${this.stashLoader}
			.tab=${this.aggregatedTabMemo}
		></e-stash-tab-container>`;
	}

	#computeAggregatedMemoKey(ids: string[]): string {
		const ts = ids.map(id => this.#cache.timestamp(id) ?? 0);
		return `${ids.join(',')}|${ts.join(',')}`;
	}

	#updateAggregatedMemo(): void {
		if (!this.multiselect || this.selected_tabs.size === 0) {
			this.aggregatedMemoKey = '';
			this.aggregatedTabMemo = null;
			return;
		}
		const ids = Array.from(this.selected_tabs.keys());

		// Filter by opened_tab if it is set and part of the selection
		const filterId = this.opened_tab?.id;
		const isFiltered = filterId && this.selected_tabs.has(filterId);
		const effectiveIds = isFiltered ? [filterId!] : ids;

		const key = this.#computeAggregatedMemoKey(effectiveIds);
		if (key === this.aggregatedMemoKey) return;

		const items: TabWithItems['items'] = [];
		let hasAnyData = false;

		for (const id of effectiveIds) {
			const cached = this.#getCachedTab(id);
			if (cached && cached.items) {
				hasAnyData = true;
				cached.items.forEach(it => {
					(it as any).tabIndex = cached.index;
					items.push(it);
				});
			}
		}

		this.aggregatedMemoKey = key;

		// Only update if we have data OR if this is the first time (no previous memo)
		// This prevents clearing the view while tabs are still loading
		if (items.length > 0) {
			this.aggregatedTabMemo = {
				id: 'aggregated-view',
				name: isFiltered ? `Filtered: ${this.opened_tab?.name}` : `Aggregated (${ids.length} tabs)`,
				type: 'QuadStash',
				index: 0,
				items,
				metadata: { colour: 'ffffff' }
			};
		} else if (!hasAnyData && !this.fetchingStashTab) {
			// Only clear if we have no data AND we're not currently loading
			this.aggregatedTabMemo = null;
		}
		// Otherwise keep the previous aggregatedTabMemo to avoid flashing spinner
	}

	constructor() {
		super();

		this.addEventListener('stashes__tab-click', e => {
			this.#handle_tab_badge_click(e);
			e.stopPropagation();
		});
		this.addEventListener('stashes__bulk-load-all', async e => {
			e.stopPropagation();
			await this.#bulkLoadAllTabs();
		});


		this.addEventListener('stashes__force-reload-selected', e => {
			e.stopPropagation();
			this.#onLoadItemsClicked();
		});
	}

	#onWindowResizeBound?: () => void;

	connectedCallback(): void {
		super.connectedCallback();
		this.#onWindowResizeBound = () => {
			this.#renderHistoryCharts();
		};
		window.addEventListener('resize', this.#onWindowResizeBound);
	}

	disconnectedCallback(): void {
		window.removeEventListener('resize', this.#onWindowResizeBound as any);
		super.disconnectedCallback();
	}

	@query('button#stashes-btn') stashesButton!: HTMLButtonElement;
	@query('button#get-data-btn') getDataButton!: HTMLButtonElement;

	protected willUpdate(map: PropertyValues<this>): void {
		if (map.has('league')) {
			this.stashtabs_badges = [];
			this.msg = '';
			this.selected_tabs = new Map();
			this.errors = [];
			this.#loadSnapshots();
		}
		if (map.has('stashLoader') && this.stashLoader) {
			this.#loadSnapshots();
		}
		if (map.has('opened_tab')) {
			this.#updateAggregatedMemo();
		}
	}

	protected async firstUpdated(): Promise<void> {
		this.#loadSnapshots();
		if (!this.fetchingStash) {
			await this.#loadStash();
		}
	}

	protected override render(): TemplateResult {
		return html`<div class="main-stashes-component">
			<header class="header">
                <div class="header-left">
                    ${this.bulkProgress ? html`
                        <div class="bulk-progress-inline">
                            <div class="bulk-row">
                                <sl-spinner></sl-spinner>
                                <span class="bulk-text">
                                    ${this.msg ? this.msg : `Loading tab ${this.bulkProgress.started} of ${this.bulkProgress.total}: ${this.bulkProgress.name}`}
                                </span>
                            </div>
                            <div class="bulk-bar">
                                <div class="bulk-fill" style="width: ${Math.max(0, Math.min(100, Math.round((this.bulkProgress.loaded / Math.max(1, this.bulkProgress.total)) * 100)))}%"></div>
                            </div>
                        </div>
                    ` : html`<div>
                        ${(this.fetchingStashTab || this.fetchingStash) ? html`<sl-spinner></sl-spinner>` : nothing}
                    </div>`}
                </div>
                
                <div class="header-right">
                    <div class="toolbar-group">
                         <div class="loads-available">
                            <sl-icon name="lightning-charge-fill"></sl-icon>
                            <span class="loads-available__value">${this.stashLoadsAvailable}</span>
                        </div>
                        <e-help-tip>
                            <p>PoE API allows 30 requests in 5 minutes</p>
                        </e-help-tip>
                    </div>

                    <div class="toolbar-group">
                        <sl-button-group>

                            ${this.snapshots.length ? html`
                                <sl-tooltip content="Clear all wealth history for current league">
                                    <sl-button 
                                        size="small" 
                                        @click=${this.#confirmClearHistory}
                                    >
                                        <sl-icon name="trash" slot="prefix"></sl-icon>
                                        Clear
                                    </sl-button>
                                </sl-tooltip>
                            ` : nothing}
                            ${this.snapshots.length ? html`
                                <sl-button size="small" @click=${this.#toggleWealth} variant=${this.showWealth ? 'primary' : 'default'} outline>
                                    ${this.showWealth ? 'Hide History' : 'Show History'}
                                </sl-button>
                            ` : nothing}
                        </sl-button-group>
                    </div>

                    <div class="toolbar-group">
                        <e-settings-panel
                            .concurrency=${this.bulkConcurrency}
                            .delayMs=${this.bulkBatchDelayMs}
                            @upd:bulk_settings=${this.#onBulkSettingsUpdate}
                        ></e-settings-panel>

                        ${this.stashtabs_badges.length && this.multiselect && this.opened_tab && (this.opened_tab.type === 'DivinationCardStash')
				? html`<sl-radio-group
                                    @sl-change=${this.#onDownloadAsChanged}
                                    .helpText=${`Download as`}
                                    value=${this.downloadAs}
                            >
                                    ${DOWNLOAD_AS_VARIANTS.map(
					variant =>
						html`<sl-radio-button size="small" value=${variant}
                                                >${variant === 'divination-cards-sample'
								? 'cards'
								: 'poe tab'}</sl-radio-button
                                            >`
				)}
                            </sl-radio-group>`
				: null}
                    </div>
                    
                    <sl-button size="small" @click=${this.#onCloseClicked} class="btn-close" variant="default">
                        <sl-icon name="x-lg" slot="prefix"></sl-icon>
                        Close
                    </sl-button>
                </div>
            </header>
            <div class="messages" role="status" aria-live="polite">
                <p class="msg">${this.msg}</p>
                <p class="msg">${this.noStashesMessage}</p>
                ${this.errors.length
				? html`<e-stash-tab-errors
                            @upd:hoveredErrorTabId=${this.#handleUpdHoveredError}
                            @upd:errors=${this.#handleUpdErrors}
                            .errors=${this.errors}
                      ></e-stash-tab-errors>`
				: nothing}
                ${this.lastError ? html`<sl-alert variant="danger" open>
                    ${this.lastError.message}
                    ${this.retryCallback ? html`<sl-button size="small" variant="primary" @click=${async () => { await this.retryCallback?.(); this.lastError = null; this.retryCallback = null; this.retryLabel = ''; }}>${this.retryLabel}</sl-button>` : nothing}
                </sl-alert>` : nothing}
            </div>
			${(this.snapshotsLoading || (this.showWealth && this.snapshots.length))
				? (this.snapshots.length ? this.#renderWealthDashboard() : this.#renderWealthSkeleton())
				: nothing}
                <e-tab-badge-group
                	.stashes=${this.stashtabs_badges}
                	.selected_tabs=${this.selected_tabs}
                	.multiselect=${this.multiselect}
                	.league=${this.league}
                	.errors=${this.errors}
                	.hoveredErrorTabId=${this.hoveredErrorTabId}
                	.badgesDisabled=${this.stashLoadsAvailable === 0}
                	@e-tab-badge-group__click=${this.#handle_tab_badge_click}
                	@e-tab-badge-group__selected-tabs-change=${this.#handle_selected_tabs_change}
                ></e-tab-badge-group>
			${this.opened_tab || (this.multiselect && this.selected_tabs.size > 0)
				? (this.multiselect
					? this.#renderAggregatedView()
					: this.stashTabTask.render({
						pending: () => {
							return html`<e-stash-tab-container
								status="pending"
								@e-stash-tab-container__close=${this.#handleTabContainerClose}
							></e-stash-tab-container>`;
						},
						complete: tab =>
							html`<e-stash-tab-container
								.cardsJustExtracted=${this.cardsJustExtracted}
								@e-stash-tab-container__close=${this.#handleTabContainerClose}
								@e-stash-tab-container__extract-cards=${this.#emitExtractCards}
								status="complete"
								.league=${this.league}
								.stashLoader=${this.stashLoader}
								.tab=${tab}
							></e-stash-tab-container>`,
						initial: () => {
							return nothing;
						},
						error: (err: unknown) => {
							if (
								!(
									typeof err === 'object' &&
									err !== null &&
									'message' in err &&
									typeof err.message === 'string'
								)
							) {
								return;
							}
							return html`<div>${err.message}</div>`;
						},
					}))
				: null}
		</div>`;
	}

	protected override updated(map: PropertyValues<this>): void {
		if (map.has('snapshots') || map.has('showWealth') || map.has('chartMode') || map.has('chartRange')) {
			this.#renderHistoryCharts();
		}
		// Re-render chart when hover state changes to draw/clear crosshair
		if (map.has('hoveredSnapshot')) {
			const line = this.renderRoot?.querySelector<HTMLCanvasElement>('#wealth-line');
			if (line) {
				const values = this.snapshots.map(s => s.total_chaos || 0);
				// Pass the index of the hovered snapshot if it exists
				const hoveredIndex = this.hoveredSnapshot ? this.snapshots.indexOf(this.hoveredSnapshot.snapshot) : -1;
				// We need to reverse index because drawLine reverses values
				const drawIndex = hoveredIndex !== -1 ? this.snapshots.length - 1 - hoveredIndex : -1;
				this.#drawLine(line, values, drawIndex);
			}
		}
	}

	#handleUpdHoveredError(e: CustomEvent<string | null>) {
		this.hoveredErrorTabId = e.detail;
	}
	#handleUpdErrors(e: CustomEvent<Array<ErrorLabel>>) {
		this.errors = e.detail;
	}
	#onLoadItemsClicked() {
		this.#load_selected_tabs(this.league, true);
	}
	#onCloseClicked() {
		this.dispatchEvent(new CloseEvent());
	}
	#onDownloadAsChanged(e: InputEvent) {
		this.downloadAs = (e.target as HTMLInputElement).value as DownloadAs;
	}

	#onBulkSettingsUpdate(e: CustomEvent<{ bulkConcurrency: number; bulkBatchDelayMs: number }>) {
		const { bulkConcurrency, bulkBatchDelayMs } = e.detail;
		this.bulkConcurrency = Math.max(1, Number(bulkConcurrency || 1));
		this.bulkBatchDelayMs = Math.max(0, Number(bulkBatchDelayMs || 0));
	}

	#toggleWealth() {
		this.showWealth = !this.showWealth;
	}

	@state() bulkLoading = false;

	async #bulkLoadAllTabs(): Promise<void> {
		if (!this.stashtabs_badges.length) {
			await this.#loadStash();
		}
		if (this.bulkLoading) return;
		this.bulkLoading = true;

		try {
			PoeGeneralPricedListElement.clearPriceCache();
			const next: SelectedStashtabs = new Map();
			for (const t of this.stashtabs_badges) {
				next.set(t.id, { id: t.id, name: t.name });
			}
			this.selected_tabs = next;
			this.dispatchEvent(new SelectedTabsChangeEvent(this.selected_tabs));
			const prev = this.downloadAs;
			this.downloadAs = 'general-tab';
			await this.#load_selected_tabs(this.league);
			this.downloadAs = prev;
			await this.#captureSnapshot();
		} finally {
			this.bulkLoading = false;
		}
	}

	#handle_selected_tabs_change(e: CustomEvent<{ selected_tabs: SelectedStashtabs }>): void {
		this.selected_tabs = new Map(e.detail.selected_tabs);
		this.dispatchEvent(new SelectedTabsChangeEvent(this.selected_tabs));

		// Enable multiselect mode if multiple tabs are selected
		if (this.selected_tabs.size > 1) {
			this.multiselect = true;
			this.opened_tab = null;
			this.#updateAggregatedMemo();
		} else if (this.selected_tabs.size === 0) {
			this.multiselect = false;
			this.opened_tab = null;
		}
	}

	#handle_tab_badge_click(e: TabClickEvent): void {
		const clicked = e.$tab;
		if (!clicked.parent && Array.isArray(clicked.children) && clicked.children.length > 0) {
			const withItems = clicked.children.find(c => c.metadata?.items);
			this.opened_tab = withItems ?? clicked.children[0];
			return;
		}

		// Switch to single-selection mode when clicking a tab
		this.multiselect = false;
		const newSelection = new Map();
		newSelection.set(clicked.id, { id: clicked.id, name: clicked.name });
		this.selected_tabs = newSelection;
		this.dispatchEvent(new SelectedTabsChangeEvent(this.selected_tabs));
		this.opened_tab = clicked;
	}
	#emitExtractCards(e: ContainerExtractCardsEvent) {
		this.cardsJustExtracted = true;
		setTimeout(() => {
			this.cardsJustExtracted = false;
		}, 2000);
		this.dispatchEvent(new ExtractCardsEvent(e.$tab, this.league));
	}
	#handleTabContainerClose() {
		this.opened_tab = null;
	}

	/** Load whole stash of Array<NoItemsTab> and emits it  */
	async #loadStash() {
		if (!this.stashLoader) {
			throw new Error('No stash loader');
		}
		this.noStashesMessage = '';
		this.fetchingStash = true;
		try {
			this.stashtabs_badges = await this.stashLoader.tabs(this.league);
			this.dispatchEvent(new StashtabsBadgesFetchedEvent(this.stashtabs_badges));
			if (!this.stashtabs_badges.length) {
				this.noStashesMessage = 'No stashes here. Try to change the league';
			}
		} catch (err) {
			const msg = this.#errorMessage(err);
			this.noStashesMessage = msg;
			if (typeof msg === 'string' && (msg.includes('401') || msg.includes('invalid_token'))) {
				this.dispatchEvent(new AuthErrorEvent());
			}
			this.#handleError('load-stashes', err, async () => {
				this.stashtabs_badges = await this.stashLoader.tabs(this.league);
			}, 'Retry loading stashes');
		} finally {
			this.fetchingStash = false;
		}
	}

	/** For each selected stashtab badge, load stashtab and emit it */
	async #load_selected_tabs(league: League, force = false): Promise<void> {
		const tabsToLoad = Array.from(this.selected_tabs.values());
		let loadedCount = 0;
		let startedCount = 0;
		const totalToLoad = tabsToLoad.length;

		this.fetchingStashTab = true;
		const CONCURRENCY = Math.max(1, Number(this.bulkConcurrency || 2));

		try {
			for (let i = 0; i < tabsToLoad.length; i += CONCURRENCY) {
				const batch = tabsToLoad.slice(i, i + CONCURRENCY);
				const pendingErrors: Array<ErrorLabel> = [];
				await Promise.allSettled(
					batch.map(async ({ id, name: stashtab_name }) => {
						startedCount++;
						this.bulkProgress = { started: startedCount, loaded: loadedCount, total: totalToLoad, name: stashtab_name };
						try {
							switch (this.downloadAs) {
								case 'divination-cards-sample': {
									const badge = this.stashtabs_badges.find(t => t.id === id)!;
									const sample = await this.#loadSingleTabContent('sample', id, league, (_sid, _lg) => this.stashLoader.sampleFromBadge(badge, league), force);
									this.dispatchEvent(new SampleFromStashtabEvent(stashtab_name, sample, league));
									break;
								}
								case 'general-tab': {
									const badge = this.stashtabs_badges.find(t => t.id === id)!;
									const stashtab = await this.#loadSingleTabContent('general-tab', id, league, (_sid, _lg) => this.stashLoader.tabFromBadge(badge, league), force);
									if (stashtab) this.#setCachedTab(stashtab.id, stashtab);
									this.dispatchEvent(new StashtabFetchedEvent(stashtab, this.league));
									break;
								}
							}
							loadedCount++;
							this.bulkProgress = { started: startedCount, loaded: loadedCount, total: totalToLoad, name: stashtab_name };
							// Update aggregated view incrementally as tabs load
							this.#updateAggregatedMemo();
						} catch (err) {
							if (!isStashTabError(err)) {
								throw err;
							}
							const stashtab_badge = this.stashtabs_badges.find(stash => stash.id === id);
							if (stashtab_badge) {
								pendingErrors.push({ noItemsTab: stashtab_badge, message: (err as any).message });
							}
						}
					})
				);
				if (pendingErrors.length) {
					this.errors = [...this.errors, ...pendingErrors];
				}
				await sleepMs(Math.max(0, Number(this.bulkBatchDelayMs || 2000)));
			}
		} finally {
			this.fetchingStashTab = false;
			this.msg = '';
			this.bulkProgress = null;
		}
	}

	@state() capturingSnapshot = false;

	async #captureSnapshot(): Promise<void> {
		if (!this.stashLoader || this.capturingSnapshot) {
			return;
		}
		this.capturingSnapshot = true;
		this.msg = 'Capturing snapshot...';
		const selected = this.selected_tabs.size
			? Array.from(this.selected_tabs.values()).map(v => v.id)
			: this.stashtabs_badges.map(b => b.id);
		const cachedTabs: Array<TabWithItems> = selected
			.map(id => this.#getCachedTab(id))
			.filter((t): t is TabWithItems => t !== null);
		const allCached = cachedTabs.length === selected.length;
		// legacy refs shape no longer used; we capture from cache exclusively
		try {
			if (!allCached) {
				for (const id of selected) {
					if (this.#cache.has(id)) continue;
					const badge = this.stashtabs_badges.find(t => t.id === id)!;
					const loaded = await this.#loadSingleTabContent('general-tab', id, this.league, (_sid, _lg) => this.stashLoader.tabFromBadge(badge, this.league), true);
					if (loaded) this.#setCachedTab(loaded.id, loaded);
				}
			}
			const finalTabs: Array<TabWithItems> = selected
				.map(id => this.#getCachedTab(id))
				.filter((t): t is TabWithItems => t !== null);
			await (this.stashLoader as any).wealthSnapshotCached(this.league, finalTabs);
			this.msg = 'Snapshot captured';
			this.#toast('success', 'Snapshot captured');
			await this.#loadSnapshots();
		} catch (err) {
			const msg = this.#errorMessage(err);
			this.msg = msg;
			this.#toast('danger', msg);
			const secs = this.#parseRetryAfterSeconds(msg);
			if (secs && secs > 0) {
				setTimeout(() => {
					this.#captureSnapshot();
				}, (secs + 1) * 1000);
			}
		} finally {
			this.capturingSnapshot = false;
		}
	}



	async #loadSnapshots(): Promise<void> {
		if (!this.stashLoader) return;
		this.snapshotsLoading = true;
		this.msg = 'Refreshing snapshots...';
		try {
			const rows = await (this.stashLoader as any).listSnapshots(this.league, 20);
			const sorted = Array.isArray(rows) ? [...rows].sort((a, b) => b.timestamp - a.timestamp) : [];
			this.snapshots = sorted;
			this.showWealth = this.snapshots.length > 0;
			this.msg = '';
		} catch (err) {
			const msg = this.#errorMessage(err);
			this.msg = msg;
			this.#handleError('load-snapshots', err, async () => { await this.#loadSnapshots(); }, 'Retry');
		} finally {
			this.snapshotsLoading = false;
		}
	}

	async #confirmClearHistory() {
		const count = this.snapshots.length;
		const league = this.league;

		const confirmed = await this.#showConfirmDialog(
			'Clear All History?',
			`This will permanently delete all ${count} wealth snapshot${count !== 1 ? 's' : ''} for league "${league}". This action cannot be undone.`,
			'Clear All Data',
			'danger'
		);

		if (confirmed) {
			await this.#clearAllHistory();
		}
	}

	#showConfirmDialog(
		title: string,
		message: string,
		confirmLabel: string,
		variant: 'danger' | 'warning' = 'danger'
	): Promise<boolean> {
		return new Promise((resolve) => {
			const dialog = document.createElement('sl-dialog');
			dialog.label = title;
			dialog.innerHTML = `
				<p style="margin: 0 0 1rem 0;">${message}</p>
				<div slot="footer" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
					<sl-button variant="default" class="cancel-btn">Cancel</sl-button>
					<sl-button variant="${variant}" class="confirm-btn">${confirmLabel}</sl-button>
				</div>
			`;

			document.body.appendChild(dialog);
			dialog.show();

			const cancelBtn = dialog.querySelector('.cancel-btn');
			const confirmBtn = dialog.querySelector('.confirm-btn');

			const cleanup = () => {
				dialog.hide();
				setTimeout(() => dialog.remove(), 300);
			};

			cancelBtn?.addEventListener('click', () => {
				cleanup();
				resolve(false);
			});

			confirmBtn?.addEventListener('click', () => {
				cleanup();
				resolve(true);
			});

			dialog.addEventListener('sl-request-close', (event) => {
				if ((event as any).detail?.source === 'overlay') {
					cleanup();
					resolve(false);
				}
			});
		});
	}

	async #clearAllHistory() {
		if (!this.stashLoader) return;

		try {
			this.msg = 'Clearing all history...';
			const deletedCount = await (this.stashLoader as any).deleteAllSnapshots(this.league);

			// Clear local state
			this.snapshots = [];
			this.showWealth = false;

			// Clear cache
			await (this.stashLoader as any).clearSnapshotCache();

			this.msg = '';
			this.#toast('success', `Successfully deleted ${deletedCount} snapshot${deletedCount !== 1 ? 's' : ''}`);

		} catch (err) {
			const errorMsg = this.#errorMessage(err);
			this.msg = errorMsg;
			this.#toast('danger', `Failed to clear history: ${errorMsg}`);
		}
	}

	#renderCategoryList(snapshot: any) {
		const total = snapshot.total_chaos || 0;
		if (total === 0) return nothing;

		const entries = Object.entries(snapshot.by_category || {})
			.map(([name, data]: [string, any]) => ({
				name: categoryFromKey(name),
				value: data.chaos || 0,
				percent: ((data.chaos || 0) / total) * 100
			}))
			.filter(e => e.value > 0)
			.sort((a, b) => b.value - a.value);

		return html`
			<div class="category-compact-list">
				${entries.map(cat => html`
					<div class="cat-compact-item">
						<div class="cat-compact-header">
							<span class="cat-compact-name">${cat.name}</span>
							<span class="cat-compact-value">${Math.round(cat.value).toLocaleString()}c</span>
						</div>
						<div class="cat-compact-bar-bg">
							<div class="cat-compact-bar" style="width: ${cat.percent}%; background: ${this.#getCategoryColor(cat.name)}"></div>
							<span class="cat-compact-percent">${cat.percent.toFixed(1)}%</span>
						</div>
					</div>
				`)}
			</div>
		`;
	}

	#getCategoryColor(category: string): string {
		const colors: Record<string, string> = {
			'Currency': '#f59e0b',
			'Fragment': '#ec4899',
			'Divination Card': '#8b5cf6',
			'Gem': '#ef4444',
			'Other': '#6b7280',
			'Essence': '#f97316',
			'Map': '#3b82f6',
			'Fossil': '#14b8a6',
			'Resonator': '#a855f7',
			'Oil': '#eab308',
			'Incubator': '#10b981',
			'Scarab': '#06b6d4',
			'Delirium Orb': '#6366f1',
			'Vial': '#84cc16'
		};
		return colors[category] || '#6b7280';
	}
	#getTopCategories(snapshot: any): Array<{ name: string; value: number; percent: number }> {
		const total = snapshot.total_chaos || 1;
		const entries = Object.entries(snapshot.by_category || {})
			.map(([name, data]: [string, any]) => ({
				name: categoryFromKey(name),
				value: data.chaos || 0,
				percent: ((data.chaos || 0) / total) * 100
			}))
			.sort((a, b) => b.value - a.value);
		return entries.slice(0, 5);
	}

	#renderTooltip() {
		if (!this.hoveredSnapshot) return nothing;

		const { snapshot, index, x, y, align } = this.hoveredSnapshot;
		const prev = this.snapshots[index + 1];
		const diff = prev ? Math.round(snapshot.total_chaos - prev.total_chaos) : 0;
		const ratio = snapshot.total_divines ? (snapshot.total_chaos / snapshot.total_divines).toFixed(0) : 0;

		return html`
			<div 
				class="chart-tooltip"
				style="left: ${x + (align === 'left' ? 12 : align === 'right' ? -12 : 0)}px; top: ${y - 12}px; transform: ${align === 'left' ? 'translate(0, -100%)' : align === 'right' ? 'translate(-100%, -100%)' : 'translate(-50%, -100%)'};"
			>
				<div class="tooltip-header">
					<span class="tooltip-date">${new Date(snapshot.timestamp * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
					${diff !== 0 ? html`<span class="tooltip-change ${diff > 0 ? 'positive' : 'negative'}">${diff > 0 ? '+' : ''}${diff.toLocaleString()}c</span>` : nothing}
				</div>
				
				<div class="tooltip-main-value">
					<span class="value">${Math.round(snapshot.total_chaos).toLocaleString()}</span>
					<span class="unit">Chaos Orbs</span>
				</div>

				<div class="tooltip-stats">
					<div class="stat-item">
						<span class="label">Divines</span>
						<span class="val">${snapshot.total_divines?.toFixed(1) || '-'}</span>
					</div>
					<div class="stat-item">
						<span class="label">Ratio</span>
						<span class="val">${ratio}:1</span>
					</div>
				</div>

				<div class="tooltip-categories">
					${this.#getTopCategories(snapshot).map(cat => html`
						<div class="cat-row">
							<div class="cat-info">
								<span class="cat-name">${cat.name}</span>
								<span class="cat-val">${Math.round(cat.value).toLocaleString()}c</span>
							</div>
							<div class="cat-bar-bg">
								<div class="cat-bar" style="width: ${cat.percent}%"></div>
							</div>
						</div>
					`)}
				</div>
			</div>
		`;
	}

	#renderWealthDashboard() {
		if (this.snapshots.length === 0) return nothing;

		const latest = this.snapshots[0];
		const prev = this.snapshots[1];
		const chaos = Math.round(latest.total_chaos);
		const chaosDiff = prev ? Math.round(latest.total_chaos - prev.total_chaos) : 0;
		const chaosTrend = chaosDiff > 0 ? 'trend-up' : chaosDiff < 0 ? 'trend-down' : 'trend-neutral';
		const chaosSign = chaosDiff > 0 ? '+' : '';
		const trendIcon = chaosDiff > 0 ? 'arrow-up-short' : chaosDiff < 0 ? 'arrow-down-short' : 'dash';

		/* removed unused sizeClass computation */

		// Stats calculations
		let rate = 0;
		let durationStr = '0m';
		let timeRange = '';
		let net = 0;

		if (prev) {
			const start = new Date(prev.timestamp * 1000);
			const end = new Date(latest.timestamp * 1000);
			const durationMs = end.getTime() - start.getTime();
			const durationHrs = durationMs / (1000 * 60 * 60);

			net = latest.total_chaos - prev.total_chaos;
			rate = durationHrs > 0 ? net / durationHrs : 0;

			const h = Math.floor(durationMs / (1000 * 60 * 60));
			const m = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
			durationStr = `${h}h ${m}m`;

			timeRange = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		}

		return html`
			<section class="wealth-history">
                <div class="metrics-grid">
                    <!-- Total Chaos -->
                    <div class="metric-card">
                        <div class="metric-label">
                            <sl-icon name="currency-bitcoin"></sl-icon> 
                            Total Chaos
                            <sl-tooltip content="Snapshot value at capture time. May differ from live prices shown in the table below due to market price changes." style="--max-width: 200px;">
                                <sl-icon name="info-circle" style="cursor: help; color: var(--sl-color-neutral-400); font-size: 0.9rem;"></sl-icon>
                            </sl-tooltip>
                        </div>
                        <div class="metric-value">${chaos.toLocaleString()}</div>
                        <div class="metric-sub ${chaosTrend}">
                            <sl-icon name="${trendIcon}"></sl-icon>
                            ${prev ? html`${chaosSign}${chaosDiff.toLocaleString()} vs last` : 'First snapshot'}
                        </div>
                        <div class="metric-timestamp">
                            <sl-icon name="clock"></sl-icon>
                            ${new Date(latest.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' })}
                        </div>
                    </div>

                    <!-- Net / Rate -->
                    <div class="metric-card">
                        <div class="metric-label"><sl-icon name="graph-up-arrow"></sl-icon> Performance</div>
                        <div class="metric-value ${net >= 0 ? 'positive' : 'negative'}">
                            ${net >= 0 ? '+' : ''}${formatChaosAmount(net)}
                        </div>
                        <div class="metric-sub">
                            ${Math.round(rate)} c/hr
                        </div>
                    </div>

                    <!-- Session -->
                    <div class="metric-card">
                        <div class="metric-label"><sl-icon name="stopwatch"></sl-icon> Session</div>
                        <div class="metric-value">${durationStr}</div>
                        <div class="metric-sub">${timeRange || 'Just started'}</div>
                    </div>

                    <!-- Snapshots -->
                    <div class="metric-card">
                        <div class="metric-label"><sl-icon name="clock-history"></sl-icon> Snapshots</div>
                        <div class="metric-value">${this.snapshots.length}</div>
                        <div class="metric-sub">Recorded</div>
                    </div>
                </div>


                ${this.#renderTopMoversStrip(latest, prev)}

                <!-- Price Changes Section -->
                <div class="price-changes-section">
                    <div class="section-header">
                        <span class="section-title">
                            <sl-icon name="graph-up"></sl-icon>
                            Price Variance Analysis
                            <sl-badge variant="neutral" pill>${this.priceChangesData.length} items</sl-badge>
                        </span>
                        <sl-button 
                            size="small" 
                            @click=${this.#togglePriceChanges}
                            variant=${this.showPriceChanges ? 'primary' : 'default'}
                        >
                            <sl-icon name="${this.showPriceChanges ? 'eye-slash' : 'eye'}" slot="prefix"></sl-icon>
                            ${this.showPriceChanges ? 'Hide Analysis' : 'Show Analysis'}
                        </sl-button>
                    </div>
                    ${this.showPriceChanges ? this.#renderPriceChanges() : html`
                        <div class="price-changes-preview">
                            <sl-icon name="info-circle"></sl-icon>
                            <p>Click "Show Analysis" to compare current live prices with your last snapshot</p>
                        </div>
                    `}
                </div>

                <div class="wealth-content-grid">
                    <div class="chart-container">
                         <div class="chart-header">
                            <div class="chart-title">Wealth Trend</div>
                            <div class="chart-controls">
                                <sl-radio-group size="small" value=${this.chartMode} @sl-change=${(e: any) => this.chartMode = e.target.value}>
                                    <sl-radio-button value="chaos">Chaos</sl-radio-button>
                                    <sl-radio-button value="divine">Divine</sl-radio-button>
                                </sl-radio-group>
                                <sl-radio-group size="small" value=${this.chartRange} @sl-change=${(e: any) => this.chartRange = e.target.value}>
                                    <sl-radio-button value="all">All</sl-radio-button>
                                    <sl-radio-button value="recent">Recent</sl-radio-button>
                                </sl-radio-group>
                            </div>
                        </div>
                        <canvas
                            id="wealth-line"
                            @mousemove=${this.#onChartMouseMove}
                            @mouseleave=${this.#onChartMouseLeave}
                        ></canvas>
                        ${this.#renderTooltip()}
                    </div>

                    <div class="category-breakdown-panel">
                        <div class="panel-header">
                            <sl-icon name="pie-chart-fill"></sl-icon>
                            <span>Category Breakdown</span>
                        </div>
						${this.#renderCategoryList(latest)}
                    </div>
                </div>
			</section>
		`;
	}

	#renderWealthSkeleton() {
		return html`
			<section class="wealth-history loading">
				<div class="metrics-grid">
					<div class="metric-card"><div class="skeleton-title"></div><div class="skeleton-value"></div><div class="skeleton-sub"></div></div>
					<div class="metric-card"><div class="skeleton-title"></div><div class="skeleton-value"></div><div class="skeleton-sub"></div></div>
					<div class="metric-card"><div class="skeleton-title"></div><div class="skeleton-value"></div><div class="skeleton-sub"></div></div>
					<div class="metric-card"><div class="skeleton-title"></div><div class="skeleton-value"></div><div class="skeleton-sub"></div></div>
				</div>
				<div class="charts">
					<div class="chart-container">
						<div class="skeleton-chart"></div>
					</div>
					<div class="chart-container">
						<div class="skeleton-chart"></div>
					</div>
				</div>
			</section>
		`;
	}

	#renderTopMoversStrip(current: any, previous: any) {
		if (!previous) return nothing;

		const changes = [];
		const curCats = current.by_category || {};
		const prevCats = previous.by_category || {};
		const allKeys = new Set([...Object.keys(curCats), ...Object.keys(prevCats)]);

		for (const k of allKeys) {
			const c = curCats[k]?.chaos || 0;
			const p = prevCats[k]?.chaos || 0;
			const diff = c - p;
			if (Math.abs(diff) > 1) {
				changes.push({ name: k, diff });
			}
		}
		changes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
		const top5 = changes.slice(0, 5);

		if (!top5.length) return nothing;

		return html`
            <div class="movers-strip">
                <div class="movers-label">Top Movers</div>
                ${top5.map(c => html`
                    <div class="mover-item">
                        <span class="mover-name">${c.name}</span>
                        <span class="mover-val" style="color:${c.diff > 0 ? 'var(--sl-color-success-600)' : 'var(--sl-color-danger-600)'}">
                            ${c.diff > 0 ? '+' : ''}${Math.round(c.diff)}c
                        </span>
                    </div>
                `)}
            </div>
        `;
	}

	async #togglePriceChanges() {
		this.showPriceChanges = !this.showPriceChanges;
		if (this.showPriceChanges) {
			await this.#calculatePriceChanges();
		}
	}

	async #calculatePriceChanges() {
		if (!this.stashLoader || this.snapshots.length === 0) {
			this.priceChangesData = [];
			return;
		}
		this.loadingPriceChanges = true;
		this.priceChangesData = [];
		try {
			const latest = this.snapshots[0];
			const prev = this.snapshots[1];
			const latestPrices = latest.item_prices || {};
			const prevPrices = prev?.item_prices || {};
			const latestKeys = Object.keys(latestPrices);
			const prevKeys = Object.keys(prevPrices);
			if (!prev || prevKeys.length === 0) {
				this.priceChangeMode = 'category';
				const snapshotCats = latest.by_category || {};
				const rows = Object.entries(snapshotCats)
					.map(([category, v]) => {
						const snapshotTotal = (v as any)?.chaos || 0;
						return { category, snapshotTotal, currentTotal: snapshotTotal, diff: 0, diffPercent: 0, topItems: [] };
					})
					.sort((a, b) => b.snapshotTotal - a.snapshotTotal);
				this.priceChangesData = rows;
				return;
			}

			this.priceChangeMode = 'item';
			const setLatest = new Set(latestKeys);
			const setPrev = new Set(prevKeys);

			const rows: Array<any> = [];

			for (const name of latestKeys) {
				const cur = Number((latestPrices as any)[name] ?? 0);
				const snap = Number((prevPrices as any)[name] ?? 0);
				const isNew = !setPrev.has(name);
				const diff = cur - snap;
				const percent = snap > 0 ? (diff / snap) * 100 : 0;
				rows.push({
					name,
					category: '',
					qty: null,
					snapshotPrice: snap,
					currentPrice: cur,
					changePercent: percent,
					totalChange: diff,
					isNew,
					isRemoved: false,
				});
			}

			for (const name of prevKeys) {
				if (!setLatest.has(name)) {
					const snap = Number((prevPrices as any)[name] ?? 0);
					const cur = 0;
					const diff = cur - snap;
					const percent = snap > 0 ? (diff / snap) * 100 : 0;
					rows.push({
						name,
						category: '',
						qty: null,
						snapshotPrice: snap,
						currentPrice: cur,
						changePercent: percent,
						totalChange: diff,
						isNew: false,
						isRemoved: true,
					});
				}
			}

			const groups = Object.groupBy(rows, r => r.name.includes('__') ? r.name.split('__')[0] : r.name);
			const deduped: Array<any> = [];
			for (const key of Object.keys(groups)) {
				const group = groups[key] || [];
				const composite = group.find(g => g.name.includes('__'));
				deduped.push(composite || group[0]);
			}
			this.priceChangesData = deduped.sort((a, b) => Math.abs(b.totalChange) - Math.abs(a.totalChange));
		} catch (err) {
			this.priceChangesData = [];
			this.#handleError('price-variance', err, async () => { await this.#calculatePriceChanges(); }, 'Retry');
		} finally {
			this.loadingPriceChanges = false;
		}
	}

	#renderPriceChanges() {
		if (this.loadingPriceChanges) {
			return html`
				<div class="price-changes-empty">
					<sl-icon name="info-circle"></sl-icon>
					<p>Loading price comparison data...</p>
				</div>
			`;
		}

		if (this.priceChangesData.length === 0) {
			return html`
				<div class="price-changes-empty">
					<sl-icon name="info-circle"></sl-icon>
					<p>No significant price changes found.</p>
				</div>
			`;
		}

		if (this.priceChangeMode === 'item') {
			const newItems = this.priceChangesData.filter(i => i.isNew);
			const removedItems = this.priceChangesData.filter(i => i.isRemoved);
			const topGainers = this.priceChangesData.filter(i => !i.isNew && !i.isRemoved && i.totalChange > 0);
			const topLosers = this.priceChangesData.filter(i => !i.isNew && !i.isRemoved && i.totalChange < 0);
			const totalVariance = this.priceChangesData.reduce((acc, item) => acc + item.totalChange, 0);

			return html`
				<div class="price-changes-content">
					<div class="price-stats">
						<div class="price-stat">
							<div class="stat-label">Total Variance</div>
							<div class="stat-value ${totalVariance >= 0 ? 'positive' : 'negative'}">
								${totalVariance >= 0 ? '+' : ''}${Math.round(totalVariance).toLocaleString()}c
							</div>
							<div class="stat-desc">Net difference (Live - Snapshot)</div>
						</div>
						<div class="price-stat positive">
							<div class="stat-label">Gainers</div>
							<div class="stat-value">${this.priceChangesData.filter(i => i.totalChange > 0).length}</div>
						</div>
						<div class="price-stat negative">
							<div class="stat-label">Losers</div>
							<div class="stat-value">${this.priceChangesData.filter(i => i.totalChange < 0).length}</div>
						</div>
					</div>

					<div class="price-tables">
                        ${newItems.length > 0 ? html`
                            <div class="price-table-container">
                                <h4 class="price-table-title">
                                    <sl-icon name="plus-circle"></sl-icon>
                                    New Items in Latest Snapshot
                                </h4>
                                <div class="price-table">
                                    <div class="price-table-header">
                                        <div>Item</div>
                                        <div>Snapshot</div>
                                        <div>Current</div>
                                        <div>Diff</div>
                                    </div>
                                    ${newItems.map(item => html`
                                        <div class="price-table-row">
                                            <div class="item-name" title="${item.name}">
                                                ${item.name}
                                            </div>
                                            <div>${item.snapshotPrice?.toFixed(1)}c</div>
                                            <div>${item.currentPrice?.toFixed(1)}c</div>
                                            <div class="price-change positive">+${(item.currentPrice - (item.snapshotPrice || 0)).toFixed(1)}c</div>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        ` : nothing}
                        ${removedItems.length > 0 ? html`
                            <div class="price-table-container">
                                <h4 class="price-table-title negative">
                                    <sl-icon name="dash-circle"></sl-icon>
                                    Removed Items Since Previous Snapshot
                                </h4>
                                <div class="price-table">
                                    <div class="price-table-header">
                                        <div>Item</div>
                                        <div>Snapshot</div>
                                        <div>Change</div>
                                    </div>
                                    ${removedItems.map(item => html`
                                        <div class="price-table-row">
                                            <div class="item-name" title="${item.name}">
                                                ${item.name}
                                            </div>
                                            <div>${item.snapshotPrice?.toFixed(1)}c</div>
                                            <div class="total-impact negative">${item.totalChange.toFixed(1)}c</div>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        ` : nothing}
						${topGainers.length > 0 ? html`
							<div class="price-table-container">
								<h4 class="price-table-title positive">
									<sl-icon name="arrow-up-circle-fill"></sl-icon>
									Top Price Increases
								</h4>
								<div class="price-table">
									<div class="price-table-header">
										<div>Item</div>
										<div>Qty</div>
										<div>Snapshot</div>
										<div>Current</div>
										<div>Change</div>
										<div>Impact</div>
									</div>
									${topGainers.map(item => html`
										<div class="price-table-row">
											<div class="item-name" title="${item.name}">
												<span class="item-category">${item.category}</span>
												${item.name}
											</div>
											<div>${item.qty}</div>
											<div>${item.snapshotPrice.toFixed(1)}c</div>
											<div class="current-price positive">${item.currentPrice.toFixed(1)}c</div>
											<div class="price-change positive">
												+${item.changePercent.toFixed(1)}%
											</div>
											<div class="total-impact positive">
												+${item.totalChange.toFixed(0)}c
											</div>
										</div>
									`)}
								</div>
							</div>
						` : nothing}

						${topLosers.length > 0 ? html`
							<div class="price-table-container">
								<h4 class="price-table-title negative">
									<sl-icon name="arrow-down-circle-fill"></sl-icon>
									Top Price Decreases
								</h4>
								<div class="price-table">
									<div class="price-table-header">
										<div>Item</div>
										<div>Qty</div>
										<div>Snapshot</div>
										<div>Current</div>
										<div>Change</div>
										<div>Impact</div>
									</div>
									${topLosers.map(item => html`
										<div class="price-table-row">
											<div class="item-name" title="${item.name}">
												<span class="item-category">${item.category}</span>
												${item.name}
											</div>
											<div>${item.qty}</div>
											<div>${item.snapshotPrice.toFixed(1)}c</div>
											<div class="current-price negative">${item.currentPrice.toFixed(1)}c</div>
											<div class="price-change negative">
												${item.changePercent.toFixed(1)}%
											</div>
											<div class="total-impact negative">
												${item.totalChange.toFixed(0)}c
											</div>
										</div>
									`)}
								</div>
							</div>
						` : nothing}
					</div>
					<div style="margin-top: 1rem; font-size: 0.8rem; color: var(--sl-color-neutral-500); display: flex; gap: 0.5rem; align-items: center;">
						<sl-icon name="check-circle"></sl-icon>
						<span>Using exact item prices from snapshot.</span>
					</div>
				</div>
			`;
		} else {
			const rows = this.priceChangesData.slice(0, 12);
			const totalVariance = this.priceChangesData.reduce((acc, c) => acc + c.diff, 0);
			return html`
				<div class="price-changes-content">
					<div class="price-stats">
						<div class="price-stat">
							<div class="stat-label">Total Variance</div>
							<div class="stat-value ${totalVariance >= 0 ? 'positive' : 'negative'}">
								${totalVariance >= 0 ? '+' : ''}${Math.round(totalVariance).toLocaleString()}c
							</div>
							<div class="stat-desc">Net difference (Live - Snapshot)</div>
						</div>
					</div>

					<div class="price-table-container">
						<h4 class="price-table-title">
							<sl-icon name="list-task"></sl-icon>
							Category Breakdown
						</h4>
						<div class="price-table">
							<div class="price-table-header" style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr;">
								<div>Category</div>
								<div>Snapshot</div>
								<div>Live</div>
								<div>Diff</div>
								<div>%</div>
							</div>
							${rows.map(cat => html`
								<div class="price-table-row" style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr;">
									<div class="item-name">
										${cat.category}
										<span class="item-category">Top: ${cat.topItems.slice(0, 2).map((i: any) => i.name).join(', ')}</span>
									</div>
									<div>${Math.round(cat.snapshotTotal).toLocaleString()}c</div>
									<div>${Math.round(cat.currentTotal).toLocaleString()}c</div>
									<div class="price-change ${cat.diff >= 0 ? 'positive' : 'negative'}">
										${cat.diff >= 0 ? '+' : ''}${Math.round(cat.diff).toLocaleString()}c
									</div>
									<div class="total-impact ${cat.diff >= 0 ? 'positive' : 'negative'}">
										${cat.diffPercent.toFixed(1)}%
									</div>
								</div>
							`)}
						</div>
					</div>
					
					<div style="margin-top: 1rem; font-size: 0.8rem; color: var(--sl-color-neutral-500); display: flex; gap: 0.5rem; align-items: center;">
						<sl-icon name="info-circle"></sl-icon>
						<span>Detailed item price history is not available in this snapshot. Showing category totals instead. Capture a new snapshot to enable detailed analysis.</span>
					</div>
				</div>
			`;
		}
	}



	#errorMessage(err: unknown): string {
		if (err && typeof err === 'object') {
			const anyErr = err as Record<string, unknown>;
			if (typeof anyErr.message === 'string') return anyErr.message as string;
			try { return JSON.stringify(err); } catch { /* no-op */ }
		}
		return String(err);
	}

	#parseRetryAfterSeconds(msg: string): number | null {
		const m = msg.match(/retry after\s+(\d+)/i);
		if (m && m[1]) {
			const n = parseInt(m[1], 10);
			return Number.isFinite(n) ? n : null;
		}
		return null;
	}

	#renderHistoryCharts(): void {
		if (!this.showWealth || !this.snapshots.length) return;
		const line = this.renderRoot?.querySelector<HTMLCanvasElement>('#wealth-line');
		const bars = this.renderRoot?.querySelector<HTMLCanvasElement>('#wealth-bars');

		let data = [...this.snapshots];
		// Filter by range
		if (this.chartRange === 'recent') {
			data = data.slice(0, 20); // Last 20 snapshots
		}

		if (line) {
			const values = data.map(s => {
				if (this.chartMode === 'divine') {
					return s.total_divines || 0;
				}
				return s.total_chaos || 0;
			});
			this.#drawLine(line, values);
		}
		if (bars) {
			const latest = this.snapshots[0];
			const entries = Object.entries(latest.by_category || {}).map(([k, v]) => ({ name: categoryFromKey(k), value: v.chaos || 0 }));
			entries.sort((a, b) => b.value - a.value);
			this.#drawBars(bars, entries.slice(0, 10));
		}
	}

	#drawLine(canvas: HTMLCanvasElement, values: number[], activeIndex: number = -1): void {
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		const w = rect.width;
		const h = 300; // Fixed height for better visibility

		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);

		if (values.length === 0) return;

		// Calculate chart area with margins for axes
		const marginLeft = 60;
		const marginRight = 20;
		const marginTop = 20;
		const marginBottom = 40;
		const chartW = w - marginLeft - marginRight;
		const chartH = h - marginTop - marginBottom;

		const max = Math.max(...values);
		const min = Math.min(...values);
		const range = max - min || 1;
		// Add 10% padding top and bottom
		const yMax = max + (range * 0.1);
		const yMin = Math.max(0, min - (range * 0.1));
		const yRange = yMax - yMin;

		const n = values.length;
		const xStep = chartW / Math.max(1, n - 1);

		// Get data for timestamps
		let data = [...this.snapshots];
		if (this.chartRange === 'recent') {
			data = data.slice(0, 20);
		}

		// Draw background
		ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
		ctx.fillRect(marginLeft, marginTop, chartW, chartH);

		// Draw grid lines and Y-axis labels
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
		ctx.font = '11px sans-serif';
		ctx.lineWidth = 1;

		const numYTicks = 5;
		for (let i = 0; i <= numYTicks; i++) {
			const value = yMin + (yRange * i / numYTicks);
			const y = marginTop + chartH - (i / numYTicks) * chartH;

			// Grid line
			ctx.beginPath();
			ctx.moveTo(marginLeft, y);
			ctx.lineTo(marginLeft + chartW, y);
			ctx.stroke();

			// Y-axis label
			ctx.textAlign = 'right';
			ctx.textBaseline = 'middle';
			let label;
			if (yRange < 2) {
				label = value.toFixed(2);
			} else if (yRange < 10) {
				label = value.toFixed(1);
			} else {
				label = Math.round(value).toLocaleString();
			}
			ctx.fillText(label, marginLeft - 5, y);
		}

		// Draw X-axis labels (timestamps)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';

		const numXTicks = Math.min(5, n);
		for (let i = 0; i < numXTicks; i++) {
			const index = Math.floor((n - 1) * i / (numXTicks - 1));
			const reversedIndex = n - 1 - index;
			const x = marginLeft + index * xStep;

			if (data[reversedIndex]) {
				const date = new Date(data[reversedIndex].timestamp * 1000);
				const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
				const dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

				// Draw tick mark
				ctx.beginPath();
				ctx.moveTo(x, marginTop + chartH);
				ctx.lineTo(x, marginTop + chartH + 5);
				ctx.stroke();

				ctx.fillText(timeLabel, x, marginTop + chartH + 8);
				ctx.font = '9px sans-serif';
				ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
				ctx.fillText(dateLabel, x, marginTop + chartH + 22);
				ctx.font = '11px sans-serif';
				ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
			}
		}

		// Draw axis labels
		ctx.save();
		ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
		ctx.font = 'bold 12px sans-serif';

		// Y-axis label (rotated)
		ctx.translate(15, marginTop + chartH / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.textAlign = 'center';
		ctx.fillText(this.chartMode === 'divine' ? 'Divine Orbs' : 'Chaos Orbs', 0, 0);
		ctx.restore();

		// X-axis label
		ctx.fillText('Time', marginLeft + chartW / 2, h - 5);

		// Gradient fill under line
		const gradient = ctx.createLinearGradient(0, marginTop, 0, marginTop + chartH);
		if (this.chartMode === 'divine') {
			gradient.addColorStop(0, 'rgba(234, 179, 8, 0.3)'); // Yellow/Gold
			gradient.addColorStop(1, 'rgba(234, 179, 8, 0)');
		} else {
			gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)'); // Indigo
			gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
		}

		ctx.beginPath();
		ctx.moveTo(marginLeft, marginTop + chartH);
		for (let i = 0; i < n; i++) {
			const x = marginLeft + i * xStep;
			const v = values[n - 1 - i]; // Reverse to show oldest to newest left-to-right
			const y = marginTop + chartH - ((v - yMin) / yRange) * chartH;
			ctx.lineTo(x, y);
		}
		ctx.lineTo(marginLeft + (n - 1) * xStep, marginTop + chartH);
		ctx.closePath();
		ctx.fillStyle = gradient;
		ctx.fill();

		// Draw line
		ctx.strokeStyle = this.chartMode === 'divine'
			? (getComputedStyle(this).getPropertyValue('--sl-color-warning-500') || '#eab308')
			: (getComputedStyle(this).getPropertyValue('--sl-color-primary-600') || '#4f46e5');
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		for (let i = 0; i < n; i++) {
			const x = marginLeft + i * xStep;
			const v = values[n - 1 - i];
			const y = marginTop + chartH - ((v - yMin) / yRange) * chartH;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// Draw points
		ctx.fillStyle = '#fff';
		for (let i = 0; i < n; i++) {
			const x = marginLeft + i * xStep;
			const v = values[n - 1 - i];
			const y = marginTop + chartH - ((v - yMin) / yRange) * chartH;

			ctx.beginPath();
			ctx.arc(x, y, 4, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();

			// Draw active point highlight
			if (i === activeIndex) {
				ctx.save();
				ctx.strokeStyle = this.chartMode === 'divine' ? 'rgba(234, 179, 8, 0.5)' : 'rgba(99, 102, 241, 0.5)';
				ctx.lineWidth = 10;
				ctx.beginPath();
				ctx.arc(x, y, 8, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();

				// Draw crosshair line
				ctx.save();
				ctx.strokeStyle = getComputedStyle(this).getPropertyValue('--sl-color-neutral-400') || '#9ca3af';
				ctx.lineWidth = 1;
				ctx.setLineDash([5, 5]);
				ctx.beginPath();
				ctx.moveTo(x, marginTop);
				ctx.lineTo(x, marginTop + chartH);
				ctx.stroke();
				ctx.restore();
			}
		}
	}

	#onChartMouseMove(e: MouseEvent) {
		const canvas = e.target as HTMLCanvasElement;
		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;

		const marginLeft = 60;
		const marginRight = 20;
		const marginTop = 20;
		const marginBottom = 40;
		const chartW = rect.width - marginLeft - marginRight;
		const chartH = 300 - marginTop - marginBottom;

		const n = this.snapshots.length;
		if (n === 0) return;

		// Calculate chart-relative X position
		const chartX = mouseX - marginLeft;
		if (chartX < 0 || chartX > chartW) {
			this.hoveredSnapshot = null;
			this.#renderHistoryCharts();
			return;
		}

		const activeN = this.chartRange === 'recent' ? Math.min(20, n) : n;
		const xStep = chartW / Math.max(1, activeN - 1);

		// Find nearest index
		let index = Math.round(chartX / xStep);
		index = Math.max(0, Math.min(activeN - 1, index));

		// Map back to snapshots array index (reversed)
		const snapshotIndex = activeN - 1 - index;
		const snapshot = this.snapshots[snapshotIndex];

		// Calculate Y position for tooltip
		const values = this.snapshots.slice(0, activeN).map(s => this.chartMode === 'divine' ? (s.total_divines || 0) : (s.total_chaos || 0));
		const max = Math.max(...values);
		const min = Math.min(...values);
		const range = max - min || 1;
		const yMax = max + (range * 0.1);
		const yMin = Math.max(0, min - (range * 0.1));
		const yRange = yMax - yMin;
		const value = this.chartMode === 'divine' ? (snapshot.total_divines || 0) : (snapshot.total_chaos || 0);
		const y = marginTop + chartH - ((value - yMin) / yRange) * chartH;

		let align: 'center' | 'left' | 'right' = 'center';
		const approxTooltipHalf = 120;
		if (mouseX < approxTooltipHalf) {
			align = 'left';
		} else if (mouseX > rect.width - approxTooltipHalf) {
			align = 'right';
		}

		this.hoveredSnapshot = {
			snapshot,
			x: mouseX,
			y,
			index,
			align,
		};
		this.#renderHistoryCharts();
	}

	#onChartMouseLeave() {
		this.hoveredSnapshot = null;
	}

	#drawBars(canvas: HTMLCanvasElement, entries: Array<{ name: string; value: number }>): void {
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		const w = rect.width;
		const h = 300; // Match line chart height

		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;

		if (w <= 0) {
			requestAnimationFrame(() => this.#renderHistoryCharts());
			return;
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			console.warn('Category Breakdown: 2D context unavailable');
			return;
		}
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);

		if (entries.length === 0) {
			ctx.fillStyle = getComputedStyle(this).getPropertyValue('--sl-color-neutral-600') || '#64748b';
			ctx.font = '600 13px system-ui';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('No category data', w / 2, h / 2);
			return;
		}

		const max = Math.max(1, ...entries.map(e => e.value));
		const rowH = Math.min(40, h / entries.length);

		// Colors for bars
		const colors = [
			'#6366f1', // Indigo
			'#8b5cf6', // Violet
			'#ec4899', // Pink
			'#f43f5e', // Rose
			'#f97316', // Orange
			'#eab308', // Yellow
			'#22c55e', // Green
			'#06b6d4', // Cyan
			'#3b82f6', // Blue
			'#64748b', // Slate
		];

		for (let i = 0; i < entries.length; i++) {
			const e = entries[i];
			const y = i * rowH + 8;
			const barMaxW = w - 120; // Reserve space for text
			const barW = Math.max(2, (e.value / max) * barMaxW);

			ctx.fillStyle = 'rgba(0,0,0,0.03)';
			ctx.fillRect(100, y, barMaxW, rowH - 12);

			ctx.fillStyle = colors[i % colors.length];
			ctx.fillRect(100, y, barW, rowH - 12);

			// Label
			ctx.fillStyle = getComputedStyle(this).getPropertyValue('--sl-color-neutral-700') || '#374151';
			ctx.font = '600 13px system-ui';
			ctx.textAlign = 'right';
			ctx.textBaseline = 'middle';
			ctx.fillText(e.name, 90, y + (rowH - 12) / 2);

			// Value
			ctx.textAlign = 'left';
			ctx.font = '13px system-ui';
			ctx.fillText(`${Math.round(e.value).toLocaleString()}`, 100 + barW + 8, y + (rowH - 12) / 2);
		}
	}



	async #loadSingleTabContent<T>(
		kind: 'general-tab' | 'sample',
		id: string,
		league: League,
		loadFunction: (id: string, league: League) => T,
		force: boolean
	): Promise<T> {
		if (!this.stashLoader) {
			throw new Error('No stash loader');
		}

		if (!force && kind === 'general-tab') {
			const cached = this.#getCachedTab(id);
			if (cached) {
				return cached as unknown as T;
			}
		}

		const result = await this.#loader.request(() => Promise.resolve(loadFunction(id, league)));
		return result as T;
	}

	#handleError(tag: string, err: unknown, retry?: () => Promise<void>, retryLabel?: string): void {
		const message = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Unknown error';
		const payload = { tag, message } as const;
		console.error('StashesViewError', payload);
		this.#toast('danger', message);
		if (retry) {
			this.lastError = payload as any;
			this.retryLabel = retryLabel ?? 'Retry';
			this.retryCallback = retry;
		}
	}
}


const sleepMs = async (ms: number): Promise<void> => {
	return new Promise(r => setTimeout(r, ms));
};

declare global {
	interface HTMLElementTagNameMap {
		'e-stashes-view': StashesViewElement;
	}
}
function formatChaosAmount(amount: number): string {
	if (amount >= 1000) {
		return `${(amount / 1000).toFixed(1)}k`;
	}
	return `${Math.round(amount)}c`;
}
declare module 'vue' {
	interface GlobalComponents {
		'e-stashes-view': DefineComponent<StashesViewProps & VueEventHandlers<Events>>;
	}
}
