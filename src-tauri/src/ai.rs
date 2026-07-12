//! Opt-in local-LLM support: model download management plus llama.cpp
//! inference.
//!
//! Everything here is inert until one of the `ai_*` commands is invoked - no
//! network calls, no model loads, no background work.
//!
//! The module is split in two layers:
//!
//! - **Model management** (always compiled): a static registry of supported
//!   GGUF models, `ai_model_status`, `ai_download_model` (streaming progress
//!   over an IPC channel, sha256-verified, `.part` + rename),
//!   `ai_delete_model`, and `ai_import_model` (copies a user-provided GGUF
//!   into the models dir; any `*.gguf` whose stem isn't a registry id is
//!   reported as a *custom* model). Files live under
//!   `<app_data>/models/<id>.gguf`.
//! - **Inference** (behind the `local-llm` cargo feature): `ai_generate`
//!   streams tokens over an IPC channel using llama-cpp-2 (Metal on macOS,
//!   CPU elsewhere), with a one-model loaded cache in Tauri state and
//!   best-effort cancellation via `ai_cancel_generate`. The feature is off by
//!   default because building llama.cpp from source requires `cmake`; without
//!   it `ai_generate` returns a clear error string.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
#[cfg(feature = "local-llm")]
use std::sync::Mutex;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------

/// Which hand-rolled chat template to fall back to when the GGUF metadata
/// doesn't carry one (both registry models do carry one; this is a safety
/// net).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TemplateKind {
    /// `<start_of_turn>user ... <end_of_turn>` (Gemma family).
    Gemma,
    /// `<|im_start|>user ... <|im_end|>` (ChatML; Qwen family).
    ChatMl,
}

pub struct ModelSpec {
    /// Stable identifier; doubles as the on-disk file stem (`<id>.gguf`).
    /// Must never contain path separators.
    pub id: &'static str,
    pub display_name: &'static str,
    /// Direct-download URL (Hugging Face `resolve` endpoint; redirects to
    /// their CDN, which reqwest follows).
    pub url: &'static str,
    /// Approximate size as advertised by Hugging Face (decimal GB), for
    /// progress UI before the server reports a Content-Length.
    pub size_bytes: u64,
    /// Thinking-tuned models open a `<think>` block and can burn the whole
    /// output budget reasoning; we prefill a closed empty block to skip it
    /// (Qwen3.5 ignores the older `/no_think` soft switch).
    pub thinking: bool,
    /// Lowercase hex sha256 of the file, taken from the Hugging Face LFS
    /// metadata. Verified after download when present.
    pub sha256: Option<&'static str>,
    /// Only read by the inference engine (and its tests).
    #[cfg_attr(not(feature = "local-llm"), allow(dead_code))]
    pub template: TemplateKind,
}

/// Supported models. URLs, sizes and checksums verified against the Hugging
/// Face repos on 2026-07-10 (E2B/Qwen) and 2026-07-12 (E4B/Phi/SmolLM3). The
/// bundled llama.cpp (llama-cpp-sys-2 0.1.151) ships `src/models/gemma4.cpp`,
/// so the Gemma 4 architecture is supported and stays the default.
pub const MODELS: &[ModelSpec] = &[
	ModelSpec {
		id: "gemma-4-e2b-it",
		display_name: "Gemma 4 E2B Instruct (Q4_K_M)",
		url: "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf",
		size_bytes: 3_110_000_000,
		sha256: Some("9378bc471710229ef165709b62e34bfb62231420ddaf6d729e727305b5b8672d"),
		template: TemplateKind::Gemma,
		thinking: false,
	},
	ModelSpec {
		id: "qwen3.5-4b",
		display_name: "Qwen3.5 4B Instruct (Q4_K_M)",
		url: "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf",
		size_bytes: 2_740_000_000,
		sha256: Some("00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4"),
		template: TemplateKind::ChatMl,
		thinking: true,
	},
	ModelSpec {
		id: "gemma-4-e4b-it",
		display_name: "Gemma 4 E4B Instruct (Q4_K_M)",
		url: "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf",
		size_bytes: 4_977_169_568,
		sha256: Some("519b9793ed6ce0ff530f1b7c96e848e08e49e7af4d57bb97f76215963a54146d"),
		template: TemplateKind::Gemma,
		thinking: false,
	},
	ModelSpec {
		id: "phi-4-mini",
		display_name: "Phi-4 Mini Instruct (Q4_K_M)",
		url: "https://huggingface.co/unsloth/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct-Q4_K_M.gguf",
		size_bytes: 2_491_874_272,
		sha256: Some("88c00229914083cd112853aab84ed51b87bdf6b9ce42f532d8c85c7c63b1730a"),
		template: TemplateKind::ChatMl,
		thinking: false,
	},
	ModelSpec {
		id: "smollm3-3b",
		display_name: "SmolLM3 3B (Q4_K_M)",
		url: "https://huggingface.co/unsloth/SmolLM3-3B-GGUF/resolve/main/SmolLM3-3B-Q4_K_M.gguf",
		size_bytes: 1_915_306_528,
		sha256: Some("4de907d2d388a5508fb7cb443a06effe14cce3518b0a78d3bdd9e74d9edce989"),
		template: TemplateKind::ChatMl,
		thinking: true,
	},
];

