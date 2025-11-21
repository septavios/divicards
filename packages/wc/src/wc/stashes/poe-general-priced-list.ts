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
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
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
    this.loadColumnPreferences();
  }

  private loadColumnPreferences(): void {
    try {
      const saved = localStorage.getItem('poe-table-visible-columns');
      const savedAgg = localStorage.getItem('poe-table-visible-columns-agg');
      if (saved) {
        this.visibleColumns = { ...this.visibleColumns, ...JSON.parse(saved) };
      }
      if (savedAgg) {
        this.visibleColumnsAgg = { ...this.visibleColumnsAgg, ...JSON.parse(savedAgg) };
      }
    } catch (e) {
      console.warn('Failed to load column preferences:', e);
    }
  }

  private saveColumnPreferences(): void {
    try {
      localStorage.setItem('poe-table-visible-columns', JSON.stringify(this.visibleColumns));
      localStorage.setItem('poe-table-visible-columns-agg', JSON.stringify(this.visibleColumnsAgg));
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

      // Explicitly set Chaos Orb price
      next.set('Chaos Orb', 1);


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
      gemFallbackByName.forEach((p, n) => { if (!next.has(n)) next.set(n, p); });

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
      const tabs = Array.from(g.tabs ?? new Set<number>([tabIndex]));
      const tab = tabs.length ? Math.min(...tabs) : tabIndex;
      const tabsText = tabs.join(',');
      return { name: g.name, stash: stashName, gemLevel: gl, gemQuality: gq, corrupted: gc, category: cat, qty: g.total, tab, tabsText, price, total, sample: g.sample };
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

    const headerCols = this.aggregate ? ['Name', 'Gem Level', 'Gem Quality', 'Corrupted', 'Category', 'Tab', 'Quantity', 'Price', 'Total'] : ['Name', 'Stash', 'Tab', 'Quantity', 'Price', 'Total'];
    const visibleCols = this.aggregate ? this.visibleColumnsAgg : this.visibleColumns;
    const filteredCols = headerCols.filter(col => visibleCols[col]);
    const filteredTotal = filtered.reduce((sum, r) => sum + (r.total || 0), 0);
    const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, this.perPage)));
    const safePage = Math.min(Math.max(1, this.page), totalPages);
    const start = (safePage - 1) * Math.max(1, this.perPage);
    const sliced = filtered.slice(start, start + Math.max(1, this.perPage));

    const hasActiveFilters = this.category || this.qtyMin !== null || this.qtyMax !== null ||
      this.priceMin !== null || this.priceMax !== null ||
      this.totalMin !== null || this.totalMax !== null;

    return html`<div class="list ${this.filtersOpen ? 'filters-open' : ''}">
      <div class="tools">
        <sl-input size="small" placeholder="Filter (regex)" .value=${this.filterPending} @sl-input=${(e: any) => { this.filterPending = e.target.value; }} @keydown=${(e: KeyboardEvent) => { if ((e as any).key === 'Enter') this.applyTextFilter(); }}></sl-input>
        <sl-button size="small" variant="primary" @click=${this.applyTextFilter}>Apply</sl-button>
        <sl-button size="small" variant="neutral" @click=${this.clearAllFilters}>Clear</sl-button>
        <sl-button size="small" id="columnsBtn" variant="default" @click=${() => { this.columnsMenuOpen = !this.columnsMenuOpen; }}>
          <sl-icon slot="prefix" name="layout-three-columns"></sl-icon>
          Columns
        </sl-button>
        ${this.aggregate ? html`<sl-button size="small" variant="${hasActiveFilters ? 'success' : 'default'}" @click=${() => { this.filtersOpen = !this.filtersOpen; }}>
          <sl-icon slot="prefix" name="${this.filtersOpen ? 'x-lg' : 'funnel'}"></sl-icon>
          ${hasActiveFilters ? 'Filters (Active)' : 'Filters'}
        </sl-button>` : null}
      ${this.aggregate ? html`<div class="filtered-total">Filtered total: ${filteredTotal.toFixed(0)}c</div>` : null}
      ${this.aggregate ? html`<div class="pager">
        <sl-button size="small" @click=${() => { this.page = Math.max(1, this.page - 1); }}>◀</sl-button>
        <span class="pager__info">Page ${safePage} / ${totalPages}</span>
        <sl-button size="small" @click=${() => { this.page = Math.min(totalPages, this.page + 1); }}>▶</sl-button>
        <sl-select size="small" .value=${String(this.perPage)} @sl-change=${(e: any) => { const v = Number(e.target.value); this.perPage = Math.max(1, v); this.page = 1; }}>
          ${[20, 50, 100, 200].map(n => html`<sl-option value=${String(n)}>${n}/page</sl-option>`)}
        </sl-select>
      </div>` : null}
        <sl-button size="small" @click=${() => { this.viewPricesOpen = true; }}>View Prices JSON</sl-button>
      </div>
      
      <sl-popup .active=${this.columnsMenuOpen} anchor="columnsBtn" placement="bottom-start" distance="8" flip shift>
        <div class="columns-menu">
          <div class="columns-menu-header">
            <span>Show/Hide Columns</span>
          </div>
          ${headerCols.map(col => html`
            <label class="column-toggle">
              <sl-checkbox 
                size="small" 
                ?checked=${visibleCols[col]} 
                @sl-change=${() => this.toggleColumn(col)}
              >${col}</sl-checkbox>
            </label>
          `)}
        </div>
      </sl-popup>
      
      
      ${this.aggregate ? html`
        <div class="filters-drawer ${this.filtersOpen ? 'open' : ''}">
          <div class="filters-drawer-header">
            <div class="header-content">
              <sl-icon name="funnel-fill"></sl-icon>
              <div>
                <h3>Filter Items</h3>
                <p class="header-subtitle">${filtered.length} of ${rows.length} items shown</p>
              </div>
            </div>
            <sl-icon-button name="x-lg" label="Close filters" @click=${() => { this.filtersOpen = false; }}></sl-icon-button>
          </div>
          
          <div class="filters-drawer-content">
            <!-- Quick Actions -->
            ${hasActiveFilters ? html`
              <div class="quick-actions">
                <sl-button size="small" variant="neutral" outline @click=${this.clearAdvancedFilters}>
                  <sl-icon slot="prefix" name="arrow-counterclockwise"></sl-icon>
                  Reset Filters
                </sl-button>
              </div>
            ` : null}
            
            <!-- Category Filter -->
            <div class="filter-group">
              <div class="filter-group-header">
                <sl-icon name="tag-fill"></sl-icon>
                <span>Category</span>
              </div>
              <sl-select 
                hoist 
                size="medium" 
                .value=${this.category ?? ''} 
                @sl-change=${(e: any) => { const v = e.target.value; this.category = v ? String(v) : null; }} 
                placeholder="All categories" 
                clearable
              >
                ${this.categories().map(c => html`<sl-option value=${c}>${c}</sl-option>`)}
              </sl-select>
              <p class="filter-help">Filter items by their category type</p>
            </div>

            <!-- Quantity Range -->
            <div class="filter-group">
              <div class="filter-group-header">
                <sl-icon name="hash"></sl-icon>
                <span>Quantity</span>
              </div>
              <div class="range-grid">
                <sl-input 
                  size="medium" 
                  type="number" 
                  placeholder="Min" 
                  .value=${String(this.qtyMin ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.qtyMin = v === '' ? null : Number(v); }}
                >
                  <span slot="prefix">Min</span>
                </sl-input>
                <sl-input 
                  size="medium" 
                  type="number" 
                  placeholder="Max" 
                  .value=${String(this.qtyMax ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.qtyMax = v === '' ? null : Number(v); }}
                >
                  <span slot="prefix">Max</span>
                </sl-input>
              </div>
              <p class="filter-help">Filter by stack size or item count</p>
            </div>

            <!-- Price Range -->
            <div class="filter-group">
              <div class="filter-group-header">
                <sl-icon name="currency-exchange"></sl-icon>
                <span>Item Price (chaos)</span>
              </div>
              <div class="range-grid">
                <sl-input 
                  size="medium" 
                  type="number" 
                  placeholder="Min" 
                  .value=${String(this.priceMin ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.priceMin = v === '' ? null : Number(v); }}
                >
                  <span slot="prefix">Min</span>
                </sl-input>
                <sl-input 
                  size="medium" 
                  type="number" 
                  placeholder="Max" 
                  .value=${String(this.priceMax ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.priceMax = v === '' ? null : Number(v); }}
                >
                  <span slot="prefix">Max</span>
                </sl-input>
              </div>
              <p class="filter-help">Filter by individual item price</p>
            </div>

            <!-- Total Value Range -->
            <div class="filter-group">
              <div class="filter-group-header">
                <sl-icon name="cash-stack"></sl-icon>
                <span>Total Value (chaos)</span>
              </div>
              <div class="range-grid">
                <sl-input 
                  size="medium" 
                  type="number" 
                  placeholder="Min" 
                  .value=${String(this.totalMin ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.totalMin = v === '' ? null : Number(v); }}
                >
                  <span slot="prefix">Min</span>
                </sl-input>
                <sl-input 
                  size="medium" 
                  type="number" 
                  placeholder="Max" 
                  .value=${String(this.totalMax ?? '')} 
                  @sl-input=${(e: any) => { const v = e.target.value; this.totalMax = v === '' ? null : Number(v); }}
                >
                  <span slot="prefix">Max</span>
                </sl-input>
              </div>
              <p class="filter-help">Filter by total stack value (price × quantity)</p>
            </div>
          </div>
        </div>
      ` : null}
      
      <div class="table-container">
        ${this.errorMessage ? html`<sl-alert variant="danger" closable @sl-after-hide=${() => (this.errorMessage = null)}>
          <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
          ${this.errorMessage}
        </sl-alert>` : null}
        ${this.invalidRegex ? html`<sl-alert variant="warning" closable @sl-after-hide=${() => (this.invalidRegex = false)}>
          <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
          Invalid regex: ${this.filterPending}
        </sl-alert>` : null}
        ${this.renderHeader(filteredCols)}
        ${sliced.map(r => html`<div class="row ${this.aggregate ? 'agg' : ''}" data-category="${r.category}">
          ${visibleCols['Name'] ? html`<div class="name">
            <poe-item .item=${normalizeItem(r.sample)}></poe-item>
            <span>${r.name}</span>
          </div>` : null}
          ${this.aggregate ? (visibleCols['Gem Level'] ? html`<div class="level">${r.gemLevel || ''}</div>` : null) : (visibleCols['Stash'] ? html`<div class="stash">${r.stash ?? ''}</div>` : null)}
          ${this.aggregate ? (visibleCols['Gem Quality'] ? html`<div class="quality">${r.gemQuality || ''}</div>` : null) : (visibleCols['Tab'] ? html`<div class="tab">${r.tab}</div>` : null)}
          ${this.aggregate && visibleCols['Corrupted'] ? html`<div class="corrupted">${typeof r.corrupted === 'boolean' ? (r.corrupted ? html`<sl-badge variant="danger" size="small" pill>Yes</sl-badge>` : html`<sl-badge variant="neutral" size="small" pill>No</sl-badge>`) : ''}</div>` : null}
          ${this.aggregate && visibleCols['Category'] ? html`<div class="category"><sl-badge variant="${this.getCategoryVariant(r.category)}" size="small" pill>${r.category}</sl-badge></div>` : null}
          ${this.aggregate && visibleCols['Tab'] ? html`<div class="tab">${r.tabsText ?? String(r.tab)}</div>` : null}
          ${visibleCols['Quantity'] ? html`<div class="qty">${r.qty.toLocaleString()}</div>` : null}
          ${visibleCols['Price'] ? html`<div class="price">${r.price ? `${r.price.toLocaleString(undefined, { maximumFractionDigits: 1 })}c` : ''}</div>` : null}
          ${visibleCols['Total'] ? html`<div class="total">${r.total ? `${Math.round(r.total).toLocaleString()}c` : ''}</div>` : null}
        </div>`)}
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

  private renderHeader(cols: string[]): TemplateResult {
    const keys: Record<string, PoeGeneralPricedListElement['sortBy']> = {
      Name: 'name', Stash: 'stash', Tab: 'tab', Quantity: 'qty', Price: 'price', Total: 'total'
    };
    const numeric = new Set(['Quantity', 'Price', 'Total']);
    return html`<div class="header ${this.aggregate ? 'agg' : ''}">
      ${cols.map(c => {
      const isSorted = this.sortBy === keys[c];
      const sortIcon = isSorted ? (this.sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-down-up';
      return html`<button class="th ${numeric.has(c) ? 'numeric' : ''} ${isSorted ? 'sorted' : ''}" @click=${() => (keys[c] ? this.onSort(keys[c]) : undefined)}>
          ${c}
          ${keys[c] ? html`<sl-icon name="${sortIcon}" class="sort-icon"></sl-icon>` : ''}
        </button>`;
    })}
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

  private getCategoryVariant(category: string): string {
    const variants: Record<string, string> = {
      'Currency': 'warning',
      'Gem': 'primary',
      'Map': 'success',
      'Fragment': 'danger',
      'Divination Card': 'purple',
      'Essence': 'cyan',
      'Fossil': 'neutral',
      'Resonator': 'neutral',
      'Oil': 'warning',
      'Incubator': 'success',
      'Scarab': 'danger',
      'Delirium Orb': 'purple',
      'Vial': 'cyan'
    };
    return variants[category] || 'neutral';
  }

  static styles: CSSResult = css`
    :host { display: block; width: 100%; height: auto; }
    .list { width: 100%; padding: 6px; display: grid; grid-auto-rows: min-content; row-gap: 4px; overflow-y: auto; overflow-x: hidden; }
    .tools { display: flex; justify-content: flex-start; gap: 6px; padding-bottom: 4px; align-items: center; flex-wrap: wrap; }
    .tools sl-input { min-width: 260px; }
    .filtered-total { font-weight: 600; opacity: 0.8; white-space: nowrap; }
    .pager { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
    .pager__info { min-width: 100px; text-align: center; }
    sl-alert { position: sticky; top: 0; z-index: 1; }
    .header, .row { display: grid; align-items: center; }
    .header:not(.agg), .row:not(.agg) { grid-template-columns: 2fr 1fr 80px 80px 100px 120px; }
    .header.agg, .row.agg { grid-template-columns: 1fr 80px 80px 100px 160px 60px 80px 80px 100px; }
    .header { 
      font-weight: 600; 
      position: sticky; 
      top: 0; 
      background: linear-gradient(180deg, var(--sl-color-gray-50) 0%, var(--sl-color-gray-100) 100%); 
      z-index: 10; 
      padding: 8px 0; 
      border-bottom: 2px solid var(--sl-color-primary-300); 
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .header .th { 
      text-align: left; 
      background: transparent; 
      border: none; 
      color: var(--sl-color-neutral-700); 
      cursor: pointer; 
      padding: 4px 8px; 
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      transition: all 0.2s ease;
      border-radius: 4px;
    }
    .header .th:hover {
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-primary-700);
    }
    .header .th.sorted {
      color: var(--sl-color-primary-700);
      font-weight: 700;
    }
    .header .th.numeric { 
      text-align: right; 
      justify-content: flex-end;
    }
    .header .th .sort-icon {
      font-size: 0.9rem;
      opacity: 0.5;
      transition: opacity 0.2s ease;
    }
    .header .th.sorted .sort-icon {
      opacity: 1;
      color: var(--sl-color-primary-600);
    }
    .header .th:hover .sort-icon {
      opacity: 0.8;
    }
    .name { display: flex; align-items: center; gap: 6px; }
    poe-item { --cell-size: 32px; --poe-item-size: 32px; --stack-size-font-size: 10px; }
    .level, .quality, .qty { text-align: right; font-variant-numeric: tabular-nums; }
    .corrupted, .category { text-align: center; }
    .price, .total { text-align: right; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; font-weight: 600; }
    .row { 
      border-bottom: 1px solid var(--sl-color-gray-200); 
      padding: 6px 0; 
      transition: background-color 0.15s ease;
    }
    .row:hover {
      background: var(--sl-color-primary-50);
      border-color: var(--sl-color-primary-200);
    }
    .row[data-category="Currency"]:hover { background: var(--sl-color-warning-50); }
    .row[data-category="Gem"]:hover { background: var(--sl-color-primary-50); }
    .row[data-category="Map"]:hover { background: var(--sl-color-success-50); }
    .row[data-category="Fragment"]:hover { background: var(--sl-color-danger-50); }
    
    /* Layout adjustments when filters are open */
    .list { 
      position: relative; 
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .list.filters-open .table-container {
      margin-right: 320px;
      transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .table-container {
      flex: 1;
      overflow: auto;
      margin-right: 0;
      transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Filters Drawer */
    .filters-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 380px;
      background: #1a1d24;
      border-left: 1px solid #2d3139;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .filters-drawer.open {
      transform: translateX(0);
    }
    
    /* Drawer Header */
    .filters-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }
    
    .header-content sl-icon {
      font-size: 1.5rem;
      color: white;
    }
    
    .filters-drawer-header h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: white;
      letter-spacing: 0.3px;
    }
    
    .header-subtitle {
      margin: 2px 0 0 0;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 400;
    }
    
    .filters-drawer-header sl-icon-button {
      color: white;
      --sl-color-neutral-600: white;
      --sl-color-neutral-700: rgba(255, 255, 255, 0.9);
      font-size: 1.2rem;
    }
    .filters-drawer-header sl-icon-button::part(base) {
      color: white;
    }
    .filters-drawer-header sl-icon-button::part(base):hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    /* Drawer Content */
    .filters-drawer-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      background: #1a1d24;
    }
    
    /* Scrollbar Styling */
    .filters-drawer-content::-webkit-scrollbar {
      width: 8px;
    }
    .filters-drawer-content::-webkit-scrollbar-track {
      background: #0f1115;
    }
    .filters-drawer-content::-webkit-scrollbar-thumb {
      background: #3a3f4b;
      border-radius: 4px;
    }
    .filters-drawer-content::-webkit-scrollbar-thumb:hover {
      background: #4a5060;
    }
    
    /* Quick Actions */
    .quick-actions {
      display: flex;
      gap: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #2d3139;
    }
    
    .quick-actions sl-button {
      flex: 1;
    }
    
    /* Filter Group */
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px;
      background: #22252d;
      border: 1px solid #2d3139;
      border-radius: 12px;
      transition: all 0.2s ease;
    }
    
    .filter-group:hover {
      border-color: #3d4250;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .filter-group-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1rem;
      font-weight: 600;
      color: #e5e7eb;
      margin-bottom: 4px;
    }
    
    .filter-group-header sl-icon {
      font-size: 1.2rem;
      color: #60a5fa;
    }
    
    .filter-help {
      margin: 0;
      font-size: 0.8rem;
      color: #9ca3af;
      line-height: 1.4;
    }
    
    /* Range Grid */
    .range-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    
    /* Input Styling within Drawer */
    .filters-drawer sl-select,
    .filters-drawer sl-input {
      --sl-input-background-color: #1a1d24;
      --sl-input-background-color-hover: #22252d;
      --sl-input-background-color-focus: #22252d;
      --sl-input-border-color: #3d4250;
      --sl-input-border-color-hover: #4a5060;
      --sl-input-border-color-focus: #60a5fa;
      --sl-input-color: #e5e7eb;
      --sl-input-placeholder-color: #6b7280;
      --sl-panel-background-color: #1a1d24;
      --sl-color-neutral-0: #1a1d24;
      --sl-color-neutral-50: #22252d;
      --sl-color-neutral-100: #2d3139;
    }
    
    .filters-drawer sl-select::part(combobox),
    .filters-drawer sl-input::part(base) {
      background: #1a1d24;
      border: 1px solid #3d4250;
      border-radius: 8px;
      color: #e5e7eb;
      font-size: 0.95rem;
    }
    
    .filters-drawer sl-select::part(combobox):hover,
    .filters-drawer sl-input::part(base):hover {
      border-color: #4a5060;
      background: #22252d;
    }
    
    .filters-drawer sl-select::part(combobox):focus,
    .filters-drawer sl-input::part(base):focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
    }
    
    .filters-drawer sl-select::part(listbox) {
      background: #1a1d24;
      border: 1px solid #3d4250;
    }
    
    .filters-drawer sl-option::part(base) {
      background: #1a1d24;
      color: #e5e7eb;
    }
    
    .filters-drawer sl-option::part(base):hover {
      background: #2563eb;
      color: white;
    }
    
    .filters-drawer sl-option[aria-selected="true"]::part(base) {
      background: #1d4ed8;
      color: white;
    }
    
    .filters-drawer sl-input::part(prefix) {
      color: #9ca3af;
      font-weight: 500;
      font-size: 0.85rem;
    }
    
    /* Columns Menu */
    .columns-menu {
      background: var(--sl-panel-background-color);
      border: 1px solid var(--sl-color-neutral-200);
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
      color: var(--sl-color-neutral-700);
      border-bottom: 1px solid var(--sl-color-neutral-200);
      margin-bottom: 4px;
    }
    
    .column-toggle {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.15s ease;
    }
    
    .column-toggle:hover {
      background: var(--sl-color-neutral-100);
    }
    
    .column-toggle sl-checkbox {
      width: 100%;
    }
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

// actions
export interface PoeGeneralPricedListElement {
  applyTextFilter(): void;
  clearAllFilters(): void;
  clearAdvancedFilters(): void;
}

(PoeGeneralPricedListElement.prototype as any).applyTextFilter = function (this: PoeGeneralPricedListElement) {
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

(PoeGeneralPricedListElement.prototype as any).clearAllFilters = function (this: PoeGeneralPricedListElement) {
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

(PoeGeneralPricedListElement.prototype as any).clearAdvancedFilters = function (this: PoeGeneralPricedListElement) {
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
