use axum::{
    extract::{Form, Query, State},
    routing::{get, post},
    Json, Router,
};
use lib::event::{Event, Notifier};
use lib::prices::AppCardPrices;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use divi::sample::{Input, Sample};
use lib::poe::stash::StashAPI;
use lib::poe::types::TabNoItems;
use lib::version::AppVersion;

struct AppState {
    prices: Mutex<AppCardPrices>,
    version: AppVersion,
}

struct AxumNotifier;
impl Notifier for AxumNotifier {
    fn notify(&self, event: &Event) {
        // In a real implementation, this might push to a websocket or SSE
        tracing::info!("Notification: {:?}", event);
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let prices = AppCardPrices::new(std::env::current_dir().unwrap().join("data")).unwrap();
    let version = AppVersion("server-1.0.0".to_string());
    let state = Arc::new(AppState {
        prices: Mutex::new(prices),
        version,
    });

    let app = Router::new()
        .route("/", get(|| async { "Hello, Divicards!" }))
        .route("/api/prices/currency", get(get_currency_prices))
        .route(
            "/api/prices/divination_card",
            get(get_divination_card_prices),
        )
        .route("/api/stashes", get(get_stashes))
        .route("/api/sample_from_tab", get(get_sample_from_tab))
        .route("/api/tab_with_items", get(get_tab_with_items))
        .route("/api/poe/token", post(post_poe_token))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    tracing::info!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}

#[derive(serde::Deserialize)]
struct StashesParams {
    league: divi::TradeLeague,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SampleParams {
    league: divi::TradeLeague,
    stash_id: String,
    substash_id: Option<String>,
}

use lib::error::Error;

use axum::http::{HeaderMap, StatusCode};
use serde::Serialize;

async fn get_stashes(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<StashesParams>,
) -> Result<Json<TabNoItems>, (StatusCode, Json<Error>)> {
    let league = divi::League::from(params.league);
    let token = get_token_from_headers_or_env(&headers);

    if token.is_empty() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(Error::AuthError(lib::poe::error::AuthError::Failed(
                "Missing access token".to_string(),
            ))),
        ));
    }

    match StashAPI::stashes(league, &state.version, &token).await {
        Ok(stashes) => Ok(Json(stashes)),
        Err(e) => Err((error_to_status(&e), Json(e))),
    }
}

async fn get_sample_from_tab(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<SampleParams>,
) -> Result<Json<Sample>, (StatusCode, Json<Error>)> {
    let league = divi::League::from(params.league.clone());
    let token = get_token_from_headers_or_env(&headers);

    if token.is_empty() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(Error::AuthError(lib::poe::error::AuthError::Failed(
                "Missing access token".to_string(),
            ))),
        ));
    }

    let tab_result = StashAPI::tab_with_items(
        &league,
        params.stash_id,
        params.substash_id,
        &state.version,
        &token,
    )
    .await;

    let tab = match tab_result {
        Ok(t) => t,
        Err(e) => return Err((error_to_status(&e), Json(e))),
    };

    // Helper notification struct for get_price
    let notifier = AxumNotifier;

    // Lock prices and get price for the league
    let mut prices_guard = state.prices.lock().await;
    let prices = prices_guard.get_price(&params.league, &notifier).await;
    drop(prices_guard); // Drop lock early

    match Sample::create(Input::from(tab), Some(prices)) {
        Ok(sample) => Ok(Json(sample)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(Error::StashTabError {
                stash_id: "unknown".to_string(), // context lost here, strictly speaking
                league: league,
                message: e.to_string(),
            }),
        )),
    }
}

async fn get_tab_with_items(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<SampleParams>,
) -> Result<Json<lib::poe::types::TabWithItems>, (StatusCode, Json<Error>)> {
    let league = divi::League::from(params.league);
    let token = get_token_from_headers_or_env(&headers);

    if token.is_empty() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(Error::AuthError(lib::poe::error::AuthError::Failed(
                "Missing access token".to_string(),
            ))),
        ));
    }

    let tab_result = StashAPI::tab_with_items(
        &league,
        params.stash_id,
        params.substash_id,
        &state.version,
        &token,
    )
    .await;

    match tab_result {
        Ok(t) => Ok(Json(t)),
        Err(e) => Err((error_to_status(&e), Json(e))),
    }
}

fn get_token_from_headers_or_env(headers: &HeaderMap) -> String {
    if let Some(auth_header) = headers.get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                return auth_str[7..].to_string();
            }
        }
    }
    std::env::var("POE_ACCESS_TOKEN").unwrap_or_default()
}

fn error_to_status(e: &Error) -> StatusCode {
    match e {
        Error::AuthError(_) => StatusCode::UNAUTHORIZED,
        Error::StashTabError { .. } => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn get_currency_prices(
    State(_state): State<Arc<AppState>>,
    Query(_params): Query<StashesParams>,
) -> Json<serde_json::Value> {
    // Currency prices are not cached in AppCardPrices yet.
    // Return empty array to avoid frontend crash
    Json(serde_json::json!([]))
}

async fn get_divination_card_prices(
    State(state): State<Arc<AppState>>,
    Query(params): Query<StashesParams>,
) -> Json<serde_json::Value> {
    let mut prices = state.prices.lock().await;
    let notifier = AxumNotifier;
    let data = prices.get_price(&params.league, &notifier).await;
    Json(serde_json::json!(data.0))
}

#[derive(serde::Deserialize)]
struct PoETokenRequest {
    code: String,
    code_verifier: String,
    redirect_uri: String,
}

#[derive(Serialize)]
struct PoETokenForm {
    client_id: String,
    grant_type: String,
    code: String,
    redirect_uri: String,
    scope: String,
    code_verifier: String,
}

async fn post_poe_token(
    Form(payload): Form<PoETokenRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let form = PoETokenForm {
        client_id: "divicards".to_string(),
        grant_type: "authorization_code".to_string(),
        code: payload.code,
        redirect_uri: payload.redirect_uri,
        scope: "account:stashes".to_string(),
        code_verifier: payload.code_verifier,
    };

    let client = reqwest::Client::builder()
        .user_agent("divicards/0.10.1")
        .build()
        .map_err(|err| {
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": err.to_string() })),
            )
        })?;
    let response = client
        .post("https://www.pathofexile.com/oauth/token")
        .header("Accept", "application/json")
        .form(&form)
        .send()
        .await
        .map_err(|err| {
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": err.to_string() })),
            )
        })?;

    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown token fetch error".to_string());
        return Err((status, Json(serde_json::json!({ "error": text }))));
    }

    let json = response.json::<serde_json::Value>().await.map_err(|err| {
        (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": err.to_string() })),
        )
    })?;

    Ok(Json(json))
}