pub const DEFAULT_MODEL_ID: &str = "gemma-4-e2b-it";

fn spec_for(id: &str) -> Result<&'static ModelSpec, String> {
    MODELS
        .iter()
        .find(|m| m.id == id)
        .ok_or_else(|| format!("Unknown model id: {}", id))
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models"))
}

fn model_file_name(id: &str) -> String {
    format!("{}.gguf", id)
}

fn part_file_name(id: &str) -> String {
    format!("{}.gguf.part", id)
}

/// Model ids double as on-disk file stems (`<id>.gguf`), and custom ids come
/// from user input, so anything that could escape the models dir is rejected.
/// Every registry id satisfies this by construction (unit-tested).
fn is_safe_model_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 256
        && !id.contains('/')
        && !id.contains('\\')
        && !id.contains("..")
}

// ---------------------------------------------------------------------------
// Chat-template fallback (pure, unit-tested)
// ---------------------------------------------------------------------------

#[cfg_attr(not(feature = "local-llm"), allow(dead_code))]
fn fallback_prompt(kind: TemplateKind, user_prompt: &str) -> String {
    match kind {
        TemplateKind::Gemma => format!(
            "<start_of_turn>user\n{}<end_of_turn>\n<start_of_turn>model\n",
            user_prompt
        ),
        TemplateKind::ChatMl => format!(
            "<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
            user_prompt
        ),
    }
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/// Managed by Tauri (`.manage(AiState::default())`). Arcs so blocking tasks
/// can outlive the `State` borrow.
pub struct AiState {
    /// Best-effort cancellation flag, checked between decode steps.
    cancel: Arc<AtomicBool>,
    /// True while a generation is running; concurrent `ai_generate` calls
    /// are rejected instead of queued.
    #[cfg(feature = "local-llm")]
    busy: Arc<AtomicBool>,
    /// One loaded model at a time; swapping model ids drops the old one
    /// (freeing its memory) before the new one is loaded.
    #[cfg(feature = "local-llm")]
    loaded: Arc<Mutex<Option<engine::LoadedModel>>>,
}

impl Default for AiState {
    fn default() -> Self {
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            #[cfg(feature = "local-llm")]
            busy: Arc::new(AtomicBool::new(false)),
            #[cfg(feature = "local-llm")]
            loaded: Arc::new(Mutex::new(None)),
        }
    }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum DownloadEvent {
    #[serde(rename_all = "camelCase")]
    Progress {
        bytes_done: u64,
        bytes_total: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Done { path: String },
}

#[derive(Serialize, Clone)]
#[serde(tag = "event", rename_all = "camelCase")]
// Constructed only by the feature-gated engine; the wire shape stays
// stable (and unit-tested) in every build.
#[cfg_attr(not(feature = "local-llm"), allow(dead_code))]
pub enum GenerateEvent {
    #[serde(rename_all = "camelCase")]
    Token { text: String },
    /// `reason` is one of `"eos"`, `"length"`, `"cancelled"`.
    #[serde(rename_all = "camelCase")]
    Done { reason: String, tokens: u32 },
}

// ---------------------------------------------------------------------------
// Commands: model management
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub id: String,
    pub display_name: String,
    /// Approximate full size (from the registry), for UI before download.
    pub size_bytes: u64,
    pub is_default: bool,
    pub downloaded: bool,
    /// Actual on-disk size when downloaded.
    pub downloaded_bytes: Option<u64>,
    /// Size of a leftover `.part` file from an interrupted download, if any.
    pub partial_bytes: Option<u64>,
    /// True for user-imported models discovered in the models dir (any
    /// `*.gguf` whose file stem is not a registry id).
    pub custom: bool,
}

#[tauri::command]
pub fn ai_model_status(app: AppHandle) -> Result<Vec<ModelStatus>, String> {
    let dir = models_dir(&app)?;
    let mut statuses: Vec<ModelStatus> = MODELS
        .iter()
        .map(|spec| {
            let file_len = |name: String| fs::metadata(dir.join(name)).ok().map(|m| m.len());
            let downloaded_bytes = file_len(model_file_name(spec.id));
            ModelStatus {
                id: spec.id.to_string(),
                display_name: spec.display_name.to_string(),
                size_bytes: spec.size_bytes,
                is_default: spec.id == DEFAULT_MODEL_ID,
                downloaded: downloaded_bytes.is_some(),
                downloaded_bytes,
                partial_bytes: file_len(part_file_name(spec.id)),
                custom: false,
            }
        })
        .collect();
    statuses.extend(custom_model_statuses(&dir));
    Ok(statuses)
}

/// Scans the models dir for user-imported models: every regular `*.gguf`
/// file whose stem is not a registry id. Sorted by id for a stable order.
fn custom_model_statuses(dir: &Path) -> Vec<ModelStatus> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out: Vec<ModelStatus> = entries
        .filter_map(|e| e.ok())
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().is_none_or(|ext| ext != "gguf") {
                return None;
            }
            let id = path.file_stem()?.to_str()?.to_string();
            if MODELS.iter().any(|m| m.id == id) {
                return None;
            }
            let meta = entry.metadata().ok()?;
            if !meta.is_file() {
                return None;
            }
            let file_name = path.file_name()?.to_str()?.to_string();
            Some(ModelStatus {
                id,
                display_name: file_name,
                size_bytes: meta.len(),
                is_default: false,
                downloaded: true,
                downloaded_bytes: Some(meta.len()),
                partial_bytes: None,
                custom: true,
            })
        })
        .collect();
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}

