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
    gem_prices: (args: { league: League }) => Array<{ name: string; level: number; quality: number; chaos_value: number | null }>;
    oil_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    incubator_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    fossil_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    resonator_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    delirium_orb_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    vial_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    divination_card_prices: (args: { league: League }) => Array<{ name: string; chaos_value: number | null }>;
    ninja_dense_overviews_raw: (args: { league: League }) => Record<string, unknown>;
    set_gem_prices_cache_ttl_minutes: (args: { minutes: number }) => void;
    wealth_snapshot: (args: { league: League; tabs: Array<{ stash_id: string; substash_id?: string | null }> }) => {
        timestamp: number;
        league: string;
        total_chaos: number;
        total_divines: number | null;
        by_category: Record<string, { chaos: number }>;
    };
    list_snapshots: (args: { league: League; limit?: number }) => Array<{
        timestamp: number;
        league: string;
        total_chaos: number;
        total_divines: number | null;
        by_category: Record<string, { chaos: number }>;
    }>;
    wealth_snapshot_cached: (args: { league: League; tabs: Array<TabWithItems> }) => {
        timestamp: number;
        league: string;
        total_chaos: number;
        total_divines: number | null;
        by_category: Record<string, { chaos: number }>;
    };
    clear_snapshots: (args: { league: League }) => void;
}

const { format } = new Intl.NumberFormat();

const debug = false;
export const command = async <CommandName extends keyof Commands, Fn extends Commands[CommandName]>(
    name: CommandName,
    ...args: Parameters<Fn>
): Promise<ReturnType<Fn>> => {
    const isTauri =
        (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ != null) ||
        (typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri')) ||
        (typeof import.meta !== 'undefined' && (import.meta as any).env && ((import.meta as any).env.TAURI_PLATFORM ?? (import.meta as any).env.TAURI));
    if (isTauri) {
        if (debug) {
            const t0 = performance.now();
            const res = (await invoke(name, ...args)) as ReturnType<Fn>;
            console.log(`${name}: ${format(performance.now() - t0)}ms`);
            return res;
        } else return invoke(name, ...args) as Promise<ReturnType<Fn>>;
    }
    const r = await mockInvoke(name as string, args[0] as Record<string, unknown>);
    return r as ReturnType<Fn>;
};

let webSqlReady: Promise<any> | null = null;
let webSqlDb: any | null = null;
const idbName = 'divicards-web-sqlite';
const idbStore = 'sqlite';

async function idbGet(): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(idbName, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(idbStore)) db.createObjectStore(idbStore);
        };
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(idbStore, 'readonly');
            const store = tx.objectStore(idbStore);
            const getReq = store.get('db');
            getReq.onerror = () => reject(getReq.error);
            getReq.onsuccess = () => {
                const val = getReq.result as ArrayBuffer | undefined;
                resolve(val ? new Uint8Array(val) : null);
                db.close();
            };
        };
    });
}

async function idbSet(bytes: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(idbName, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(idbStore)) db.createObjectStore(idbStore);
        };
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(idbStore, 'readwrite');
            const store = tx.objectStore(idbStore);
            const putReq = store.put(bytes.buffer, 'db');
            putReq.onerror = () => reject(putReq.error);
            putReq.onsuccess = () => {
                resolve();
                db.close();
            };
        };
    });
}

async function getWebDb(): Promise<any> {
    if (webSqlDb) return webSqlDb;
    if (!webSqlReady) {
        webSqlReady = (async () => {
            const initSqlJs = (await import('sql.js')).default;
            const SQL = await initSqlJs({ locateFile: (f: string) => `https://sql.js.org/dist/${f}` });
            const existing = await idbGet();
            webSqlDb = existing ? new SQL.Database(existing) : new SQL.Database();
            webSqlDb.run(
                'CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INTEGER NOT NULL, league TEXT NOT NULL, total_chaos REAL NOT NULL, total_divines REAL, json TEXT NOT NULL)'
            );
            return SQL;
        })();
    }
    await webSqlReady;
    return webSqlDb;
}

async function persistWebDb(): Promise<void> {
    if (!webSqlDb) return;
    const bytes: Uint8Array = webSqlDb.export();
    await idbSet(bytes);
}

