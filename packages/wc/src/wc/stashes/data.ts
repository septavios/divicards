import { DivinationCardsSample, League } from '@divicards/shared/types.js';
import { IStashLoader } from '@divicards/shared/IStashLoader.js';
import type { PoeItem, TabWithItems, NoItemsTab } from 'poe-custom-elements/types.js';

import stashesData from './json/stashes.json' with { type: 'json' };
import sampleData from './json/sample.json' with { type: 'json' };
// Mock datasets for Storybook UI testing
// Each dataset below is documented to explain the UI scenario it targets.

export const stashes = stashesData as NoItemsTab[];
export const league: League = 'Standard';
export const sample: DivinationCardsSample = sampleData;
import quadStash from './json/QuadStashStd.json'  with { type: 'json' };
import fragmentsStash from './json/fragmentsTab.json'  with { type: 'json' };
const quad = quadStash as TabWithItems;
const fragments = fragmentsStash as TabWithItems;

const sleepSecs = (secs: number): Promise<void> => new Promise(resolve => setTimeout(resolve, secs * 1000));

// Helper: create a minimal PoE item with realistic fields used by UI
function makeItem(baseType: string, stackSize: number, extra: Record<string, any> = {}): PoeItem {
  const props: Array<any> = [];
  if (extra.properties) {
    // allow caller to set properties directly
  } else if ((extra as any).gemLevel || (extra as any).gemQuality) {
    const lvl = (extra as any).gemLevel ?? 0;
    const q = (extra as any).gemQuality ?? 0;
    props.push({ displayMode: 0, name: 'Gem Level', type: 0, values: [[String(lvl), 0]] });
    props.push({ displayMode: 0, name: 'Quality', type: 0, values: [[`${q}%`, 0]] });
  } else {
    props.push({ displayMode: 0, name: 'Stack Size', type: 32, values: [[`${stackSize}`, 0]] });
  }
  return {
    baseType,
    typeLine: baseType,
    stackSize,
    properties: extra.properties ?? props,
    frameType: 5,
    h: 1,
    w: 1,
    x: 0,
    y: 0,
    identified: true,
    league,
    ...(extra as any),
  } as PoeItem;
}

// Helper: generate a large mixed tab for pagination/scroll testing
// Includes currency, fragments, maps, essences, and gems with varied states.
function generateLargeTab(count = 240): TabWithItems {
  const namesCurrency = ['Chaos Orb', 'Divine Orb', 'Exalted Orb', "Orb of Alchemy", 'Orb of Fusing'];
  const namesFragments = ['Mortal Hope', 'Mortal Ignorance', 'Sacrifice at Dusk', 'Shaper Fragment'];
  const namesMaps = ['Jungle Valley Map', 'Cemetery Map', 'Tropical Island Map', 'Vault Map'];
  const namesEssences = ['Deafening Essence of Greed', 'Screaming Essence of Wrath', 'Weeping Essence of Contempt'];
  const namesGems = ['Awakened Multistrike Support', 'Vaal Arc', 'Precision', 'Toxic Rain'];

  const items: PoeItem[] = [];
  let tabIndex = 0;
  for (let i = 0; i < count; i++) {
    const bucket = i % 5;
    tabIndex = (i % 8); // spread across tabs
    if (bucket === 0) {
      const name = namesCurrency[i % namesCurrency.length];
      const qty = 1 + (i % 40);
      items.push(makeItem(name, qty, { tabIndex }));
    } else if (bucket === 1) {
      const name = namesFragments[i % namesFragments.length];
      const qty = 1 + (i % 10);
      items.push(makeItem(name, qty, { tabIndex }));
    } else if (bucket === 2) {
      const name = namesMaps[i % namesMaps.length];
      const qty = 1;
      items.push(makeItem(name, qty, { tabIndex }));
    } else if (bucket === 3) {
      const name = namesEssences[i % namesEssences.length];
      const qty = 1 + (i % 5);
      items.push(makeItem(name, qty, { tabIndex }));
    } else {
      const name = namesGems[i % namesGems.length];
      const lvl = 1 + (i % 21);
      const q = i % 23;
      const corrupted = i % 7 === 0;
      items.push(makeItem(name, 1, { tabIndex, gemLevel: lvl as any, gemQuality: q as any, corrupted }));
    }
  }
  return { id: 'mock-generated', index: 1, items } as TabWithItems;
}

/**
 * CSV sample: export/import testing for e-sample-card flows
 * - Includes valid/invalid rows, empty values, and mixed types
 */
export const mockCSV: string = `name,amount,price,sum\nChaos Orb,10,2.5,25\nDivine Orb,1,180,180\n,,,\nInvalid Row,-1,abc,0`;

/**
 * XML sample: generic inventory format with metadata and status flags
 */