#[tauri::command]
pub async fn ai_download_model(
    app: AppHandle,
    id: String,
    channel: Channel<DownloadEvent>,
) -> Result<(), String> {
    let spec = spec_for(&id)?;
    let dir = models_dir(&app)?;
    // reqwest's blocking client spins up its own single-purpose runtime, so
    // it must not run on this async thread.
    tauri::async_runtime::spawn_blocking(move || download_blocking(spec, &dir, &channel))
        .await
        .map_err(|e| e.to_string())?
}

fn download_blocking(
    spec: &'static ModelSpec,
    dir: &std::path::Path,
    channel: &Channel<DownloadEvent>,
) -> Result<(), String> {
    let final_path = dir.join(model_file_name(spec.id));
    if final_path.exists() {
        let _ = channel.send(DownloadEvent::Done {
            path: final_path.to_string_lossy().into_owned(),
        });
        return Ok(());
    }
    fs::create_dir_all(dir).map_err(|e| format!("Cannot create {}: {}", dir.display(), e))?;
    let part_path = dir.join(part_file_name(spec.id));

    let result = stream_to_part_file(spec, &part_path, channel);
    if result.is_err() {
        let _ = fs::remove_file(&part_path);
        return result;
    }

    fs::rename(&part_path, &final_path).map_err(|e| e.to_string())?;
    let _ = channel.send(DownloadEvent::Done {
        path: final_path.to_string_lossy().into_owned(),
    });
    Ok(())
}