async function mockInvoke(name: string, arg: Record<string, unknown>): Promise<unknown> {
    switch (name) {
        case 'version':
            return 'dev-web';
        case 'poe_has_token':
            return false;
        case 'google_has_token':
            return false;
        case 'google_identity':
            return { given_name: 'Web', name: 'Web User', id: 'web', picture: '', locale: 'en' };
        case 'stashes':
            return {
                stashes: [
                    { id: 'tabA', index: 0, name: 'Tab A', type: 'NormalStash', selected: false },
                    { id: 'tabB', index: 1, name: 'Tab B', type: 'NormalStash', selected: false },
                ],
            };
        case 'tab_with_items': {
            const id = (arg?.stashId as string) ?? 'tabA';
            const idx = id === 'tabA' ? 0 : 1;
            const league = (arg?.league as string) ?? 'Standard';
            const items = [
                {
                    typeLine: 'Chaos Orb',
                    baseType: 'Chaos Orb',
                    stackSize: 12,
                    w: 1,
                    h: 1,
                    x: 0,
                    y: 0,
                    identified: true,
                    league,
                },
                {
                    typeLine: 'Vaal Orb',
                    baseType: 'Vaal Orb',
                    stackSize: 5,
                    w: 1,
                    h: 1,
                    x: 1,
                    y: 0,
                    identified: true,
                    league,
                },
                {
                    typeLine: 'Ancient Orb',
                    baseType: 'Ancient Orb',
                    stackSize: 2,
                    w: 1,
                    h: 1,
                    x: 2,
                    y: 0,
                    identified: true,
                    league,
                },
            ];
            return { id, index: idx, name: id, type: 'NormalStash', items };
        }
        case 'sample_from_tab': {
            const sample = {
                cards: [],
                notCards: [],
                fixedNames: [],
            } as const;
            return sample;
        }
        case 'sample_into_csv': {
            const prefs = (arg?.preferences ?? {}) as { columns?: string[] };
            const cols = (prefs.columns ?? ['name', 'amount']) as string[];
            const sample = (arg?.sample ?? {}) as { cards?: Array<Record<string, any>> };
            const cards = Array.isArray(sample.cards) ? sample.cards : [];
            const header = cols.join(',');
            const lines = cards.map(c =>
                cols
                    .map(k => {
                        const v = c[k];
                        if (v === null || v === undefined) return '';
                        return typeof v === 'string' ? v.replaceAll(',', ';') : String(v);
                    })
                    .join(',')
            );
            return [header, ...lines].join('\n');
        }
        case 'map_prices':
            return [];
        case 'currency_prices':
            return [
                { name: 'Chaos Orb', chaos_value: 60 },
                { name: 'Vaal Orb', chaos_value: 5 },
                { name: 'Ancient Orb', chaos_value: 15 },
            ];
        case 'fragment_prices':
            return [];
        case 'essence_prices':
            return [];
        case 'gem_prices':
            return [];
        case 'oil_prices':
            return [];
        case 'incubator_prices':
            return [];
        case 'fossil_prices':
            return [];
        case 'resonator_prices':
            return [];
        case 'delirium_orb_prices':
            return [];
        case 'vial_prices':
            return [];
        case 'divination_card_prices':
            return [];
        case 'ninja_dense_overviews_raw':
            return {};
        case 'set_gem_prices_cache_ttl_minutes':
            return;
        case 'wealth_snapshot': {
            const league = (arg?.league as string) ?? 'Standard';
            const tabs = (arg?.tabs as Array<{ stash_id: string; substash_id?: string | null }>) ?? [];
            const priceMap: Record<string, number> = {
                'Chaos Orb': 60,
                'Vaal Orb': 5,
                'Ancient Orb': 15,
            };
            let total_chaos = 0;
            let by_category: Record<string, { chaos: number }> = {};
            const add = (name: string, qty: number, category: string) => {
                const val = (priceMap[name] ?? 0) * qty;
                if (!by_category[category]) by_category[category] = { chaos: 0 };
                by_category[category].chaos += val;
                total_chaos += val;
            };
            for (const ref of tabs) {
                const id = ref.stash_id;
                if (id === 'tabA') {
                    add('Chaos Orb', 12, 'currency');
                    add('Vaal Orb', 5, 'currency');
                    add('Ancient Orb', 2, 'currency');
                } else if (id === 'tabB') {
                    add('Chaos Orb', 6, 'currency');
                }
            }
            const snapshot = {
                timestamp: Math.floor(Date.now() / 1000),
                league,
                total_chaos,
                total_divines: null,
                by_category,
            } as const;
            const db = await getWebDb();
            const json = JSON.stringify(snapshot);
            const stmt = db.prepare('INSERT INTO snapshots (timestamp, league, total_chaos, total_divines, json) VALUES (?, ?, ?, ?, ?)');
            stmt.run([snapshot.timestamp, league, total_chaos, null, json]);
            stmt.free();
            await persistWebDb();
            return snapshot;
        }
        case 'list_snapshots': {
            const league = (arg?.league as string) ?? 'Standard';
            const limit = (arg?.limit as number) ?? 10;
            const db = await getWebDb();
            const stmt = db.prepare('SELECT json FROM snapshots WHERE league = ? ORDER BY timestamp DESC LIMIT ?');
            const rows: Array<any> = [];
            stmt.bind([league, limit]);
            while (stmt.step()) {
                const row = stmt.getAsObject() as { json: string };
                rows.push(JSON.parse(row.json));
            }
            stmt.free();
            return rows as Array<{
                timestamp: number;
                league: string;
                total_chaos: number;
                total_divines: number | null;
                by_category: Record<string, { chaos: number }>;
            }>;
        }
        case 'wealth_snapshot_cached': {
            const league = (arg?.league as string) ?? 'Standard';
            const tabs = (arg?.tabs as Array<TabWithItems>) ?? [];
            const priceMap: Record<string, number> = {
                'Chaos Orb': 60,
                'Vaal Orb': 5,
                'Ancient Orb': 15,
            };
            let total_chaos = 0;
            let by_category: Record<string, { chaos: number }> = {};
            const add = (name: string, qty: number, category: string) => {
                const val = (priceMap[name] ?? 0) * qty;
                if (!by_category[category]) by_category[category] = { chaos: 0 };
                by_category[category].chaos += val;
                total_chaos += val;
            };
            for (const tab of tabs) {
                const kind = (tab.type ?? 'NormalStash') as string;
                for (const item of tab.items ?? []) {
                    const name = (item.baseType as string) ?? '';
                    const qty = Number(item.stackSize ?? 1);
                    let category = 'other';
                    if (kind === 'CurrencyStash') category = 'currency';
                    add(name, qty, category);
                }
            }
            const snapshot = {
                timestamp: Math.floor(Date.now() / 1000),
                league,
                total_chaos,
                total_divines: null,
                by_category,
            } as const;
            const db = await getWebDb();
            const json = JSON.stringify(snapshot);
            const stmt = db.prepare('INSERT INTO snapshots (timestamp, league, total_chaos, total_divines, json) VALUES (?, ?, ?, ?, ?)');
            stmt.run([snapshot.timestamp, league, total_chaos, null, json]);
            stmt.free();
            await persistWebDb();
            return snapshot;
        }
        case 'clear_snapshots': {
            const league = (arg?.league as string) ?? 'Standard';
            const db = await getWebDb();
            const stmt = db.prepare('DELETE FROM snapshots WHERE league = ?');
            stmt.run([league]);
            stmt.free();
            await persistWebDb();
            return;
        }
        case 'google_logout':
            return;
        case 'google_identity':
            return { name: '', email: '', picture: '' };
        case 'google_auth':
            return;
        case 'old_google_auth':
            return;
        case 'open_url':
            return;
        case 'poe_auth':
            return '';
        case 'poe_logout':
            return;
        case 'sample': {
            const sample = {
                cards: [],
                notCards: [],
                fixedNames: [],
            } as const;
            return sample;
        }
        case 'merge': {
            const sample = {
                cards: [],
                notCards: [],
                fixedNames: [],
            } as const;
            return sample;
        }
        default:
            throw new Error(`Unsupported command: ${name}`);
    }
}
