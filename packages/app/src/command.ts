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
}

const { format } = new Intl.NumberFormat();
const isDev = !!(import.meta as any).env?.DEV;
export const resolveBaseUrl = (): string => {
	const envUrl = (import.meta as any).env?.VITE_API_URL;
	if (envUrl) return envUrl;
	if (typeof window !== 'undefined' && window.location?.origin) {
		try {
			const url = new URL(window.location.origin);
			url.port = '3000';
			url.pathname = '/api';
			return url.toString().replace(/\/$/, '');
		} catch {
			return 'http://localhost:3000/api';
		}
	}
	return 'http://localhost:3000/api';
};
export const isTauri = (): boolean => {
	return (
		(typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ != null) ||
		(typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri')) ||
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env &&
			((import.meta as any).env.TAURI_PLATFORM ?? (import.meta as any).env.TAURI))
	);
};

export const command = async <CommandName extends keyof Commands>(
    name: CommandName,
    args?: Parameters<Commands[CommandName]>[0]
): Promise<ReturnType<Commands[CommandName]>> => {
    if (isTauri()) {
        return invoke(name, args) as Promise<ReturnType<Commands[CommandName]>>;
    }

    // Web Implementation
    const baseUrl = resolveBaseUrl();
    // console.log(`[Web API] Calling ${name} with args`, args);

    if (name === 'stashes') {
        const league = args ? (args as any).league : 'Standard';
        const token = localStorage.getItem('access_token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token.trim()}` } : {};
        
        return fetch(`${baseUrl}/stashes?league=${league}`, { headers }).then(async r => {
            if (!r.ok) throw await r.json();
            return r.json();
        }) as any;
    }
    
    if (name === 'sample_from_tab') {
        if (!args) throw new Error('Helpers: sample_from_tab requires args');
        const query = new URLSearchParams(args as any).toString();
        const token = localStorage.getItem('access_token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token.trim()}` } : {};

        return fetch(`${baseUrl}/sample_from_tab?${query}`, { headers }).then(async r => {
            if (!r.ok) throw await r.json();
            return r.json();
        }) as any;
    }

    if (name === 'tab_with_items') {
        if (!args) throw new Error('Helpers: tab_with_items requires args');
        const query = new URLSearchParams(args as any).toString();
        const token = localStorage.getItem('access_token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token.trim()}` } : {};

        return fetch(`${baseUrl}/tab_with_items?${query}`, { headers })
            .then(async r => {
                const text = await r.text();
                if (!r.ok) {
                     // Try to parse error as JSON, otherwise throw status text
                    try {
                        throw JSON.parse(text);
                    } catch (e) {
                        throw new Error(`Server error ${r.status}: ${text}`);
                    }
                }
                return JSON.parse(text);
            })
            .catch(err => {
                if (isDev) {
                    console.warn(`[Web API] tab_with_items fetch failed, using mock.`, err);
                    return mockInvoke('tab_with_items', args as any);
                }
                throw err;
            }) as any;
    }

    if (name === 'divination_card_prices') {
        const league = (args as any)?.league;
        const query = league ? `?league=${encodeURIComponent(league)}` : '';
        return fetch(`${baseUrl}/prices/divination_card${query}`).then(r => r.json()) as any;
    }

    if (name === 'currency_prices') {
        const league = (args as any)?.league;
        const query = league ? `?league=${encodeURIComponent(league)}` : '';
        return fetch(`${baseUrl}/prices/currency${query}`).then(r => r.json()) as any;
    }

    console.warn(`[Web API] Command ${name} not implemented, returning mock or throwing.`);
    // Fallback Mock Logic or Error
    return mockInvoke(name, args as any) as any;
};

async function mockInvoke(name: string, arg: Record<string, unknown>): Promise<unknown> {
    switch (name) {
        case 'version':
            return 'dev-web';
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
        case 'poe_auth': {
            // PKCE Helpers
            const generateRandomString = (length: number) => {
                const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
                let text = '';
                for (let i = 0; i < length; i++) {
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                }
                return text;
            };

            const sha256 = async (plain: string) => {
                const encoder = new TextEncoder();
                const data = encoder.encode(plain);
                return window.crypto.subtle.digest('SHA-256', data);
            };

            const base64UrlEncode = (a: ArrayBuffer) => {
                // @ts-ignore
                return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');
            };

            const state = generateRandomString(16);
            const verifier = generateRandomString(64);

            const hashed = await sha256(verifier);
            const challenge = base64UrlEncode(hashed);

            localStorage.setItem('oauth_state', state);
            localStorage.setItem('pkce_verifier', verifier);

            const redirectUri = typeof window !== 'undefined'
                ? `${window.location.origin}/callback`
                : 'http://localhost:50151/callback';
            const params = new URLSearchParams({
                client_id: 'divicards',
                response_type: 'code',
                scope: 'account:stashes',
                state: state,
                redirect_uri: redirectUri,
                code_challenge: challenge,
                code_challenge_method: 'S256',
            });

            window.location.href = `https://www.pathofexile.com/oauth/authorize?${params.toString()}`;
            return 'redirecting';
        }
        case 'poe_logout':
            localStorage.removeItem('access_token');
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
        case 'tab_with_items': {
            return {
                id: 'mock-tab',
                name: 'Mock Tab',
                type: 'NormalStash',
                index: 0,
                items: [
                    {
                        id: 'item-1',
                        baseType: 'The Nurse',
                        typeLine: 'The Nurse',
                        stackSize: 8,
                        icon: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvRGl2aW5hdGlvbi9JbnZlbnRvcnlJY29uIiwidyI6MSwiaCI6MSwic2NhbGUiOjF9XQ/0c3d9a7.png',
                        w: 1,
                        h: 1,
                        x: 0,
                        y: 0,
                        ilvl: 0,
                        league: 'Standard',
                        name: '',
                        identified: true,
                    },
                    {
                        id: 'item-2',
                        baseType: 'The Doctor',
                        typeLine: 'The Doctor',
                        stackSize: 2,
                        icon: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvRGl2aW5hdGlvbi9UaGVEb2N0b3IiLCJ3IjoxLCJoIjoxLCJzY2FsZSI6MX1d/2b531f6.png',
                        w: 1,
                        h: 1,
                        x: 1,
                        y: 0,
                        ilvl: 0,
                        league: 'Standard',
                        name: '',
                        identified: true,
                    },
                     {
                        id: 'item-3',
                        baseType: 'House of Mirrors',
                        typeLine: 'House of Mirrors',
                        stackSize: 1,
                        icon: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvRGl2aW5hdGlvbi9Ib3VzZU9mTWlycm9ycyIsInciOjEsImgiOjEsInNjYWxlIjoxfV0/34e8d28.png',
                        w: 1,
                        h: 1,
                        x: 2,
                        y: 0,
                        ilvl: 0,
                        league: 'Standard',
                        name: '',
                        identified: true,
                    }
                ],
                color: '888888',
            };
        }
        default:
            throw new Error(`Unsupported command: ${name}`);
    }
}
