use crate::poe::error::AuthError;
use divi::League;
use serde::{ser::SerializeStruct, Serialize};
use std::{fmt::Display, io};

#[derive(Debug)]
pub enum Error {
    HttpError(reqwest::Error),
    SerdeError(serde_json::Error),
    DiviError(divi::error::Error),
    AuthError(AuthError),
    IoError(io::Error),
    SqlError(rusqlite::Error),
    RetryAfter(String),
    GoogleError(googlesheets::error::Error),
    ConfigDirNotExists,
    StashTabError {
        stash_id: String,
        league: League,
        message: String,
    },
}

impl Error {
    pub fn kind(&self) -> &'static str {
        match self {
            Error::HttpError(_) => "httpError",
            Error::SerdeError(_) => "serdeError",
            Error::DiviError(_) => "diviError",
            Error::AuthError(_) => "authError",
            Error::IoError(_) => "ioError",
            Error::SqlError(_) => "sqlError",
            Error::RetryAfter(_) => "retryAfterError",
            Error::GoogleError(_) => "googleError",
            Error::ConfigDirNotExists => "configDirNotExists",
            Error::StashTabError { .. } => "stashTabError",
        }
    }
}

impl Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::AuthError(err) => err.fmt(f),
            Error::HttpError(err) => err.fmt(f),
            Error::SerdeError(err) => err.fmt(f),
            Error::DiviError(err) => err.fmt(f),
            Error::IoError(err) => err.fmt(f),
            Error::SqlError(err) => err.fmt(f),
            Error::RetryAfter(secs) => {
                write!(f, "You have reached the limit, retry after {secs} seconds")
            }
            Error::GoogleError(err) => err.fmt(f),
            Error::ConfigDirNotExists => f.write_str("Config dir not exists"),
            Error::StashTabError { message, .. } => f.write_str(message),
        }
    }
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            Error::AuthError(err) => err.serialize(serializer),
            Error::StashTabError {
                stash_id,
                league,
                message,
            } => {
                let mut err = serializer.serialize_struct("Error", 5)?;
                err.serialize_field("message", message)?;
                err.serialize_field("kind", self.kind())?;
                err.serialize_field("appErrorFromTauri", &true)?;
                err.serialize_field("league", league)?;
                err.serialize_field("stashId", stash_id)?;
                err.end()
            }
            _ => {
                let mut err = serializer.serialize_struct("Error", 2)?;
                err.serialize_field("message", self.to_string().as_str())?;
                err.serialize_field("kind", self.kind())?;
                err.serialize_field("appErrorFromTauri", &true)?;
                err.end()
            }
        }
    }
}

impl From<reqwest::Error> for Error {
    fn from(value: reqwest::Error) -> Self {
        Error::HttpError(value)
    }
}

impl From<serde_json::Error> for Error {
    fn from(value: serde_json::Error) -> Self {
        Error::SerdeError(value)
    }
}

impl From<divi::error::Error> for Error {
    fn from(value: divi::error::Error) -> Self {
        Error::DiviError(value)
    }
}

impl From<io::Error> for Error {
    fn from(value: io::Error) -> Self {
        Error::IoError(value)
    }
}

impl From<googlesheets::error::Error> for Error {
    fn from(value: googlesheets::error::Error) -> Self {
        Error::GoogleError(value)
    }
}

impl From<rusqlite::Error> for Error {
    fn from(value: rusqlite::Error) -> Self {
        Error::SqlError(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn stash_error_serialization_includes_fields() {
        let e = Error::StashTabError { stash_id: "test".to_string(), league: divi::League::Standard, message: "API Error 401: Unauthorized".to_string() };
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v.get("appErrorFromTauri").unwrap(), &json!(true));
        assert_eq!(v.get("kind").unwrap(), &json!("stashTabError"));
        assert_eq!(v.get("league").unwrap(), &json!(divi::League::Standard));
        assert_eq!(v.get("stashId").unwrap(), &json!("test"));
        assert_eq!(v.get("message").unwrap(), &json!("API Error 401: Unauthorized"));
    }

    #[test]
    fn retry_after_message_is_human_readable() {
        let e = Error::RetryAfter("10".to_string());
        let msg = e.to_string();
        assert!(msg.contains("retry after 10"));
    }
}
