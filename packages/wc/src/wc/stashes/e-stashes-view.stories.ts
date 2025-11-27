import { html, TemplateResult } from 'lit';
import './e-stashes-view';
import '@shoelace-style/shoelace/dist/components/details/details.js';
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import type { IStashLoader } from '@divicards/shared/IStashLoader.js';
import type { DivinationCardsSample } from '@divicards/shared/types.js';
import type { NoItemsTab, TabWithItems } from 'poe-custom-elements/types.js';

class MockStashLoader implements IStashLoader {
  async tabs(_league: string): Promise<NoItemsTab[]> {
    return [
      { id: 'tab-currency', index: 1, name: 'Currency', type: 'CurrencyStash' } as any,
      { id: 'tab-cards', index: 2, name: 'Divination Cards', type: 'DivinationCardStash' } as any,
      { id: 'tab-maps', index: 3, name: 'Maps', type: 'MapStash' } as any,
    ];
  }
  async sampleFromTab(_tabId: string, _league: string): Promise<DivinationCardsSample> {
    return { rows: [] } as any;
  }
  async tab(_tabId: string, _league: string): Promise<TabWithItems> {
    return this.tabFromBadge({ id: _tabId, index: 0, name: _tabId, type: 'GenericStash' } as any, _league);
  }
  async tabFromBadge(badge: any, _league: string): Promise<TabWithItems> {
    const id = badge.id as string;
    if (id === 'tab-currency') {
      return {
        id,
        index: 1,
        type: 'CurrencyStash',
        items: [
          { baseType: 'Chaos Orb', stackSize: 50, w: 1, h: 1 } as any,
          { baseType: 'Divine Orb', stackSize: 2, w: 1, h: 1 } as any,
        ],
      } as any;
    }
    if (id === 'tab-cards') {
      return {
        id,
        index: 2,
        type: 'DivinationCardStash',
        items: [
          { typeLine: 'The Hoarder', stackSize: 6, w: 1, h: 1 } as any,
          { typeLine: 'The Saint’s Treasure', stackSize: 1, w: 1, h: 1 } as any,
        ],
      } as any;
    }
    return {
      id,
      index: 3,
      type: 'MapStash',
      items: [
        { typeLine: 'Jungle Valley Map', properties: [{ name: 'Map Tier', values: [[10, 0]] }], w: 1, h: 1 } as any,
        { typeLine: 'Mesa Map', properties: [{ name: 'Map Tier', values: [[14, 0]] }], w: 1, h: 1 } as any,
        { typeLine: 'Vaal Arc', properties: [{ name: 'Gem Level', values: [[20, 0]] }, { name: 'Quality', values: [[20, 0]] }], w: 1, h: 1, frameType: 4 } as any,
      ],
    } as any;
  }
  async sampleFromBadge(_badge: any, _league: string): Promise<any> { return { rows: [] }; }
  async wealthSnapshotCached(_league: string, _tabs: Array<TabWithItems>): Promise<any> {
    const now = Math.floor(Date.now() / 1000);
    return { timestamp: now, league: _league, total_chaos: 25000, total_divines: 70, by_category: { Currency: { chaos: 5000 }, Maps: { chaos: 8000 }, 'Divination Cards': { chaos: 6000 }, Gem: { chaos: 6000 } } };
  }
  async wealthSnapshot(_league: string, _tabs: Array<{ stash_id: string; substash_id?: string | null }>): Promise<any> {
    const now = Math.floor(Date.now() / 1000);
    return { timestamp: now, league: _league, total_chaos: 25000, total_divines: 70, by_category: { Currency: { chaos: 5000 }, Maps: { chaos: 8000 }, 'Divination Cards': { chaos: 6000 }, Gem: { chaos: 6000 } } };
  }
  async listSnapshots(_league: string, _count?: number): Promise<Array<any>> {
    const base = 15000;
    const arr: any[] = [];
    for (let i = 0; i < 12; i++) {
      const ts = Math.floor(Date.now() / 1000) - i * 1800;
      const total = base + i * 500 + (i % 3 === 0 ? -800 : 300);
      const item_prices = i <= 1 ? {
        'Chaos Orb': i === 0 ? 2.8 : 2.5,
        'Divine Orb': i === 0 ? 185 : 180,
        'Jungle Valley Map': i === 0 ? 4 : 3,
        'Mesa Map': i === 0 ? 6 : 6,
      } : undefined;
      const inventory = i === 1 ? { 'Chaos Orb': 50, 'Divine Orb': 2 } : undefined;
      arr.push({ timestamp: ts, league: _league, total_chaos: total, total_divines: 50 + i, item_prices, inventory, by_category: { Currency: { chaos: 4000 + i * 100 }, Maps: { chaos: 5000 + i * 200 }, 'Divination Cards': { chaos: 3000 + i * 150 }, Gem: { chaos: 2000 + i * 120 } } });
    }
    return arr;
  }
  async priceVarianceCached(_league: string, _tabs: Array<TabWithItems>, _baseline_item_prices?: Record<string, number>, _baseline_by_category?: Record<string, { chaos: number }>, baseline_inventory?: Record<string, number>): Promise<{ mode: 'item' | 'category' | 'inventory'; changes: any[]; totalVariance?: number }> {
    if (baseline_inventory) {
      return {
        mode: 'inventory',
        changes: [
          { name: 'Chaos Orb', category: 'Currency', currentQty: 60, price: 2.8, totalValue: 168, isNew: false, isRemoved: false, snapshotQty: baseline_inventory['Chaos Orb'] ?? 0 },
          { name: 'Divine Orb', category: 'Currency', currentQty: 2, price: 185, totalValue: 370, isNew: false, isRemoved: false, snapshotQty: baseline_inventory['Divine Orb'] ?? 0 },
        ],
        totalVariance: 538,
      };
    }
    return { mode: 'item', changes: [
      { name: 'Chaos Orb', category: 'Currency', qty: null, snapshotPrice: 2.5, currentPrice: 2.8, changePercent: 12, totalChange: 0.3 },
      { name: 'Divine Orb', category: 'Currency', qty: null, snapshotPrice: 180, currentPrice: 185, changePercent: 2.8, totalChange: 5 },
    ], totalVariance: 5.3 };
  }
  async priceSourcesMatrix(_league: string, _opts: any): Promise<Array<any>> {
    return [
      { category: 'Currency', name: 'Chaos Orb', currency_overview: 2.5, item_overview: null, poewatch: 2.6 },
      { category: 'Currency', name: 'Divine Orb', currency_overview: 180, item_overview: null, poewatch: 179 },
    ];
  }
  async ninjaDenseOverviewsRaw(_league: string): Promise<Record<string, unknown>> { return {}; }
  async mapPrices(_league: string): Promise<Array<any>> { return [{ name: 'Jungle Valley Map', tier: 10, chaos_value: 3 }, { name: 'Mesa Map', tier: 14, chaos_value: 6 }]; }
  async currencyPrices(_league: string): Promise<Array<any>> { return [{ name: 'Chaos Orb', chaos_value: 2.5 }, { name: 'Divine Orb', chaos_value: 180 }]; }
  async fragmentPrices(_league: string): Promise<Array<any>> { return [{ name: 'Shaper Fragment', chaos_value: 15 }]; }
  async essencePrices(_league: string): Promise<Array<any>> { return [{ name: 'Essence of Greed', chaos_value: 1.2, variant: null }]; }
  async gemPrices(_league: string): Promise<Array<any>> { return [{ name: 'Vaal Arc', level: 20, quality: 20, chaos_value: 3 }]; }
  async oilPrices(_league: string): Promise<Array<any>> { return [{ name: 'Amber Oil', chaos_value: 1 }]; }
  async incubatorPrices(_league: string): Promise<Array<any>> { return [{ name: 'Fragmented Incubator', chaos_value: 2 }]; }
  async fossilPrices(_league: string): Promise<Array<any>> { return [{ name: 'Faceted Fossil', chaos_value: 90 }]; }
  async resonatorPrices(_league: string): Promise<Array<any>> { return [{ name: 'Prime Chaotic Resonator', chaos_value: 3 }]; }
  async deliriumOrbPrices(_league: string): Promise<Array<any>> { return [{ name: "Jeweller's Delirium Orb", chaos_value: 4 }]; }
  async vialPrices(_league: string): Promise<Array<any>> { return [{ name: 'Vial of Dominance', chaos_value: 10 }]; }
  async divinationCardPrices(_league: string): Promise<Array<any>> { return [{ name: 'The Hoarder', chaos_value: 12 }, { name: 'The Saint’s Treasure', chaos_value: 20 }]; }
}

