import { LitElement, html, css, TemplateResult, CSSResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TabWithItems, PoeItem } from 'poe-custom-elements/types.js';
import 'poe-custom-elements/item.js';
import type { IStashLoader } from '@divicards/shared/IStashLoader.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import { SlConverter } from '../e-league-select.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/popup/popup.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import '@shoelace-style/shoelace/dist/components/badge/badge.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '../shared/e-json-viewer';
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
  @property({ type: Boolean }) columnsMenuOpen: boolean = false;
  @property({ type: Object }) visibleColumns: Record<string, boolean> = {
    'Name': true,
    'Category': true,
    'Stash': true,
    'Tab': true,
    'Quantity': true,
    'Price': true,
    'Total': true
  };
  @property({ type: Object }) visibleColumnsAgg: Record<string, boolean> = {
    'Name': true,
    'Gem Level': true,
    'Gem Quality': true,
    'Corrupted': true,
    'Category': true,
    'Tab': true,
    'Quantity': true,
    'Price': true,
    'Total': true
  };
  @property({ type: Boolean }) compactMode: boolean = true;
  @property({ type: Boolean }) ultraCompactMode: boolean = false;
  @property({ type: Array }) columnOrder: string[] = [];
  @property({ type: Array }) columnOrderAgg: string[] = [];
  @property({ type: Object }) columnWidths: Record<string, string> = { 'Name': 'minmax(280px,2fr)', 'Category': '160px', 'Stash': '1fr', 'Tab': '80px', 'Quantity': '80px', 'Price': '100px', 'Total': '120px' };
  @property({ type: Object }) columnWidthsAgg: Record<string, string> = { 'Name': 'minmax(240px,1fr)', 'Gem Level': '80px', 'Gem Quality': '80px', 'Corrupted': '100px', 'Category': '160px', 'Tab': '60px', 'Quantity': '80px', 'Price': '80px', 'Total': '100px' };
  @property({ type: Number }) selectedRowIndex: number | null = null;
  @state() private infoOpenFor: string | null = null;
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
    return true;
  }

  private orderedHeaderCols(): string[] {
    const baseAgg = ['Name', 'Gem Level', 'Gem Quality', 'Corrupted', 'Category', 'Tab', 'Quantity', 'Price', 'Total'];
    const base = ['Name', 'Category', 'Stash', 'Tab', 'Quantity', 'Price', 'Total'];
    const order = this.aggregate ? (this.columnOrderAgg.length ? this.columnOrderAgg : baseAgg) : (this.columnOrder.length ? this.columnOrder : base);
    const visible = this.aggregate ? this.visibleColumnsAgg : this.visibleColumns;
    return order.filter(c => visible[c]);
  }

  private renderCell(r: any, col: string): TemplateResult | null {
    switch (col) {
      case 'Name':
        return html`<div class="name"><poe-item .item=${normalizeItem(r.sample)}></poe-item><span>${r.name}</span></div>`;
      case 'Stash':
        return html`<div class="stash">${r.stash ?? ''}</div>`;
      case 'Tab':
        return html`<div class="tab">${this.aggregate ? (r.tabsText ?? String(r.tab)) : r.tab}</div>`;
      case 'Gem Level':
        return html`<div class="level">${r.gemLevel || ''}</div>`;
      case 'Gem Quality':
        return html`<div class="quality">${r.gemQuality || ''}</div>`;
      case 'Corrupted':
        return html`<div class="corrupted">${typeof r.corrupted === 'boolean' ? (r.corrupted ? html`<sl-badge variant="danger" pill>Yes</sl-badge>` : html`<sl-badge variant="neutral" pill>No</sl-badge>`) : ''}</div>`;
      case 'Category':
        return html`<div class="category"><sl-badge variant="${this.getCategoryVariant(r.category)}" pill>${r.category}</sl-badge></div>`;
      case 'Quantity':
        return html`<div class="qty">${r.qty.toLocaleString()}</div>`;
      case 'Price':
        return html`<div class="price">${r.price ? `${r.price.toLocaleString(undefined, { maximumFractionDigits: 1 })}c` : ''}</div>`;
      case 'Total':
        return html`<div class="total">${r.total ? `${Math.round(r.total).toLocaleString()}c` : ''}</div>`;
      default:
        return null;
    }
  }

  @state() private _rows: any[] = [];
  @state() private _filtered: any[] = [];
  @state() private _sorted: any[] = [];

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

    let rowsChanged = false;
    let filteredChanged = false;

    if (map.has('tab') || map.has('prices')) {
      this._calculateRows();
      rowsChanged = true;
    }

    if (rowsChanged || map.has('filter') || map.has('category') || map.has('qtyMin') || map.has('qtyMax') || map.has('priceMin') || map.has('priceMax') || map.has('totalMin') || map.has('totalMax')) {
      this._calculateFiltered();
      filteredChanged = true;
    }

    if (filteredChanged || map.has('sortBy') || map.has('sortDir')) {
      this._calculateSorted();
    }
  }

  private _calculateRows() {
    const items = this.tab?.items ?? [];
    const tabIndex = this.tab?.index ?? 0;
    const groups = groupAggregated(items);
    const stashName = this.aggregate ? '' : (this.tab?.name || (this.tab ? `Tab #${tabIndex}` : ''));

    this._rows = Array.from(groups.values()).map(g => {
      const price = this.resolvePrice(g.sample, g.name);
      const total = +(price * g.total).toFixed(1);
      const isGemItem = isGem(g.sample);
      const gl = isGemItem ? getGemLevel(g.sample) : null;
      const gq = isGemItem ? getGemQuality(g.sample) : null;
      const gc = isGemItem ? isCorrupted(g.sample) : null;
      const cat = this.categoryIndex.get(normalizeName(g.name)) ?? (isGemItem ? 'Gem' : 'Other');
      const tabs = Array.from(g.tabs ?? new Set<number>([tabIndex]));
      const tab = tabs.length ? Math.min(...tabs) : tabIndex;
      const tabsText = tabs.join(',');
      return { name: g.name, stash: stashName, gemLevel: gl, gemQuality: gq, corrupted: gc, category: cat, qty: g.total, tab, tabsText, price, total, sample: g.sample };
    });
  }

  private _calculateFiltered() {
    let regex: RegExp | null = null;
    if (this.filter && this.filter.trim().length && !this.invalidRegex) {
      try {
        regex = new RegExp(this.filter.trim(), 'i');
      } catch (_) {
        // keep invalidRegex state
      }
    }
    const filteredByRegex = regex ? this._rows.filter(r => regex!.test(r.name)) : this._rows;
    this._filtered = filteredByRegex.filter(r => this.matchesAdvancedFilters(r));
  }

  private _calculateSorted() {
    this._sorted = [...this._filtered].sort((a, b) => {
      const mul = this.sortDir === 'asc' ? 1 : -1;
      switch (this.sortBy) {
        case 'name': return a.name.localeCompare(b.name) * mul;
        case 'stash': return (a.stash ?? '').localeCompare(b.stash ?? '') * mul;
        case 'tab': return (a.tab - b.tab) * mul;
        case 'qty': return (a.qty - b.qty) * mul;
        case 'price': return (a.price - b.price) * mul;
        case 'total': return (a.total - b.total) * mul;
        default: return 0;
      }
    });
  }

  protected async firstUpdated(): Promise<void> {
    if (this.prices.size === 0) await this.loadPrices();
    this.filterPending = this.filter;
    this.loadColumnPreferences();
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem('poe-table-visible-columns');
      const savedAgg = localStorage.getItem('poe-table-visible-columns-agg');
      const order = localStorage.getItem('poe-table-order');
      const orderAgg = localStorage.getItem('poe-table-order-agg');
      const widths = localStorage.getItem('poe-table-widths');
      const widthsAgg = localStorage.getItem('poe-table-widths-agg');
      const compact = localStorage.getItem('poe-table-compact');
      const ultra = localStorage.getItem('poe-table-ultra');
      if (saved) {
        this.visibleColumns = { ...this.visibleColumns, ...JSON.parse(saved) };
      }
      if (savedAgg) {
        this.visibleColumnsAgg = { ...this.visibleColumnsAgg, ...JSON.parse(savedAgg) };
      }
      if (order) this.columnOrder = JSON.parse(order);
      if (orderAgg) this.columnOrderAgg = JSON.parse(orderAgg);
      if (widths) this.columnWidths = { ...this.columnWidths, ...JSON.parse(widths) };
      if (widthsAgg) this.columnWidthsAgg = { ...this.columnWidthsAgg, ...JSON.parse(widthsAgg) };
      if (compact) this.compactMode = compact === 'true';
      if (ultra) this.ultraCompactMode = ultra === 'true';
    } catch (e) {
      console.warn('Failed to load column preferences:', e);
    }
  }

  private saveColumnPreferences(): void {
    try {
      localStorage.setItem('poe-table-visible-columns', JSON.stringify(this.visibleColumns));
      localStorage.setItem('poe-table-visible-columns-agg', JSON.stringify(this.visibleColumnsAgg));
      localStorage.setItem('poe-table-order', JSON.stringify(this.columnOrder));
      localStorage.setItem('poe-table-order-agg', JSON.stringify(this.columnOrderAgg));
      localStorage.setItem('poe-table-widths', JSON.stringify(this.columnWidths));
      localStorage.setItem('poe-table-widths-agg', JSON.stringify(this.columnWidthsAgg));
      localStorage.setItem('poe-table-compact', String(this.compactMode));
      localStorage.setItem('poe-table-ultra', String(this.ultraCompactMode));
    } catch (e) {
      console.warn('Failed to save column preferences:', e);
    }
  }

  private toggleColumn(column: string): void {
    if (this.aggregate) {
      this.visibleColumnsAgg = { ...this.visibleColumnsAgg, [column]: !this.visibleColumnsAgg[column] };
    } else {
      this.visibleColumns = { ...this.visibleColumns, [column]: !this.visibleColumns[column] };
    }
    this.saveColumnPreferences();
    this.requestUpdate();
  }

  private moveColumn(column: string, dir: 'up' | 'down'): void {
    const base = this.aggregate ? (this.columnOrderAgg.length ? this.columnOrderAgg : ['Name', 'Gem Level', 'Gem Quality', 'Corrupted', 'Category', 'Tab', 'Quantity', 'Price', 'Total']) : (this.columnOrder.length ? this.columnOrder : ['Name', 'Category', 'Stash', 'Tab', 'Quantity', 'Price', 'Total']);
    const arr = [...base];
    const idx = arr.indexOf(column);
    if (idx < 0) return;
    const nextIdx = dir === 'up' ? Math.max(0, idx - 1) : Math.min(arr.length - 1, idx + 1);
    const [item] = arr.splice(idx, 1);
    arr.splice(nextIdx, 0, item);
    if (this.aggregate) this.columnOrderAgg = arr; else this.columnOrder = arr;
    this.saveColumnPreferences();
    this.requestUpdate();
  }

  private setColumnWidth(column: string, px: number): void {
    const v = `${Math.max(40, Math.min(400, Math.floor(px)))}px`;
    if (this.aggregate) {
      this.columnWidthsAgg = { ...this.columnWidthsAgg, [column]: v };
    } else {
      this.columnWidths = { ...this.columnWidths, [column]: v };
    }
    this.saveColumnPreferences();
    this.requestUpdate();
  }

  private static priceCache: Map<string, { timestamp: number, prices: Map<string, number>, debugData: any }> = new Map();

  static clearPriceCache(): void {
    PoeGeneralPricedListElement.priceCache.clear();
  }

  private async loadPrices(): Promise<void> {
    const cacheKey = this.league;
    const cached = PoeGeneralPricedListElement.priceCache.get(cacheKey);

    if (cached) {
      this.prices = cached.prices;
      this.debugData = cached.debugData;
      // We also need to rebuild derived indices that depend on the raw data
      this.buildCategoryIndex({ ...this.debugData } as any);
      this.rebuildDerivedIndices(this.debugData);
      return;
    }

    if (!this.stashLoader) {
      // If no loader is present (e.g. in Storybook or before injection),
      // we can't load prices. Just return to avoid error loops.
      return;
    }

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

      // Explicitly set Chaos Orb price
      next.set('Chaos Orb', 1);

      this.prices = next;
      this.rebuildDerivedIndices(this.debugData);
      this.buildCategoryIndex({ currency, fragments, oils, incubators, fossils, resonators, deliriumOrbs, vials, essences, cards, maps, gems });

      PoeGeneralPricedListElement.priceCache.set(this.league, {
        timestamp: Date.now(),
        prices: this.prices,
        debugData: this.debugData
      });

      this.errorMessage = null;
    } catch (err: unknown) {
      this.prices = new Map();
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to fetch prices';
      this.errorMessage = `${msg}`;
    }
  }

  private rebuildDerivedIndices(data: any) {
    const { essences, gems, maps } = data;

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

    const gemFallbackByName = new Map<string, number>();
    (gems || []).forEach((r: { name: string; level: number; quality: number; corrupt?: boolean; chaos_value: number | null }) => {
      const price = typeof r.chaos_value === 'number' ? r.chaos_value : null;
      if (price === null) return;
      const n = r.name;
      const isL10 = (r.level ?? 0) === 1 && (r.quality ?? 0) === 0 && !Boolean(r.corrupt);
      const is2020 = (r.level ?? 0) === 20 && (r.quality ?? 0) === 20 && !Boolean(r.corrupt);
      const existing = gemFallbackByName.get(n);
      if (existing === undefined) {
        if (isL10 || is2020) {
          gemFallbackByName.set(n, price);
        } else {
          gemFallbackByName.set(n, price);
        }
      } else if (isL10) {
        gemFallbackByName.set(n, price);
      } else if (is2020 && !isL10) {
        gemFallbackByName.set(n, price);
      }
    });
    gemFallbackByName.forEach((p, n) => { if (!this.prices.has(n)) this.prices.set(n, p); });

    this.mapPriceIndex.clear();
    (maps || []).forEach((r: { name: string; tier: number; chaos_value: number | null }) => {
      const k = mapKey(r.name, r.tier ?? 0);
      const price = typeof r.chaos_value === 'number' ? r.chaos_value : null;
      if (price !== null && !this.mapPriceIndex.has(k)) {
        this.mapPriceIndex.set(k, price);
      }
    });
  }

  protected render(): TemplateResult {
    const filteredCols = this.orderedHeaderCols();
    const visibleCols = this.aggregate ? this.visibleColumnsAgg : this.visibleColumns;
    const filteredTotal = this._sorted.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalPages = Math.max(1, Math.ceil(this._sorted.length / Math.max(1, this.perPage)));
    const safePage = Math.min(Math.max(1, this.page), totalPages);
    const start = (safePage - 1) * Math.max(1, this.perPage);
    const sliced = this._sorted.slice(start, start + Math.max(1, this.perPage));

    const hasActiveFilters = this.category || this.qtyMin !== null || this.qtyMax !== null ||
      this.priceMin !== null || this.priceMax !== null ||
      this.totalMin !== null || this.totalMax !== null;

    return html`<div class="list ${this.filtersOpen ? 'filters-open' : ''} ${this.ultraCompactMode ? 'ultra' : ''}">
      <div class="toolbar">
        <div class="toolbar-primary">
          <div class="filters-group">
            <sl-input size="small" placeholder="Filter (regex)" .value=${this.filterPending} @sl-input=${(e: any) => { this.filterPending = e.target.value; }} @keydown=${(e: KeyboardEvent) => { if ((e as any).key === 'Enter') this.applyTextFilter(); }}></sl-input>
            <sl-button size="small" variant="primary" @click=${this.applyTextFilter}>Apply</sl-button>
            <sl-button size="small" variant="neutral" @click=${this.clearAllFilters}>Clear</sl-button>
            <sl-button size="small" variant="${hasActiveFilters ? 'success' : 'default'}" @click=${() => { this.filtersOpen = !this.filtersOpen; }}>
              <sl-icon slot="prefix" name="${this.filtersOpen ? 'x-lg' : 'funnel'}"></sl-icon>
              ${hasActiveFilters ? 'Filters (Active)' : 'Filters'}
            </sl-button>
          </div>
          <div class="primary-actions">
            <sl-button size="small" @click=${() => { this.viewPricesOpen = true; }}>View JSON</sl-button>
          </div>
        </div>

        <div class="toolbar-secondary">
          <div class="options-group">
            <sl-button size="small" id="columnsBtn" variant="default" @click=${() => { this.columnsMenuOpen = !this.columnsMenuOpen; }}>
              <sl-icon slot="prefix" name="layout-three-columns"></sl-icon>
              Columns
            </sl-button>
            <sl-switch size="small" ?checked=${this.ultraCompactMode} @sl-change=${(e: any) => { this.ultraCompactMode = e.target.checked; this.saveColumnPreferences(); }}>Ultra</sl-switch>
          </div>
          <div class="pagination-group">
            <div class="filtered-total">Filtered total: ${filteredTotal.toFixed(0)}c</div>
            <div class="pager">
              <sl-button size="small" @click=${() => { this.page = Math.max(1, this.page - 1); }}>◀</sl-button>
              <span class="pager__info">Page ${safePage} / ${totalPages}</span>
              <sl-button size="small" @click=${() => { this.page = Math.min(totalPages, this.page + 1); }}>▶</sl-button>
              <sl-select size="small" .value=${String(this.perPage)} @sl-change=${(e: any) => { const v = Number(e.target.value); this.perPage = Math.max(1, v); this.page = 1; }}>
                ${[20, 50, 100, 200].map(n => html`<sl-option value=${String(n)}>${n}/page</sl-option>`)}
              </sl-select>
            </div>
          </div>
        </div>
      </div>

      ${this.columnsMenuOpen ? html`
        <div class="columns-panel" role="region" aria-label="Column options">
          <div class="columns-menu">
            <div class="columns-menu-header">
              <span>Show/Hide Columns</span>
            </div>
            ${((this.aggregate ? ['Name', 'Gem Level', 'Gem Quality', 'Corrupted', 'Category', 'Tab', 'Quantity', 'Price', 'Total'] : ['Name', 'Category', 'Stash', 'Tab', 'Quantity', 'Price', 'Total']) as Array<string>).map(col => html`
              <div class="column-row">
                <sl-checkbox 
                  ?checked=${visibleCols[col]} 
                  @sl-change=${() => this.toggleColumn(col)}
                >${col}</sl-checkbox>
                <div class="column-actions">
                  <sl-icon-button name="chevron-up" label="Move up" @click=${() => this.moveColumn(col, 'up')}></sl-icon-button>
                  <sl-icon-button name="chevron-down" label="Move down" @click=${() => this.moveColumn(col, 'down')}></sl-icon-button>
                  ${col !== 'Name' ? html`<sl-input size="small" type="number" placeholder="px" .value=${String(parseInt((this.aggregate ? this.columnWidthsAgg[col] : this.columnWidths[col]) || '80px'))} @sl-input=${(e: any) => this.setColumnWidth(col, Number(e.target.value))} style="width: 80px;"></sl-input>` : null}
                </div>
              </div>
            `)}
          </div>
        </div>
      ` : null}
      
      <sl-dialog 
        .open=${this.filtersOpen} 
        @sl-request-close=${() => { this.filtersOpen = false; }}
        label="Filter Items"
        class="filters-dialog"
      >
        <div slot="label" class="dialog-label">
          <sl-icon name="funnel-fill"></sl-icon>
          <span>Filter Items</span>
          <sl-badge variant="neutral" pill>${this._filtered.length} of ${this._rows.length}</sl-badge>
        </div>
        
        <div class="filters-content">
          <!-- Quick Actions -->
          ${hasActiveFilters ? html`
            <sl-button size="small" variant="neutral" outline @click=${this.clearAdvancedFilters}>
              <sl-icon slot="prefix" name="arrow-counterclockwise"></sl-icon>
              Reset All
            </sl-button>
          ` : null}
          
          <!-- Compact Filter Grid -->
          <div class="filter-compact-grid">
            <!-- Category Filter -->
            <div class="filter-compact-item">
              <label class="filter-compact-label">
                <sl-icon name="tag-fill"></sl-icon>
                Category
              </label>
              <sl-select 
                hoist 
                size="small" 
                .value=${this.category ? SlConverter.toSlValue(this.category) : ''} 
                @sl-change=${(e: any) => { const v = e.target.value; this.category = v ? SlConverter.fromSlValue<string>(String(v)) : null; }} 
                placeholder="All" 
                clearable
              >
                ${this.categories().map(c => html`<sl-option value=${SlConverter.toSlValue(c)}>${c}</sl-option>`)}
              </sl-select>
            </div>

            <!-- Quantity Range -->
            <div class="filter-compact-item">
              <label class="filter-compact-label">
                <sl-icon name="hash"></sl-icon>
                Quantity
              </label>
              <div class="range-compact">
                <sl-input 
                  size="small" 
                  type="number" 
                  placeholder="Min" 
                  .value=${String(this.qtyMin ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.qtyMin = v === '' ? null : Number(v); }}
                ></sl-input>
                <span class="range-sep">–</span>
                <sl-input 
                  size="small" 
                  type="number" 
                  placeholder="Max" 
                  .value=${String(this.qtyMax ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.qtyMax = v === '' ? null : Number(v); }}
                ></sl-input>
              </div>
            </div>

            <!-- Price Range -->
            <div class="filter-compact-item">
              <label class="filter-compact-label">
                <sl-icon name="currency-exchange"></sl-icon>
                Item Price (c)
              </label>
              <div class="range-compact">
                <sl-input 
                  size="small" 
                  type="number" 
                  placeholder="Min" 
                  .value=${String(this.priceMin ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.priceMin = v === '' ? null : Number(v); }}
                ></sl-input>
                <span class="range-sep">–</span>
                <sl-input 
                  size="small" 
                  type="number" 
                  placeholder="Max" 
                  .value=${String(this.priceMax ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.priceMax = v === '' ? null : Number(v); }}
                ></sl-input>
              </div>
            </div>

            <!-- Total Value Range -->
            <div class="filter-compact-item">
              <label class="filter-compact-label">
                <sl-icon name="cash-stack"></sl-icon>
                Total Value (c)
              </label>
              <div class="range-compact">
                <sl-input 
                  size="small" 
                  type="number" 
                  placeholder="Min" 
                  .value=${String(this.totalMin ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.totalMin = v === '' ? null : Number(v); }}
                ></sl-input>
                <span class="range-sep">–</span>
                <sl-input 
                  size="small" 
                  type="number" 
                  placeholder="Max" 
                  .value=${String(this.totalMax ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.totalMax = v === '' ? null : Number(v); }}
                ></sl-input>
              </div>
            </div>
          </div>
        </div>
        
        <div slot="footer" class="dialog-footer">
          <sl-button variant="primary" @click=${() => { this.filtersOpen = false; }}>
            Apply Filters
          </sl-button>
        </div>
      </sl-dialog>
      
      <div class="table-container">
        ${this.errorMessage ? html`<sl-alert variant="danger" closable @sl-after-hide=${() => (this.errorMessage = null)}>
          <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
          ${this.errorMessage}
        </sl-alert>` : null}
        ${this.invalidRegex ? html`<sl-alert variant="warning" closable @sl-after-hide=${() => (this.invalidRegex = false)}>
          <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
          Invalid regex: ${this.filterPending}
        </sl-alert>` : null}
        <div class="table-scroll" role="region" aria-label="Items table">
          <table class="poe-table" role="table">
            ${this.renderTableHead(filteredCols)}
            <tbody>
              ${sliced.map((r: any, idx: number) => html`
                <tr class="${this.ultraCompactMode ? 'ultra' : ''}" data-category="${r.category}" aria-rowindex="${idx + 1}">
                  ${filteredCols.map(c => html`<td class="${this.tdClassFor(c)}">${this.renderCell(r, c)}</td>`)}
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
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
        const p2020 = this.gemPriceIndex.get(gemKeyC(displayName, 20, 20, false));
        if (typeof p2020 === 'number') return p2020;
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

  private renderTableHead(cols: string[]): TemplateResult {
    const keys: Record<string, PoeGeneralPricedListElement['sortBy']> = {
      Name: 'name', Stash: 'stash', Tab: 'tab', Quantity: 'qty', Price: 'price', Total: 'total'
    };
    const numeric = new Set(['Gem Level', 'Gem Quality', 'Quantity', 'Price', 'Total']);
    return html`<thead>
      <tr>
        ${cols.map(c => {
      const isSorted = this.sortBy === keys[c];
      const sortIcon = isSorted ? (this.sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-down-up';
      const ariaSort = isSorted ? (this.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
      const infoId = `colinfo-${c.replace(/\s+/g, '-')}`;
      return html`<th scope="col" aria-sort="${ariaSort}" class="${numeric.has(c) ? 'numeric' : ''}" style="width: ${this.colWidthPx(c)}">
            ${keys[c]
          ? html`<button class="th ${isSorted ? 'sorted' : ''}" @click=${() => this.onSort(keys[c])}>
                  ${c}
                  <sl-icon name="${sortIcon}" class="sort-icon"></sl-icon>
                  <sl-icon-button id="${infoId}" name="info-circle" label="Column info" class="col-info-btn"
                    @click=${(e: Event) => { e.stopPropagation(); this.toggleInfo(c); }}
                    @keydown=${(e: KeyboardEvent) => this.onInfoKeydown(e, c)}
                  ></sl-icon-button>
                </button>
                <sl-popup .active=${this.infoOpenFor === c} anchor="${infoId}" placement="bottom-start">
                  <div class="col-info-box">${this.infoContent(c)}</div>
                </sl-popup>`
          : html`<span class="th">${c}
                  <sl-icon-button id="${infoId}" name="info-circle" label="Column info" class="col-info-btn"
                    @click=${(e: Event) => { e.stopPropagation(); this.toggleInfo(c); }}
                    @keydown=${(e: KeyboardEvent) => this.onInfoKeydown(e, c)}
                  ></sl-icon-button>
                  <sl-popup .active=${this.infoOpenFor === c} anchor="${infoId}" placement="bottom-start">
                    <div class="col-info-box">${this.infoContent(c)}</div>
                  </sl-popup>
                </span>`}
          </th>`;
    })}
      </tr>
    </thead>`;
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

  private tdClassFor(col: string): string {
    if (['Gem Level', 'Gem Quality', 'Quantity', 'Price', 'Total', 'Tab'].includes(col)) return 'numeric';
    if (['Category', 'Corrupted'].includes(col)) return 'center';
    return 'text';
  }

  private toggleInfo(col: string): void {
    this.infoOpenFor = this.infoOpenFor === col ? null : col;
  }

  private onInfoKeydown(e: KeyboardEvent, col: string): void {
    const k = e.key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      this.toggleInfo(col);
    }
    if (k === 'Escape') {
      this.infoOpenFor = null;
    }
  }

  private infoContent(col: string): TemplateResult {
    const t = (s: string) => html`<div class="col-info-line">${s}</div>`;
    switch (col) {
      case 'Name': return t('Item base name.');
      case 'Stash': return t('Source stash name.');
      case 'Tab': return this.aggregate ? t('Tabs containing this item, shown as comma-separated indexes.') : t('Tab index in the selected stash.');
      case 'Gem Level': return t('Exact level of the gem.');
      case 'Gem Quality': return t('Exact quality of the gem in percent.');
      case 'Corrupted': return t('Whether the gem is corrupted.');
      case 'Category': return t('Item category derived from pricing sources.');
      case 'Quantity': return t('Total stack count across aggregated tabs.');
      case 'Price': return t('Estimated chaos value per item based on price sources.');
      case 'Total': return t('Quantity × Price, rounded to chaos.');
      default: return t('Column details.');
    }
  }

  private colWidthPx(col: string): string {
    const v = (this.aggregate ? this.columnWidthsAgg[col] : this.columnWidths[col]) || '';
    const m = v.match(/(\d+)\s*px/);
    if (m) return `${m[1]}px`;
    const mm = v.match(/minmax\((\d+)px/);
    if (mm) return `${mm[1]}px`;
    return 'auto';
  }

  private getCategoryVariant(category: string): 'primary' | 'success' | 'neutral' | 'warning' | 'danger' {
    const variants: Record<string, 'primary' | 'success' | 'neutral' | 'warning' | 'danger'> = {
      'Currency': 'warning',
      'Gem': 'primary',
      'Map': 'success',
      'Fragment': 'danger',
      'Divination Card': 'primary',
      'Essence': 'neutral',
      'Fossil': 'neutral',
      'Resonator': 'neutral',
      'Oil': 'warning',
      'Incubator': 'success',
      'Scarab': 'danger',
      'Delirium Orb': 'danger',
      'Vial': 'neutral'
    };
    return variants[category] || 'neutral';
  }

  applyTextFilter(): void {
    const val = (this.filterPending || '').trim();
    if (!val) {
      this.filter = '';
      this.invalidRegex = false;
      this.page = 1;
      return;
    }
    try {
      // eslint-disable-next-line no-new
      new RegExp(val, 'i');
      this.filter = val;
      this.invalidRegex = false;
      this.page = 1;
    } catch (_) {
      this.invalidRegex = true;
    }
  }

  clearAllFilters(): void {
    this.filterPending = '';
    this.filter = '';
    this.invalidRegex = false;
    this.category = null;
    this.qtyMin = null;
    this.qtyMax = null;
    this.priceMin = null;
    this.priceMax = null;
    this.totalMin = null;
    this.totalMax = null;
    this.page = 1;
  }

  clearAdvancedFilters(): void {
    this.category = null;
    this.qtyMin = null;
    this.qtyMax = null;
    this.priceMin = null;
    this.priceMax = null;
    this.totalMin = null;
    this.totalMax = null;
    this.page = 1;
  }

  static styles: CSSResult = css`
    :host { display: block; width: 100%; height: auto; }
    .list { 
      width: 100%; 
      padding: 6px; 
      display: grid; 
      grid-auto-rows: min-content; 
      row-gap: 4px; 
      overflow-y: auto; 
      overflow-x: hidden; 
      --table-bg: var(--sl-color-neutral-50);
      --table-header-bg: var(--sl-color-neutral-100);
      --table-row-bg: var(--sl-color-neutral-50);
      --table-row-hover-bg: var(--sl-color-neutral-100);
      --table-text-color: var(--sl-color-neutral-900);
      --header-text-color: var(--sl-color-primary-600);
      --table-border-color: var(--sl-color-neutral-200);
      background: var(--table-bg);
      color: var(--table-text-color);
    }
    :host-context(.sl-theme-dark) .list { 
      --table-bg: #0d1117; 
      --table-header-bg: #161b22; 
      --table-row-bg: #0d1117; 
      --table-row-alt-bg: #161b22;
      --table-row-hover-bg: #21262d; 
      --table-text-color: #c9d1d9;
      --table-border-color: #30363d;
      --header-text-color: var(--sl-color-primary-400);
      background: var(--table-bg);
      color: var(--table-text-color);
    }
    .list.ultra { row-gap: 2px; }
    .toolbar { display: grid; grid-template-columns: 1fr; gap: 6px; }
    .toolbar-primary, .toolbar-secondary { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
    .filters-group { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .filters-group sl-input { min-width: 260px; }
    .primary-actions { display: inline-flex; gap: 6px; align-items: center; }
    .options-group { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .pagination-group { display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end; flex: 1; }
    .filtered-total { font-weight: 600; opacity: 0.8; white-space: nowrap; }
    .pager { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
    .pager__info { min-width: 100px; text-align: center; }
    sl-alert { }
    .columns-panel { background: var(--table-bg); border: 1px solid var(--table-border-color); border-radius: 0.5rem; padding: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    .columns-menu { display: grid; grid-auto-rows: min-content; row-gap: 6px; }
    .columns-menu-header { font-weight: 600; color: var(--header-text-color, var(--sl-color-neutral-700)); margin-bottom: 4px; }
    .column-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .column-actions { display: inline-flex; align-items: center; gap: 6px; }
    .table-scroll { width: 100%; height: 100%; overflow: auto; }
    .poe-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
    thead { background: var(--table-header-bg); position: sticky; top: 0; z-index: 2; }
    thead th { position: sticky; top: 0; background: var(--table-header-bg); border-bottom: 1px solid var(--table-border-color); padding: 10px 12px; color: var(--header-text-color); font-weight: 700; text-align: left; }
    thead th.numeric { text-align: right; }
    thead th .th { background: transparent; border: none; color: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; padding: 4px 6px; border-radius: 6px; }
    thead th .th:hover { color: var(--sl-color-primary-600); }
    thead th .th:focus-visible { outline: 2px solid var(--sl-color-primary-600); outline-offset: 2px; }
    thead th .th.sorted { color: var(--sl-color-primary-700); font-weight: 800; }
    :host-context(.sl-theme-dark) thead th .th.sorted { color: var(--sl-color-primary-300); }
    thead th .sort-icon { font-size: 0.9rem; opacity: 0.7; }
    .col-info-btn { --size: 20px; color: var(--sl-color-neutral-600); }
    :host-context(.sl-theme-dark) .col-info-btn { color: var(--sl-color-neutral-300); }
    .col-info-box { background: var(--card-bg, var(--table-bg)); border: 1px solid var(--table-border-color); border-radius: 8px; padding: 8px 10px; max-width: 280px; font-size: 0.85rem; color: var(--table-text-color); box-shadow: var(--sl-shadow-large); }
    .col-info-line { line-height: 1.3; }
    tbody tr { background: var(--table-row-bg); color: var(--table-text-color); border-bottom: 1px solid var(--table-border-color); }
    tbody tr:nth-child(even) { background: var(--table-row-alt-bg); }
    td { padding: 6px 8px; vertical-align: middle; }
    td.numeric { text-align: right; }
    td.center { text-align: center; }
    tbody tr:hover { background: var(--table-row-hover-bg); }
    :host-context(.sl-theme-dark) thead th .th:hover { color: var(--sl-color-primary-500); }
    .name { display: flex; align-items: center; gap: 6px; }
    poe-item { --cell-size: 24px; --poe-item-size: 24px; --stack-size-font-size: 9px; }
    .list.ultra poe-item { --cell-size: 20px; --poe-item-size: 20px; --stack-size-font-size: 8px; }
    .level, .quality, .qty { text-align: right; font-variant-numeric: tabular-nums; justify-self: end; }
    .corrupted, .category { text-align: center; justify-self: center; }
    .price, .total { text-align: right; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; font-weight: 600; justify-self: end; }
    .row { 
      background: var(--table-row-bg);
      color: var(--table-text-color);
      border-bottom: 1px solid var(--table-border-color); 
      padding: 6px 8px; 
      transition: all 0.15s ease;
      border-radius: 4px;
      margin-bottom: 1px;
    }
    .row:nth-child(even) { background: var(--table-row-alt-bg); }
    .row > div { padding: 0 8px; }
    .row.ultra { padding: 3px 0; }
    .row:hover {
      background: var(--table-row-hover-bg);
      transform: translateX(2px);
    }
    .row:focus-within { outline: 2px solid var(--sl-color-primary-600); outline-offset: 0; }
    .row.selected { background: rgba(0,112,243,0.2); border-left: 3px solid var(--sl-color-primary-600); }
    .toolbar { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; }
    .row[data-category="Currency"]:hover { background: var(--table-row-hover-bg); }
    .row[data-category="Gem"]:hover { background: var(--table-row-hover-bg); }
    .row[data-category="Map"]:hover { background: var(--table-row-hover-bg); }
    .row[data-category="Fragment"]:hover { background: var(--table-row-hover-bg); }
    
    /* Layout adjustments when filters are open */
    .list { 
      position: relative; 
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      overflow: hidden; /* Let virtualizer handle scrolling */
    }
    .table-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      width: 100%;
      overflow: hidden;
    }
    :host-context(.sl-theme-dark) .table-container { background: var(--table-bg); }
    :host-context(.sl-theme-dark) .table-container { background: var(--table-bg); }
    .row {
      width: 100%;
      box-sizing: border-box;
    }
    .list.filters-open .table-container {
      margin-right: 320px;
      transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    
    /* Filters Dialog */
    .filters-dialog::part(panel) {
      max-width: 600px;
      width: 90vw;
    }
    
    .filters-dialog::part(body) {
      padding: 0;
    }
    
    .dialog-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .dialog-label sl-icon {
      color: var(--sl-color-primary-600);
    }
    .dialog-label { display: flex; align-items: center; gap: 8px; font-size: 1.1rem; font-weight: 600; }
    
    .dialog-label sl-badge {
      margin-left: auto;
    }
    
    .filters-content { display: flex; flex-direction: column; gap: 16px; padding-top: 8px; }
    
    /* Compact Filter Grid - 2 columns */
    .filter-compact-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 16px; 
    }
    
    @media (max-width: 600px) {
      .filter-compact-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .filter-compact-item { display: flex; flex-direction: column; gap: 6px; }
    .filter-compact-item:first-child { grid-column: 1 / -1; } /* Category full width */
    .filter-compact-label { 
      font-size: 0.85rem; 
      font-weight: 500; 
      color: var(--sl-color-neutral-600); 
      display: flex; 
      align-items: center; 
      gap: 6px; 
    }
    :host-context(.sl-theme-dark) .filter-compact-label { color: var(--sl-color-neutral-400); }
    .filter-compact-label sl-icon {
      font-size: 0.9rem;
      color: var(--sl-color-primary-500);
    }
    
    /* Range Compact - Side by Side */
    .range-compact {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    
    .range-compact sl-input {
      flex: 1;
    }
    
    .range-sep {
      color: var(--sl-color-neutral-500);
      font-weight: 500;
      font-size: 0.9rem;
    }
    
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    
    /* Columns Menu */
    .columns-menu {
      background: var(--table-bg);
      border: 1px solid var(--table-border-color);
      border-radius: 8px;
      padding: 8px;
      min-width: 200px;
      box-shadow: var(--sl-shadow-large);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .columns-menu-header {
      padding: 8px 12px;
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--header-text-color, var(--sl-color-neutral-700));
      border-bottom: 1px solid var(--table-border-color);
      margin-bottom: 4px;
    }
    
    .column-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; }
    .column-row:hover { background: var(--table-row-hover-bg); }
    .column-actions { display: inline-flex; gap: 6px; align-items: center; }
    
    .column-toggle sl-checkbox {
      width: 100%;
    }

    :host-context(.sl-theme-dark) .filters-group sl-input,
    :host-context(.sl-theme-dark) .filters-content sl-input,
    :host-context(.sl-theme-dark) .filters-content sl-select {
      --sl-input-background-color: #0e1113;
      --sl-input-border-color: var(--sl-color-neutral-700);
      --sl-input-color: var(--sl-color-neutral-100);
      --sl-input-placeholder-color: var(--sl-color-neutral-500);
    }

    :host-context(.sl-theme-dark) .header .th:hover { color: var(--sl-color-primary-500); }
    :host-context(.sl-theme-dark) .row.selected { background: rgba(0, 112, 243, 0.25); border-left-color: var(--sl-color-primary-600); }
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

type Group = { name: string; total: number; sample: PoeItem; tabs: Set<number> };

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
    const tIdx = Number((it as any).tabIndex ?? (it as any).__tabIndex ?? 0) || 0;
    const prev = map.get(key);
    if (prev) {
      prev.total += qty;
      prev.tabs.add(tIdx);
    } else {
      map.set(key, { name: baseName, total: qty, sample: it, tabs: new Set([tIdx]) });
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

export function categoryFromKey(k: string): string {
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
