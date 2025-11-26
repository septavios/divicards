use crate::{
    error::Error,
    event::{Event, ToastVariant},
};
use divi::{prices::Prices, Error as DiviError, TradeLeague};
use ninja::{
    fetch_stash_currency_overview, fetch_stash_dense_overviews_raw, fetch_stash_item_overview,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex, OnceLock,
};
use std::time::Instant;
use std::{collections::HashMap, fs, path::PathBuf};
use tauri::Window;
use tracing::{debug, info, instrument};

pub const MINUTE_AS_SECS: f64 = 60.0;
const UP_TO_DATE_THRESHOLD_MINUTES: f32 = 20.0;
const STILL_USABLE_THRESHOLD_MINUTES: f32 = 20.0;

pub enum LeagueFileState {
    UpToDate(Prices),
    StillUsable(Prices, f32),
    TooOld,
    Invalid,
    NoFile,
}

impl AppCardPrices {
    #[instrument(skip(self, window))]
    pub async fn get_price(&mut self, league: &TradeLeague, window: &Window) -> Prices {
        if let Some(prices) = self.prices_by_league.get(league) {
            return prices.to_owned();
        }

        match self.read_file(league) {
            LeagueFileState::UpToDate(prices) => prices,
            LeagueFileState::StillUsable(prices, minutes_old) => self
                .fetch_and_update(league)
                .await
                .unwrap_or_else(|_| {
                       let message = format!("Prices are not up-to-date, but still usable ({minutes_old:.0} minutes old). Unable to load new prices.");
                        Event::Toast {
                            variant: ToastVariant::Warning,
                            message,
                        }
                        .emit(window);
                        prices
                }),
            _ => self
                .fetch_and_update(league)
                .await
                .unwrap_or_else(|err| {
                    self.send_default_prices_with_toast_warning(&err, league, window)
                }),
        }
    }

    pub fn read_file(&self, league: &TradeLeague) -> LeagueFileState {
        if !self.league_file_exists(league) {
            return LeagueFileState::NoFile;
        }

        let Ok(prices) = self.read_from_file(league) else {
            return LeagueFileState::Invalid;
        };

        if let Some(minutes_old) = self.file_minutes_old(league) {
            match minutes_old {
                n if n <= UP_TO_DATE_THRESHOLD_MINUTES => LeagueFileState::UpToDate(prices),
                n if n <= STILL_USABLE_THRESHOLD_MINUTES => LeagueFileState::StillUsable(prices, n),
                _ => LeagueFileState::TooOld,
            }
        } else {
            LeagueFileState::NoFile
        }
    }

