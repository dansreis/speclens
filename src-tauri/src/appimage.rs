//! Linux AppImage startup safeguards.
//!
//! The AppImage bundles its own `libwayland-client.so.0`. When the dynamic
//! loader picks the bundled copy while Mesa/EGL use the system one, Wayland
//! launches abort with `Could not create default EGL display:
//! EGL_BAD_PARAMETER` (issue #13). Before GTK/WebKit touch the display we
//! re-exec once with the first available system `libwayland-client` in
//! `LD_PRELOAD`. Independently, the WebKitGTK rendering paths known to be
//! unstable inside AppImages (DMA-BUF renderer, accelerated compositing) are
//! disabled unless the user set the variables themselves. Native package
//! installs are untouched: everything is gated on the `APPIMAGE`/`APPDIR`
//! environment the AppImage runtime injects.

#[cfg(any(test, target_os = "linux"))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct StartupEnvOverride {
    key: &'static str,
    value: &'static str,
}

#[cfg(any(test, target_os = "linux"))]
const LINUX_APPIMAGE_WEBKIT_OVERRIDES: [StartupEnvOverride; 2] = [
    StartupEnvOverride {
        key: "WEBKIT_DISABLE_DMABUF_RENDERER",
        value: "1",
    },
    StartupEnvOverride {
        key: "WEBKIT_DISABLE_COMPOSITING_MODE",
        value: "1",
    },
];

#[cfg(any(test, target_os = "linux"))]
const WAYLAND_CLIENT_PRELOAD_CANDIDATES: [&str; 7] = [
    "/usr/lib/libwayland-client.so",
    "/usr/lib/libwayland-client.so.0",
    "/usr/lib64/libwayland-client.so",
    "/usr/lib64/libwayland-client.so.0",
    "/lib64/libwayland-client.so.0",
    "/lib/x86_64-linux-gnu/libwayland-client.so.0",
    "/usr/lib/x86_64-linux-gnu/libwayland-client.so.0",
];

/// Guard variable set on the re-exec'd process so a failed preload can't loop.
#[cfg(any(test, target_os = "linux"))]
const PRELOAD_ATTEMPTED_VAR: &str = "SPECLENS_APPIMAGE_WAYLAND_PRELOAD_ATTEMPTED";

#[cfg(any(test, target_os = "linux"))]
fn is_linux_appimage_launch<F>(mut get_var: F) -> bool
where
    F: FnMut(&str) -> Option<String>,
{
    ["APPIMAGE", "APPDIR"]
        .into_iter()
        .any(|key| get_var(key).is_some_and(|value| !value.trim().is_empty()))
}

#[cfg(any(test, target_os = "linux"))]
fn is_wayland_session<F>(mut get_var: F) -> bool
where
    F: FnMut(&str) -> Option<String>,
{
    get_var("WAYLAND_DISPLAY").is_some_and(|value| !value.trim().is_empty())
        || get_var("XDG_SESSION_TYPE")
            .is_some_and(|value| value.trim().eq_ignore_ascii_case("wayland"))
}

#[cfg(any(test, target_os = "linux"))]
fn wayland_client_preload_path_with<F, E>(
    mut get_var: F,
    mut file_exists: E,
) -> Option<&'static str>
where
    F: FnMut(&str) -> Option<String>,
    E: FnMut(&str) -> bool,
{
    if !is_linux_appimage_launch(&mut get_var) || !is_wayland_session(&mut get_var) {
        return None;
    }

    // A user-supplied LD_PRELOAD wins, and a prior attempt means the preload
    // didn't help; either way, don't re-exec.
    if get_var("LD_PRELOAD").is_some_and(|value| !value.trim().is_empty())
        || get_var(PRELOAD_ATTEMPTED_VAR).is_some_and(|value| value == "1")
    {
        return None;
    }

    WAYLAND_CLIENT_PRELOAD_CANDIDATES
        .into_iter()
        .find(|path| file_exists(path))
}

#[cfg(any(test, target_os = "linux"))]
fn startup_env_overrides_with<F>(mut get_var: F) -> Vec<StartupEnvOverride>
where
    F: FnMut(&str) -> Option<String>,
{
    if !is_linux_appimage_launch(&mut get_var) {
        return Vec::new();
    }

    LINUX_APPIMAGE_WEBKIT_OVERRIDES
        .into_iter()
        .filter(|env_override| {
            get_var(env_override.key).is_none_or(|value| value.trim().is_empty())
        })
        .collect()
}

