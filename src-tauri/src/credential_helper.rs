use std::io::{Read, Write};
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

const ENTROPY: &[u8] = b"io.github.20240610ldx-hub.pilaude:credentials:v1";
const MAX_INPUT: u64 = 4 * 1024 * 1024;

fn transform(protect: bool, input: &[u8]) -> Result<Vec<u8>, ()> {
    let data = CRYPT_INTEGER_BLOB {
        cbData: u32::try_from(input.len()).map_err(|_| ())?,
        pbData: input.as_ptr().cast_mut(),
    };
    let entropy = CRYPT_INTEGER_BLOB {
        cbData: ENTROPY.len() as u32,
        pbData: ENTROPY.as_ptr().cast_mut(),
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    // Input buffers remain alive through the call. DPAPI allocates output with
    // LocalAlloc; copy it before freeing, including on a failed call.
    let success = unsafe {
        if protect {
            CryptProtectData(
                &data,
                null(),
                &entropy,
                null(),
                null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &data,
                null_mut(),
                &entropy,
                null(),
                null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    let result = if success == 0 || (output.cbData > 0 && output.pbData.is_null()) {
        Err(())
    } else if output.cbData == 0 {
        Ok(Vec::new())
    } else {
        Ok(unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec())
    };
    if !output.pbData.is_null() {
        unsafe {
            LocalFree(output.pbData.cast());
        }
    }
    result
}

/// A bounded stdio entry point, handled before Tauri opens any windows.
/// Payloads never enter command arguments, environment variables or files.
pub fn run_cli() -> Option<i32> {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some("--pilaude-credential") {
        return None;
    }
    let result = (|| {
        let protect = match args.next().as_deref() {
            Some("Protect") => true,
            Some("Unprotect") => false,
            _ => return Err(()),
        };
        if args.next().is_some() {
            return Err(());
        }
        let mut input = Vec::new();
        std::io::stdin()
            .take(MAX_INPUT + 1)
            .read_to_end(&mut input)
            .map_err(|_| ())?;
        if input.len() as u64 > MAX_INPUT {
            return Err(());
        }
        let output = transform(protect, &input)?;
        std::io::stdout().lock().write_all(&output).map_err(|_| ())
    })();
    if result.is_err() {
        eprintln!("Windows credential protection failed.");
    }
    Some(if result.is_ok() { 0 } else { 1 })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_user_dpapi_round_trips_utf8_and_empty_values() {
        for value in [b"".as_slice(), "pilaude fixture 假凭据".as_bytes()] {
            let encrypted = transform(true, value).expect("protect");
            assert!(!encrypted.is_empty());
            assert!(!encrypted
                .windows(value.len().max(1))
                .any(|part| !value.is_empty() && part == value));
            assert_eq!(transform(false, &encrypted), Ok(value.to_vec()));
        }
    }

    #[test]
    fn invalid_ciphertext_fails_without_returning_input() {
        assert_eq!(transform(false, b"not a DPAPI blob"), Err(()));
    }
}