export default { title: 'Dashboard/e-stashes-view' };

export const FullMock: { render: () => TemplateResult; play: (ctx: any) => Promise<void> } = {
  render(): TemplateResult {
    const loader = new MockStashLoader();
    return html`<e-stashes-view .league=${'Standard'} .downloadAs=${'general-tab'} .stashLoader=${loader as any}></e-stashes-view>`;
  },
  async play({ canvasElement }: any): Promise<void> {
    const el = canvasElement.querySelector('e-stashes-view') as any;
    await new Promise(r => setTimeout(r, 150));
    const tabs = await el.stashLoader.tabs(el.league);
    const sel = new Map<string, { id: string; name: string }>();
    tabs.forEach((t: any) => sel.set(t.id, { id: t.id, name: t.name }));
    el.selected_tabs = sel;
    el.multiselect = true;
    el.dispatchEvent(new CustomEvent('stashes__force-reload-selected', { bubbles: true, composed: true }));
  }
};

class EmptySnapshotsLoader extends MockStashLoader {
  async listSnapshots(_league: string, _count?: number): Promise<Array<any>> {
    return [];
  }
}

export const EmptySnapshots: { render: () => TemplateResult; play: (ctx: any) => Promise<void> } = {
  render(): TemplateResult {
    const loader = new EmptySnapshotsLoader();
    return html`<e-stashes-view .league=${'Standard'} .downloadAs=${'general-tab'} .stashLoader=${loader as any}></e-stashes-view>`;
  },
  async play({ canvasElement }: any): Promise<void> {
    const el = canvasElement.querySelector('e-stashes-view') as any;
    await new Promise(r => setTimeout(r, 150));
    const tabs = await el.stashLoader.tabs(el.league);
    const sel = new Map<string, { id: string; name: string }>();
    tabs.forEach((t: any) => sel.set(t.id, { id: t.id, name: t.name }));
    el.selected_tabs = sel;
    el.multiselect = true;
    el.showWealth = true;
    el.dispatchEvent(new CustomEvent('stashes__force-reload-selected', { bubbles: true, composed: true }));
  }
};