/// Streams the download into `part_path`, hashing as it goes and emitting
/// throttled progress events. Verifies sha256 (when known) before returning.
fn stream_to_part_file(
    spec: &ModelSpec,
    part_path: &std::path::Path,
    channel: &Channel<DownloadEvent>,
) -> Result<(), String> {
    use std::io::{Read, Write};

    // The blocking client's default 30s timeout covers the whole body -
    // far too short for a multi-GB file. Keep only a connect timeout.
    let client = reqwest::blocking::Client::builder()
        .timeout(None)
        .connect_timeout(std::time::Duration::from_secs(30))
        .user_agent(concat!("speclens/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let mut resp = client
        .get(spec.url)
        .send()
        .map_err(|e| format!("Download failed: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Download failed: {}", e))?;
    let bytes_total = resp.content_length().or(Some(spec.size_bytes));

    let mut file = fs::File::create(part_path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 256 * 1024];
    let mut bytes_done: u64 = 0;
    let mut last_reported: u64 = 0;
    const REPORT_EVERY: u64 = 8 * 1024 * 1024;

    let _ = channel.send(DownloadEvent::Progress {
        bytes_done: 0,
        bytes_total,
    });
    loop {
        let n = resp
            .read(&mut buf)
            .map_err(|e| format!("Download interrupted: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        bytes_done += n as u64;
        if bytes_done - last_reported >= REPORT_EVERY {
            last_reported = bytes_done;
            let _ = channel.send(DownloadEvent::Progress {
                bytes_done,
                bytes_total,
            });
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);
    let _ = channel.send(DownloadEvent::Progress {
        bytes_done,
        bytes_total,
    });

    if let Some(expected) = spec.sha256 {
        let actual = hex_lower(&hasher.finalize());
        if actual != expected {
            return Err(format!(
                "Checksum mismatch for {}: expected {}, got {}",
                spec.id, expected, actual
            ));
        }
    }
    Ok(())
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[tauri::command]
pub fn ai_delete_model(
    app: AppHandle,
    id: String,
    state: State<'_, AiState>,
) -> Result<(), String> {
    // Works for both registry ids and custom (imported) ids - the id only
    // needs to be a safe file stem, not a registry entry.
    if !is_safe_model_id(&id) {
        return Err(format!("Invalid model id: {}", id));
    }
    // Unload first so the mmap is released before the file goes away.
    #[cfg(feature = "local-llm")]
    {
        let mut loaded = state.loaded.lock().map_err(|e| e.to_string())?;
        if loaded.as_ref().is_some_and(|m| m.id == id) {
            *loaded = None;
        }
    }
    #[cfg(not(feature = "local-llm"))]
    let _ = &state;

    let dir = models_dir(&app)?;
    for name in [model_file_name(&id), part_file_name(&id)] {
        let path = dir.join(name);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_import_model(app: AppHandle, source_path: String) -> Result<String, String> {
    let dir = models_dir(&app)?;
    // File copy can take a while for multi-GB models; keep it off the async
    // runtime thread.
    tauri::async_runtime::spawn_blocking(move || {
        let (id, dest) = plan_import(Path::new(&source_path), &dir)?;
        fs::create_dir_all(&dir).map_err(|e| format!("Cannot create {}: {}", dir.display(), e))?;
        fs::copy(&source_path, &dest).map_err(|e| format!("Import failed: {}", e))?;
        Ok(id)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Validates an import source and computes the new model id plus destination
/// path (always `<dir>/<id>.gguf`, so a lookup by id finds the file exactly).
/// Pure of any copying so the rules are unit-testable.
fn plan_import(source: &Path, dir: &Path) -> Result<(String, PathBuf), String> {
    if !source
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("gguf"))
    {
        return Err("Only .gguf model files can be imported".to_string());
    }
    let id = source
        .file_stem()
        .and_then(|s| s.to_str())
        .filter(|s| is_safe_model_id(s))
        .ok_or_else(|| format!("Invalid model file name: {}", source.display()))?
        .to_string();
    let file_name = model_file_name(&id);
    let dest = dir.join(&file_name);
    if dest.exists() {
        return Err(format!(
            "A model file named {} already exists. Delete that model first, or rename the file before importing.",
            file_name
        ));
    }
    Ok((id, dest))
}

// ---------------------------------------------------------------------------
// Commands: inference
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn ai_cancel_generate(state: State<'_, AiState>) {
    state.cancel.store(true, Ordering::SeqCst);
}

/// Where generation reads the model from, plus its prompting knobs. Registry
/// ids use their spec. Any other id is a custom import: the file must already
/// exist in the models dir, prompting relies on the GGUF-embedded chat
/// template (ChatML as the hand-rolled fallback - see `build_prompt`), and
/// there is no thinking prefill.
#[cfg(feature = "local-llm")]
fn resolve_generation_target(
    app: &AppHandle,
    model_id: &str,
) -> Result<(PathBuf, TemplateKind, bool), String> {
    let dir = models_dir(app)?;
    match spec_for(model_id) {
        Ok(spec) => {
            let path = dir.join(model_file_name(spec.id));
            if !path.is_file() {
                return Err(format!(
                    "Model {} is not downloaded yet - call ai_download_model first",
                    spec.id
                ));
            }
            Ok((path, spec.template, spec.thinking))
        }
        Err(unknown) => {
            if !is_safe_model_id(model_id) {
                return Err(format!("Invalid model id: {}", model_id));
            }
            let path = dir.join(model_file_name(model_id));
            if !path.is_file() {
                return Err(unknown);
            }
            Ok((path, TemplateKind::ChatMl, false))
        }
    }
}

#[cfg(feature = "local-llm")]
#[tauri::command]
pub async fn ai_generate(
    app: AppHandle,
    state: State<'_, AiState>,
    model_id: String,
    prompt: String,
    channel: Channel<GenerateEvent>,
) -> Result<(), String> {
    let (path, template, thinking) = resolve_generation_target(&app, &model_id)?;

    if state
        .busy
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("A generation is already in progress".to_string());
    }
    let _busy = ClearOnDrop(state.busy.clone());
    state.cancel.store(false, Ordering::SeqCst);

    // Reuse the cached model when the id matches; otherwise drop the old one
    // *before* loading the new one so both never occupy memory at once.
    let cached = {
        let mut loaded = state.loaded.lock().map_err(|e| e.to_string())?;
        match loaded.as_ref() {
            Some(m) if m.id == model_id => Some(m.model.clone()),
            Some(_) => {
                *loaded = None;
                None
            }
            None => None,
        }
    };
    let model = match cached {
        Some(m) => m,
        None => {
            let model = tauri::async_runtime::spawn_blocking(move || engine::load_model(&path))
                .await
                .map_err(|e| e.to_string())??;
            let model = Arc::new(model);
            *state.loaded.lock().map_err(|e| e.to_string())? = Some(engine::LoadedModel {
                id: model_id,
                model: model.clone(),
            });
            model
        }
    };

    let cancel = state.cancel.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut prompt = engine::build_prompt(&model, template, &prompt);
        if thinking {
            // Prefill a completed (empty) reasoning block so the model answers
            // directly instead of spending the token budget inside <think>.
            prompt.push_str("<think>\n\n</think>\n\n");
        }
        engine::generate_blocking(&model, &prompt, engine::MAX_OUTPUT_TOKENS, &cancel, &|ev| {
            let _ = channel.send(ev);
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(not(feature = "local-llm"))]
#[tauri::command]
pub async fn ai_generate(
    app: AppHandle,
    state: State<'_, AiState>,
    model_id: String,
    prompt: String,
    channel: Channel<GenerateEvent>,
) -> Result<(), String> {
    let _ = (app, state, model_id, prompt, channel);
    Err(
        "SpecLens was built without the local-llm feature. Install cmake and rebuild with \
		 `cargo build --features local-llm` (or add it to default features) to enable inference."
            .to_string(),
    )
}

/// Clears an AtomicBool when dropped; keeps the busy flag honest on every
/// exit path (including errors and panics unwinding through the command).
#[cfg(feature = "local-llm")]
struct ClearOnDrop(Arc<AtomicBool>);

#[cfg(feature = "local-llm")]
impl Drop for ClearOnDrop {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

// ---------------------------------------------------------------------------
// llama.cpp engine (compiled only with `local-llm`)
// ---------------------------------------------------------------------------

#[cfg(feature = "local-llm")]
mod engine {
    use std::num::NonZeroU32;
    use std::path::Path;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, OnceLock};

    use llama_cpp_2::context::params::LlamaContextParams;
    use llama_cpp_2::llama_backend::LlamaBackend;
    use llama_cpp_2::llama_batch::LlamaBatch;
    use llama_cpp_2::model::params::LlamaModelParams;
    use llama_cpp_2::model::{AddBos, LlamaChatMessage, LlamaModel};
    use llama_cpp_2::sampling::LlamaSampler;

    use super::{fallback_prompt, GenerateEvent, TemplateKind};

    /// Sensible defaults for our "summarize / explain a spec" use case. The
    /// output cap fits ~15 capabilities at 2-3 sentences each plus overview.
    pub const MAX_OUTPUT_TOKENS: u32 = 2048;
    const TEMPERATURE: f32 = 0.3;
    const N_CTX: u32 = 8192;
    /// Prompt tokens are decoded in chunks of this size so we never exceed
    /// the context's batch capacity.
    const PROMPT_CHUNK: usize = 512;

    pub struct LoadedModel {
        /// Registry id or custom (imported) id - always the on-disk file stem.
        pub id: String,
        pub model: Arc<LlamaModel>,
    }

    /// llama.cpp's backend must be initialized exactly once per process; the
    /// OnceLock both guarantees that and keeps it alive for the process
    /// lifetime (dropping it would tear the backend down under a live model).
    fn backend() -> &'static LlamaBackend {
        static BACKEND: OnceLock<LlamaBackend> = OnceLock::new();
        BACKEND.get_or_init(|| {
            // Only fails when already initialized, which the OnceLock rules out.
            let mut backend = LlamaBackend::init().expect("llama backend init");
            backend.void_logs();
            backend
        })
    }

    pub fn load_model(path: &Path) -> Result<LlamaModel, String> {
        // Default params offload all layers to Metal on macOS builds and run
        // pure CPU elsewhere - no per-platform tuning needed here.
        LlamaModel::load_from_file(backend(), path, &LlamaModelParams::default())
            .map_err(|e| format!("Failed to load model: {}", e))
    }

    /// Formats a single-user-turn prompt with the model's own chat template
    /// from GGUF metadata, falling back to a hand-rolled template.
    pub fn build_prompt(model: &LlamaModel, fallback: TemplateKind, user_prompt: &str) -> String {
        if let Ok(template) = model.chat_template(None) {
            if let Ok(message) = LlamaChatMessage::new("user".to_string(), user_prompt.to_string())
            {
                if let Ok(prompt) = model.apply_chat_template(&template, &[message], true) {
                    return prompt;
                }
            }
        }
        fallback_prompt(fallback, user_prompt)
    }

    /// Decodes the prompt, then streams sampled tokens through `emit` until
    /// EOS, `max_tokens`, or cancellation. Emits a final `Done` event.
    pub fn generate_blocking(
        model: &LlamaModel,
        prompt: &str,
        max_tokens: u32,
        cancel: &AtomicBool,
        emit: &dyn Fn(GenerateEvent),
    ) -> Result<(), String> {
        let ctx_params = LlamaContextParams::default().with_n_ctx(NonZeroU32::new(N_CTX));
        let mut ctx = model
            .new_context(backend(), ctx_params)
            .map_err(|e| format!("Failed to create context: {}", e))?;

        let tokens = model
            .str_to_token(prompt, AddBos::Always)
            .map_err(|e| format!("Tokenization failed: {}", e))?;
        if tokens.is_empty() {
            return Err("Empty prompt".to_string());
        }
        let budget = N_CTX.saturating_sub(max_tokens + 4) as usize;
        if tokens.len() > budget {
            return Err(format!(
                "Prompt too long: {} tokens, budget is {} (context {} minus {} output tokens)",
                tokens.len(),
                budget,
                N_CTX,
                max_tokens
            ));
        }

        // Decode the prompt in chunks; only the very last token requests
        // logits (that's the position we sample from).
        let mut batch = LlamaBatch::new(PROMPT_CHUNK, 1);
        let mut pos: i32 = 0;
        for chunk in tokens.chunks(PROMPT_CHUNK) {
            if cancel.load(Ordering::SeqCst) {
                emit(GenerateEvent::Done {
                    reason: "cancelled".to_string(),
                    tokens: 0,
                });
                return Ok(());
            }
            batch.clear();
            for token in chunk {
                pos += 1;
                let wants_logits = pos as usize == tokens.len();
                batch
                    .add(*token, pos - 1, &[0], wants_logits)
                    .map_err(|e| e.to_string())?;
            }
            ctx.decode(&mut batch).map_err(|e| e.to_string())?;
        }

        let mut sampler = LlamaSampler::chain_simple([
            LlamaSampler::temp(TEMPERATURE),
            LlamaSampler::dist(seed_from_time()),
        ]);
        let mut decoder = encoding_rs::UTF_8.new_decoder();
        let mut produced: u32 = 0;
        let mut reason = "length";
        while produced < max_tokens {
            if cancel.load(Ordering::SeqCst) {
                reason = "cancelled";
                break;
            }
            let token = sampler.sample(&ctx, batch.n_tokens() - 1);
            sampler.accept(token);
            if model.is_eog_token(token) {
                reason = "eos";
                break;
            }
            // Stateful decoder: multi-byte UTF-8 sequences split across
            // tokens surface once complete instead of erroring.
            if let Ok(text) = model.token_to_piece(token, &mut decoder, false, None) {
                if !text.is_empty() {
                    emit(GenerateEvent::Token { text });
                }
            }
            produced += 1;
            if (pos as u32) >= N_CTX - 1 {
                reason = "length";
                break;
            }
            batch.clear();
            batch
                .add(token, pos, &[0], true)
                .map_err(|e| e.to_string())?;
            pos += 1;
            ctx.decode(&mut batch).map_err(|e| e.to_string())?;
        }
        emit(GenerateEvent::Done {
            reason: reason.to_string(),
            tokens: produced,
        });
        Ok(())
    }

    fn seed_from_time() -> u32 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(42)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_is_well_formed() {
        // Unique ids, and the default must exist.
        let ids: Vec<&str> = MODELS.iter().map(|m| m.id).collect();
        let mut deduped = ids.clone();
        deduped.sort_unstable();
        deduped.dedup();
        assert_eq!(deduped.len(), ids.len(), "duplicate model ids");
        assert!(ids.contains(&DEFAULT_MODEL_ID));

        for spec in MODELS {
            // Ids become file names - no separators or traversal allowed.
            // (ai_delete_model relies on every registry id passing this.)
            assert!(is_safe_model_id(spec.id), "unsafe id: {}", spec.id);
            assert!(
                spec.url.starts_with("https://huggingface.co/"),
                "unexpected host: {}",
                spec.url
            );
            assert!(spec.url.ends_with(".gguf"), "not a gguf url: {}", spec.url);
            assert!(
                spec.size_bytes > 1_000_000_000,
                "suspiciously small: {}",
                spec.id
            );
            let sha = spec.sha256.expect("registry entries should carry sha256");
            assert_eq!(sha.len(), 64);
            assert!(sha.chars().all(|c| c.is_ascii_hexdigit()));
            assert_eq!(sha, sha.to_lowercase(), "sha256 must be lowercase hex");
        }
    }

    #[test]
    fn spec_lookup() {
        assert_eq!(spec_for("gemma-4-e2b-it").unwrap().id, "gemma-4-e2b-it");
        assert_eq!(
            spec_for("qwen3.5-4b").unwrap().template,
            TemplateKind::ChatMl
        );
        assert!(spec_for("nope").is_err());
        assert!(spec_for("../evil").is_err());
    }

    #[test]
    fn file_names_derive_from_id() {
        assert_eq!(model_file_name("gemma-4-e2b-it"), "gemma-4-e2b-it.gguf");
        assert_eq!(part_file_name("qwen3.5-4b"), "qwen3.5-4b.gguf.part");
    }

    #[test]
    fn custom_id_path_safety() {
        // Custom ids (file stems of imported models) must stay inside the
        // models dir - ai_generate/ai_delete_model gate on this.
        assert!(is_safe_model_id("My-Model.Q4_K_M"));
        assert!(is_safe_model_id("llama-3.2-1b-instruct-q8_0"));
        assert!(!is_safe_model_id(""));
        assert!(!is_safe_model_id(".."));
        assert!(!is_safe_model_id("../evil"));
        assert!(!is_safe_model_id("evil/.."));
        assert!(!is_safe_model_id("a/b"));
        assert!(!is_safe_model_id("a\\b"));
        assert!(!is_safe_model_id("/etc/passwd"));
        assert!(!is_safe_model_id(&"x".repeat(257)));
    }

    #[test]
    fn import_plan_rules() {
        let dir = tempfile::tempdir().unwrap();

        // Only .gguf files (any case) are accepted.
        assert!(plan_import(Path::new("/tmp/model.bin"), dir.path()).is_err());
        assert!(plan_import(Path::new("/tmp/model"), dir.path()).is_err());
        assert!(plan_import(Path::new("/tmp/model.gguf.part"), dir.path()).is_err());

        // Happy path: id is the file stem; destination is <dir>/<id>.gguf
        // with a normalized (lowercase) extension.
        let (id, dest) = plan_import(Path::new("/tmp/My-Model.Q4.GGUF"), dir.path()).unwrap();
        assert_eq!(id, "My-Model.Q4");
        assert_eq!(dest, dir.path().join("My-Model.Q4.gguf"));

        // Name collision is refused with a clear error, never overwritten.
        fs::write(dir.path().join("taken.gguf"), b"").unwrap();
        let err = plan_import(Path::new("/elsewhere/taken.gguf"), dir.path()).unwrap_err();
        assert!(err.contains("already exists"), "unexpected error: {}", err);
    }

    #[test]
    fn custom_model_scan() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("custom-b.gguf"), b"12345").unwrap();
        fs::write(dir.path().join("custom-a.gguf"), b"123").unwrap();
        // Registry stems, non-gguf files and .part leftovers are excluded.
        fs::write(dir.path().join("gemma-4-e2b-it.gguf"), b"x").unwrap();
        fs::write(dir.path().join("notes.txt"), b"x").unwrap();
        fs::write(dir.path().join("custom-c.gguf.part"), b"x").unwrap();

        let statuses = custom_model_statuses(dir.path());
        let ids: Vec<&str> = statuses.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, ["custom-a", "custom-b"], "sorted by id");
        let a = &statuses[0];
        assert_eq!(a.display_name, "custom-a.gguf");
        assert!(a.custom);
        assert!(a.downloaded);
        assert!(!a.is_default);
        assert_eq!(a.size_bytes, 3);
        assert_eq!(a.downloaded_bytes, Some(3));
        assert_eq!(a.partial_bytes, None);

        // A missing dir yields no customs (first launch, nothing downloaded).
        assert!(custom_model_statuses(&dir.path().join("nope")).is_empty());
    }

    #[test]
    fn model_status_wire_shape_includes_custom() {
        let status = serde_json::to_value(ModelStatus {
            id: "m".into(),
            display_name: "m.gguf".into(),
            size_bytes: 1,
            is_default: false,
            downloaded: true,
            downloaded_bytes: Some(1),
            partial_bytes: None,
            custom: true,
        })
        .unwrap();
        assert_eq!(
            status,
            serde_json::json!({
                "id": "m",
                "displayName": "m.gguf",
                "sizeBytes": 1,
                "isDefault": false,
                "downloaded": true,
                "downloadedBytes": 1,
                "partialBytes": null,
                "custom": true,
            })
        );
    }

    #[test]
    fn fallback_templates() {
        let gemma = fallback_prompt(TemplateKind::Gemma, "Hi");
        assert_eq!(
            gemma,
            "<start_of_turn>user\nHi<end_of_turn>\n<start_of_turn>model\n"
        );
        let chatml = fallback_prompt(TemplateKind::ChatMl, "Hi");
        assert_eq!(
            chatml,
            "<|im_start|>user\nHi<|im_end|>\n<|im_start|>assistant\n"
        );
    }

    #[test]
    fn hex_encoding() {
        assert_eq!(hex_lower(&[0x00, 0xff, 0x0a]), "00ff0a");
        assert_eq!(hex_lower(&[]), "");
    }

    #[test]
    fn event_wire_shapes() {
        let progress = serde_json::to_value(DownloadEvent::Progress {
            bytes_done: 10,
            bytes_total: Some(100),
        })
        .unwrap();
        assert_eq!(
            progress,
            serde_json::json!({ "event": "progress", "bytesDone": 10, "bytesTotal": 100 })
        );
        let done = serde_json::to_value(GenerateEvent::Done {
            reason: "eos".to_string(),
            tokens: 3,
        })
        .unwrap();
        assert_eq!(
            done,
            serde_json::json!({ "event": "done", "reason": "eos", "tokens": 3 })
        );
        let token = serde_json::to_value(GenerateEvent::Token {
            text: "hi".to_string(),
        })
        .unwrap();
        assert_eq!(token, serde_json::json!({ "event": "token", "text": "hi" }));
    }

    /// Manual validation once a model is on disk:
    /// `cargo test --features local-llm ai_smoke -- --ignored --nocapture`
    /// Looks at `SPECLENS_AI_MODEL` (a .gguf path) first, then any .gguf in
    /// the app's models dir.
    #[cfg(feature = "local-llm")]
    #[test]
    #[ignore = "requires a downloaded model file"]
    fn ai_smoke() {
        use std::sync::atomic::AtomicBool;
        use std::sync::Mutex;

        let path = smoke_model_path().expect(
            "no model found: set SPECLENS_AI_MODEL to a .gguf path or download a model in the app",
        );
        eprintln!("ai_smoke: loading {}", path.display());
        let model = engine::load_model(&path).expect("model should load");
        let mut prompt =
            engine::build_prompt(&model, TemplateKind::Gemma, "Reply with one word: hi");
        // Mirror ai_generate's thinking-model prefill (see spec.thinking).
        if path.to_string_lossy().contains("qwen") {
            prompt.push_str("<think>\n\n</think>\n\n");
        }
        let out = Mutex::new(String::new());
        let done = AtomicBool::new(false);
        let cancel = AtomicBool::new(false);
        engine::generate_blocking(&model, &prompt, 16, &cancel, &|ev| match ev {
            GenerateEvent::Token { text } => out.lock().unwrap().push_str(&text),
            GenerateEvent::Done { .. } => done.store(true, Ordering::SeqCst),
        })
        .expect("generation should succeed");
        let out = out.lock().unwrap();
        eprintln!("ai_smoke: generated {:?}", *out);
        assert!(done.load(Ordering::SeqCst), "no done event");
        assert!(!out.is_empty(), "no tokens generated");
    }

    #[cfg(feature = "local-llm")]
    fn smoke_model_path() -> Option<PathBuf> {
        if let Ok(p) = std::env::var("SPECLENS_AI_MODEL") {
            return Some(PathBuf::from(p));
        }
        let home = std::env::var_os("HOME")?;
        let dir =
            PathBuf::from(home).join("Library/Application Support/com.danielreis.speclens/models");
        fs::read_dir(dir)
            .ok()?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .find(|p| p.extension().is_some_and(|e| e == "gguf"))
    }
}
