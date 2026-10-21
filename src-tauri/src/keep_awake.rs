//! Windows "keep the system awake" request owned by the desktop shell.
//!
//! One `PowerCreateRequest` handle is held while the user has the switch on:
//! no thread, no timer, no polling. The request is `PowerRequestSystemRequired`
//! only, so the screen may still turn off and the user can still sleep the
//! machine by hand. `enabled` is reported only after the OS accepted the
//! request. Disabling, destroying the main window, or exiting closes the
//! handle, and the OS drops the request with the process in any case.
//! The default is off on every launch (nothing is persisted).

use std::sync::Mutex;

use serde::Serialize;

/// Result of a status query or toggle, as seen by the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeepAwakeStatus {
    /// The platform can hold a keep-awake request at all.
    pub supported: bool,
    /// The OS currently holds an accepted request from this process.
    pub enabled: bool,
}

/// Thin seam over the OS so the lifecycle is testable without touching power.
trait PowerBackend: Send + Sync {
    /// Owned request; dropping it must release every OS resource it holds.
    type Request: Send;
    fn supported(&self) -> bool;
    /// Create the request and ask the OS to hold the system awake.
    fn acquire(&self) -> Result<Self::Request, String>;
    /// Withdraw the awake demand. The request is dropped afterwards either way.
    fn withdraw(&self, request: &Self::Request) -> Result<(), String>;
}

struct KeepAwake<B: PowerBackend> {
    backend: B,
    request: Mutex<Option<B::Request>>,
}

impl<B: PowerBackend> KeepAwake<B> {
    fn new(backend: B) -> Self {
        Self {
            backend,
            request: Mutex::new(None),
        }
    }

    fn status(&self) -> KeepAwakeStatus {
        let held = self
            .request
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false);
        KeepAwakeStatus {
            supported: self.backend.supported(),
            enabled: held,
        }
    }

    fn set(&self, enabled: bool) -> Result<KeepAwakeStatus, String> {
        if enabled {
            self.enable()?;
        } else {
            self.disable()?;
        }
        Ok(self.status())
    }

    fn enable(&self) -> Result<(), String> {
        if !self.backend.supported() {
            return Err("Keep awake is only supported on Windows.".to_string());
        }
        let mut slot = self
            .request
            .lock()
            .map_err(|_| "Keep-awake state is unavailable.".to_string())?;
        if slot.is_some() {
            // Repeated enable: keep the one request, never stack another.
            return Ok(());
        }
        *slot = Some(self.backend.acquire()?);
        Ok(())
    }

    fn disable(&self) -> Result<(), String> {
        let mut slot = self
            .request
            .lock()
            .map_err(|_| "Keep-awake state is unavailable.".to_string())?;
        let Some(request) = slot.take() else {
            return Ok(());
        };
        // Dropping closes the handle, which releases the request even when
        // the explicit withdraw failed; the failure is still reported.
        let result = self.backend.withdraw(&request);
        drop(request);
        result
    }

    fn release(&self) {
        let _ = self.disable();
    }
}

#[cfg(windows)]
mod platform {
    use super::PowerBackend;
    use windows_sys::Win32::{
        Foundation::{CloseHandle, GetLastError, HANDLE, INVALID_HANDLE_VALUE},
        System::{
            Power::{
                PowerClearRequest, PowerCreateRequest, PowerRequestSystemRequired, PowerSetRequest,
            },
            Threading::{POWER_REQUEST_CONTEXT_SIMPLE_STRING, REASON_CONTEXT, REASON_CONTEXT_0},
        },
    };

    pub struct WinRequest(HANDLE);

    // The handle is an opaque kernel object usable from any thread.
    unsafe impl Send for WinRequest {}

    impl Drop for WinRequest {
        fn drop(&mut self) {
            // SAFETY: the handle came from PowerCreateRequest and is closed once.
            unsafe { CloseHandle(self.0) };
        }
    }

    pub struct WindowsPower;

    impl PowerBackend for WindowsPower {
        type Request = WinRequest;

        fn supported(&self) -> bool {
            true
        }

