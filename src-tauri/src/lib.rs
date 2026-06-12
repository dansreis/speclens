use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use walkdir::WalkDir;

#[derive(Clone, Serialize)]
struct Person {
    name: String,
    email: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocAuthor {
    created_by: Person,
    created_at: String,
    last_edited_by: Person,
    last_edited_at: String,
    edit_count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoPayload {
    id: String,
    files: HashMap<String, String>,
    authorship: HashMap<String, DocAuthor>,
    change_rollups: HashMap<String, DocAuthor>,
    /// Fingerprint of the repo's current state. See `compute_signature`.
    signature: String,
}

struct CommitInfo {
    hash: String,
    name: String,
    email: String,
    iso_date: String,
}

#[tauri::command]
async fn load_repo(path: String) -> Result<RepoPayload, String> {
    let project_root = PathBuf::from(&path);
    if !project_root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    let openspec_dir = project_root.join("openspec");
    if !openspec_dir.is_dir() {
        return Err(format!(
            "No openspec/ folder found at {}",
            project_root.display()
        ));
    }
    let id = project_root
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    load_project(&id, &project_root)
}

fn load_project(id: &str, project_root: &Path) -> Result<RepoPayload, String> {
    let mut files: HashMap<String, String> = HashMap::new();
    let openspec_dir = project_root.join("openspec");

    for entry in WalkDir::new(&openspec_dir)
        .into_iter()
        .filter_entry(|e| !is_hidden_or_skipped(e))
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let ext = entry
            .path()
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if ext != "md" && ext != "yaml" && ext != "yml" {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(project_root)
            .map_err(|e| e.to_string())?;
        let rel_str = path_to_forward_slash(rel);
        let content = fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
        files.insert(rel_str, content);
    }

    let mut authorship: HashMap<String, DocAuthor> = HashMap::new();
    let mut change_rollups: HashMap<String, DocAuthor> = HashMap::new();

    if let Some(git_root) = find_git_root(project_root) {
        let project_rel = project_root
            .strip_prefix(&git_root)
            .map_err(|e| e.to_string())?;
        let project_rel_str = path_to_forward_slash(project_rel);
        // For each tracked file, run `git log --follow` to capture authorship across renames.
        let mut commits_by_change: HashMap<String, Vec<CommitInfo>> = HashMap::new();
        for rel in files.keys() {
            let git_path = if project_rel_str.is_empty() {
                rel.clone()
            } else {
                format!("{}/{}", project_rel_str, rel)
            };
            let commits = match git_log_follow(&git_root, &git_path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            if commits.is_empty() {
                continue;
            }
            if let Some(change_key) = change_key_for(rel) {
                commits_by_change
                    .entry(change_key)
                    .or_default()
                    .extend(commits.iter().cloned());
            }
            authorship.insert(rel.clone(), rollup(&commits));
        }
        for (key, commits) in commits_by_change {
            change_rollups.insert(key, rollup(&commits));
        }
    }

    let signature = compute_signature(project_root);

    Ok(RepoPayload {
        id: id.to_string(),
        files,
        authorship,
        change_rollups,
        signature,
    })
}

#[tauri::command]
async fn repo_signature(path: String) -> Result<String, String> {
    let project_root = PathBuf::from(&path);
    if !project_root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    let openspec_dir = project_root.join("openspec");
    if !openspec_dir.is_dir() {
        return Err(format!(
            "No openspec/ folder found at {}",
            project_root.display()
        ));
    }
    Ok(compute_signature(&project_root))
}

/// A fingerprint that changes iff the project's loaded content would change.
///
/// Git-backed: `git:<HEAD-sha>:<hash of (path, content) for every tracked +
/// untracked-not-ignored file under project>`. Equivalent in semantics to
/// `git ls-files --cached --others --exclude-standard -z | xargs -0 sha256sum
/// | sha256sum`. Catches every byte change to every non-ignored file under
/// the project; HEAD-sha additionally invalidates on commits that don't
/// change working-tree contents (so authorship updates are picked up).
///
/// Non-git: `fs:<hash of (relative path, mtime ns) for every file under openspec/>`.
fn compute_signature(project_root: &Path) -> String {
    if let Some(git_root) = find_git_root(project_root) {
        let head = git_command(&git_root, &["rev-parse", "HEAD"]).unwrap_or_default();
        let project_rel = project_root
            .strip_prefix(&git_root)
            .ok()
            .map(path_to_forward_slash)
            .unwrap_or_default();
        let mut ls_args: Vec<&str> = vec![
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ];
        if !project_rel.is_empty() {
            ls_args.push("--");
            ls_args.push(&project_rel);
        }
        let raw = git_command_bytes(&git_root, &ls_args).unwrap_or_default();
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        for path_bytes in raw.split(|&b| b == 0) {
            if path_bytes.is_empty() {
                continue;
            }
            path_bytes.hash(&mut hasher);
            let rel = String::from_utf8_lossy(path_bytes);
            let full = git_root.join(rel.as_ref());
            if let Ok(contents) = fs::read(&full) {
                contents.hash(&mut hasher);
            }
        }
        return format!("git:{}:{:x}", head, hasher.finish());
    }
    let openspec_dir = project_root.join("openspec");
    let mut entries: Vec<(String, u128)> = Vec::new();
    for entry in WalkDir::new(&openspec_dir)
        .into_iter()
        .filter_entry(|e| !is_hidden_or_skipped(e))
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(project_root)
            .unwrap_or(entry.path());
        let mtime_ns = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        entries.push((path_to_forward_slash(rel), mtime_ns));
    }
    entries.sort();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    for (p, m) in &entries {
        p.hash(&mut hasher);
        m.hash(&mut hasher);
    }
    format!("fs:{:x}", hasher.finish())
}

fn git_command(repo_root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_root)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn git_command_bytes(repo_root: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_root)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(output.stdout)
}

fn is_hidden_or_skipped(entry: &walkdir::DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();
    name.starts_with('.') || name == "node_modules"
}

fn path_to_forward_slash(p: &Path) -> String {
    p.components()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join("/")
}

/// Looks for `.git` AT the project root or its immediate parent. We don't walk
/// further up — otherwise a folder loaded from inside an unrelated git checkout
/// (e.g. the user's home dir or `~/Projects`) would attribute authorship from
/// that unrelated repo's history.
fn find_git_root(start: &Path) -> Option<PathBuf> {
    if start.join(".git").is_dir() {
        return Some(start.to_path_buf());
    }
    let parent = start.parent()?;
    if parent.join(".git").is_dir() {
        return Some(parent.to_path_buf());
    }
    None
}

/// Returns "<slug>" or "archive/<slug>" for a path under `openspec/changes/...`,
/// or `None` for paths that don't belong to a change folder.
fn change_key_for(rel_path: &str) -> Option<String> {
    let prefix = "openspec/changes/";
    let rest = rel_path.strip_prefix(prefix)?;
    let mut parts = rest.splitn(3, '/');
    let first = parts.next()?;
    if first == "archive" {
        let slug = parts.next()?;
        if parts.next().is_none() {
            return None;
        }
        Some(format!("archive/{}", slug))
    } else {
        if parts.next().is_none() {
            return None;
        }
        Some(first.to_string())
    }
}

fn git_log_follow(repo_root: &Path, file_path: &str) -> Result<Vec<CommitInfo>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_root)
        .arg("log")
        .arg("--follow")
        .arg("--format=%H%x09%aN%x09%aE%x09%aI")
        .arg("--")
        .arg(file_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();
    for line in stdout.lines() {
        let mut fields = line.split('\t');
        let hash = fields.next().unwrap_or("").to_string();
        let name = fields.next().unwrap_or("").to_string();
        let email = fields.next().unwrap_or("").to_string();
        let iso_date = fields.next().unwrap_or("").to_string();
        if hash.is_empty() {
            continue;
        }
        commits.push(CommitInfo {
            hash,
            name,
            email,
            iso_date,
        });
    }
    Ok(commits)
}

impl Clone for CommitInfo {
    fn clone(&self) -> Self {
        CommitInfo {
            hash: self.hash.clone(),
            name: self.name.clone(),
            email: self.email.clone(),
            iso_date: self.iso_date.clone(),
        }
    }
}

/// `commits` is newest-first (git log default). Oldest = last element.
fn rollup(commits: &[CommitInfo]) -> DocAuthor {
    let mut sorted = commits.to_vec();
    sorted.sort_by(|a, b| a.iso_date.cmp(&b.iso_date));
    let oldest = &sorted[0];
    let newest = &sorted[sorted.len() - 1];
    let mut hashes: BTreeSet<&str> = BTreeSet::new();
    for c in &sorted {
        hashes.insert(c.hash.as_str());
    }
    DocAuthor {
        created_by: Person {
            name: oldest.name.clone(),
            email: oldest.email.clone(),
        },
        created_at: oldest.iso_date.clone(),
        last_edited_by: Person {
            name: newest.name.clone(),
            email: newest.email.clone(),
        },
        last_edited_at: newest.iso_date.clone(),
        edit_count: hashes.len() as u32,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_repo, repo_signature])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
