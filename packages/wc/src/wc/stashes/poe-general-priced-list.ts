import { LitElement, html, css, TemplateResult, CSSResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { TabWithItems, PoeItem } from 'poe-custom-elements/types.js';
import 'poe-custom-elements/item.js';
import type { IStashLoader } from '@divicards/shared/IStashLoader.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/popup/popup.js';
import '../shared/e-json-viewer';

@customElement('poe-general-priced-list')
export class PoeGeneralPricedListElement extends LitElement {
  @property({ type: Object }) tab!: TabWithItems;
  @property() league: string = 'Standard';
  @property({ type: Object }) prices: Map<string, number> = new Map();
  @property() sortBy: 'name' | 'stash' | 'tab' | 'qty' | 'price' | 'total' = 'name';
  @property() sortDir: 'asc' | 'desc' = 'asc';
  @property({ attribute: false }) stashLoader!: IStashLoader;
  @property() errorMessage: string | null = null;
  @property({ type: Boolean }) viewPricesOpen: boolean = false;
  @property({ attribute: false }) debugData: Record<string, any[]> = {};
  @property({ type: Boolean }) aggregate: boolean = false;
  @property() filter: string = '';
  @property() filterPending: string = '';
  @property({ type: Boolean }) invalidRegex: boolean = false;
  @property({ type: Boolean }) filtersOpen: boolean = false;
  @property() category: string | null = null;
  @property({ type: Number }) qtyMin: number | null = null;
  @property({ type: Number }) qtyMax: number | null = null;
  @property({ type: Number }) priceMin: number | null = null;
  @property({ type: Number }) priceMax: number | null = null;
  @property({ type: Number }) totalMin: number | null = null;
  @property({ type: Number }) totalMax: number | null = null;
  @property({ type: Number }) page: number = 1;
  @property({ type: Number }) perPage: number = 50;
  private categoryIndex: Map<string, string> = new Map();
  private essencePriceByTypeLine: Map<string, number> = new Map();
  private gemPriceIndex: Map<string, number> = new Map();
  private mapPriceIndex: Map<string, number> = new Map();

  private buildCategoryIndex(src: CategorySource): void {
    const map = new Map<string, string>();
    (Object.keys(src) as Array<keyof CategorySource>).forEach(key => {
      const arr = src[key] || [];
      const category = categoryFromKey(key);
      arr.forEach(r => { if (r && typeof (r as any).name === 'string') map.set(normalizeName((r as any).name), category); });
    });
    this.categoryIndex = map;
  }

  private categories(): string[] {
    const set = new Set<string>(Array.from(this.categoryIndex.values()));
    return Array.from(set.values());
  }

  private matchesAdvancedFilters(r: { name: string; qty: number; price: number; total: number }): boolean {
    if (this.aggregate) {
      if (this.category) {
        const cat = this.categoryIndex.get(normalizeName(r.name)) ?? 'Other';
        if (cat !== this.category) return false;
      }
      if (this.qtyMin !== null && r.qty < this.qtyMin) return false;
      if (this.qtyMax !== null && r.qty > this.qtyMax) return false;
      if (this.priceMin !== null && r.price < this.priceMin) return false;
      if (this.priceMax !== null && r.price > this.priceMax) return false;
      if (this.totalMin !== null && r.total < this.totalMin) return false;
      if (this.totalMax !== null && r.total > this.totalMax) return false;
    }
    return true;
  }

  async willUpdate(map: Map<PropertyKey, unknown>): Promise<void> {
    if (map.has('league') || this.prices.size === 0) {
      await this.loadPrices();
    }
    if (map.has('tab')) {
      const n = String(this.tab?.name || '');
      const id = String(this.tab?.id || '');
      const isAggregated = id === 'aggregated-view' || n.startsWith('Aggregated');
      this.aggregate = isAggregated;
    }
  }

  protected async firstUpdated(): Promise<void> {
    if (this.prices.size === 0) await this.loadPrices();
    this.filterPending = this.filter;
  }

  private async loadPrices(): Promise<void> {
    try {
      const [currency, fragments, oils, incubators, fossils, resonators, deliriumOrbs, vials, essences, cards, gems, maps] = await Promise.all([
        this.stashLoader.currencyPrices(this.league as any),
        this.stashLoader.fragmentPrices(this.league as any),
        this.stashLoader.oilPrices(this.league as any),
        this.stashLoader.incubatorPrices(this.league as any),
        this.stashLoader.fossilPrices(this.league as any),
        this.stashLoader.resonatorPrices(this.league as any),
        this.stashLoader.deliriumOrbPrices(this.league as any),
        this.stashLoader.vialPrices(this.league as any),
        this.stashLoader.essencePrices(this.league as any),
        this.stashLoader.divinationCardPrices(this.league as any),
        this.stashLoader.gemPrices(this.league as any),
        this.stashLoader.mapPrices(this.league as any),
      ]);
      this.debugData = { currency, fragments, oils, incubators, fossils, resonators, deliriumOrbs, vials, essences, cards, gems, maps } as any;
      const next = new Map<string, number>();
      const merge = (rows: Array<{ name: string; chaos_value: number | null }>) => {
        rows.forEach(r => {
          if (!r || typeof r.name !== 'string') return;
          if (typeof r.chaos_value === 'number') {
            if (!next.has(r.name)) next.set(r.name, r.chaos_value);
          }
        });
      };
      [currency, fragments, oils, incubators, fossils, resonators, deliriumOrbs, vials, cards].forEach(merge);
      

      // Build essence price lookup by full typeLine, e.g., "Screaming Essence of Scorn"
      this.essencePriceByTypeLine.clear();
      (essences || []).forEach((r: { name: string; variant?: string | null; chaos_value: number | null }) => {
        const base = String(r.name || '').trim();
        const variant = String(r.variant || '').trim();
        const full = variant ? `${variant} ${base}` : base;
        const price = typeof r.chaos_value === 'number' ? r.chaos_value : null;
        if (price !== null && !this.essencePriceByTypeLine.has(full)) {
          this.essencePriceByTypeLine.set(full, price);
        }
      });

      // Build gem price index keyed by name+level+quality+corrupt
      this.gemPriceIndex.clear();
      (gems || []).forEach((r: { name: string; level: number; quality: number; corrupt?: boolean; chaos_value: number | null }) => {
        const k = gemKeyC(r.name, r.level ?? 0, r.quality ?? 0, Boolean(r.corrupt));
        const price = typeof r.chaos_value === 'number' ? r.chaos_value : null;
        if (price !== null && !this.gemPriceIndex.has(k)) {
          this.gemPriceIndex.set(k, price);
        }
      });

      this.mapPriceIndex.clear();
      (maps || []).forEach((r: { name: string; tier: number; chaos_value: number | null }) => {
        const k = mapKey(r.name, r.tier ?? 0);
        const price = typeof r.chaos_value === 'number' ? r.chaos_value : null;
        if (price !== null && !this.mapPriceIndex.has(k)) {
          this.mapPriceIndex.set(k, price);
        }
      });

      this.buildCategoryIndex({ currency, fragments, oils, incubators, fossils, resonators, deliriumOrbs, vials, essences, cards, maps, gems });
      this.prices = next;
      this.errorMessage = null;
    } catch (err: unknown) {
      this.prices = new Map();
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to fetch prices';
      this.errorMessage = `${msg}`;
    }
  }

  protected render(): TemplateResult {
    const items = this.tab?.items ?? [];
    const tabIndex = this.tab?.index ?? 0;
    const groups = groupAggregated(items);
    const stashName = this.aggregate ? '' : (this.tab?.name || (this.tab ? `Tab #${tabIndex}` : ''));
    const rows = Array.from(groups.values()).map(g => {
      const price = this.resolvePrice(g.sample, g.name);
      const total = +(price * g.total).toFixed(1);
      const isGemItem = isGem(g.sample);
      const gl = isGemItem ? getGemLevel(g.sample) : null;
      const gq = isGemItem ? getGemQuality(g.sample) : null;
      const gc = isGemItem ? isCorrupted(g.sample) : null;
      const cat = this.categoryIndex.get(normalizeName(g.name)) ?? (isGemItem ? 'Gem' : 'Other');
      return { name: g.name, stash: stashName, gemLevel: gl, gemQuality: gq, corrupted: gc, category: cat, qty: g.total, tab: tabIndex, price, total, sample: g.sample };
    });
    if (this.aggregate && rows.length === 0) {
      return html``;
    }
    let regex: RegExp | null = null;
    if (this.filter && this.filter.trim().length && !this.invalidRegex) {
      try {
        regex = new RegExp(this.filter.trim(), 'i');
      } catch (_) {
        // keep invalidRegex state
      }
    }
    const filteredByRegex = regex ? rows.filter(r => regex!.test(r.name)) : rows;
    const filtered = filteredByRegex.filter(r => this.matchesAdvancedFilters(r));
    filtered.sort((a, b) => {
      const mul = this.sortDir === 'asc' ? 1 : -1;
      switch (this.sortBy) {
        case 'name': return a.name.localeCompare(b.name) * mul;
        case 'stash': return (a.stash ?? '').localeCompare(b.stash ?? '') * mul;
        case 'tab': return (a.tab - b.tab) * mul;
        case 'qty': return (a.qty - b.qty) * mul;
        case 'price': return (a.price - b.price) * mul;
        case 'total': return (a.total - b.total) * mul;
      }
    });

    const headerCols = this.aggregate ? ['Name', 'Gem Level', 'Gem Quality', 'Corrupted', 'Category', 'Quantity', 'Price', 'Total'] : ['Name', 'Stash', 'Tab', 'Quantity', 'Price', 'Total'];
    const filteredTotal = filtered.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, this.perPage)));
    const safePage = Math.min(Math.max(1, this.page), totalPages);
    const start = (safePage - 1) * Math.max(1, this.perPage);
    const sliced = filtered.slice(start, start + Math.max(1, this.perPage));
    return html`<div class="list">
      <div class="tools">
        <sl-input size="small" placeholder="Filter (regex)" .value=${this.filterPending} @sl-input=${(e: any) => { this.filterPending = e.target.value; }} @keydown=${(e: KeyboardEvent) => { if ((e as any).key === 'Enter') this.applyTextFilter(); }}></sl-input>
        <sl-button size="small" variant="primary" @click=${this.applyTextFilter}>Apply</sl-button>
        <sl-button size="small" variant="neutral" @click=${this.clearAllFilters}>Clear</sl-button>
        ${this.aggregate ? html`<sl-button size="small" id="filtersBtn" @click=${() => { this.filtersOpen = !this.filtersOpen; }}>Filters</sl-button>` : null}
      ${this.aggregate ? html`<div class="filtered-total">Filtered total: ${filteredTotal.toFixed(0)}c</div>` : null}
      ${this.aggregate ? html`<div class="pager">
        <sl-button size="small" @click=${() => { this.page = Math.max(1, this.page - 1); }}>◀</sl-button>
        <span class="pager__info">Page ${safePage} / ${totalPages}</span>
        <sl-button size="small" @click=${() => { this.page = Math.min(totalPages, this.page + 1); }}>▶</sl-button>
        <sl-select size="small" .value=${String(this.perPage)} @sl-change=${(e: any) => { const v = Number(e.target.value); this.perPage = Math.max(1, v); this.page = 1; }}>
          ${[20,50,100,200].map(n => html`<sl-option value=${String(n)}>${n}/page</sl-option>`)}
        </sl-select>
      </div>` : null}
        <sl-button size="small" @click=${() => { this.viewPricesOpen = true; }}>View Prices JSON</sl-button>
      </div>
      ${this.aggregate ? html`<sl-popup .active=${this.filtersOpen} anchor="filtersBtn" placement="bottom-end" distance="8">
        <div class="filters-panel">
          <h4>Category</h4>
          <sl-select hoist .value=${this.category ?? ''} @sl-change=${(e: any) => { const v = e.target.value; this.category = v ? String(v) : null; }} placeholder="Filter by category">
            ${this.categories().map(c => html`<sl-option value=${c}>${c}</sl-option>`)}
          </sl-select>
          <div class="divider"></div>
          <h4>Quantity Range</h4>
          <div class="grid-2">
            <sl-input type="number" placeholder="No minimum" .value=${String(this.qtyMin ?? '')} @sl-input=${(e: any) => { const v = e.target.value; this.qtyMin = v === '' ? null : Number(v); }}></sl-input>
            <sl-input type="number" placeholder="No maximum" .value=${String(this.qtyMax ?? '')} @sl-input=${(e: any) => { const v = e.target.value; this.qtyMax = v === '' ? null : Number(v); }}></sl-input>
          </div>
          <div class="divider"></div>
          <h4>Item Price Range</h4>
          <div class="grid-2">
            <sl-input type="number" placeholder="No minimum" .value=${String(this.priceMin ?? '')} @sl-input=${(e: any) => { const v = e.target.value; this.priceMin = v === '' ? null : Number(v); }}></sl-input>
            <sl-input type="number" placeholder="No maximum" .value=${String(this.priceMax ?? '')} @sl-input=${(e: any) => { const v = e.target.value; this.priceMax = v === '' ? null : Number(v); }}></sl-input>
          </div>
          <div class="divider"></div>
          <h4>Total Price Range</h4>
          <div class="grid-2">
            <sl-input type="number" placeholder="No minimum" .value=${String(this.totalMin ?? '')} @sl-input=${(e: any) => { const v = e.target.value; this.totalMin = v === '' ? null : Number(v); }}></sl-input>
            <sl-input type="number" placeholder="No maximum" .value=${String(this.totalMax ?? '')} @sl-input=${(e: any) => { const v = e.target.value; this.totalMax = v === '' ? null : Number(v); }}></sl-input>
          </div>
        </div>
      </sl-popup>` : null}
      ${this.errorMessage ? html`<sl-alert variant="danger" closable @sl-after-hide=${() => (this.errorMessage = null)}>
        <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
        ${this.errorMessage}
      </sl-alert>` : null}
      ${this.invalidRegex ? html`<sl-alert variant="warning" closable @sl-after-hide=${() => (this.invalidRegex = false)}>
        <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
        Invalid regex: ${this.filterPending}
      </sl-alert>` : null}
      ${this.renderHeader(headerCols)}
      ${sliced.map(r => html`<div class="row ${this.aggregate ? 'agg' : ''}">
        <div class="name">
          <poe-item .item=${normalizeItem(r.sample)}></poe-item>
          <span>${r.name}</span>
        </div>
        ${this.aggregate ? html`<div class="level">${r.gemLevel ?? '-'}</div>` : html`<div class="stash">${r.stash ?? ''}</div>`}
        ${this.aggregate ? html`<div class="quality">${r.gemQuality ?? '-'}</div>` : html`<div class="tab">${r.tab}</div>`}
        ${this.aggregate ? html`<div class="corrupted">${typeof r.corrupted === 'boolean' ? (r.corrupted ? 'Yes' : 'No') : '-'}</div>` : null}
        ${this.aggregate ? html`<div class="category">${r.category}</div>` : null}
        <div class="qty">${r.qty}</div>
        <div class="price">${r.price ? `${r.price.toFixed(0)}c` : '-'}</div>
        <div class="total">${r.total ? `${r.total.toFixed(0)}c` : '-'}</div>
      </div>`)}
    </div>
    <sl-dialog label="Prices JSON" .open=${this.viewPricesOpen} @sl-hide=${() => { this.viewPricesOpen = false; }} style="--width: 800px;">
      <e-json-viewer .data=${this.debugData}></e-json-viewer>
      <sl-button slot="footer" variant="primary" @click=${() => { this.viewPricesOpen = false; }}>Close</sl-button>
    </sl-dialog>`;
  }

  private resolvePrice(item: PoeItem, displayName: string): number {
    if (isGem(item)) {
      const lvl = getGemLevel(item);
      const q = getGemQuality(item);
      const c = isCorrupted(item);
      if (lvl === 20 && q === 20) {
        const pExact = this.gemPriceIndex.get(gemKeyC(displayName, 20, 20, c))
          ?? this.gemPriceIndex.get(gemKeyC(displayName, 20, 20, false));
        if (typeof pExact === 'number') return pExact;
      } else {
        const pDowngrade = this.gemPriceIndex.get(gemKeyC(displayName, 1, 0, false))
          ?? this.gemPriceIndex.get(gemKeyC(displayName, lvl, q, false));
        if (typeof pDowngrade === 'number') return pDowngrade;
      }
      const nameFallback = this.prices.get(displayName);
      if (typeof nameFallback === 'number') return nameFallback;
    }
    if (isEssence(item)) {
      const typeLine = String((item as any).typeLine || displayName);
      const direct = this.essencePriceByTypeLine.get(typeLine);
      if (typeof direct === 'number') return direct;
      const parsed = parseEssenceName(typeLine);
      const base = parsed.base;
      const basePrice = this.prices.get(base);
      if (typeof basePrice === 'number') return basePrice;
    }
    if (isMap(item)) {
      const tier = getMapTier(item);
      const k = mapKey(displayName, tier);
      const p = this.mapPriceIndex.get(k);
      if (typeof p === 'number') return p;
      const fallback = this.prices.get(displayName);
      if (typeof fallback === 'number') return fallback;
    }
    const p = this.prices.get(displayName);
    return typeof p === 'number' ? p : 0;
  }

  private renderHeader(cols: string[]): TemplateResult {
    const keys: Record<string, PoeGeneralPricedListElement['sortBy']> = {
      Name: 'name', Stash: 'stash', Tab: 'tab', Quantity: 'qty', Price: 'price', Total: 'total'
    };
    const numeric = new Set(['Quantity', 'Price', 'Total']);
    return html`<div class="header ${this.aggregate ? 'agg' : ''}">
      ${cols.map(c => html`<button class="th ${numeric.has(c) ? 'numeric' : ''}" @click=${() => (keys[c] ? this.onSort(keys[c]) : undefined)}>${c}${this.sortBy === keys[c] ? (this.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>`)}
    </div>`;
  }

  private onSort(col: PoeGeneralPricedListElement['sortBy']) {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'asc';
    }
    this.requestUpdate();
  }

  static styles: CSSResult = css`
    :host { display: block; width: 100%; height: auto; }
    .list { width: 100%; padding: 8px; display: grid; grid-auto-rows: min-content; row-gap: 6px; overflow: auto; }
    .tools { display: flex; justify-content: flex-end; gap: 8px; padding-bottom: 6px; align-items: center; }
    .tools sl-input { min-width: 260px; }
    .filtered-total { font-weight: 600; opacity: 0.8; }
    .pager { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
    .pager__info { min-width: 100px; text-align: center; }
    sl-alert { position: sticky; top: 0; z-index: 1; }
    .header, .row { display: grid; grid-template-columns: 1fr 160px 60px 80px 80px 100px; align-items: center; column-gap: 12px; }
    .header.agg, .row.agg { grid-template-columns: 1fr 80px 80px 100px 160px 80px 80px 100px; }
    .header { font-weight: 600; position: sticky; top: 0; background: var(--sl-color-gray-50); z-index: 2; padding: 6px 0; border-bottom: 1px solid var(--sl-color-gray-200); }
    .header .th { text-align: left; background: transparent; border: none; color: inherit; cursor: pointer; padding: 4px 0; }
    .header .th.numeric { text-align: right; }
    .name { display: flex; align-items: center; gap: 8px; }
    poe-item { --cell-size: 32px; --poe-item-size: 32px; --stack-size-font-size: 10px; }
    .level, .quality, .qty { text-align: right; }
    .corrupted { text-align: center; }
    .price, .total { text-align: right; }
    .row { border-bottom: 1px solid var(--sl-color-gray-200); padding: 6px 0; }
    .filters-panel { width: 360px; max-width: 80vw; padding: 12px; display: grid; row-gap: 10px; }
    .filters-panel h4 { margin: 0; font-size: 0.95rem; }
    .divider { height: 1px; background: var(--sl-color-gray-200); margin: 4px 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 8px; }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'poe-general-priced-list': PoeGeneralPricedListElement;
  }
}

function normalizeItem(item: PoeItem): PoeItem {
  return { ...item, w: 1, h: 1, x: 0, y: 0, identified: true } as PoeItem;
}

type Group = { name: string; total: number; sample: PoeItem };

function isGem(item: PoeItem): boolean {
  const ft = (item as any).frameType;
  const props = (item as any).properties || [];
  const hasGemProp = Array.isArray(props) && props.some((p: any) => p?.name === 'Gem Level' || p?.name === 'Level');
  return ft === 4 || hasGemProp;
}

function getGemLevel(item: PoeItem): number {
  const p = (item as any).properties || [];
  for (const prop of p) {
    if ((prop as any).name === 'Gem Level' || (prop as any).name === 'Level') {
      const val = Array.isArray((prop as any).values) && (prop as any).values?.[0]?.[0];
      if (val !== undefined && val !== null) {
        const v = String(val);
        const m = v.match(/(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
    }
  }
  return 0;
}

function getGemQuality(item: PoeItem): number {
  const p = (item as any).properties || [];
  for (const prop of p) {
    if ((prop as any).name === 'Quality') {
      const val = Array.isArray((prop as any).values) && (prop as any).values?.[0]?.[0];
      if (val !== undefined && val !== null) {
        const v = String(val);
        const m = v.match(/(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
    }
  }
  return 0;
}

function isCorrupted(item: PoeItem): boolean {
  return Boolean((item as any).corrupted);
}

function gemKeyC(name: string, level: number, quality: number, corrupt: boolean): string { return `${name}__${level}__${quality}__${corrupt ? 'c' : 'u'}`; }

function groupAggregated(items: PoeItem[]): Map<string, Group> {
  const map = new Map<string, Group>();
  for (const it of items) {
    const baseName = it.typeLine || it.baseType || it.name;
    let key = baseName;
    if (isGem(it)) {
      const lvl = getGemLevel(it);
      const q = getGemQuality(it);
      const c = isCorrupted(it);
      key = `${baseName}__${lvl}__${q}__${c ? 'c' : 'u'}`;
    }
    const qty = it.stackSize ?? 1;
    const prev = map.get(key);
    if (prev) {
      prev.total += qty;
    } else {
      map.set(key, { name: baseName, total: qty, sample: it });
    }
  }
  return map;
}

function isEssence(item: PoeItem): boolean {
  const name = String((item as any).typeLine || (item as any).baseType || (item as any).name || '');
  return name.includes('Essence');
}

function isMap(item: PoeItem): boolean {
  const props = (item as any).properties || [];
  const hasMapTier = Array.isArray(props) && props.some((p: any) => p?.name === 'Map Tier');
  const name = String((item as any).typeLine || (item as any).baseType || (item as any).name || '');
  return hasMapTier || name.endsWith(' Map');
}

function getMapTier(item: PoeItem): number {
  const p = (item as any).properties || [];
  for (const prop of p) {
    if ((prop as any).name === 'Map Tier') {
      const val = Array.isArray((prop as any).values) && (prop as any).values?.[0]?.[0];
      if (val !== undefined && val !== null) {
        const v = String(val);
        const m = v.match(/(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
    }
  }
  return 0;
}

function mapKey(name: string, tier: number): string { return `${name}__${tier}`; }

// actions
export interface PoeGeneralPricedListElement {
  applyTextFilter(): void;
  clearAllFilters(): void;
}

(PoeGeneralPricedListElement.prototype as any).applyTextFilter = function(this: PoeGeneralPricedListElement) {
  const val = (this.filterPending || '').trim();
  if (!val) {
    this.filter = '';
    this.invalidRegex = false;
    this.page = 1 as any;
    return;
  }
  try {
    // eslint-disable-next-line no-new
    new RegExp(val, 'i');
    this.filter = val;
    this.invalidRegex = false;
    this.page = 1 as any;
  } catch (_) {
    this.invalidRegex = true;
  }
};

(PoeGeneralPricedListElement.prototype as any).clearAllFilters = function(this: PoeGeneralPricedListElement) {
  this.filterPending = '' as any;
  this.filter = '' as any;
  this.invalidRegex = false as any;
  this.category = null as any;
  this.qtyMin = null as any;
  this.qtyMax = null as any;
  this.priceMin = null as any;
  this.priceMax = null as any;
  this.totalMin = null as any;
  this.totalMax = null as any;
  this.page = 1 as any;
};


type CategorySource = {
  currency: Array<{ name: string }>,
  fragments: Array<{ name: string }>,
  oils: Array<{ name: string }>,
  incubators: Array<{ name: string }>,
  fossils: Array<{ name: string }>,
  resonators: Array<{ name: string }>,
  deliriumOrbs: Array<{ name: string }>,
  vials: Array<{ name: string }>,
  essences?: Array<{ name: string }>,
  cards?: Array<{ name: string }>,
  maps?: Array<{ name: string }>,
  gems?: Array<{ name: string }>
};

function normalizeName(n: string): string { return n.trim(); }

function categoryFromKey(k: keyof CategorySource): string {
  switch (k) {
    case 'currency': return 'Currency';
    case 'fragments': return 'Fragment';
    case 'oils': return 'Oil';
    case 'incubators': return 'Incubator';
    case 'fossils': return 'Fossil';
    case 'resonators': return 'Resonator';
    case 'deliriumOrbs': return 'Delirium Orb';
    case 'vials': return 'Vial';
    case 'essences': return 'Essence';
    case 'cards': return 'Divination Card';
    case 'maps': return 'Map';
    case 'gems': return 'Gem';
    default: return 'Other';
  }
}

function parseEssenceName(typeLine: string | undefined): { base: string; variant?: string } {
  const s = String(typeLine || '');
  const m = s.match(/^(\w+)\s+Essence\s+of\s+(.+)/);
  if (m) {
    const variant = m[1];
    const base = `Essence of ${m[2]}`;
    return { base, variant };
  }
  const n = s.includes('Essence of ') ? s.substring(s.indexOf('Essence of ')) : s;
  return { base: n };
}
