use crate::error::Error;
use crate::event::{toast, ToastVariant};
use crate::poe::error::AuthError;
use robius_authentication::{AndroidText, BiometricStrength, Context, PolicyBuilder, Text, WindowsText, Error as RobiusError};
use tauri::{command, Window};

#[command]
pub fn biometric_authenticate(window: Window) -> Result<(), Error> {
    let _ = window.set_focus();
    toast(ToastVariant::Info, "Verifying identity with Touch ID".into(), &window);
    let policy = PolicyBuilder::new()
        .biometrics(Some(BiometricStrength::Strong))
        .password(true)
        .companion(true)
        .build()
        .ok_or(Error::AuthError(AuthError::Failed))?;

    let text = Text {
        android: AndroidText {
            title: "Authenticate",
            subtitle: None,
            description: Some("Authenticate to connect to Path of Exile"),
        },
        apple: "Authenticate to connect to Path of Exile",
        windows: WindowsText::new("Authenticate", "Authenticate to continue").unwrap(),
    };

    let (tx, rx) = std::sync::mpsc::channel::<Result<(), ()>>();
    let callback = move |auth_result: Result<(), RobiusError>| {
        let _ = tx.send(auth_result.map_err(|_| ()));
    };

    Context::new(())
        .authenticate(text, &policy, callback)
        .map_err(|err| {
            toast(
                ToastVariant::Warning,
                format!("Authentication unavailable: {:?}", err),
                &window,
            );
            Error::AuthError(AuthError::OtherWithDescription {
                error: "robius".into(),
                error_description: format!("{:?}", err),
            })
        })?;

    match rx.recv() {
        Ok(Ok(())) => {
            toast(ToastVariant::Success, "Authentication successful".into(), &window);
            Ok(())
        }
        Ok(Err(())) => {
            toast(ToastVariant::Warning, "Authentication canceled or failed".into(), &window);
            Err(Error::AuthError(AuthError::UserDenied))
        }
        Err(recv_err) => {
            toast(
                ToastVariant::Warning,
                format!("Authentication failed: {}", recv_err),
                &window,
            );
            Err(Error::AuthError(AuthError::Failed))
        }
    }
}