export const PriceVarianceItems: { render: () => TemplateResult; play: (ctx: any) => Promise<void> } = {
  render(): TemplateResult {
    const loader = new MockStashLoader();
    return html`<e-stashes-view .league=${'Standard'} .downloadAs=${'general-tab'} .stashLoader=${loader as any}></e-stashes-view>`;
  },
  async play({ canvasElement }: any): Promise<void> {
    const el = canvasElement.querySelector('e-stashes-view') as any;
    await new Promise(r => setTimeout(r, 200));
    const tabs = await el.stashLoader.tabs(el.league);
    const sel = new Map<string, { id: string; name: string }>();
    tabs.forEach((t: any) => sel.set(t.id, { id: t.id, name: t.name }));
    el.selected_tabs = sel;
    el.multiselect = true;
    el.snapshots = await el.stashLoader.listSnapshots(el.league, 12);
    el.dispatchEvent(new CustomEvent('stashes__force-reload-selected', { bubbles: true, composed: true }));
    await new Promise(r => setTimeout(r, 250));
    const btn = el.shadowRoot?.querySelector('sl-button');
    if (btn) (btn as HTMLElement).click();
  }
};

export const PriceSourcesComparison: { render: () => TemplateResult; play: (ctx: any) => Promise<void> } = {
  render(): TemplateResult {
    const loader = new MockStashLoader();
    return html`<e-stashes-view .league=${'Standard'} .downloadAs=${'general-tab'} .stashLoader=${loader as any}></e-stashes-view>`;
  },
  async play({ canvasElement }: any): Promise<void> {
    const el = canvasElement.querySelector('e-stashes-view') as any;
    await new Promise(r => setTimeout(r, 200));
    const tabs = await el.stashLoader.tabs(el.league);
    const sel = new Map<string, { id: string; name: string }>();
    tabs.forEach((t: any) => sel.set(t.id, { id: t.id, name: t.name }));
    el.selected_tabs = sel;
    el.multiselect = true;
    el.dispatchEvent(new CustomEvent('stashes__force-reload-selected', { bubbles: true, composed: true }));
    await new Promise(r => setTimeout(r, 300));
    const buttons = Array.from(el.shadowRoot?.querySelectorAll('sl-button') || []).map(x => x as HTMLElement);
    const target = buttons.find(b => (b.textContent || '').includes('Show Comparison')) || buttons[0];
    if (target) (target as HTMLElement).click();
  }
};