        fn acquire(&self) -> Result<WinRequest, String> {
            let mut reason: Vec<u16> = "Pilaude keeps the system awake while background tasks run"
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect();
            let context = REASON_CONTEXT {
                Version: 0,
                Flags: POWER_REQUEST_CONTEXT_SIMPLE_STRING,
                Reason: REASON_CONTEXT_0 {
                    SimpleReasonString: reason.as_mut_ptr(),
                },
            };
            // SAFETY: `context` and the string it points to outlive the call.
            let handle = unsafe { PowerCreateRequest(&context) };
            if handle.is_null() || handle == INVALID_HANDLE_VALUE {
                let code = unsafe { GetLastError() };
                return Err(format!("PowerCreateRequest failed (error {code})."));
            }
            let request = WinRequest(handle);
            // SAFETY: valid handle owned by `request`; on failure it is dropped (closed).
            if unsafe { PowerSetRequest(request.0, PowerRequestSystemRequired) } == 0 {
                let code = unsafe { GetLastError() };
                return Err(format!("PowerSetRequest failed (error {code})."));
            }
            Ok(request)
        }

        fn withdraw(&self, request: &WinRequest) -> Result<(), String> {
            // SAFETY: valid handle owned by `request`.
            if unsafe { PowerClearRequest(request.0, PowerRequestSystemRequired) } == 0 {
                let code = unsafe { GetLastError() };
                return Err(format!(
                    "PowerClearRequest failed (error {code}); the request handle was closed."
                ));
            }
            Ok(())
        }
    }
}

#[cfg(windows)]
type Platform = platform::WindowsPower;
#[cfg(windows)]
const PLATFORM: Platform = platform::WindowsPower;

#[cfg(not(windows))]
struct Unsupported;

#[cfg(not(windows))]
impl PowerBackend for Unsupported {
    type Request = ();
    fn supported(&self) -> bool {
        false
    }
    fn acquire(&self) -> Result<(), String> {
        Err("Keep awake is only supported on Windows.".to_string())
    }
    fn withdraw(&self, _request: &()) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(not(windows))]
type Platform = Unsupported;
#[cfg(not(windows))]
const PLATFORM: Platform = Unsupported;

/// Managed Tauri state: the single keep-awake request of this process.
pub struct KeepAwakeState(KeepAwake<Platform>);

impl Default for KeepAwakeState {
    fn default() -> Self {
        Self(KeepAwake::new(PLATFORM))
    }
}

impl KeepAwakeState {
    /// Drop any held request (window destroyed, exit).
    pub fn release(&self) {
        self.0.release();
    }
}

#[tauri::command]
pub fn keep_awake_status(state: tauri::State<'_, KeepAwakeState>) -> KeepAwakeStatus {
    state.0.status()
}

