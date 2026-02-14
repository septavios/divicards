use super::types::TabNoItems;
use crate::{
    error::Error,
    poe::{error::AuthError, types::TabWithItems, API_URL},
    prices::AppCardPrices,
    version::AppVersion,
};

#[cfg(feature = "desktop")]
use crate::poe::{AccessTokenStorage, Persist};

use divi::{
    prices::Prices,
    sample::{Input, Sample},
    {League, TradeLeague},
};
use reqwest::{Client, RequestBuilder, StatusCode};
use serde::Deserialize;

#[cfg(feature = "desktop")]
use tauri::{command, State, Window};
#[cfg(feature = "desktop")]
use tokio::sync::Mutex;
#[cfg(feature = "desktop")]
use tracing::instrument;

#[cfg(feature = "desktop")]
#[instrument(skip(prices, window))]
#[command]
pub async fn sample_from_tab(
    league: League,
    stash_id: String,
    substash_id: Option<String>,
    prices: State<'_, Mutex<AppCardPrices>>,
    version: State<'_, AppVersion>,
    window: Window,
) -> Result<Sample, Error> {
    let token = AccessTokenStorage::new()
        .get()
        .map_err(|_| Error::AuthError(AuthError::Failed("Missing access token".to_string())))?;
    let tab = StashAPI::tab_with_items(
        &league,
        stash_id.clone(),
        substash_id,
        version.inner(),
        &token,
    )
    .await?;

    let prices = match TradeLeague::try_from(league.clone()) {
        Ok(league) => {
            let mut guard = prices.lock().await;
            guard.get_price(&league, &window).await
        }
        Err(_) => Prices::default(),
    };

    let sample = Sample::create(Input::from(tab), Some(prices)).map_err(|divi_err| {
        Error::StashTabError {
            stash_id,
            league,
            message: divi_err.to_string(),
        }
    })?;
    Ok(sample)
}

#[cfg(feature = "desktop")]
#[instrument]
#[command]
pub async fn tab_with_items(
    league: League,
    stash_id: String,
    substash_id: Option<String>,
    version: State<'_, AppVersion>,
) -> Result<TabWithItems, Error> {
    let token = AccessTokenStorage::new()
        .get()
        .map_err(|_| Error::AuthError(AuthError::Failed("Missing access token".to_string())))?;
    let tab = StashAPI::tab_with_items(
        &league,
        stash_id.clone(),
        substash_id.clone(),
        version.inner(),
        &token,
    )
    .await?;
    let item_count = tab.items().count();
    let map_count = tab
        .items()
        .filter(|i| i.base_type().is_some_and(|b| b.ends_with(" Map")))
        .count();
    tracing::info!(
        league = %league,
        stash_id = %stash_id,
        substash_id = ?substash_id,
        items = item_count,
        maps = map_count,
        "tab_with_items response"
    );
    Ok(tab)
}

#[cfg(feature = "desktop")]
#[command]
pub async fn extract_cards(
    tab: TabWithItems,
    league: League,
    prices: State<'_, Mutex<AppCardPrices>>,
    window: Window,
) -> Result<Sample, Error> {
    let prices = match TradeLeague::try_from(league.clone()) {
        Ok(league) => {
            let mut guard = prices.lock().await;
            guard.get_price(&league, &window).await
        }
        Err(_) => Prices::default(),
    };

    let tab_id = tab.id().unwrap_or_else(|_| "No tab id".to_string());
    let sample = Sample::create(Input::from(tab), Some(prices)).map_err(|divi_err| {
        Error::StashTabError {
            stash_id: tab_id,
            league,
            message: divi_err.to_string(),
        }
    })?;
    Ok(sample)
}

#[cfg(feature = "desktop")]
#[instrument]
#[command]
pub async fn stashes(league: League, version: State<'_, AppVersion>) -> Result<TabNoItems, Error> {
    let token = AccessTokenStorage::new()
        .get()
        .map_err(|_| Error::AuthError(AuthError::Failed("Missing access token".to_string())))?;
    StashAPI::stashes(league, version.inner(), &token).await
}

