import type { IStashLoader } from '@divicards/shared/IStashLoader.js';
import { html, PropertyValues, nothing, LitElement, CSSResult, TemplateResult } from 'lit';
import '../e-help-tip';
// league select moved to app toolbar
import './e-tab-badge-group/e-tab-badge-group.js';
import './e-stash-tab-errors';
import { property, state, query, customElement } from 'lit/decorators.js';
import { type League } from '@divicards/shared/types.js';
import { ACTIVE_LEAGUE } from '@divicards/shared/lib.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/radio-button/radio-button.js';
import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import { isStashTabError } from '@divicards/shared/error.js';
import type { ErrorLabel, SelectedStashtabs } from './types.js';
import { styles } from './e-stashes-view.styles.js';
import './e-stash-tab-container/e-stash-tab-container.js';
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
	CloseEvent,
	Events,
} from './events.js';
import { DefineComponent } from 'vue';
import { VueEventHandlers } from '../../event-utils.js';
import { MultiselectChangeEvent } from './e-tab-badge-group/events.js';
import { TabClickEvent } from './e-tab-badge/events.js';

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
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
	@state() opened_tab: NoItemsTab | null = null;
	@state() snapshots: Array<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }> }> = [];
	/** Indicator whether cards was just extracted. */
	@state() cardsJustExtracted = false;
	@state() showWealth = false;
	@state() hoveredSnapshot: { x: number; y: number; snapshot: any; index: number } | null = null;
	@state() bulkProgress: { loaded: number; total: number; name: string } | null = null;
	@state() chartMode: 'chaos' | 'divine' = 'chaos';
	@state() chartRange: 'all' | 'recent' = 'all';
	private lastToastTime = 0;

	private stashTabTask = new Task(this, {
		task: async ([tab, selectedTabs]: [NoItemsTab | null, SelectedStashtabs]) => {
			if (this.multiselect && selectedTabs && selectedTabs.size === 0) {
				return null;
			}


			if (!tab) {
				return null;
			}
			// If we have this tab in cache, serve it without an API call
			const inCache = this.#getCachedTab(tab.id);
			if (inCache) {
				return inCache;
			}
			// Aggregate MapStash items across all children regardless of flattening
			if (tab.type === 'MapStash') {
				const parentId = tab.parent ?? tab.id;
				let children = this.stashtabs_badges.filter(t => t.parent === parentId);
				if (children.length > 0) {
					const items: TabWithItems['items'] = [];
					for (const child of children) {
						const childTab = await this.stashLoader.tabFromBadge(child, this.league);
						items.push(...childTab.items);
					}
					return { ...tab, items, children } as TabWithItems;
				}
				// fallback to existing child array if present
				if (Array.isArray(tab.children) && tab.children.length > 0) {
					const items: TabWithItems['items'] = [];
					for (const child of tab.children) {
						const childTab = await this.stashLoader.tabFromBadge(child, this.league);
						items.push(...childTab.items);
					}
					return { ...tab, items, children: tab.children } as TabWithItems;
				}
				// re-fetch badges to discover children and try again
				try {
					const badges = await this.stashLoader.tabs(this.league);
					this.stashtabs_badges = badges;
					children = badges.filter(t => t.parent === parentId);
					if (children.length > 0) {
						const items: TabWithItems['items'] = [];
						for (const child of children) {
							const childTab = await this.stashLoader.tabFromBadge(child, this.league);
							items.push(...childTab.items);
						}
						return { ...tab, items, children } as TabWithItems;
					}
				} catch {
					// ignore and fallthrough
				}
			}
			const loaded = await this.#loadSingleTabContent('general-tab', tab.id, this.league, (_id, _league) => this.stashLoader.tabFromBadge(this.opened_tab!, this.league), false);
			if (loaded && typeof (loaded as any)?.id === 'string') {
				this.#setCachedTab((loaded as any).id, loaded as any);
			}
			return loaded;
		},
		args: () => [this.opened_tab, this.selected_tabs] as [NoItemsTab | null, SelectedStashtabs],
	});

	// Cache helper methods with TTL support
	#isCacheValid(id: string): boolean {
		const cached = this.tabsCache.get(id);
		if (!cached) return false;
		return Date.now() - cached.timestamp < this.CACHE_TTL;
	}

	#getCachedTab(id: string): TabWithItems | null {
		if (this.#isCacheValid(id)) {
			return this.tabsCache.get(id)!.data;
		}
		// Remove expired cache entry
		this.tabsCache.delete(id);
		return null;
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
		this.tabsCache.set(id, {
			data: tab,
			timestamp: Date.now()
		});
		this.requestUpdate();
	}

	#renderAggregatedView(): TemplateResult | typeof nothing {
		if (!this.multiselect || this.selected_tabs.size === 0) return nothing;

		const selectedIds = Array.from(this.selected_tabs.keys());
		const items: TabWithItems['items'] = [];

		// Collect items from cache
		for (const id of selectedIds) {
			const cached = this.#getCachedTab(id);
			if (cached && cached.items) {
				items.push(...cached.items);
			}
		}

		// Don't show aggregated table if we have no items yet
		if (items.length === 0) {
			return nothing;
		}

		// Create a synthetic tab for aggregation
		const aggregatedTab: TabWithItems = {
			id: 'aggregated-view',
			name: `Aggregated (${selectedIds.length} tabs)`,
			type: 'QuadStash',
			index: 0,
			items: items,
			metadata: {
				colour: 'ffffff'
			}
		};

		return html`<e-stash-tab-container
			.cardsJustExtracted=${this.cardsJustExtracted}
			@e-stash-tab-container__close=${this.#handleTabContainerClose}
			@e-stash-tab-container__extract-cards=${this.#emitExtractCards}
			status="complete"
			.league=${this.league}
			.stashLoader=${this.stashLoader}
			.tab=${aggregatedTab}
		></e-stash-tab-container>`;
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

		this.addEventListener('stashes__clear-cache', async e => {
			e.stopPropagation();
			await this.#clearAllCache();
		});
		this.addEventListener('stashes__force-reload-selected', e => {
			e.stopPropagation();
			this.#onLoadItemsClicked();
		});
	}

	@query('button#stashes-btn') stashesButton!: HTMLButtonElement;
	@query('button#get-data-btn') getDataButton!: HTMLButtonElement;

	protected willUpdate(map: PropertyValues<this>): void {
		if (map.has('league')) {
			this.stashtabs_badges = [];
			this.msg = '';
			this.selected_tabs = new Map();
			this.errors = [];
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
                    ${this.stashtabs_badges.length
				? html`
                                <div>
                                    ${this.fetchingStashTab
						? html`<sl-button><sl-spinner></sl-spinner></sl-button>`
						: nothing}
                                </div>
                          `
				: html`<div>
                                ${this.fetchingStash
						? html`<sl-button size="small"><sl-spinner></sl-spinner></sl-button>`
						: nothing}
                          </div> `}
                </div>
                
                <div class="header-right">
                    <div class="snapshot-controls">
                         <div class="loads-available">
                            Loads: <span class="loads-available__value">${this.stashLoadsAvailable}</span>
                        </div>
                        <e-help-tip>
                            <p>PoE API allows 30 requests in 5 minutes</p>
                        </e-help-tip>
                        <sl-button-group>
                            <sl-button 
                                size="small" 
                                @click=${this.#captureSnapshot} 
                                title="Refresh Snapshot"
                                .loading=${this.capturingSnapshot}
                                .disabled=${this.capturingSnapshot}
                            >
                                <sl-icon name="arrow-clockwise" slot="prefix"></sl-icon>
                                Refresh
                            </sl-button>
                            ${this.snapshots.length ? html`
                                <sl-button size="small" @click=${this.#toggleWealth} ?variant=${this.showWealth ? 'default' : 'neutral'}>
                                    ${this.showWealth ? 'Hide History' : 'Show History'}
                                </sl-button>
                            ` : nothing}
                        </sl-button-group>
                    </div>

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
                    
                    <sl-button size="small" @click=${this.#onCloseClicked} class="btn-close">Close</sl-button>
                </div>
			</header>
			<div class="messages">
				${this.bulkProgress ? html`
					<div class="bulk-progress">
						<div class="bulk-row">
							<sl-spinner></sl-spinner>
							<span class="bulk-text">
								${this.msg ? this.msg : `Loading ${this.bulkProgress.name} (${this.bulkProgress.loaded}/${this.bulkProgress.total})...`}
							</span>
						</div>
						<div class="bulk-bar">
							<div class="bulk-fill" style="width: ${Math.max(0, Math.min(100, Math.round((this.bulkProgress.loaded / Math.max(1, this.bulkProgress.total)) * 100)))}%"></div>
						</div>
					</div>
				` : html`<p class="msg">${this.msg}</p>`}
				<p class="msg">${this.noStashesMessage}</p>
				${this.errors.length
				? html`<e-stash-tab-errors
							@upd:hoveredErrorTabId=${this.#handleUpdHoveredError}
							@upd:errors=${this.#handleUpdErrors}
							.errors=${this.errors}
					  ></e-stash-tab-errors>`
				: nothing}
			</div>
            ${this.showWealth && this.snapshots.length ? this.#renderWealthDashboard() : nothing}
			<e-tab-badge-group
				.stashes=${this.stashtabs_badges}
				.selected_tabs=${this.selected_tabs}
				.multiselect=${this.multiselect}
				.league=${this.league}
				.errors=${this.errors}
				.hoveredErrorTabId=${this.hoveredErrorTabId}
				.downloadedStashTabs=${this.downloadedStashTabs}
				.badgesDisabled=${this.stashLoadsAvailable === 0}
				@e-tab-badge-group__click=${this.#handle_tab_badge_click}
				@e-tab-badge-group__multiselect-change=${this.#change_multiselect}
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
			this.multiselect = true;

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

	#handle_selected_tabs_change(e: SelectedTabsChangeEvent): void {
		this.selected_tabs = new Map(e.$selected_tabs);
		this.dispatchEvent(new SelectedTabsChangeEvent(this.selected_tabs));
		if (this.multiselect && this.selected_tabs.size === 0) {
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
		this.opened_tab = clicked;
	}
	#change_multiselect(e: MultiselectChangeEvent): void {
		this.multiselect = e.$multiselect;
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
			if (err instanceof Error) {
				this.noStashesMessage = err.message;
			} else if (typeof err === 'string') {
				this.noStashesMessage = err;
			} else {
				throw err;
			}
		} finally {
			this.fetchingStash = false;
		}
	}

	/** For each selected stashtab badge, load stashtab and emit it */
	async #load_selected_tabs(league: League, force = false): Promise<void> {
		const tabsToLoad = Array.from(this.selected_tabs.values());
		let loadedCount = 0;
		const totalToLoad = tabsToLoad.length;

		this.fetchingStashTab = true;
		const CONCURRENCY = 2; // Load 2 tabs at a time

		try {
			// Process tabs in batches for parallel loading
			for (let i = 0; i < tabsToLoad.length; i += CONCURRENCY) {
				const batch = tabsToLoad.slice(i, i + CONCURRENCY);

				// Load batch in parallel using Promise.allSettled
				await Promise.allSettled(
					batch.map(async ({ id, name: stashtab_name }) => {
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

							// Update progress after each tab loads
							loadedCount++;
							this.bulkProgress = { loaded: loadedCount, total: totalToLoad, name: stashtab_name };
						} catch (err) {
							if (!isStashTabError(err)) {
								throw err;
							}
							const stashtab_badge = this.stashtabs_badges.find(stash => stash.id === id);
							if (stashtab_badge) {
								this.errors = [
									...this.errors,
									{
										noItemsTab: stashtab_badge,
										message: err.message,
									},
								];
							}
						}
					})
				);
				// Sleep 2s between batches to avoid rate limits
				await sleepSecs(2);
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
					if (this.tabsCache.has(id)) continue;
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

	async #clearAllCache(): Promise<void> {
		// Confirm with user before clearing
		const confirmed = confirm('Are you sure you want to clear all cached tabs and snapshot history? This cannot be undone.');
		if (!confirmed) return;

		try {
			// 1. Reset all loading states (fixes "stuck" issues)
			this.fetchingStashTab = false;
			this.bulkLoading = false;
			this.bulkProgress = null;
			this.msg = '';

			// 2. Clear tabs cache (assign new Map for reactivity)
			this.tabsCache = new Map();

			// 3. Reset UI State (New User Experience)
			this.selected_tabs = new Map();
			this.opened_tab = null;
			this.chartMode = 'chaos';
			this.chartRange = 'all';
			this.showWealth = false;
			this.snapshots = [];
			this.dispatchEvent(new SelectedTabsChangeEvent(this.selected_tabs));

			// 4. Clear snapshots from storage (graceful fallback)
			if (this.stashLoader) {
				try {
					await (this.stashLoader as any).clearSnapshots(this.league);
				} catch (e) {
					console.warn('Backend does not support clearing snapshots history', e);
				}
			}

			// 5. Reload snapshots to update UI (should be empty)
			try {
				await this.#loadSnapshots();
			} catch (e) {
				console.warn('Failed to reload snapshots', e);
			}

			this.#toast('success', 'Cache and history cleared');
			this.msg = 'Cache and history cleared';
			this.requestUpdate();
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to clear cache';
			this.#toast('danger', msg);
			this.msg = msg;
		}
	}

	async #loadSnapshots(): Promise<void> {
		if (!this.stashLoader) return;
		this.msg = 'Refreshing snapshots...';
		try {
			const rows = await (this.stashLoader as any).listSnapshots(this.league, 20);
			const sorted = Array.isArray(rows) ? [...rows].sort((a, b) => b.timestamp - a.timestamp) : [];
			this.snapshots = sorted;
			if (this.snapshots.length) {
				this.showWealth = true;
			}
			this.msg = '';
			// toast('success', 'Snapshots refreshed'); // redundant
		} catch (err) {
			this.msg = this.#errorMessage(err);
			this.#toast('danger', this.msg);
		}
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
                        <div class="metric-label"><sl-icon name="currency-bitcoin"></sl-icon> Total Chaos</div>
                        <div class="metric-value">${chaos.toLocaleString()}</div>
                        <div class="metric-sub ${chaosTrend}">
                            <sl-icon name="${trendIcon}"></sl-icon>
                            ${prev ? html`${chaosSign}${chaosDiff.toLocaleString()} vs last` : 'First snapshot'}
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

                <div class="charts">
                    <div class="chart-container">
                        <div class="chart-header">
                            <div class="chart-title">Wealth Trend</div>
                            <div class="chart-controls" style="display:flex;gap:0.5rem;">
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
                        ${this.hoveredSnapshot ? html`
                            <div 
                                class="chart-tooltip"
                                style="left: ${this.hoveredSnapshot.x}px; top: ${this.hoveredSnapshot.y - 10}px; transform: translate(-50%, -100%);"
                            >
                                <div class="tooltip-date">${new Date(this.hoveredSnapshot.snapshot.timestamp * 1000).toLocaleString()}</div>
                                <div class="tooltip-row">
                                    <span class="tooltip-label">Chaos:</span>
                                    <span class="tooltip-val">${Math.round(this.hoveredSnapshot.snapshot.total_chaos).toLocaleString()}</span>
                                </div>
                                ${this.hoveredSnapshot.snapshot.total_divines ? html`
                                <div class="tooltip-row">
                                    <span class="tooltip-label">Divines:</span>
                                    <span class="tooltip-val">${this.hoveredSnapshot.snapshot.total_divines.toFixed(2)}</span>
                                </div>` : nothing}
                            </div>
                        ` : nothing}
                    </div>
                    <div class="chart-container">
                         <div class="chart-header">
                            <div class="chart-title">Category Breakdown</div>
                         </div>
                        <canvas id="wealth-bars"></canvas>
                    </div>
                </div>
                
                <div class="category-list">
                    ${this.#renderCategoryList(latest)}
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

	#renderCategoryList(latest: any) {
		const total = latest.total_chaos || 1;
		const entries = Object.entries(latest.by_category || {}).map(([k, v]) => ({ name: k, chaos: (v as any).chaos || 0 }));
		entries.sort((a, b) => b.chaos - a.chaos);

		const getIcon = (name: string) => {
			if (name.includes('currency')) return 'coin';
			if (name.includes('card')) return 'postcard';
			if (name.includes('essence')) return 'droplet';
			if (name.includes('fragment')) return 'puzzle';
			if (name.includes('map')) return 'map';
			return 'box';
		};

		return html`${entries.map(e => {
			const pct = (e.chaos / total) * 100;
			return html`
				<div class="category-card">
					<div class="category-icon">
						<sl-icon name="${getIcon(e.name)}"></sl-icon>
					</div>
					<div class="category-details">
						<div class="category-header">
							<span class="cat-name">${e.name}</span>
							<span class="cat-val">${Math.round(e.chaos).toLocaleString()} <small class="category-pct">(${pct.toFixed(1)}%)</small></span>
						</div>
						<div class="progress-bar">
							<div class="progress-fill" style="width: ${pct}%"></div>
						</div>
					</div>
				</div>`;
		})}`;
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
			const entries = Object.entries(latest.by_category || {}).map(([k, v]) => ({ name: k, value: v.chaos || 0 }));
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

		const max = Math.max(...values);
		const min = Math.min(...values);
		const range = max - min || 1;
		// Add 15% padding top and bottom
		const yMax = max + (range * 0.15);
		const yMin = Math.max(0, min - (range * 0.15));
		const yRange = yMax - yMin;

		const n = values.length;
		const xStep = w / Math.max(1, n - 1);

		// Draw Grid
		ctx.strokeStyle = 'rgba(0,0,0,0.05)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		// Horizontal grid lines (5 lines)
		for (let i = 0; i <= 4; i++) {
			const y = h - (i / 4) * h;
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
		}
		ctx.stroke();

		// Gradient fill
		const gradient = ctx.createLinearGradient(0, 0, 0, h);
		if (this.chartMode === 'divine') {
			gradient.addColorStop(0, 'rgba(234, 179, 8, 0.2)'); // Yellow/Gold
			gradient.addColorStop(1, 'rgba(234, 179, 8, 0)');
		} else {
			gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)'); // Indigo
			gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
		}

		ctx.beginPath();
		// Start from bottom left
		ctx.moveTo(0, h);
		for (let i = 0; i < n; i++) {
			const x = i * xStep;
			const v = values[n - 1 - i]; // Reverse to show oldest to newest left-to-right
			const y = h - ((v - yMin) / yRange) * h;
			if (i === 0) ctx.lineTo(x, y); // First point
			else ctx.lineTo(x, y);
		}
		// Close path for fill
		ctx.lineTo((n - 1) * xStep, h);
		ctx.closePath();
		ctx.fillStyle = gradient;
		ctx.fill();

		// Stroke line
		ctx.strokeStyle = this.chartMode === 'divine'
			? (getComputedStyle(this).getPropertyValue('--sl-color-warning-500') || '#eab308')
			: (getComputedStyle(this).getPropertyValue('--sl-color-primary-600') || '#4f46e5');
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		for (let i = 0; i < n; i++) {
			const x = i * xStep;
			const v = values[n - 1 - i];
			const y = h - ((v - yMin) / yRange) * h;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// Draw points
		ctx.fillStyle = '#fff';
		for (let i = 0; i < n; i++) {
			const x = i * xStep;
			const v = values[n - 1 - i];
			const y = h - ((v - yMin) / yRange) * h;

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
				ctx.moveTo(x, 0);
				ctx.lineTo(x, h);
				ctx.stroke();
				ctx.restore();
			}
		}
	}

	#onChartMouseMove(e: MouseEvent) {
		const canvas = e.target as HTMLCanvasElement;
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const w = rect.width;
		const n = this.snapshots.length;

		if (n === 0) return;

		const xStep = w / Math.max(1, n - 1);
		// Find nearest index. Note: chart draws oldest to newest (reversed array)
		// so index 0 on chart is snapshots[n-1]
		let index = Math.round(x / xStep);
		index = Math.max(0, Math.min(n - 1, index));

		// Map back to snapshots array index
		const snapshotIndex = n - 1 - index;
		const snapshot = this.snapshots[snapshotIndex];

		// Calculate Y position for tooltip
		const values = this.snapshots.map(s => this.chartMode === 'divine' ? (s.total_divines || 0) : (s.total_chaos || 0));
		const max = Math.max(...values);
		const min = Math.min(...values);
		const range = max - min || 1;
		const yMax = max + (range * 0.15);
		const yMin = Math.max(0, min - (range * 0.15));
		const yRange = yMax - yMin;

		const val = this.chartMode === 'divine' ? (snapshot.total_divines || 0) : (snapshot.total_chaos || 0);
		const y = 300 - ((val - yMin) / yRange) * 300; // 300 is fixed height

		this.hoveredSnapshot = {
			x: index * xStep,
			y: y,
			index: index,
			snapshot
		};
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

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);

		if (entries.length === 0) return;

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

	async #waitForLoadsAvailable() {
		while (this.stashLoadsAvailable === 0) {
			this.msg = 'Loads available: 0. Waiting for cooldown.';
			await sleepSecs(1);
		}
		this.msg = '';
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

		await this.#waitForLoadsAvailable();
		this.stashLoadsAvailable--;
		setTimeout(() => {
			this.stashLoadsAvailable++;
		}, SECS_300);
		try {
			// Add 30s timeout to prevent hanging
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Request timed out')), 30000)
			);
			const singleTabContent = await Promise.race([
				loadFunction(id, league),
				timeoutPromise
			]);
			return singleTabContent;
		} finally {
			// run again go clear wait-messages when time comes
			this.#waitForLoadsAvailable();
		}
	}
}

const sleepSecs = async (secs: number): Promise<void> => {
	return new Promise(r => setTimeout(r, secs * 1000));
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