class ErrorMockStashLoader extends MockStashLoader {
  async tabs(_league: string): Promise<NoItemsTab[]> {
    throw new Error('401 Unauthorized');
  }
}

export const ErrorUnauthorized: { render: () => TemplateResult; play: (ctx: any) => Promise<void> } = {
  render(): TemplateResult {
    const loader = new ErrorMockStashLoader();
    return html`<e-stashes-view .league=${'Standard'} .downloadAs=${'general-tab'} .stashLoader=${loader as any}></e-stashes-view>`;
  },
  async play({ canvasElement }: any): Promise<void> {
    const el = canvasElement.querySelector('e-stashes-view') as any;
    await new Promise(r => setTimeout(r, 150));
    el.dispatchEvent(new CustomEvent('stashes__bulk-load-all', { bubbles: true, composed: true }));
  }
};

export const SingleTabView: { render: () => TemplateResult; play: (ctx: any) => Promise<void> } = {
  render(): TemplateResult {
    const loader = new MockStashLoader();
    return html`<e-stashes-view .league=${'Standard'} .downloadAs=${'general-tab'} .stashLoader=${loader as any}></e-stashes-view>`;
  },
  async play({ canvasElement }: any): Promise<void> {
    const el = canvasElement.querySelector('e-stashes-view') as any;
    await new Promise(r => setTimeout(r, 150));
    const tabs = await el.stashLoader.tabs(el.league);
    const sel = new Map<string, { id: string; name: string }>();
    sel.set(tabs[0].id, { id: tabs[0].id, name: tabs[0].name });
    el.selected_tabs = sel;
    el.multiselect = false;
    el.dispatchEvent(new CustomEvent('stashes__force-reload-selected', { bubbles: true, composed: true }));
  }
};

export const RecentRangeWealth: { render: () => TemplateResult; play: (ctx: any) => Promise<void> } = {
  render(): TemplateResult {
    const loader = new MockStashLoader();
    return html`<e-stashes-view .league=${'Standard'} .downloadAs=${'general-tab'} .stashLoader=${loader as any}></e-stashes-view>`;
  },
  async play({ canvasElement }: any): Promise<void> {
    const el = canvasElement.querySelector('e-stashes-view') as any;
    el.snapshots = await el.stashLoader.listSnapshots(el.league, 12);
    el.showWealth = true;
    el.chartRange = 'recent';
  }
};
