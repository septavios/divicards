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
const toast = (variant: ToastVariant, message: string) => {
    const iconVariantRecord: Record<ToastVariant, string> = {
        info: 'info-circle',
        success: 'check2-circle',
        neutral: 'gear',
        warning: 'exclamation-triangle',
        danger: 'exclamation-octagon',
    };
    const iconName = iconVariantRecord[variant];
    const duration = variant === 'warning' || variant === 'danger' ? undefined : 5000;
    const variantProp = variant === 'info' ? 'primary' : variant;
    const alert = Object.assign(document.createElement('sl-alert'), {
        closable: true,
        duration,
        variant: variantProp,
    } as any);
    const icon = Object.assign(document.createElement('sl-icon'), {
        name: iconName,
        slot: 'icon',
    } as any);
    alert.append(icon, message);
    (alert as any).toast();
};

export interface StashesViewProps {
	league?: League;
	stashLoader: IStashLoader;
}

export type DownloadAs = (typeof DOWNLOAD_AS_VARIANTS)[number];
const DOWNLOAD_AS_VARIANTS = ['divination-cards-sample', 'general-tab'] as const;

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
	@state() tabsCache: Map<string, TabWithItems> = new Map();
	@state() opened_tab: NoItemsTab | null = null;
	@state() snapshots: Array<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }> }> = [];
	/** Indicator whether cards was just extracted. */
	@state() cardsJustExtracted = false;
	@state() showWealth = false;
	private stashTabTask = new Task(this, {
		task: async ([tab]) => {
			if (!tab) {
				return null;
			}
			// If we have this tab in cache, serve it without an API call
			const inCache = this.tabsCache.get(tab.id);
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
	                this.tabsCache.set((loaded as any).id, loaded as any);
	            }
	            return loaded;
		},
		args: () => [this.opened_tab],
	});

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
        if (!this.fetchingStash) {
            await this.#loadStash();
        }
    }

	protected override render(): TemplateResult {
		return html`<div class="main-stashes-component">
			<header class="header">
                ${this.stashtabs_badges.length
                    ? html`
                            <div>
                                ${this.fetchingStashTab
                                    ? html`<sl-button><sl-spinner></sl-spinner></sl-button>`
                                    : this.multiselect
                                    ? html`<sl-button
                                            id="get-data-btn"
                                            class="btn-load-items"
                                            .disabled=${this.selected_tabs.size === 0 ||
                                            this.fetchingStashTab ||
                                            this.stashLoadsAvailable === 0}
                                            @click=${this.#onLoadItemsClicked}
                                      >
                                            Force reload selected
                                      </sl-button>`
                                    : null}
                            </div>
                      `
                    : html`<div>
                            ${this.fetchingStash
                                ? html`<sl-button size="small"><sl-spinner></sl-spinner></sl-button>`
                                : nothing}
                      </div> `}
                <div class="top-right-corner">
                    ${this.stashtabs_badges.length
                        ? html`
                                ${this.multiselect && this.opened_tab && (this.opened_tab.type === 'DivinationCardStash')
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
                                <div class="tips">
                                    <e-help-tip>
                                        <p>PoE API allows 30 requests in 5 minutes</p>
                                    </e-help-tip>
                                    <div class="loads-available">
                                        Loads available:<span class="loads-available__value"
                                            >${this.stashLoadsAvailable}</span
                                        >
                                    </div>
                                    <sl-button size="small" variant="primary" @click=${this.#captureSnapshot}>Capture Snapshot</sl-button>
                                    <sl-button size="small" @click=${this.#loadSnapshots}>Refresh Snapshots</sl-button>
                                    ${this.snapshots.length ? html`<sl-button size="small" @click=${this.#toggleWealth}>${this.showWealth ? 'Hide' : 'Wealth History'}</sl-button>` : nothing}
                                    ${this.snapshots.length
                                        ? html`<sl-details summary="Snapshots">
                                                <div>
                                                    ${this.snapshots.slice(0, 10).map(s => html`<div>
                                                        <span>${new Date(s.timestamp * 1000).toLocaleString()}</span>
                                                        <span> • Chaos: ${Math.round(s.total_chaos)}</span>
                                                        ${s.total_divines != null ? html`<span> • Div: ${s.total_divines.toFixed(2)}</span>` : nothing}
                                                    </div>`)}
                                                </div>
                                            </sl-details>`
                                        : nothing}
                                </div>
                          `
                        : nothing}
                    <sl-button size="small" @click=${this.#onCloseClicked} class="btn-close">Close</sl-button>
                </div>
			</header>
			<div class="messages">
				<p class="msg">${this.msg}</p>
				<p class="msg">${this.noStashesMessage}</p>
				${this.errors.length
					? html`<e-stash-tab-errors
							@upd:hoveredErrorTabId=${this.#handleUpdHoveredError}
							@upd:errors=${this.#handleUpdErrors}
							.errors=${this.errors}
					  ></e-stash-tab-errors>`
					: nothing}
			</div>
            ${this.showWealth && this.snapshots.length ? html`
            <section class="wealth-history">
                <div class="wealth-summary">
                    ${(() => {
                        const latest = this.snapshots[0];
                        const chaos = Math.round(latest.total_chaos);
                        const div = latest.total_divines != null ? latest.total_divines.toFixed(2) : '';
                        return html`<div class="summary-item">Total Chaos: <strong>${chaos}</strong></div>
                        ${div ? html`<div class="summary-item">Total Divines: <strong>${div}</strong></div>` : nothing}
                        <div class="summary-item">Snapshots: <strong>${this.snapshots.length}</strong></div>`;
                    })()}
                </div>
                <div class="charts">
                    <canvas id="wealth-line"></canvas>
                    <canvas id="wealth-bars"></canvas>
                </div>
                <div class="category-list">
                    ${(() => {
                        const latest = this.snapshots[0];
                        const total = latest.total_chaos || 1;
                        const entries = Object.entries(latest.by_category || {}).map(([k, v]) => ({ name: k, chaos: v.chaos || 0 }));
                        entries.sort((a, b) => b.chaos - a.chaos);
                        return html`${entries.map(e => html`<div class="category-row">
                            <span class="category-name">${e.name}</span>
                            <span class="category-val">${Math.round(e.chaos)}</span>
                            <span class="category-pct">${((e.chaos / total) * 100).toFixed(1)}%</span>
                        </div>`)}`;
                    })()}
                </div>
            </section>` : nothing}
			<e-tab-badge-group
				.multiselect=${this.multiselect}
				league=${this.league}
				.stashes=${this.stashtabs_badges}
				.selected_tabs=${this.selected_tabs}
				.errors=${this.errors}
				.hoveredErrorTabId=${this.hoveredErrorTabId}
				@change:multiselect=${this.#change_multiselect}
				@change:selected_tabs=${this.#handle_selected_tabs_change}
				.badgesDisabled=${this.stashLoadsAvailable === 0}
			></e-tab-badge-group>
			${this.opened_tab
				? this.stashTabTask.render({
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
							return html`initial`;
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
				  })
				: null}
		</div>`;
	}

	protected override updated(map: PropertyValues<this>): void {
		if (map.has('snapshots') || map.has('showWealth')) {
			this.#renderHistoryCharts();
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

    async #bulkLoadAllTabs(): Promise<void> {
        if (!this.stashtabs_badges.length) {
            await this.#loadStash();
        }
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
    }

	#handle_selected_tabs_change(e: SelectedTabsChangeEvent): void {
		this.selected_tabs = new Map(e.$selected_tabs);
		this.dispatchEvent(new SelectedTabsChangeEvent(this.selected_tabs));
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
		while (this.selected_tabs.size > 0) {
			for (const { id, name: stashtab_name } of this.selected_tabs.values()) {
				this.fetchingStashTab = true;
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
							if (stashtab) this.tabsCache.set(stashtab.id, stashtab);
							this.dispatchEvent(new StashtabFetchedEvent(stashtab, this.league));
							break;
						}
					}
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
				} finally {
					this.selected_tabs.delete(id);
					this.selected_tabs = new Map(this.selected_tabs);
					this.fetchingStashTab = false;
					this.msg = '';
				}
			}
		}
	}

	async #captureSnapshot(): Promise<void> {
		if (!this.stashLoader) {
			return;
		}
		this.msg = 'Capturing snapshot...';
		const selected = this.selected_tabs.size
			? Array.from(this.selected_tabs.values()).map(v => v.id)
			: this.stashtabs_badges.map(b => b.id);
		const cachedTabs: Array<TabWithItems> = selected
			.map(id => this.tabsCache.get(id))
			.filter((t): t is TabWithItems => !!t);
		const allCached = cachedTabs.length === selected.length;
		// legacy refs shape no longer used; we capture from cache exclusively
        try {
            if (!allCached) {
                for (const id of selected) {
                    if (this.tabsCache.has(id)) continue;
                    const badge = this.stashtabs_badges.find(t => t.id === id)!;
                    const loaded = await this.#loadSingleTabContent('general-tab', id, this.league, (_sid, _lg) => this.stashLoader.tabFromBadge(badge, this.league), true);
                    if (loaded) this.tabsCache.set(loaded.id, loaded);
                }
            }
            const finalTabs: Array<TabWithItems> = selected
                .map(id => this.tabsCache.get(id))
                .filter((t): t is TabWithItems => !!t);
            await (this.stashLoader as any).wealthSnapshotCached(this.league, finalTabs);
            this.msg = 'Snapshot captured';
            toast('success', 'Snapshot captured');
            await this.#loadSnapshots();
        } catch (err) {
            const msg = this.#errorMessage(err);
            this.msg = msg;
            toast('danger', msg);
            const secs = this.#parseRetryAfterSeconds(msg);
            if (secs && secs > 0) {
                setTimeout(() => {
                    this.#captureSnapshot();
                }, (secs + 1) * 1000);
            }
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
            toast('success', 'Snapshots refreshed');
        } catch (err) {
            this.msg = this.#errorMessage(err);
            toast('danger', this.msg);
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
		if (line) {
			const values = this.snapshots.map(s => s.total_chaos || 0);
			this.#drawLine(line, values);
		}
		if (bars) {
			const latest = this.snapshots[0];
			const entries = Object.entries(latest.by_category || {}).map(([k, v]) => ({ name: k, value: v.chaos || 0 }));
			entries.sort((a, b) => b.value - a.value);
			this.#drawBars(bars, entries.slice(0, 10));
		}
	}

	#drawLine(canvas: HTMLCanvasElement, values: number[]): void {
		const dpr = window.devicePixelRatio || 1;
		const w = canvas.clientWidth || 600;
		const h = 220;
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		const max = Math.max(...values);
		const min = Math.min(...values);
		const pad = (max - min) * 0.1;
		const yMax = max + pad;
		const yMin = Math.max(0, min - pad);
		const n = values.length;
		const xStep = n > 1 ? w / (n - 1) : w;
		ctx.strokeStyle = getComputedStyle(this).getPropertyValue('--sl-color-primary-600') || '#4f46e5';
		ctx.lineWidth = 2;
		ctx.beginPath();
		for (let i = 0; i < n; i++) {
			const x = i * xStep;
			const v = values[i];
			const y = h - ((v - yMin) / (yMax - yMin)) * (h - 20);
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
		const last = values[n - 1] || 0;
		ctx.fillStyle = getComputedStyle(this).getPropertyValue('--sl-color-neutral-700') || '#374151';
		ctx.font = '12px system-ui';
		ctx.fillText(`${Math.round(last)}`, w - 60, 16);
	}

	#drawBars(canvas: HTMLCanvasElement, entries: Array<{ name: string; value: number }>): void {
		const dpr = window.devicePixelRatio || 1;
		const w = canvas.clientWidth || 600;
		const h = 260;
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		const max = Math.max(1, ...entries.map(e => e.value));
		const rowH = Math.min(30, h / Math.max(1, entries.length));
		for (let i = 0; i < entries.length; i++) {
			const e = entries[i];
			const y = i * rowH + 4;
			const barW = ((e.value / max) * (w - 160));
			ctx.fillStyle = getComputedStyle(this).getPropertyValue('--sl-color-primary-500') || '#6366f1';
			ctx.fillRect(140, y, barW, rowH - 8);
			ctx.fillStyle = getComputedStyle(this).getPropertyValue('--sl-color-neutral-700') || '#374151';
			ctx.font = '12px system-ui';
			ctx.fillText(e.name, 8, y + rowH / 2);
			ctx.fillText(`${Math.round(e.value)}`, 110, y + rowH / 2);
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
			const cached = this.tabsCache.get(id);
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
			const singleTabContent = await loadFunction(id, league);
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

declare module 'vue' {
    interface GlobalComponents {
        'e-stashes-view': DefineComponent<StashesViewProps & VueEventHandlers<Events>>;
    }
}