/// Must run before the Tauri builder so the environment is in place when
/// GTK/WebKit initialize.
#[cfg(target_os = "linux")]
pub fn apply_startup_safeguards() {
    apply_wayland_client_preload();

    for env_override in startup_env_overrides_with(|key| std::env::var(key).ok()) {
        std::env::set_var(env_override.key, env_override.value);
    }
}

#[cfg(target_os = "linux")]
fn apply_wayland_client_preload() {
    use std::os::unix::process::CommandExt;

    let Some(preload_path) = wayland_client_preload_path_with(
        |key| std::env::var(key).ok(),
        |path| std::path::Path::new(path).is_file(),
    ) else {
        return;
    };

    let exe = match std::env::current_exe() {
        Ok(exe) => exe,
        Err(e) => {
            eprintln!(
                "SpecLens AppImage Wayland preload skipped: failed to resolve executable ({e})"
            );
            return;
        }
    };

    // exec() only returns on failure; on success this process is replaced.
    let error = std::process::Command::new(exe)
        .args(std::env::args_os().skip(1))
        .env("LD_PRELOAD", preload_path)
        .env(PRELOAD_ATTEMPTED_VAR, "1")
        .exec();
    eprintln!("SpecLens AppImage Wayland preload skipped: failed to re-exec ({error})");
}

#[cfg(not(target_os = "linux"))]
pub fn apply_startup_safeguards() {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_overrides_are_empty_outside_appimage_launches() {
        assert!(startup_env_overrides_with(|_| None).is_empty());
    }

    #[test]
    fn env_overrides_disable_unstable_webkit_rendering_for_appimages() {
        let overrides = startup_env_overrides_with(|key| match key {
            "APPIMAGE" => Some("/tmp/SpecLens.AppImage".to_string()),
            _ => None,
        });

        assert_eq!(
            overrides,
            vec![
                StartupEnvOverride {
                    key: "WEBKIT_DISABLE_DMABUF_RENDERER",
                    value: "1",
                },
                StartupEnvOverride {
                    key: "WEBKIT_DISABLE_COMPOSITING_MODE",
                    value: "1",
                }
            ]
        );
    }

    #[test]
    fn env_overrides_preserve_explicit_user_setting_per_variable() {
        let overrides = startup_env_overrides_with(|key| match key {
            "APPDIR" => Some("/tmp/.mount_SpecLens".to_string()),
            "WEBKIT_DISABLE_DMABUF_RENDERER" => Some("0".to_string()),
            _ => None,
        });

        assert_eq!(
            overrides,
            vec![StartupEnvOverride {
                key: "WEBKIT_DISABLE_COMPOSITING_MODE",
                value: "1",
            }]
        );
    }

    #[test]
    fn wayland_preload_uses_first_available_system_library() {
        let preload_path = wayland_client_preload_path_with(
            |key| match key {
                "APPIMAGE" => Some("/tmp/SpecLens.AppImage".to_string()),
                "XDG_SESSION_TYPE" => Some("wayland".to_string()),
                _ => None,
            },
            |path| path == "/lib/x86_64-linux-gnu/libwayland-client.so.0",
        );

        assert_eq!(
            preload_path,
            Some("/lib/x86_64-linux-gnu/libwayland-client.so.0")
        );
    }

    #[test]
    fn wayland_preload_preserves_explicit_ld_preload() {
        let preload_path = wayland_client_preload_path_with(
            |key| match key {
                "APPDIR" => Some("/tmp/.mount_SpecLens".to_string()),
                "WAYLAND_DISPLAY" => Some("wayland-0".to_string()),
                "LD_PRELOAD" => Some("/custom/libwayland-client.so".to_string()),
                _ => None,
            },
            |_| true,
        );

        assert_eq!(preload_path, None);
    }

    #[test]
    fn wayland_preload_runs_only_once() {
        let preload_path = wayland_client_preload_path_with(
            |key| match key {
                "APPIMAGE" => Some("/tmp/SpecLens.AppImage".to_string()),
                "WAYLAND_DISPLAY" => Some("wayland-0".to_string()),
                k if k == PRELOAD_ATTEMPTED_VAR => Some("1".to_string()),
                _ => None,
            },
            |_| true,
        );

        assert_eq!(preload_path, None);
    }

    #[test]
    fn wayland_preload_is_empty_for_x11_sessions() {
        let preload_path = wayland_client_preload_path_with(
            |key| match key {
                "APPIMAGE" => Some("/tmp/SpecLens.AppImage".to_string()),
                "XDG_SESSION_TYPE" => Some("x11".to_string()),
                _ => None,
            },
            |_| true,
        );

        assert_eq!(preload_path, None);
    }
}