#[tauri::command]
pub fn set_keep_awake(
    state: tauri::State<'_, KeepAwakeState>,
    enabled: bool,
) -> Result<KeepAwakeStatus, String> {
    state.0.set(enabled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    };

    #[derive(Default)]
    struct Counters {
        acquired: AtomicUsize,
        live: AtomicUsize,
        fail_acquire: AtomicBool,
        fail_withdraw: AtomicBool,
    }

    struct FakeRequest(Arc<Counters>);
    impl Drop for FakeRequest {
        fn drop(&mut self) {
            self.0.live.fetch_sub(1, Ordering::SeqCst);
        }
    }

    struct Fake {
        counters: Arc<Counters>,
        supported: bool,
    }
    impl PowerBackend for Fake {
        type Request = FakeRequest;
        fn supported(&self) -> bool {
            self.supported
        }
        fn acquire(&self) -> Result<FakeRequest, String> {
            if self.counters.fail_acquire.load(Ordering::SeqCst) {
                return Err("denied".to_string());
            }
            self.counters.acquired.fetch_add(1, Ordering::SeqCst);
            self.counters.live.fetch_add(1, Ordering::SeqCst);
            Ok(FakeRequest(self.counters.clone()))
        }
        fn withdraw(&self, _request: &FakeRequest) -> Result<(), String> {
            if self.counters.fail_withdraw.load(Ordering::SeqCst) {
                return Err("clear failed".to_string());
            }
            Ok(())
        }
    }

    fn make(supported: bool) -> (KeepAwake<Fake>, Arc<Counters>) {
        let counters = Arc::new(Counters::default());
        let service = KeepAwake::new(Fake {
            counters: counters.clone(),
            supported,
        });
        (service, counters)
    }

    #[test]
    fn keep_awake_defaults_off() {
        let (service, counters) = make(true);
        assert_eq!(
            service.status(),
            KeepAwakeStatus {
                supported: true,
                enabled: false
            }
        );
        assert_eq!(counters.live.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn keep_awake_five_rounds_never_stack_requests() {
        let (service, counters) = make(true);
        for _ in 0..5 {
            assert!(service.set(true).unwrap().enabled);
            assert!(service.set(true).unwrap().enabled);
            assert_eq!(counters.live.load(Ordering::SeqCst), 1);
            assert!(!service.set(false).unwrap().enabled);
            assert!(!service.set(false).unwrap().enabled);
            assert_eq!(counters.live.load(Ordering::SeqCst), 0);
        }
        assert_eq!(counters.acquired.load(Ordering::SeqCst), 5);
    }

    #[test]
    fn keep_awake_failed_acquire_is_not_reported_enabled() {
        let (service, counters) = make(true);
        counters.fail_acquire.store(true, Ordering::SeqCst);
        assert_eq!(service.set(true).unwrap_err(), "denied");
        assert!(!service.status().enabled);
        assert_eq!(counters.live.load(Ordering::SeqCst), 0);
        counters.fail_acquire.store(false, Ordering::SeqCst);
        assert!(service.set(true).unwrap().enabled);
    }

    #[test]
    fn keep_awake_unsupported_platform_returns_clear_error() {
        let (service, counters) = make(false);
        let error = service.set(true).unwrap_err();
        assert!(error.contains("only supported on Windows"));
        assert!(!service.status().supported);
        assert!(!service.status().enabled);
        assert_eq!(counters.acquired.load(Ordering::SeqCst), 0);
        assert!(service.set(false).is_ok());
    }

    #[test]
    fn keep_awake_failed_withdraw_still_releases_handle() {
        let (service, counters) = make(true);
        service.set(true).unwrap();
        counters.fail_withdraw.store(true, Ordering::SeqCst);
        assert_eq!(service.set(false).unwrap_err(), "clear failed");
        assert!(!service.status().enabled);
        assert_eq!(counters.live.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn keep_awake_release_and_drop_free_the_request() {
        let (service, counters) = make(true);
        service.set(true).unwrap();
        service.release();
        assert!(!service.status().enabled);
        assert_eq!(counters.live.load(Ordering::SeqCst), 0);
        service.release();

        service.set(true).unwrap();
        assert_eq!(counters.live.load(Ordering::SeqCst), 1);
        drop(service);
        assert_eq!(counters.live.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn keep_awake_concurrent_toggles_leave_at_most_one_request() {
        let (service, counters) = make(true);
        let service = Arc::new(service);
        let workers: Vec<_> = (0..8)
            .map(|i| {
                let service = service.clone();
                let counters = counters.clone();
                std::thread::spawn(move || {
                    for _ in 0..50 {
                        let _ = service.set(i % 2 == 0);
                        assert!(counters.live.load(Ordering::SeqCst) <= 1);
                    }
                })
            })
            .collect();
        for worker in workers {
            worker.join().unwrap();
        }
        assert!(counters.live.load(Ordering::SeqCst) <= 1);
        service.release();
        assert_eq!(counters.live.load(Ordering::SeqCst), 0);
    }

    #[cfg(windows)]
    #[test]
    fn keep_awake_real_windows_request_round_trip() {
        let service = KeepAwake::new(platform::WindowsPower);
        for _ in 0..5 {
            let on = service.set(true).expect("OS accepts the request");
            assert!(on.supported && on.enabled);
            assert!(service.set(true).unwrap().enabled);
            let off = service.set(false).expect("OS clears the request");
            assert!(!off.enabled);
        }
    }
}