    pub fn read_league_file(&self, league: &TradeLeague) -> Result<Prices, Error> {
        let json = std::fs::read_to_string(self.league_path(league))?;
        let prices = serde_json::from_str::<Prices>(&json)?;
        Ok(prices)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppCardPrices {
    pub dir: PathBuf,
    pub prices_by_league: HashMap<TradeLeague, Prices>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapPrice {
    pub name: String,
    pub tier: u8,
    pub chaos_value: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamedPrice {
    pub name: String,
    pub chaos_value: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EssencePrice {
    pub name: String,
    pub variant: Option<String>,
    pub chaos_value: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GemPrice {
    pub name: String,
    pub level: u8,
    pub quality: u8,
    pub corrupt: bool,
    pub chaos_value: Option<f32>,
}

static GEM_TTL_SECS: OnceLock<AtomicU64> = OnceLock::new();

#[tauri::command]
#[instrument]
pub async fn map_prices(league: TradeLeague) -> Result<Vec<MapPrice>, Error> {
    let lines = fetch_stash_item_overview("Map", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    let mut out: Vec<MapPrice> = Vec::with_capacity(lines.len());
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let tier = v
            .get("mapTier")
            .and_then(Value::as_u64)
            .map(|n| n as u8)
            .unwrap_or(0);
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        if !name.is_empty() {
            out.push(MapPrice {
                name,
                tier,
                chaos_value,
            });
        }
    }
    info!(league = %league, count = out.len(), "map_prices fetched");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn currency_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "Currency" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert(name, chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_currency_overview("Currency", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("currencyTypeName")
            .and_then(Value::as_str)
            .or_else(|| v.get("name").and_then(Value::as_str))
            .unwrap_or("")
            .to_string();
        let chaos_value = v
            .get("chaosEquivalent")
            .and_then(Value::as_f64)
            .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
            .map(|n| n as f32);
        match map.get(&name) {
            None => {
                map.insert(name, chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert(name, chaos_value);
                }
            }
        }
    }
    let out: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();
    info!(league = %league, count = out.len(), "currency_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn fragment_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut out: Vec<NamedPrice> = Vec::new();

    let fragments_res = fetch_stash_currency_overview("Fragment", &league).await;
    if let Ok(fragments) = &fragments_res {
        for v in fragments.iter() {
            let name = v
                .get("currencyTypeName")
                .and_then(Value::as_str)
                .or_else(|| v.get("name").and_then(Value::as_str))
                .unwrap_or("")
                .to_string();
            let chaos_value = v
                .get("chaosEquivalent")
                .and_then(Value::as_f64)
                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                .map(|n| n as f32);
            if !name.is_empty() {
                out.push(NamedPrice { name, chaos_value });
            }
        }
    }

    let scarabs_res = fetch_stash_item_overview("Scarab", &league).await;
    if let Ok(scarabs) = &scarabs_res {
        for v in scarabs.iter() {
            let name = v
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();

            let chaos_value = v
                .get("chaosValue")
                .and_then(Value::as_f64)
                .map(|n| n as f32);
            if !name.is_empty() {
                out.push(NamedPrice { name, chaos_value });
            }
        }
    }

    let dense_res = ninja::fetch_stash_dense_overviews_flat(&league).await;
    if let Ok(lines) = &dense_res {
        for v in lines.iter() {
            let name = v
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let chaos_value = v
                .get("chaos")
                .and_then(Value::as_f64)
                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                .map(|n| n as f32);
            if !name.is_empty() {
                out.push(NamedPrice { name, chaos_value });
            }
        }
    }

    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    for p in out.into_iter() {
        match map.get(&p.name) {
            None => {
                map.insert(p.name, p.chaos_value);
            }
            Some(existing) => {
                let new = p.chaos_value;
                match (existing, new) {
                    (None, Some(_)) => {
                        map.insert(p.name, new);
                    }
                    (Some(ev), Some(nv)) => {
                        // Prefer the higher non-null price across sources (dense often more accurate)
                        if nv > *ev {
                            map.insert(p.name, Some(nv));
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    let result: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();

    if result.is_empty() {
        return Err(Error::DiviError(DiviError::NoPricesForLeagueOnNinja(
            league,
        )));
    }

    info!(league = %league, count = result.len(), "fragment_prices merged (classic + dense)");
    Ok(result)
}

#[tauri::command]
#[instrument]
pub async fn oil_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "Oil" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert(name, chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_item_overview("Oil", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        match map.get(&name) {
            None => {
                map.insert(name, chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert(name, chaos_value);
                }
            }
        }
    }
    let out: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();
    info!(league = %league, count = out.len(), "oil_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn incubator_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "Incubator" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert(name, chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_item_overview("Incubator", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        match map.get(&name) {
            None => {
                map.insert(name, chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert(name, chaos_value);
                }
            }
        }
    }
    let out: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();
    info!(league = %league, count = out.len(), "incubator_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn fossil_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "Fossil" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert(name, chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_item_overview("Fossil", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        match map.get(&name) {
            None => {
                map.insert(name, chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert(name, chaos_value);
                }
            }
        }
    }
    let out: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();
    info!(league = %league, count = out.len(), "fossil_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn divination_card_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "DivinationCard" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert(name, chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_item_overview("DivinationCard", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        match map.get(&name) {
            None => {
                map.insert(name, chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert(name, chaos_value);
                }
            }
        }
    }
    let out: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();
    info!(league = %league, count = out.len(), "divination_card_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn resonator_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "Resonator" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert(name, chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_item_overview("Resonator", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        match map.get(&name) {
            None => {
                map.insert(name, chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert(name, chaos_value);
                }
            }
        }
    }
    let out: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();
    info!(league = %league, count = out.len(), "resonator_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn delirium_orb_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "DeliriumOrb" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert(name, chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_item_overview("DeliriumOrb", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        match map.get(&name) {
            None => {
                map.insert(name, chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert(name, chaos_value);
                }
            }
        }
    }
    let out: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();
    info!(league = %league, count = out.len(), "delirium_orb_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn vial_prices(league: TradeLeague) -> Result<Vec<NamedPrice>, Error> {
    let mut map: std::collections::HashMap<String, Option<f32>> = std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "Vial" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert(name, chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_item_overview("Vial", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        match map.get(&name) {
            None => {
                map.insert(name, chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert(name, chaos_value);
                }
            }
        }
    }
    let out: Vec<NamedPrice> = map
        .into_iter()
        .map(|(name, chaos_value)| NamedPrice { name, chaos_value })
        .collect();
    info!(league = %league, count = out.len(), "vial_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn ninja_dense_overviews_raw(league: TradeLeague) -> Result<Value, Error> {
    let v = fetch_stash_dense_overviews_raw(&league)
        .await
        .map_err(DiviError::NinjaError)?;
    Ok(v)
}

#[tauri::command]
#[instrument]
pub async fn essence_prices(league: TradeLeague) -> Result<Vec<EssencePrice>, Error> {
    let mut map: std::collections::HashMap<(String, Option<String>), Option<f32>> =
        std::collections::HashMap::new();
    if let Ok(raw) = ninja::fetch_stash_dense_overviews_raw(&league).await {
        let arr = if raw.is_array() {
            raw.as_array().cloned()
        } else {
            raw.get("overviews").and_then(Value::as_array).cloned()
        };
        if let Some(categories) = arr {
            for cat in categories.into_iter() {
                let t = cat.get("type").and_then(Value::as_str).unwrap_or("");
                if t == "Essence" {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        for v in lines.iter() {
                            let name = v
                                .get("name")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let variant = v
                                .get("variant")
                                .and_then(Value::as_str)
                                .map(|s| s.to_string());
                            let chaos_value = v
                                .get("chaos")
                                .and_then(Value::as_f64)
                                .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                .map(|n| n as f32);
                            if !name.is_empty() {
                                map.insert((name, variant), chaos_value);
                            }
                        }
                    }
                }
            }
        }
    }
    let lines = fetch_stash_item_overview("Essence", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let variant = v
            .get("variant")
            .and_then(Value::as_str)
            .map(|s| s.to_string());
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        match map.get(&(name.clone(), variant.clone())) {
            None => {
                map.insert((name, variant), chaos_value);
            }
            Some(existing) => {
                if existing.is_none() && chaos_value.is_some() {
                    map.insert((name.clone(), variant.clone()), chaos_value);
                }
            }
        }
    }
    let out: Vec<EssencePrice> = map
        .into_iter()
        .map(|((name, variant), chaos_value)| EssencePrice {
            name,
            variant,
            chaos_value,
        })
        .collect();
    info!(league = %league, count = out.len(), "essence_prices dense-first");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub async fn gem_prices(league: TradeLeague) -> Result<Vec<GemPrice>, Error> {
    static GEM_CACHE: OnceLock<Mutex<HashMap<TradeLeague, (Vec<GemPrice>, Instant)>>> =
        OnceLock::new();
    let ttl_secs = GEM_TTL_SECS
        .get_or_init(|| AtomicU64::new(60 * 15))
        .load(Ordering::Relaxed);
    let cache = GEM_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    {
        let guard = cache.lock().unwrap();
        if let Some((data, ts)) = guard.get(&league).cloned() {
            if ts.elapsed().as_secs() < ttl_secs {
                info!(league = %league, count = data.len(), "gem_prices cached");
                return Ok(data);
            }
        }
        drop(guard);
    }

    let lines = fetch_stash_item_overview("SkillGem", &league)
        .await
        .map_err(DiviError::NinjaError)?;
    let mut out: Vec<GemPrice> = Vec::with_capacity(lines.len());
    for v in lines.into_iter() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let level = v
            .get("gemLevel")
            .and_then(Value::as_u64)
            .map(|n| n as u8)
            .unwrap_or(0);
        let quality = v
            .get("gemQuality")
            .and_then(Value::as_u64)
            .map(|n| n as u8)
            .unwrap_or(0);
        let corrupt = v.get("corrupted").and_then(Value::as_bool).unwrap_or(false);
        let chaos_value = v
            .get("chaosValue")
            .and_then(Value::as_f64)
            .map(|n| n as f32);
        if !name.is_empty() {
            out.push(GemPrice {
                name,
                level,
                quality,
                corrupt,
                chaos_value,
            });
        }
    }
    {
        let mut guard = GEM_CACHE
            .get_or_init(|| Mutex::new(HashMap::new()))
            .lock()
            .unwrap();
        guard.insert(league.to_owned(), (out.clone(), Instant::now()));
    }
    info!(league = %league, count = out.len(), "gem_prices fetched");
    Ok(out)
}

#[tauri::command]
#[instrument]
pub fn set_gem_prices_cache_ttl_minutes(minutes: u64) -> Result<(), Error> {
    let ttl = GEM_TTL_SECS.get_or_init(|| AtomicU64::new(60 * 15));
    ttl.store(minutes.saturating_mul(60), Ordering::Relaxed);
    info!(minutes, "set_gem_prices_cache_ttl_minutes");
    Ok(())
}
impl AppCardPrices {
    pub fn new(dir: PathBuf) -> Result<Self, Error> {
        if !dir.exists() {
            fs::create_dir_all(&dir)?;
        }
        Ok(AppCardPrices {
            dir,
            prices_by_league: HashMap::new(),
        })
    }

    #[instrument(skip(self, window))]
    fn send_default_prices_with_toast_warning(
        &self,
        err: &Error,
        league: &TradeLeague,
        window: &Window,
    ) -> Prices {
        Event::Toast {
            variant: ToastVariant::Warning,
            message: format!("{err} Unable to load prices for league {league}. Skip price-dependant calculations."),
        }
        .emit(window);
        Prices::default()
    }

    #[instrument(skip(self))]
    fn read_from_file_update_and_return(&mut self, league: &TradeLeague) -> Result<Prices, Error> {
        let json = std::fs::read_to_string(self.league_path(league))?;
        let prices = serde_json::from_str::<Prices>(&json)?;
        self.prices_by_league
            .insert(league.to_owned(), prices.clone());
        Ok(prices)
    }

    #[instrument(skip(self))]
    pub fn league_path(&self, league: &TradeLeague) -> PathBuf {
        self.dir.join(format!("{}-prices.json", { league }))
    }

    #[instrument(skip(self))]
    async fn fetch_and_update(&mut self, league: &TradeLeague) -> Result<Prices, Error> {
        let prices = Prices::fetch(league).await.map_err(DiviError::NinjaError)?;
        debug!("fetch_and_update: fetched. Serializing to json");
        let json = serde_json::to_string(&prices)?;

        debug!("fetch_and_update: Serialized. Next write to file");

        std::fs::write(self.league_path(league), json)?;

        debug!("fetch_and_update: wrote to file");
        self.prices_by_league
            .insert(league.to_owned(), prices.clone());

        Ok(prices)
    }

    #[instrument(skip(self))]
    fn read_from_file(&self, league: &TradeLeague) -> Result<Prices, Error> {
        let json = std::fs::read_to_string(self.league_path(league))?;
        let prices = serde_json::from_str::<Prices>(&json)?;
        Ok(prices)
    }

    #[instrument(skip(self))]
    fn file_is_up_to_date(&self, league: &TradeLeague) -> bool {
        match self.file_minutes_old(league) {
            Some(minutes_old) => minutes_old <= UP_TO_DATE_THRESHOLD_MINUTES,
            None => false,
        }
    }

    #[instrument(skip(self))]
    fn file_is_still_usable(&self, league: &TradeLeague) -> bool {
        match self.file_minutes_old(league) {
            Some(minutes_old) => minutes_old <= STILL_USABLE_THRESHOLD_MINUTES,
            None => false,
        }
    }

    #[instrument(skip(self))]
    fn file_minutes_old(&self, league: &TradeLeague) -> Option<f32> {
        let path = self.league_path(league);
        match fs::metadata(&path) {
            Ok(metadata) => match metadata.modified() {
                Ok(modified_time) => match modified_time.elapsed() {
                    Ok(duration) => Some((duration.as_secs_f64() / MINUTE_AS_SECS) as f32),
                    Err(_e) => {
                        // SystemTimeError: modified time is later than current time.
                        debug!(
                            "File {:?} modification time is in the future. Treating as needing update.",
                            path
                        );
                        None
                    }
                },
                Err(e) => {
                    debug!("Failed to read modification time for {:?}: {}", path, e);
                    None
                }
            },
            Err(e) => {
                debug!("Failed to read metadata for {:?}: {}", path, e);
                None
            }
        }
    }

    #[instrument(skip(self))]
    fn league_file_exists(&self, league: &TradeLeague) -> bool {
        self.league_path(league).try_exists().unwrap_or(false)
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceSourceRow {
    pub category: String,
    pub name: String,
    pub variant: Option<String>,
    pub tier: Option<u8>,
    pub dense: Option<f32>,
    pub dense_graph: Option<Vec<f64>>,
    pub currency_overview: Option<f32>,
    pub item_overview: Option<f32>,
    pub poewatch: Option<f32>,
}

fn poewatch_extract_price(v: &Value) -> Option<f32> {
    v.get("mean")
        .and_then(Value::as_f64)
        .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
        .or_else(|| v.get("chaos").and_then(Value::as_f64))
        .or_else(|| v.get("value").and_then(Value::as_f64))
        .map(|n| n as f32)
}

fn poewatch_extract_name(v: &Value) -> String {
    v.get("name")
        .and_then(Value::as_str)
        .or_else(|| v.get("baseType").and_then(Value::as_str))
        .unwrap_or("")
        .to_string()
}
fn norm(s: &str) -> String {
    s.trim().to_lowercase()
}

#[tauri::command]
#[instrument]
pub async fn price_sources_matrix(
    league: TradeLeague,
    include_low_confidence: Option<bool>,
) -> Result<Vec<PriceSourceRow>, Error> {
    let (
        dense_raw_res,
        currency_currency_res,
        currency_fragment_res,
        item_oil_res,
        item_incubator_res,
        item_fossil_res,
        item_divcard_res,
        item_resonator_res,
        item_delirium_res,
        item_vial_res,
        item_essence_res,
        item_scarab_res,
        item_map_res,
    ) = tokio::join!(
        ninja::fetch_stash_dense_overviews_raw(&league),
        fetch_stash_currency_overview("Currency", &league),
        fetch_stash_currency_overview("Fragment", &league),
        fetch_stash_item_overview("Oil", &league),
        fetch_stash_item_overview("Incubator", &league),
        fetch_stash_item_overview("Fossil", &league),
        fetch_stash_item_overview("DivinationCard", &league),
        fetch_stash_item_overview("Resonator", &league),
        fetch_stash_item_overview("DeliriumOrb", &league),
        fetch_stash_item_overview("Vial", &league),
        fetch_stash_item_overview("Essence", &league),
        fetch_stash_item_overview("Scarab", &league),
        fetch_stash_item_overview("Map", &league)
    );

    let dense_raw_res = dense_raw_res.ok();
    let currency_currency_res = currency_currency_res.ok();
    let currency_fragment_res = currency_fragment_res.ok();
    let item_oil_res = item_oil_res.ok();
    let item_incubator_res = item_incubator_res.ok();
    let item_fossil_res = item_fossil_res.ok();
    let item_divcard_res = item_divcard_res.ok();
    let item_resonator_res = item_resonator_res.ok();
    let item_delirium_res = item_delirium_res.ok();
    let item_vial_res = item_vial_res.ok();
    let item_essence_res = item_essence_res.ok();
    let item_scarab_res = item_scarab_res.ok();
    let item_map_res = item_map_res.ok();

    let mut dense_by_cat: std::collections::HashMap<String, Vec<Value>> =
        std::collections::HashMap::new();
    if let Some(raw) = dense_raw_res {
        // Debug: Log the top-level keys in the Dense API response
        if let Some(obj) = raw.as_object() {
            let keys: Vec<&String> = obj.keys().collect();
            info!(
                keys = ?keys,
                "Dense API response top-level keys"
            );
        }

        // Handle new Ninja API structure (currencyOverviews + itemOverviews)
        let mut process_overviews = |key: &str| {
            if let Some(arr) = raw.get(key).and_then(Value::as_array) {
                info!(
                    key = %key,
                    count = arr.len(),
                    "Found overview array in Dense API"
                );
                for cat in arr.iter() {
                    if let Some(t) = cat.get("type").and_then(Value::as_str) {
                        if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                            info!(
                                category = %t,
                                lines_count = lines.len(),
                                "Dense category found"
                            );
                            // Merge with existing category instead of replacing
                            dense_by_cat
                                .entry(t.to_string())
                                .and_modify(|existing| existing.extend(lines.clone()))
                                .or_insert_with(|| lines.clone());
                        }
                    }
                }
            }
        };

        process_overviews("currencyOverviews");
        process_overviews("itemOverviews");

        // Fallback for older structure or if it changes back
        if let Some(arr) = raw.get("overviews").and_then(Value::as_array) {
            info!(count = arr.len(), "Found 'overviews' array in Dense API");
            for cat in arr.iter() {
                if let Some(t) = cat.get("type").and_then(Value::as_str) {
                    if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                        dense_by_cat.insert(t.to_string(), lines.clone());
                    }
                }
            }
        } else if raw.is_array() {
            info!("Dense API response is a direct array");
            if let Some(arr) = raw.as_array() {
                for cat in arr.iter() {
                    if let Some(t) = cat.get("type").and_then(Value::as_str) {
                        if let Some(lines) = cat.get("lines").and_then(Value::as_array) {
                            dense_by_cat.insert(t.to_string(), lines.clone());
                        }
                    }
                }
            }
        }

        // Debug: Log what categories were extracted
        let categories: Vec<&String> = dense_by_cat.keys().collect();
        info!(
            categories = ?categories,
            total_categories = dense_by_cat.len(),
            "Dense categories extracted"
        );
    }

    let mut rows: Vec<PriceSourceRow> = Vec::new();

    static POEWATCH_TTL_SECS: OnceLock<AtomicU64> = OnceLock::new();
    static POEWATCH_CACHE: OnceLock<Mutex<HashMap<(String, String, bool), (Vec<Value>, Instant)>>> =
        OnceLock::new();
    POEWATCH_TTL_SECS
        .get_or_init(|| AtomicU64::new(60 * 10))
        .load(Ordering::Relaxed);
    async fn poewatch_items_cached(
        league: &TradeLeague,
        category: &str,
        _include_low_confidence: bool,
    ) -> Option<Vec<Value>> {
        // Note: include_low_confidence is not currently supported by the public API we are using, but kept in signature for cache key compatibility if needed.
        let key = (
            format!("{}", league),
            category.to_string(),
            _include_low_confidence,
        );
        let cache = POEWATCH_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        if let Some((data, ts)) = cache.lock().unwrap().get(&key).cloned() {
            if ts.elapsed().as_secs()
                < POEWATCH_TTL_SECS
                    .get_or_init(|| AtomicU64::new(60 * 10))
                    .load(Ordering::Relaxed)
            {
                return Some(data);
            }
        }
        // Updated URL to api.poe.watch/get
        let url = "https://api.poe.watch/get";
        let client = reqwest::Client::new();
        let resp = client
            .get(url)
            .query(&[
                ("league", format!("{}", league)),
                ("category", category.to_string()),
            ])
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let v = resp.json::<Value>().await.ok()?;
        let arr = if v.is_array() {
            v.as_array().cloned()
        } else {
            None
        }?;
        {
            let mut guard = POEWATCH_CACHE
                .get_or_init(|| Mutex::new(HashMap::new()))
                .lock()
                .unwrap();
            guard.insert(key, (arr.clone(), Instant::now()));
        }
        Some(arr)
    }

    let low_conf = include_low_confidence.unwrap_or(false);
    let poewatch_currency = poewatch_items_cached(&league, "currency", low_conf).await;
    if let Some(lines) = dense_by_cat.get("Currency") {
        // Debug: Log all Dense Currency items to see what's available
        info!(count = lines.len(), "Dense Currency items available");
        for v in lines.iter() {
            if let Some(name) = v.get("name").and_then(Value::as_str) {
                if name.contains("Mirror") {
                    let chaos = v
                        .get("chaos")
                        .and_then(Value::as_f64)
                        .or_else(|| v.get("chaosValue").and_then(Value::as_f64));
                    info!(
                        name = %name,
                        chaos = ?chaos,
                        raw_item = ?v,
                        "Dense Currency item with 'Mirror' in name (from Dense API)"
                    );
                }
            }
        }

        let mut names: std::collections::HashSet<String> = std::collections::HashSet::new();
        for v in lines.iter() {
            if let Some(n) = v.get("name").and_then(Value::as_str) {
                names.insert(n.to_string());
            }
        }
        if let Some(cur) = currency_currency_res.as_ref() {
            for v in cur.iter() {
                let n = v
                    .get("currencyTypeName")
                    .and_then(Value::as_str)
                    .or_else(|| v.get("name").and_then(Value::as_str))
                    .unwrap_or("")
                    .to_string();
                if !n.is_empty() {
                    names.insert(n);
                }
            }
        }
        for name in names.into_iter() {
            let (dense, dense_graph) = lines
                .iter()
                .find_map(|v| {
                    if v.get("name").and_then(Value::as_str) == Some(&name[..]) {
                        let price = v
                            .get("chaos")
                            .and_then(Value::as_f64)
                            .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                            .map(|n| n as f32);
                        let graph = v
                            .get("graph")
                            .and_then(Value::as_array)
                            .map(|arr| arr.iter().filter_map(|v| v.as_f64()).collect::<Vec<f64>>());
                        Some((price, graph))
                    } else {
                        None
                    }
                })
                .unwrap_or((None, None));

            // Debug logging for Mirror of Kalandra
            if name.contains("Mirror") {
                info!(
                    name = %name,
                    dense = ?dense,
                    has_graph = ?dense_graph.is_some(),
                    graph_len = ?dense_graph.as_ref().map(|g| g.len()),
                    "Currency item with 'Mirror' in name - Result"
                );
            }

            let cov = currency_currency_res.as_ref().and_then(|cur| {
                for v in cur.iter() {
                    let nn = v
                        .get("currencyTypeName")
                        .and_then(Value::as_str)
                        .or_else(|| v.get("name").and_then(Value::as_str))
                        .unwrap_or("");
                    if nn == name {
                        return v
                            .get("chaosEquivalent")
                            .and_then(Value::as_f64)
                            .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                            .map(|n| n as f32);
                    }
                }
                None
            });
            let pw = poewatch_currency.as_ref().and_then(|arr| {
                for v in arr.iter() {
                    let nn = poewatch_extract_name(v);
                    if nn == name || norm(&nn) == norm(&name) {
                        return poewatch_extract_price(v);
                    }
                }
                None
            });
            rows.push(PriceSourceRow {
                category: "Currency".to_string(),
                name,
                variant: None,
                tier: None,
                dense,
                dense_graph,
                currency_overview: cov,
                item_overview: None,
                poewatch: pw,
            });
        }
    }

    let poewatch_fragment = poewatch_items_cached(&league, "fragment", low_conf).await;
    if let Some(lines) = dense_by_cat.get("Fragment") {
        let mut names: std::collections::HashSet<String> = std::collections::HashSet::new();
        for v in lines.iter() {
            if let Some(n) = v.get("name").and_then(Value::as_str) {
                names.insert(n.to_string());
            }
        }
        if let Some(cur) = currency_fragment_res.as_ref() {
            for v in cur.iter() {
                let n = v
                    .get("currencyTypeName")
                    .and_then(Value::as_str)
                    .or_else(|| v.get("name").and_then(Value::as_str))
                    .unwrap_or("")
                    .to_string();
                if !n.is_empty() {
                    names.insert(n);
                }
            }
        }
        if let Some(scarabs) = item_scarab_res.as_ref() {
            for v in scarabs.iter() {
                let n = v
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !n.is_empty() {
                    names.insert(n);
                }
            }
        }
        for name in names.into_iter() {
            let (dense, dense_graph) = lines
                .iter()
                .find_map(|v| {
                    if v.get("name").and_then(Value::as_str) == Some(&name[..]) {
                        let price = v
                            .get("chaos")
                            .and_then(Value::as_f64)
                            .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                            .map(|n| n as f32);
                        let graph = v
                            .get("graph")
                            .and_then(Value::as_array)
                            .map(|arr| arr.iter().filter_map(|v| v.as_f64()).collect::<Vec<f64>>());
                        Some((price, graph))
                    } else {
                        None
                    }
                })
                .unwrap_or((None, None));
            let cov = currency_fragment_res.as_ref().and_then(|cur| {
                for v in cur.iter() {
                    let nn = v
                        .get("currencyTypeName")
                        .and_then(Value::as_str)
                        .or_else(|| v.get("name").and_then(Value::as_str))
                        .unwrap_or("");
                    if nn == name {
                        return v
                            .get("chaosEquivalent")
                            .and_then(Value::as_f64)
                            .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                            .map(|n| n as f32);
                    }
                }
                None
            });
            let iov = item_scarab_res.as_ref().and_then(|scarabs| {
                for v in scarabs.iter() {
                    let nn = v.get("name").and_then(Value::as_str).unwrap_or("");
                    if nn == name {
                        return v
                            .get("chaosValue")
                            .and_then(Value::as_f64)
                            .map(|n| n as f32);
                    }
                }
                None
            });
            let pw = poewatch_fragment.as_ref().and_then(|arr| {
                for v in arr.iter() {
                    let nn = poewatch_extract_name(v);
                    if nn == name || norm(&nn) == norm(&name) {
                        return poewatch_extract_price(v);
                    }
                }
                None
            });
            rows.push(PriceSourceRow {
                category: "Fragment".to_string(),
                name,
                variant: None,
                tier: None,
                dense,
                dense_graph,
                currency_overview: cov,
                item_overview: iov,
                poewatch: pw,
            });
        }
    }

    let poewatch_oil = poewatch_items_cached(&league, "oil", low_conf).await;
    let poewatch_incubator = poewatch_items_cached(&league, "incubator", low_conf).await;
    let poewatch_fossil = poewatch_items_cached(&league, "fossil", low_conf).await;
    let poewatch_card = poewatch_items_cached(&league, "card", low_conf).await;
    let poewatch_resonator = poewatch_items_cached(&league, "resonator", low_conf).await;
    let poewatch_delirium = poewatch_items_cached(&league, "deliriumorb", low_conf).await;
    let poewatch_vial = poewatch_items_cached(&league, "vial", low_conf).await;
    for (cat_name, item_res, pw_res_opt) in [
        ("Oil", item_oil_res.as_ref(), poewatch_oil.as_ref()),
        (
            "Incubator",
            item_incubator_res.as_ref(),
            poewatch_incubator.as_ref(),
        ),
        ("Fossil", item_fossil_res.as_ref(), poewatch_fossil.as_ref()),
        (
            "DivinationCard",
            item_divcard_res.as_ref(),
            poewatch_card.as_ref(),
        ),
        (
            "Resonator",
            item_resonator_res.as_ref(),
            poewatch_resonator.as_ref(),
        ),
        (
            "DeliriumOrb",
            item_delirium_res.as_ref(),
            poewatch_delirium.as_ref(),
        ),
        ("Vial", item_vial_res.as_ref(), poewatch_vial.as_ref()),
    ] {
        let dense_lines = dense_by_cat.get(cat_name);
        let mut names: std::collections::HashSet<String> = std::collections::HashSet::new();
        if let Some(lines) = dense_lines {
            for v in lines.iter() {
                if let Some(n) = v.get("name").and_then(Value::as_str) {
                    names.insert(n.to_string());
                }
            }
        }
        if let Some(items) = item_res {
            for v in items.iter() {
                let n = v
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !n.is_empty() {
                    names.insert(n);
                }
            }
        }
        for name in names.into_iter() {
            let (dense, dense_graph) = dense_lines
                .map(|lines| {
                    lines
                        .iter()
                        .find_map(|v| {
                            if v.get("name").and_then(Value::as_str) == Some(&name[..]) {
                                let price = v
                                    .get("chaos")
                                    .and_then(Value::as_f64)
                                    .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                                    .map(|n| n as f32);
                                let graph = v.get("graph").and_then(Value::as_array).map(|arr| {
                                    arr.iter().filter_map(|v| v.as_f64()).collect::<Vec<f64>>()
                                });
                                Some((price, graph))
                            } else {
                                None
                            }
                        })
                        .unwrap_or((None, None))
                })
                .unwrap_or((None, None));
            let iov = item_res.and_then(|items| {
                for v in items.iter() {
                    let nn = v.get("name").and_then(Value::as_str).unwrap_or("");
                    if nn == name {
                        return v
                            .get("chaosValue")
                            .and_then(Value::as_f64)
                            .map(|n| n as f32);
                    }
                }
                None
            });
            let pw = pw_res_opt.and_then(|arr| {
                for v in arr.iter() {
                    let nn = poewatch_extract_name(v);
                    if nn == name || norm(&nn) == norm(&name) {
                        return poewatch_extract_price(v);
                    }
                }
                None
            });
            rows.push(PriceSourceRow {
                category: cat_name.to_string(),
                name,
                variant: None,
                tier: None,
                dense,
                dense_graph,
                currency_overview: None,
                item_overview: iov,
                poewatch: pw,
            });
        }
    }

    let poewatch_essence = poewatch_items_cached(&league, "essence", low_conf).await;
    if let Some(dense_lines) = dense_by_cat.get("Essence") {
        let mut keys: std::collections::HashSet<(String, Option<String>)> =
            std::collections::HashSet::new();
        for v in dense_lines.iter() {
            let name = v
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let variant = v
                .get("variant")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            if !name.is_empty() {
                keys.insert((name, variant));
            }
        }
        if let Some(items) = item_essence_res.as_ref() {
            for v in items.iter() {
                let name = v
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let variant = v
                    .get("variant")
                    .and_then(Value::as_str)
                    .map(|s| s.to_string());
                if !name.is_empty() {
                    keys.insert((name, variant));
                }
            }
        }
        for (name, variant) in keys.into_iter() {
            let (dense, dense_graph) = dense_lines
                .iter()
                .find_map(|v| {
                    let nn = v.get("name").and_then(Value::as_str).unwrap_or("");
                    let vv = v.get("variant").and_then(Value::as_str);
                    if nn == name && vv.map(|s| s.to_string()) == variant {
                        let price = v
                            .get("chaos")
                            .and_then(Value::as_f64)
                            .or_else(|| v.get("chaosValue").and_then(Value::as_f64))
                            .map(|n| n as f32);
                        let graph = v
                            .get("graph")
                            .and_then(Value::as_array)
                            .map(|arr| arr.iter().filter_map(|v| v.as_f64()).collect::<Vec<f64>>());
                        Some((price, graph))
                    } else {
                        None
                    }
                })
                .unwrap_or((None, None));
            let iov = item_essence_res.as_ref().and_then(|items| {
                for v in items.iter() {
                    let nn = v.get("name").and_then(Value::as_str).unwrap_or("");
                    let vv = v
                        .get("variant")
                        .and_then(Value::as_str)
                        .map(|s| s.to_string());
                    if nn == name && vv == variant {
                        return v
                            .get("chaosValue")
                            .and_then(Value::as_f64)
                            .map(|n| n as f32);
                    }
                }
                None
            });
            let pw = poewatch_essence.as_ref().and_then(|arr| {
                for v in arr.iter() {
                    let nn = poewatch_extract_name(v);
                    let vv = v
                        .get("variant")
                        .and_then(Value::as_str)
                        .map(|s| s.to_string());
                    if (nn == name && vv == variant) || (norm(&nn) == norm(&name) && vv == variant)
                    {
                        return poewatch_extract_price(v);
                    }
                    if let Some(ref var) = variant {
                        let combo = format!("{} {}", var, name);
                        if nn == combo || norm(&nn) == norm(&combo) {
                            return poewatch_extract_price(v);
                        }
                    }
                }
                None
            });
            let (derived_tier, derived_variant) = get_essence_tier(&name)
                .map(|(t, v)| (Some(t), Some(v)))
                .unwrap_or((None, None));

            rows.push(PriceSourceRow {
                category: "Essence".to_string(),
                name,
                variant: variant.or(derived_variant),
                tier: derived_tier,
                dense,
                dense_graph,
                currency_overview: None,
                item_overview: iov,
                poewatch: pw,
            });
        }
    }

    let poewatch_map = poewatch_items_cached(&league, "map", low_conf).await;
    if let Some(items) = item_map_res.as_ref() {
        let mut names: std::collections::HashSet<(String, u8)> = std::collections::HashSet::new();
        for v in items.iter() {
            let name = v
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let tier = v
                .get("mapTier")
                .and_then(Value::as_u64)
                .map(|n| n as u8)
                .unwrap_or(0);
            if !name.is_empty() {
                names.insert((name, tier));
            }
        }
        for (name, tier) in names.into_iter() {
            let iov = items.iter().find_map(|v| {
                let nn = v.get("name").and_then(Value::as_str).unwrap_or("");
                let tt = v
                    .get("mapTier")
                    .and_then(Value::as_u64)
                    .map(|n| n as u8)
                    .unwrap_or(0);
                if nn == name && tt == tier {
                    v.get("chaosValue")
                        .and_then(Value::as_f64)
                        .map(|n| n as f32)
                } else {
                    None
                }
            });
            let pw = poewatch_map.as_ref().and_then(|arr| {
                for v in arr.iter() {
                    let nn = poewatch_extract_name(v);
                    let tt = v
                        .get("mapTier")
                        .and_then(Value::as_u64)
                        .map(|n| n as u8)
                        .or_else(|| v.get("tier").and_then(Value::as_u64).map(|n| n as u8))
                        .unwrap_or(0);
                    if (nn == name || norm(&nn) == norm(&name)) && tt == tier {
                        return poewatch_extract_price(v);
                    }
                }
                None
            });
            rows.push(PriceSourceRow {
                category: "Map".to_string(),
                name,
                variant: None,
                tier: Some(tier),
                dense: None,
                dense_graph: None,
                currency_overview: None,
                item_overview: iov,
                poewatch: pw,
            });
        }
    }

    Ok(rows)
}

fn get_essence_tier(name: &str) -> Option<(u8, String)> {
    if name.starts_with("Deafening") {
        return Some((1, "Deafening".to_string()));
    }
    if name.starts_with("Shrieking") {
        return Some((2, "Shrieking".to_string()));
    }
    if name.starts_with("Screaming") {
        return Some((3, "Screaming".to_string()));
    }
    if name.starts_with("Wailing") {
        return Some((4, "Wailing".to_string()));
    }
    if name.starts_with("Weeping") {
        return Some((5, "Weeping".to_string()));
    }
    if name.starts_with("Muttering") {
        return Some((6, "Muttering".to_string()));
    }
    if name.starts_with("Whispering") {
        return Some((7, "Whispering".to_string()));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn poewatch_extract_price_prefers_mean() {
        let v = serde_json::json!({ "mean": 12.3, "chaosValue": 9.0, "chaos": 8.0, "value": 7.0 });
        assert_eq!(poewatch_extract_price(&v), Some(12.3));
    }

    #[test]
    fn poewatch_extract_price_fallbacks_work() {
        let v = serde_json::json!({ "chaosValue": 9.0 });
        assert_eq!(poewatch_extract_price(&v), Some(9.0));
        let v = serde_json::json!({ "chaos": 8.0 });
        assert_eq!(poewatch_extract_price(&v), Some(8.0));
        let v = serde_json::json!({ "value": 7.0 });
        assert_eq!(poewatch_extract_price(&v), Some(7.0));
        let v = serde_json::json!({});
        assert_eq!(poewatch_extract_price(&v), None);
    }

    #[test]
    fn poewatch_extract_name_prefers_name_then_basetype() {
        let v = serde_json::json!({ "name": "Divine Orb", "baseType": "Divine Orb BT" });
        assert_eq!(poewatch_extract_name(&v), "Divine Orb".to_string());
        let v = serde_json::json!({ "baseType": "Exalted Orb" });
        assert_eq!(poewatch_extract_name(&v), "Exalted Orb".to_string());
        let v = serde_json::json!({});
        assert_eq!(poewatch_extract_name(&v), "".to_string());
    }

    #[test]
    fn norm_trims_and_lowercases() {
        assert_eq!(norm("  Exalted Orb \n"), "exalted orb".to_string());
    }

    #[test]
    fn test_price_comparison_logic() {
        // Test equal prices
        let v1 = serde_json::json!({ "mean": 10.0 });
        let v2 = serde_json::json!({ "chaosValue": 10.0 });
        assert_eq!(poewatch_extract_price(&v1), poewatch_extract_price(&v2));

        // Test significant difference
        let v_high = serde_json::json!({ "mean": 100.0 });
        let v_low = serde_json::json!({ "mean": 10.0 });
        let p_high = poewatch_extract_price(&v_high).unwrap();
        let p_low = poewatch_extract_price(&v_low).unwrap();
        assert!(p_high > p_low);
        assert!((p_high - p_low).abs() > 0.001);

        // Test floating point precision
        let v_float = serde_json::json!({ "mean": 10.123456 });
        let p_float = poewatch_extract_price(&v_float).unwrap();
        assert!((p_float - 10.123456).abs() < 0.0001);
    }

    #[test]
    fn test_edge_cases() {
        // Null values
        let v_null = serde_json::json!({ "mean": null });
        assert_eq!(poewatch_extract_price(&v_null), None);

        // Missing fields
        let v_missing = serde_json::json!({ "other": 10.0 });
        assert_eq!(poewatch_extract_price(&v_missing), None);

        // Mixed types (should handle gracefully if json is malformed/unexpected type)
        let v_str = serde_json::json!({ "mean": "10.0" }); // String instead of number
        assert_eq!(poewatch_extract_price(&v_str), None); // Should be None as it expects f64
    }

    #[test]
    fn test_poewatch_extract_name_edge_cases() {
        let v_empty = serde_json::json!({});
        assert_eq!(poewatch_extract_name(&v_empty), "");

        let v_null_name = serde_json::json!({ "name": null });
        assert_eq!(poewatch_extract_name(&v_null_name), "");
    }
}
