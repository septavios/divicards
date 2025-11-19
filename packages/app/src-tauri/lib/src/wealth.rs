use crate::{error::Error, poe::stash, poe::types::StashType, prices, version::AppVersion};
use chrono::Utc;
use divi::{League, TradeLeague};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, State, Window};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabRef {
    pub stash_id: String,
    pub substash_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryTotals {
    pub chaos: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WealthSnapshot {
    pub timestamp: i64,
    pub league: TradeLeague,
    pub total_chaos: f32,
    pub total_divines: Option<f32>,
    pub by_category: HashMap<String, CategoryTotals>,
}

fn db_path() -> std::path::PathBuf {
    let base = dirs::data_dir().unwrap_or(std::env::current_dir().unwrap());
    base.join("divicards").join("wealth.sqlite")
}

fn ensure_db() -> Result<Connection, Error> {
    let path = db_path();
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    let conn = Connection::open(path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            league TEXT NOT NULL,
            total_chaos REAL NOT NULL,
            total_divines REAL,
            json TEXT NOT NULL
        )",
        [],
    )?;
    Ok(conn)
}

#[command]
pub async fn wealth_snapshot(
    league: TradeLeague,
    tabs: Vec<TabRef>,
    prices_state: State<'_, Mutex<prices::AppCardPrices>>,
    version: State<'_, AppVersion>,
    window: Window,
) -> Result<WealthSnapshot, Error> {
    let ll: League = league.clone().into();

    let currency_prices = prices::currency_prices(league.clone()).await.unwrap_or_default();
    let fragment_prices = prices::fragment_prices(league.clone()).await.unwrap_or_default();
    let oil_prices = prices::oil_prices(league.clone()).await.unwrap_or_default();
    let incubator_prices = prices::incubator_prices(league.clone()).await.unwrap_or_default();
    let fossil_prices = prices::fossil_prices(league.clone()).await.unwrap_or_default();
    let card_prices = prices::divination_card_prices(league.clone()).await.unwrap_or_default();
    let resonator_prices = prices::resonator_prices(league.clone()).await.unwrap_or_default();
    let delirium_orb_prices = prices::delirium_orb_prices(league.clone()).await.unwrap_or_default();
    let vial_prices = prices::vial_prices(league.clone()).await.unwrap_or_default();
    let map_prices = prices::map_prices(league.clone()).await.unwrap_or_default();
    let gem_prices = prices::gem_prices(league.clone()).await.unwrap_or_default();

    let mut currency_map: HashMap<String, f32> = HashMap::new();
    for p in currency_prices.into_iter() { if let Some(v) = p.chaos_value { currency_map.insert(p.name, v); } }
    let divine_price = currency_map.get("Divine Orb").copied();

    let mut frags_map: HashMap<String, f32> = HashMap::new();
    for p in fragment_prices.into_iter() { if let Some(v) = p.chaos_value { frags_map.insert(p.name, v); } }
    let mut oils_map: HashMap<String, f32> = HashMap::new();
    for p in oil_prices.into_iter() { if let Some(v) = p.chaos_value { oils_map.insert(p.name, v); } }
    let mut incubators_map: HashMap<String, f32> = HashMap::new();
    for p in incubator_prices.into_iter() { if let Some(v) = p.chaos_value { incubators_map.insert(p.name, v); } }
    let mut fossils_map: HashMap<String, f32> = HashMap::new();
    for p in fossil_prices.into_iter() { if let Some(v) = p.chaos_value { fossils_map.insert(p.name, v); } }
    let mut cards_map: HashMap<String, f32> = HashMap::new();
    for p in card_prices.into_iter() { if let Some(v) = p.chaos_value { cards_map.insert(p.name, v); } }
    let mut resonators_map: HashMap<String, f32> = HashMap::new();
    for p in resonator_prices.into_iter() { if let Some(v) = p.chaos_value { resonators_map.insert(p.name, v); } }
    let mut delirium_map: HashMap<String, f32> = HashMap::new();
    for p in delirium_orb_prices.into_iter() { if let Some(v) = p.chaos_value { delirium_map.insert(p.name, v); } }
    let mut vials_map: HashMap<String, f32> = HashMap::new();
    for p in vial_prices.into_iter() { if let Some(v) = p.chaos_value { vials_map.insert(p.name, v); } }
    let mut maps_map: HashMap<(String, u8), f32> = HashMap::new();
    for p in map_prices.into_iter() { if let Some(v) = p.chaos_value { maps_map.insert((p.name, p.tier), v); } }
    let mut gems_map: HashMap<(String, u8, u8), f32> = HashMap::new();
    for p in gem_prices.into_iter() { if let Some(v) = p.chaos_value { gems_map.insert((p.name, p.level, p.quality), v); } }

    let mut by_category: HashMap<String, CategoryTotals> = HashMap::new();
    let mut total_chaos: f32 = 0.0;

    for tr in tabs.into_iter() {
        let tab = loop {
            match stash::tab_with_items(ll.clone(), tr.stash_id.clone(), tr.substash_id.clone(), version.clone()).await {
                Ok(tab) => break tab,
                Err(Error::RetryAfter(secs)) => {
                    let secs: u64 = secs.parse().unwrap_or(1);
                    sleep(Duration::from_secs(secs + 1)).await;
                    continue;
                }
                Err(err) => return Err(err),
            }
        };
        sleep(Duration::from_millis(1100)).await;
        let kind = tab.kind().unwrap_or(StashType::Other);
        for item in tab.items() {
            let name = item.base_type().unwrap_or("").to_string();
            let qty = item.stack_size().unwrap_or(1) as f32;
            let mut category = String::from("other");
            let mut price: Option<f32> = None;
            match kind {
                StashType::CurrencyStash => { category = String::from("currency"); price = currency_map.get(&name).copied(); }
                StashType::FragmentStash => { category = String::from("fragments"); price = frags_map.get(&name).copied(); }
                StashType::DivinationCardStash => { category = String::from("cards"); price = cards_map.get(&name).copied(); }
                StashType::MapStash => {
                    category = String::from("maps");
                    let tier = item.map_tier().unwrap_or(0);
                    price = maps_map.get(&(name.clone(), tier)).copied().or_else(|| maps_map.get(&(name.clone(), 0)).copied());
                }
                StashType::EssenceStash => { category = String::from("essences"); price = fossils_map.get(&name).copied(); }
                _ => {
                    price = oils_map.get(&name).copied()
                        .or_else(|| incubators_map.get(&name).copied())
                        .or_else(|| resonators_map.get(&name).copied())
                        .or_else(|| delirium_map.get(&name).copied())
                        .or_else(|| vials_map.get(&name).copied());
                }
            }
            if price.is_none() {
                if let Some(v) = gems_map.get(&(name.clone(), item.gem_level().unwrap_or(0), item.gem_quality().unwrap_or(0))).copied() {
                    category = String::from("gems");
                    price = Some(v);
                }
            }
            let item_chaos = price.unwrap_or(0.0) * qty;
            if item_chaos > 0.0 {
                total_chaos += item_chaos;
                let entry = by_category.entry(category).or_insert(CategoryTotals { chaos: 0.0 });
                entry.chaos += item_chaos;
            }
        }
    }

    let total_divines = divine_price.map(|d| if d > 0.0 { total_chaos / d } else { 0.0 });
    let snapshot = WealthSnapshot {
        timestamp: Utc::now().timestamp(),
        league,
        total_chaos,
        total_divines,
        by_category,
    };

    let conn = ensure_db()?;
    let json = serde_json::to_string(&snapshot)?;
    conn.execute(
        "INSERT INTO snapshots (timestamp, league, total_chaos, total_divines, json) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![snapshot.timestamp, format!("{}", snapshot.league), snapshot.total_chaos, snapshot.total_divines, json],
    )?;

    crate::event::Event::Toast { variant: crate::event::ToastVariant::Success, message: "Snapshot captured".to_string() }.emit(&window);
    Ok(snapshot)
}

#[command]
pub async fn wealth_snapshot_cached(
    league: TradeLeague,
    tabs: Vec<crate::poe::types::TabWithItems>,
    prices_state: State<'_, Mutex<prices::AppCardPrices>>, // kept for parity
    window: Window,
) -> Result<WealthSnapshot, Error> {
    let currency_prices = prices::currency_prices(league.clone()).await.unwrap_or_default();
    let fragment_prices = prices::fragment_prices(league.clone()).await.unwrap_or_default();
    let oil_prices = prices::oil_prices(league.clone()).await.unwrap_or_default();
    let incubator_prices = prices::incubator_prices(league.clone()).await.unwrap_or_default();
    let fossil_prices = prices::fossil_prices(league.clone()).await.unwrap_or_default();
    let card_prices = prices::divination_card_prices(league.clone()).await.unwrap_or_default();
    let resonator_prices = prices::resonator_prices(league.clone()).await.unwrap_or_default();
    let delirium_orb_prices = prices::delirium_orb_prices(league.clone()).await.unwrap_or_default();
    let vial_prices = prices::vial_prices(league.clone()).await.unwrap_or_default();
    let map_prices = prices::map_prices(league.clone()).await.unwrap_or_default();
    let gem_prices = prices::gem_prices(league.clone()).await.unwrap_or_default();

    let mut currency_map: HashMap<String, f32> = HashMap::new();
    for p in currency_prices.into_iter() { if let Some(v) = p.chaos_value { currency_map.insert(p.name, v); } }
    let divine_price = currency_map.get("Divine Orb").copied();

    let mut frags_map: HashMap<String, f32> = HashMap::new();
    for p in fragment_prices.into_iter() { if let Some(v) = p.chaos_value { frags_map.insert(p.name, v); } }
    let mut oils_map: HashMap<String, f32> = HashMap::new();
    for p in oil_prices.into_iter() { if let Some(v) = p.chaos_value { oils_map.insert(p.name, v); } }
    let mut incubators_map: HashMap<String, f32> = HashMap::new();
    for p in incubator_prices.into_iter() { if let Some(v) = p.chaos_value { incubators_map.insert(p.name, v); } }
    let mut fossils_map: HashMap<String, f32> = HashMap::new();
    for p in fossil_prices.into_iter() { if let Some(v) = p.chaos_value { fossils_map.insert(p.name, v); } }
    let mut cards_map: HashMap<String, f32> = HashMap::new();
    for p in card_prices.into_iter() { if let Some(v) = p.chaos_value { cards_map.insert(p.name, v); } }
    let mut resonators_map: HashMap<String, f32> = HashMap::new();
    for p in resonator_prices.into_iter() { if let Some(v) = p.chaos_value { resonators_map.insert(p.name, v); } }
    let mut delirium_map: HashMap<String, f32> = HashMap::new();
    for p in delirium_orb_prices.into_iter() { if let Some(v) = p.chaos_value { delirium_map.insert(p.name, v); } }
    let mut vials_map: HashMap<String, f32> = HashMap::new();
    for p in vial_prices.into_iter() { if let Some(v) = p.chaos_value { vials_map.insert(p.name, v); } }
    let mut maps_map: HashMap<(String, u8), f32> = HashMap::new();
    for p in map_prices.into_iter() { if let Some(v) = p.chaos_value { maps_map.insert((p.name, p.tier), v); } }
    let mut gems_map: HashMap<(String, u8, u8), f32> = HashMap::new();
    for p in gem_prices.into_iter() { if let Some(v) = p.chaos_value { gems_map.insert((p.name, p.level, p.quality), v); } }

    let mut by_category: HashMap<String, CategoryTotals> = HashMap::new();
    let mut total_chaos: f32 = 0.0;

    for tab in tabs.into_iter() {
        let kind = tab.kind().unwrap_or(crate::poe::types::StashType::Other);
        for item in tab.items() {
            let name = item.base_type().unwrap_or("").to_string();
            let qty = item.stack_size().unwrap_or(1) as f32;
            let mut category = String::from("other");
            let mut price: Option<f32> = None;
            match kind {
                crate::poe::types::StashType::CurrencyStash => { category = String::from("currency"); price = currency_map.get(&name).copied(); }
                crate::poe::types::StashType::FragmentStash => { category = String::from("fragments"); price = frags_map.get(&name).copied(); }
                crate::poe::types::StashType::DivinationCardStash => { category = String::from("cards"); price = cards_map.get(&name).copied(); }
                crate::poe::types::StashType::MapStash => {
                    category = String::from("maps");
                    let tier = item.map_tier().unwrap_or(0);
                    price = maps_map.get(&(name.clone(), tier)).copied().or_else(|| maps_map.get(&(name.clone(), 0)).copied());
                }
                crate::poe::types::StashType::EssenceStash => { category = String::from("essences"); price = fossils_map.get(&name).copied(); }
                _ => {
                    price = oils_map.get(&name).copied()
                        .or_else(|| incubators_map.get(&name).copied())
                        .or_else(|| resonators_map.get(&name).copied())
                        .or_else(|| delirium_map.get(&name).copied())
                        .or_else(|| vials_map.get(&name).copied());
                }
            }
            if price.is_none() {
                if let Some(v) = gems_map.get(&(name.clone(), item.gem_level().unwrap_or(0), item.gem_quality().unwrap_or(0))).copied() {
                    category = String::from("gems");
                    price = Some(v);
                }
            }
            let item_chaos = price.unwrap_or(0.0) * qty;
            if item_chaos > 0.0 {
                total_chaos += item_chaos;
                let entry = by_category.entry(category).or_insert(CategoryTotals { chaos: 0.0 });
                entry.chaos += item_chaos;
            }
        }
    }

    let total_divines = divine_price.map(|d| if d > 0.0 { total_chaos / d } else { 0.0 });
    let snapshot = WealthSnapshot {
        timestamp: Utc::now().timestamp(),
        league,
        total_chaos,
        total_divines,
        by_category,
    };

    let conn = ensure_db()?;
    let json = serde_json::to_string(&snapshot)?;
    conn.execute(
        "INSERT INTO snapshots (timestamp, league, total_chaos, total_divines, json) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![snapshot.timestamp, format!("{}", snapshot.league), snapshot.total_chaos, snapshot.total_divines, json],
    )?;

    crate::event::Event::Toast { variant: crate::event::ToastVariant::Success, message: "Snapshot captured".to_string() }.emit(&window);
    Ok(snapshot)
}

#[command]
pub async fn list_snapshots(
    league: TradeLeague,
    limit: Option<i64>,
) -> Result<Vec<WealthSnapshot>, Error> {
    let conn = ensure_db()?;
    let mut stmt = conn.prepare("SELECT json FROM snapshots WHERE league = ?1 ORDER BY timestamp DESC LIMIT ?2")?;
    let rows = stmt.query_map(params![format!("{}", league), limit.unwrap_or(10)], |row| {
        let json: String = row.get(0)?;
        let snap: WealthSnapshot = serde_json::from_str(&json).unwrap_or(WealthSnapshot {
            timestamp: 0,
            league: league.clone(),
            total_chaos: 0.0,
            total_divines: None,
            by_category: HashMap::new(),
        });
        Ok(snap)
    })?;
    let mut out: Vec<WealthSnapshot> = Vec::new();
    for r in rows { out.push(r?); }
    Ok(out)
}