pub struct StashAPI;
impl StashAPI {
    pub async fn tab_with_items(
        league: &League,
        stash_id: String,
        substash_id: Option<String>,
        version: &AppVersion,
        access_token: &str,
    ) -> Result<TabWithItems, Error> {
        let url = match substash_id {
            Some(substash_id) => {
                format!("{API_URL}/stash/{league}/{stash_id}/{substash_id}")
            }
            None => format!("{API_URL}/stash/{league}/{stash_id}"),
        };

        let response = StashAPI::with_auth_headers(&url, version, access_token)
            .send()
            .await?;

        let headers = &response.headers();
        if let Some(s) = headers.get("retry-after") {
            let s = s.to_str().unwrap().to_owned();
            return Err(Error::RetryAfter(s));
        }
        if let Some(limit_account_header) = headers.get("x-rate-limit-account") {
            if let Some(limit_account_state_header) = headers.get("x-rate-limit-account-state") {
                println!(
                    "x-rate-limit-account: {limit_account_header:?}, x-rate-limit-account-state: {limit_account_state_header:?}"
                );
            };
        };

        if response.status() == StatusCode::UNAUTHORIZED
            || response.status() == StatusCode::FORBIDDEN
        {
            let msg = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(Error::AuthError(AuthError::Failed(msg)));
        }

        #[derive(Deserialize)]
        struct ResponseShape {
            stash: TabWithItems,
        }

        let response_shape = response.json::<ResponseShape>().await?;
        Ok(response_shape.stash)
    }

    pub async fn stashes(
        league: League,
        version: &AppVersion,
        access_token: &str,
    ) -> Result<TabNoItems, Error> {
        let url = format!("{API_URL}/stash/{league}");
        let response = StashAPI::with_auth_headers(&url, version, access_token)
            .send()
            .await?;

        if response.status() == StatusCode::UNAUTHORIZED
            || response.status() == StatusCode::FORBIDDEN
        {
            let msg = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(Error::AuthError(AuthError::Failed(msg)));
        }

        Ok(response.json().await?)
    }

    fn with_auth_headers(url: &str, version: &AppVersion, access_token: &str) -> RequestBuilder {
        let client = Client::new().get(url).header(
            "User-Agent",
            format!("OAuth divicards/{} (contact: poeshonya3@gmail.com)", {
                version
            }),
        );

        let token = access_token.trim();
        println!(
            "STASH_DEBUG: Token Len: {}, Type: {}",
            token.len(),
            if token.len() == 32 {
                "Cookie"
            } else {
                "Bearer"
            }
        );

        // POESESSID is exactly 32 characters (MD5/hex)
        if token.len() == 32 {
            client.header("Cookie", format!("POESESSID={}", token))
        } else {
            client.header("Authorization", format!("Bearer {}", token))
        }
    }
}

#[cfg(feature = "desktop")]
#[instrument]
#[command]
pub async fn tab(
    league: League,
    stash_id: String,
    version: State<'_, AppVersion>,
) -> Result<TabWithItems, Error> {
    let token = AccessTokenStorage::new()
        .get()
        .map_err(|_| Error::AuthError(AuthError::Failed("Missing access token".to_string())))?;
    StashAPI::tab_with_items(&league, stash_id, None, version.inner(), &token).await
}

#[cfg(feature = "desktop")]
#[instrument(skip(prices, window, tab))]
#[command]
pub async fn sample_from_tab_with_items(
    league: League,
    tab: TabWithItems,
    prices: State<'_, Mutex<AppCardPrices>>,
    window: Window,
) -> Result<Sample, Error> {
    let prices = match TradeLeague::try_from(league) {
        Ok(league) => {
            let mut guard = prices.lock().await;
            guard.get_price(&league, &window).await
        }
        Err(_) => Prices::default(),
    };

    let sample = Sample::create(Input::from(tab), Some(prices))?;
    Ok(sample)
}
