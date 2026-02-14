#[cfg(feature = "desktop")]
use keyring::Entry;

#[cfg(feature = "desktop")]
pub mod auth;
pub mod error;
pub mod stash;
pub mod types;

pub const API_URL: &str = "https://api.pathofexile.com";
pub const PROVIDER_LABEL: &str = "poe";
pub const CLIENT_ID: &str = "divicards";
pub const AUTH_URL: &str = "https://www.pathofexile.com/oauth/authorize";
pub const TOKEN_URL: &str = "https://www.pathofexile.com/oauth/token";

#[cfg(feature = "desktop")]
#[derive(Debug)]
pub struct AccessTokenStorage(Entry);

#[cfg(feature = "desktop")]
impl AccessTokenStorage {
    pub fn new() -> Self {
        AccessTokenStorage::default()
    }
}

#[cfg(feature = "desktop")]
impl Default for AccessTokenStorage {
    fn default() -> Self {
        AccessTokenStorage(Entry::new("divicards", Self::KEY_NAME).unwrap())
    }
}

#[cfg(feature = "desktop")]
impl Persist for AccessTokenStorage {
    const KEY_NAME: &'static str = "poe_access_token";
    fn get(&self) -> Result<String, keyring::Error> {
        self.0.get_password()
    }

    fn set(&self, value: &str) -> Result<(), keyring::Error> {
        self.0.set_password(value)
    }

    fn delete(&self) -> Result<(), keyring::Error> {
        self.0.delete_password()
    }
}

#[cfg(feature = "desktop")]
pub trait Persist {
    const KEY_NAME: &'static str;
    fn get(&self) -> Result<String, keyring::Error>;
    fn set(&self, value: &str) -> Result<(), keyring::Error>;
    fn delete(&self) -> Result<(), keyring::Error>;
}
