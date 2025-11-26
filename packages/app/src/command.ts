import { invoke } from '@tauri-apps/api/core';
import {
    DivinationCardsSample,
    League,
    NameAmount,
    TradeLeague,
    GoogleIdentity,
    TablePreferences,
    Column,
} from '@divicards/shared/types.js';
import { NoItemsTab, TabWithItems } from 'poe-custom-elements/types.js';

export type SampleData = string | NameAmount[] | DivinationCardsSample;
export type ValueRange = {
    majorDimension: 'ROWS' | 'COLUMNS';
    range: string;
    values: Array<Array<string | number | null | undefined>>;
};
type Preferences = Omit<TablePreferences, 'columns'> & { columns: Column[] };

export interface Commands {
    version: () => string;
    poe_has_token: () => boolean;
    biometric_authenticate: () => void;
    read_batch(args: { spreadsheetId: string; ranges: string[] }): unknown;
    read_sheet(args: { spreadsheetId: string; range: string }): ValueRange;
    new_sheet_with_sample: (args: {
        spreadsheetId: string;
        title: string;
        sample: DivinationCardsSample;
        league: League;
        preferences: Preferences;
    }) => string;
    google_logout: () => void;
    google_identity: () => GoogleIdentity;
    google_has_token: () => boolean;
    google_auth: () => void;
    old_google_auth: () => void;
    sample: (args: { data: SampleData; league: TradeLeague | null }) => DivinationCardsSample;
    merge: (args: { samples: DivinationCardsSample[] }) => DivinationCardsSample;
    open_url: (args: { url: string }) => void;
    poe_auth: () => string;
    poe_logout: () => void;
    stashes: (args: { league: League }) => { stashes: NoItemsTab[] };
    sample_into_csv: (args: { sample: DivinationCardsSample; preferences: Preferences }) => string;
    sample_from_tab: (args: { league: League; stashId: string; subStashId?: string }) => DivinationCardsSample;
    tab_with_items: (args: { league: League; stashId: string; subStashId?: string }) => TabWithItems;
    extract_cards: (args: { tab: TabWithItems; league: League }) => DivinationCardsSample;
    map_prices: (args: { league: League }) => Array<{ name: string; tier: number; chaos_value: number | null }>;
    currency_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    fragment_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    essence_prices: (args: { league: League }) => Array<{ name: string; variant: string | null; chaos_value: number | null }>;
    gem_prices: (args: { league: League }) => Array<{ name: string; level: number; quality: number; corrupt?: boolean; chaos_value: number | null }>;
    oil_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    incubator_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    fossil_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    resonator_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    delirium_orb_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    vial_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    divination_card_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    ninja_dense_overviews_raw: (args: { league: League }) => Record<string, unknown>;
    price_sources_matrix: (args: { league: League; include_low_confidence?: boolean }) => Array<{ category: string; name: string; variant?: string | null; tier?: number | null; dense?: number | null; currency_overview?: number | null; item_overview?: number | null; poewatch?: number | null }>;
    set_gem_prices_cache_ttl_minutes: (args: { minutes: number }) => void;
    price_variance_cached: (args: { league: League; tabs: Array<TabWithItems>; baseline_item_prices?: Record<string, number>; baseline_by_category?: Record<string, { chaos: number }>; baseline_inventory?: Record<string, number> }) => { mode: 'item' | 'category' | 'inventory'; changes: any[]; totalVariance?: number };
    wealth_snapshot: (args: { league: League; tabs: Array<{ stash_id: string; substash_id?: string | null }> }) => {
        timestamp: number;
        league: string;
        total_chaos: number;
        total_divines: number | null;
        by_category: Record<string, { chaos: number }>;
        item_prices?: Record<string, number>;
    };
    list_snapshots: (args: {
        league: League;
        limit?: number;
        offset?: number;
        start_timestamp?: number;
        end_timestamp?: number;
    }) => Array<{
        timestamp: number;
        league: string;
        total_chaos: number;
        total_divines: number | null;
        by_category: Record<string, { chaos: number }>;
        item_prices?: Record<string, number>;
    }>;
    count_snapshots: (args: {
        league: League;
        start_timestamp?: number;
        end_timestamp?: number;
    }) => number;
    clear_snapshot_cache: () => void;
    delete_all_snapshots: (args: { league?: string }) => number;
    wealth_snapshot_cached: (args: { league: League; tabs: Array<TabWithItems> }) => {
        timestamp: number;
        league: string;
        total_chaos: number;
        total_divines: number | null;
        by_category: Record<string, { chaos: number }>;
        item_prices?: Record<string, number>;
    };


}

const { format } = new Intl.NumberFormat();

const debug = false;
export const command = async <CommandName extends keyof Commands, Fn extends Commands[CommandName]>(
    name: CommandName,
    ...args: Parameters<Fn>
): Promise<ReturnType<Fn>> => {
    if (debug) {
        const t0 = performance.now();
        const res = (await invoke(name, ...args)) as ReturnType<Fn>;
        console.log(`${name}: ${format(performance.now() - t0)}ms`);
        return res;
    }
    return invoke(name, ...args) as Promise<ReturnType<Fn>>;
};
