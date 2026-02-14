use serde::{Deserialize, Serialize};
#[cfg(feature = "desktop")]
use tauri::{Emitter, Window};
use tracing::instrument;

pub trait Notifier: Send + Sync {
    fn notify(&self, event: &Event);
}

#[cfg(feature = "desktop")]
impl Notifier for Window {
    fn notify(&self, event: &Event) {
        self.emit(event.name(), event).unwrap();
    }
}

pub struct NoOpNotifier;
impl Notifier for NoOpNotifier {
    fn notify(&self, _event: &Event) {}
}

pub fn toast(variant: ToastVariant, message: String, notifier: &dyn Notifier) {
    Event::Toast { variant, message }.notify(notifier)
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum Event {
    #[serde(rename = "toast")]
    #[serde(alias = "toast")]
    Toast {
        variant: ToastVariant,
        message: String,
    },
    #[serde(rename = "auth-url")]
    #[serde(alias = "auth-url")]
    AuthUrl { url: String },
}

impl Event {
    #[instrument(skip(notifier))]
    pub fn notify(&self, notifier: &dyn Notifier) {
        notifier.notify(self);
    }

    pub fn name(&self) -> &str {
        match self {
            Event::Toast { .. } => "toast",
            Event::AuthUrl { .. } => "auth-url",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ToastVariant {
    #[serde(rename = "info")]
    Info,
    #[serde(rename = "success")]
    Success,
    #[serde(rename = "neutral")]
    Neutral,
    #[serde(rename = "warning")]
    Warning,
    #[serde(rename = "danger")]
    Danger,
}
