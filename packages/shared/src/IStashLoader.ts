import { DivinationCardsSample, League } from './types.js';
import { NoItemsTab, TabWithItems } from 'poe-custom-elements';

export interface IStashLoader {
	tabs(league: League): Promise<NoItemsTab[]>;
	sampleFromTab(tabId: string, league: League): Promise<DivinationCardsSample>;
	tab: (tabId: string, league: League) => Promise<TabWithItems>;
	tabFromBadge: (tab: NoItemsTab, league: League) => Promise<TabWithItems>;
	sampleFromBadge: (tab: NoItemsTab, league: League) => Promise<DivinationCardsSample>;
	mapPrices: (league: League) => Promise<Array<{ name: string; tier: number; chaos_value: number | null }>>;
	currencyPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	fragmentPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	essencePrices: (league: League) => Promise<Array<{ name: string; variant: string | null; chaos_value: number | null }>>;
	gemPrices: (league: League) => Promise<Array<{ name: string; level: number; quality: number; corrupt?: boolean; chaos_value: number | null }>>;
	oilPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	incubatorPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	fossilPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	resonatorPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	deliriumOrbPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	vialPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	divinationCardPrices: (league: League) => Promise<Array<{ name: string; chaos_value: number | null }>>;
	ninjaDenseOverviewsRaw: (league: League) => Promise<Record<string, unknown>>;
	priceSourcesMatrix: (league: League, opts?: { includeLowConfidence?: boolean }) => Promise<Array<{ category: string; name: string; variant?: string | null; tier?: number | null; dense?: number | null; currency_overview?: number | null; item_overview?: number | null; poewatch?: number | null }>>;
	wealthSnapshot: (league: League, tabs: Array<{ stash_id: string; substash_id?: string | null }>) => Promise<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }>; inventory?: Record<string, number> }>;
	listSnapshots: (league: League, limit?: number) => Promise<Array<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }>; inventory?: Record<string, number> }>>;
	wealthSnapshotCached: (league: League, tabs: Array<TabWithItems>) => Promise<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }>; inventory?: Record<string, number> }>;
	priceVarianceCached: (
		league: League,
		tabs: Array<TabWithItems>,
		baseline_item_prices?: Record<string, number>,
		baseline_by_category?: Record<string, { chaos: number }>,
		baseline_inventory?: Record<string, number>
	) => Promise<{ mode: 'item' | 'category' | 'inventory'; changes: any[]; totalVariance?: number }>;
}

export interface IDefaultStashLoader {
	tabs: (league: League) => Promise<NoItemsTab[]>;
	tab: (league: League, tabId: string) => Promise<TabWithItems>;
	sample?: (league: League, tabId: string) => Promise<DivinationCardsSample>;
}

/**
 * 
 * ```
 * const stashLoader = new DefaultStashLoader(
	'divicards',
	'0.5.3',
	'poeshonya3@gmail.com',
	'97b464048e88ad2c6433dacbefd67030c97523a5'
);

	```
 */
export class StashLoader implements IDefaultStashLoader {
	static API_URL = 'https://api.pathofexile.com' as const;
	/** Name of your application */
	#app: string;
	/** Actual version of your application */
	#version: string;
	/** Contact Email of developer */
	#contactEmail: string;
	/** Access Token with scope:stashes */
	#token: string;

	/**
	 *
	 * @param app Name of your application
	 * @param version Actual version of your application
	 * @param contactEmail Contact Email of developer
	 * @param token Access Token with scope:stashes
	 */
	constructor(app: string, version: string, contactEmail: string, token: string) {
		this.#app = app;
		this.#version = version;
		this.#contactEmail = contactEmail;
		this.#token = token;
	}

	async tab(league: string, tabId: string, subtabId?: string): Promise<TabWithItems> {
		let url = `${StashLoader.API_URL}/stash/${league}/${tabId}`;
		if (subtabId) {
			url = `${url}/${subtabId}`;
		}

		const response = await fetch(url, {
			headers: this.#authHeaders(),
		});
		if (response.status === 401) {
			throw 'Unauthorized';
		}

		type ApiTabResponse = { stash: TabWithItems };
		const body: ApiTabResponse & { error?: { message: string } } = await response.json();
		if (!response.ok && typeof body?.error?.message === 'string') {
			throw body.error.message;
		}
		return body.stash;
	}

	async tabs(league: string): Promise<NoItemsTab[]> {
		const url = `${StashLoader.API_URL}/stash/${league}`;
		const response = await fetch(url, {
			headers: this.#authHeaders(),
		});
		if (response.status === 401) {
			throw 'Unauthorized';
		}

		type ApiTabsResponse = { stashes: NoItemsTab[] };

		const body: ApiTabsResponse & { error?: { message: string } } = await response.json();
		if (!response.ok && typeof body?.error?.message === 'string') {
			throw body.error.message;
		}

		return this.#flattenTabs(body.stashes);
	}

	#flattenTabs(tabs: NoItemsTab[]): NoItemsTab[] {
		const flat: NoItemsTab[] = [];

		for (const tab of tabs) {
			if (tab.type !== 'Folder') {
				flat.push(tab);
			}

			if (tab.children) {
				for (const childTab of tab.children) {
					flat.push(childTab);
				}
			}
		}

		return flat;
	}

	#authHeaders() {
		return new Headers({
			Authorization: `Bearer ${this.#token}`,
			'User-Agent': this.#userAgentHeader(),
		});
	}

	/** for "User-Agent" header
	 * ```
	 *  'User-Agent': #this.userAgent()
	 * ```
	 */
	#userAgentHeader() {
		return `$OAuth ${this.#app}/${this.#version} (contact: ${this.#contactEmail})`;
	}
}