export const mockXML: string = `<?xml version="1.0" encoding="UTF-8"?>\n<inventory generated="true" timestamp="${Math.floor(Date.now() / 1000)}">\n  <item id="1" name="Chaos Orb" qty="10" status="active"/>\n  <item id="2" name="Divine Orb" qty="1" status="inactive"/>\n  <item id="3" name="Awakened Multistrike Support" qty="1" status="active" corrupted="true"/>\n</inventory>`;

// Cycle across multiple tab sources: fixed JSON tabs and a generated large dataset
let stash: 'quad' | 'fragments' | 'generated' = 'quad';
export class MockStashLoader implements IStashLoader {
    async tab(_tabId: string, _league: string): Promise<TabWithItems> {
        const nextStash = stash === 'quad' ? fragments : (stash === 'fragments' ? generateLargeTab(260) : quad);
        stash = stash === 'quad' ? 'fragments' : (stash === 'fragments' ? 'generated' : 'quad');
        await sleepSecs(0.2);
        return nextStash;
    }
    async tabFromBadge(_tab: NoItemsTab, _league: League): Promise<TabWithItems> {
        return this.tab('', _league);
    }
    sampleFromTab(_tabId: string, _league: League): Promise<DivinationCardsSample> {
        return new Promise(r =>
            setTimeout(() => {
                r(sample);
            }, 50)
        );
    }
    sampleFromBadge(_tab: NoItemsTab, _league: League): Promise<DivinationCardsSample> {
        return this.sampleFromTab('', _league);
    }
    /** Price mocks: representative data types, edge cases (nulls), and coverage across categories */
    async mapPrices(_league: League): Promise<Array<{ name: string; tier: number; chaos_value: number | null }>> {
        return [
            { name: 'Jungle Valley Map', tier: 1, chaos_value: 1.2 },
            { name: 'Cemetery Map', tier: 5, chaos_value: 3.4 },
            { name: 'Vault Map', tier: 16, chaos_value: 25.0 },
            { name: 'Tropical Island Map', tier: 2, chaos_value: null } // invalid/missing price
        ];
    }
    async currencyPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Chaos Orb', chaos_value: 2.5 },
            { name: 'Divine Orb', chaos_value: 180 },
            { name: 'Exalted Orb', chaos_value: 100 },
            { name: 'Orb of Alchemy', chaos_value: 0.3 },
            { name: 'Orb of Fusing', chaos_value: 0.2 }
        ];
    }
    async fragmentPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Mortal Hope', chaos_value: 90 },
            { name: 'Mortal Ignorance', chaos_value: 12 },
            { name: 'Sacrifice at Dusk', chaos_value: 1.1 },
            { name: 'Shaper Fragment', chaos_value: null }
        ];
    }
    async essencePrices(_league: League): Promise<Array<{ name: string; variant: string | null; chaos_value: number | null }>> {
        return [
            { name: 'Essence of Greed', variant: 'Deafening', chaos_value: 2.1 },
            { name: 'Essence of Wrath', variant: 'Screaming', chaos_value: 0.8 },
            { name: 'Essence of Contempt', variant: null, chaos_value: null }
        ];
    }
    async gemPrices(_league: League): Promise<Array<{ name: string; level: number; quality: number; chaos_value: number | null }>> {
        return [
            { name: 'Awakened Multistrike Support', level: 5, quality: 20, chaos_value: 300 },
            { name: 'Precision', level: 21, quality: 23, chaos_value: 8.5 },
            { name: 'Vaal Arc', level: 20, quality: 0, chaos_value: 2.2 },
            { name: 'Toxic Rain', level: 1, quality: 0, chaos_value: null }
        ];
    }
    async oilPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Golden Oil', chaos_value: 250 },
            { name: 'Silver Oil', chaos_value: 30 },
            { name: 'Clear Oil', chaos_value: 0.1 }
        ];
    }
    async incubatorPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Abyssal Incubator', chaos_value: 1.9 },
            { name: 'Diviner Incubator', chaos_value: 5.5 }
        ];
    }
    async fossilPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Dense Fossil', chaos_value: 6.5 },
            { name: 'Perfect Fossil', chaos_value: 3.3 }
        ];
    }
    async resonatorPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Prime Chaotic Resonator', chaos_value: 2.2 },
            { name: 'Potent Chaotic Resonator', chaos_value: 4.8 }
        ];
    }
    async deliriumOrbPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Skittering Delirium Orb', chaos_value: 15.2 },
            { name: 'Divination Delirium Orb', chaos_value: 38.1 }
        ];
    }
    async vialPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Vial of Summoning', chaos_value: 12.3 },
            { name: 'Vial of Dominance', chaos_value: null }
        ];
    }
    async divinationCardPrices(_league: League): Promise<Array<{ name: string; chaos_value: number | null }>> {
        return [
            { name: 'Rain of Chaos', chaos_value: 3.0 },
            { name: 'The Union', chaos_value: 1.0 },
            { name: 'The Web', chaos_value: 3.0 }
        ];
    }
    async ninjaDenseOverviewsRaw(_league: League): Promise<Record<string, unknown>> {
        // Dense overview mock: minimal baseline signal
        return { updated_at: Math.floor(Date.now() / 1000) } as Record<string, unknown>;
    }
    /**
     * Price source matrix for comparison UI in dashboard.
     * - Covers All/Category filters, search, min diff, divine conversion
     * - Includes mixed availability across sources and sparkline data via dense_graph
     */
    async priceSourcesMatrix(_league: League, _opts?: { includeLowConfidence?: boolean }): Promise<Array<{ category: string; name: string; variant?: string | null; tier?: number | null; dense?: number | null; currency_overview?: number | null; item_overview?: number | null; poewatch?: number | null }>> {
        const rows: Array<any> = [];
        const add = (category: string, name: string, opts: Partial<{ variant: string | null; tier: number | null; dense: number | null; currency: number | null; item: number | null; poewatch: number | null; graph: number[] }>) => {
            rows.push({ category, name, variant: opts.variant ?? null, tier: opts.tier ?? null, dense: opts.dense ?? null, currency_overview: opts.currency ?? null, item_overview: opts.item ?? null, poewatch: opts.poewatch ?? null, dense_graph: opts.graph ?? [] });
        };
        add('Currency', 'Chaos Orb', { dense: 2.5, currency: 2.6, item: 2.4, poewatch: 2.5, graph: [0, 1, -1, 2, 3, -2, 0] });
        add('Currency', 'Divine Orb', { dense: 180, currency: 182, item: 175, poewatch: 181, graph: [-1, 0, 2, -3, 1, 4] });
        add('Currency', 'Exalted Orb', { dense: 100, currency: 95, item: 105, poewatch: 98, graph: [1, 2, -1, -2, 1] });
        add('Fragments', 'Mortal Hope', { dense: 90, currency: 92, item: 85, poewatch: 88, graph: [0, 2, -2, 1, -1] });
        add('Maps', 'Vault Map', { tier: 16, dense: 25, currency: 26, item: 24, poewatch: null, graph: [1, 1, 1, -1, -1] });
        add('Gems', 'Awakened Multistrike Support', { dense: 300, item: 310, currency: null, poewatch: 305, graph: [-2, -1, 0, 2, 3] });
        add('Essences', 'Essence of Wrath', { variant: 'Screaming', dense: 0.8, currency: 0.9, item: 0.7, poewatch: 0.85, graph: [0, 0, 1, -1, 2] });
        // Low confidence example (optional): smaller diff
        add('Currency', 'Orb of Alchemy', { dense: 0.3, currency: 0.3, item: 0.3, poewatch: 0.31, graph: [0, 0, 0, 0, 0] });
        // Volume for scrolling/pagination
        for (let i = 0; i < 40; i++) add('Divination', `Card ${i + 1}`, { dense: 1 + (i % 3), item: 1.2 + (i % 2), currency: null, poewatch: null, graph: [i % 5, (i % 5) - 2, 0, 1] });
        return rows;
    }
    /**
     * Wealth snapshot: returns realistic totals per category.
     * - Includes metadata timestamp, league
     * - Edge cases: zeros, spikes, missing categories between snapshots
     */
    async wealthSnapshot(_league: League, _tabs: Array<{ stash_id: string; substash_id?: string | null }>): Promise<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }> }> {
        const now = Math.floor(Date.now() / 1000);
        return { timestamp: now, league, total_chaos: 22500, total_divines: 75, by_category: { 'Divination Cards': { chaos: 9000 }, Currency: { chaos: 4000 }, Fragments: { chaos: 3500 }, Maps: { chaos: 3000 }, Essences: { chaos: 3000 } } };
    }
    async listSnapshots(_league: League, _limit?: number): Promise<Array<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }>; item_prices?: Record<string, number>; inventory?: Record<string, number> }>> {
        const now = Math.floor(Date.now() / 1000);
        const makeSnap = (ts: number, totals: Record<string, number>, opts?: Partial<{ div: number | null; prices: Record<string, number>; inv: Record<string, number> }>) => ({
            timestamp: ts,
            league,
            total_chaos: Object.values(totals).reduce((a, b) => a + b, 0),
            total_divines: opts?.div ?? Math.round((Object.values(totals).reduce((a, b) => a + b, 0)) / 300),
            by_category: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, { chaos: v }])) as Record<string, { chaos: number }>,
            item_prices: opts?.prices,
            inventory: opts?.inv,
        });

        const latestPrices: Record<string, number> = {
            'Chaos Orb': 2.5,
            'Divine Orb': 180,
            'Awakened Multistrike Support__5__20__u': 300,
            'Precision__21__23__c': 9.0,
            'Mortal Hope': 92,
        };
        const prevPrices: Record<string, number> = {
            'Chaos Orb': 2.4,
            'Divine Orb': 175,
            'Awakened Multistrike Support__5__20__u': 280,
            'Vaal Arc__20__0__u': 2.3,
        };

        const prevInventory: Record<string, number> = {
            'Chaos Orb': 1000,
            'Divine Orb': 10,
            'Awakened Multistrike Support__5__20__u': 1,
            'Vaal Arc__20__0__u': 5,
        };

        const rows = [
            // Previous snapshot: baseline for item mode and inventory mode
            makeSnap(now - 2 * 60 * 60, { 'Divination Cards': 6000, Currency: 3500, Fragments: 2500, Maps: 2000 }, { div: 50, prices: prevPrices, inv: prevInventory }),
            // Latest snapshot: used to compute changes
            makeSnap(now, { 'Divination Cards': 8000, Currency: 3800, Fragments: 3050, Maps: 2500 }, { div: 61, prices: latestPrices }),
            // Edge case: zeros, missing categories
            makeSnap(now - 4 * 60 * 60, { 'Divination Cards': 0, Currency: 4200, Maps: 2600 }, { div: 55 }),
            // Spike values for chart testing
            makeSnap(now - 6 * 60 * 60, { 'Divination Cards': 12000, Currency: 3000, Fragments: 1000, Maps: 500 }, { div: 70 }),
        ];
        // Add volume for line chart scrolling
        for (let i = 1; i <= 24; i++) {
            rows.push(makeSnap(now - (i + 6) * 60 * 60, { 'Divination Cards': 4000 + (i * 120), Currency: 3000 + (i * 60), Fragments: 2000 + (i * 40), Maps: 1500 + (i * 35) }));
        }
        return rows;
    }
    async wealthSnapshotCached(_league: League, _tabs: Array<TabWithItems>): Promise<{ timestamp: number; league: string; total_chaos: number; total_divines: number | null; by_category: Record<string, { chaos: number }> }> {
        const now = Math.floor(Date.now() / 1000);
        return { timestamp: now, league, total_chaos: 20000, total_divines: 66, by_category: { 'Divination Cards': { chaos: 8500 }, Currency: { chaos: 3700 }, Fragments: { chaos: 2900 }, Maps: { chaos: 2900 } } };
    }
    async priceVarianceCached(
        _league: League,
        _tabs: Array<TabWithItems>,
        _baseline_item_prices?: Record<string, number>,
        _baseline_by_category?: Record<string, { chaos: number }>,
        _baseline_inventory?: Record<string, number>
    ): Promise<{ mode: 'item' | 'category' | 'inventory'; changes: any[]; totalVariance?: number }> {
        // Inventory mode: compare current tab contents against baseline inventory quantities
        if (_baseline_inventory) {
            const priceMap: Record<string, number> = {
                'Chaos Orb': 2.5,
                'Divine Orb': 180,
                'Awakened Multistrike Support__5__20__u': 300,
                'Vaal Arc__20__0__u': 2.2,
            };
            const curInv: Record<string, number> = { ..._baseline_inventory };
            // Simulate changes: add chaos, remove vaal arc, increase divine
            curInv['Chaos Orb'] = (curInv['Chaos Orb'] ?? 0) + 50;
            curInv['Divine Orb'] = (curInv['Divine Orb'] ?? 0) + 1;
            delete curInv['Vaal Arc__20__0__u'];
            const changes: Array<any> = [];
            let total = 0;
            const unionKeys = new Set<string>([...Object.keys(_baseline_inventory), ...Object.keys(curInv)]);
            for (const k of unionKeys) {
                const snapQty = _baseline_inventory[k] ?? 0;
                const curQty = curInv[k] ?? 0;
                const deltaQty = curQty - snapQty;
                const price = priceMap[k] ?? 0;
                const totalValue = deltaQty * price;
                const isNew = snapQty === 0 && curQty > 0;
                const isRemoved = snapQty > 0 && curQty === 0;
                total += totalValue;
                changes.push({
                    name: k,
                    category: (() => {
                        if (k.includes('Orb')) return 'Currency';
                        if (k.includes('Essence')) return 'Essences';
                        if (k.includes('__')) return 'Gems';
                        return 'Unknown';
                    })(),
                    snapshotQty: snapQty,
                    currentQty: curQty,
                    price,
                    totalValue,
                    isNew,
                    isRemoved,
                });
            }
            return { mode: 'inventory', changes, totalVariance: total };
        }
        // Fallback: empty category mode
        return { mode: 'category', changes: [], totalVariance: 0 };
    }
    tabs(_league: League): Promise<NoItemsTab[]> {
        return new Promise(r => r(stashes));
    }
}
