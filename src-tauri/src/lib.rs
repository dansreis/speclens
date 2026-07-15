mod ai;
mod appimage;

use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use git2::{Mailmap, Repository};
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
    /// True when `.git/` was found at the project root or its immediate
    /// parent. Mirrors what `find_git_root` returns at load time.
    has_git: bool,
    /// Full SHA of the current HEAD commit when `has_git` is true. None
    /// when there's no git, when the repo has no commits yet, or when
    /// HEAD can't be resolved for any other reason.
    head_sha: Option<String>,
    /// Fingerprint of the repo's current state. See `compute_signature`.
    signature: String,
}

#[derive(Clone)]
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
    let git_root_opt = find_git_root(project_root);
    let has_git = git_root_opt.is_some();
    let mut head_sha: Option<String> = None;

    if let Some(git_root) = &git_root_opt {
        if let Ok(repo) = Repository::open(git_root) {
            head_sha = head_commit_sha(&repo);
            // Loaded once per repo; resolves %aN/%aE-style mailmapped
            // identities. When no .mailmap exists this is an empty map that
            // resolves every signature to itself (plain %an/%ae behavior).
            let mailmap = repo.mailmap().ok();
            let project_rel = project_root
                .strip_prefix(git_root)
                .map_err(|e| e.to_string())?;
            let project_rel_str = path_to_forward_slash(project_rel);
            // Derive per-file authorship across renames with ONE pass over
            // history (see collect_file_histories) instead of a revwalk per
            // file - the per-file variant was O(files x commits) and took
            // minutes-to-hours on large repos.
            let tracked: HashMap<String, String> = files
                .keys()
                .map(|rel| {
                    let git_path = if project_rel_str.is_empty() {
                        rel.clone()
                    } else {
                        format!("{}/{}", project_rel_str, rel)
                    };
                    (git_path, rel.clone())
                })
                .collect();
            let pathspec = if project_rel_str.is_empty() {
                "openspec".to_string()
            } else {
                format!("{}/openspec", project_rel_str)
            };
            let histories = collect_file_histories(&repo, mailmap.as_ref(), &tracked, &pathspec)
                .unwrap_or_default();
            let mut commits_by_change: HashMap<String, Vec<CommitInfo>> = HashMap::new();
            for (rel, commits) in histories {
                if commits.is_empty() {
                    continue;
                }
                if let Some(change_key) = change_key_for(&rel) {
                    commits_by_change
                        .entry(change_key)
                        .or_default()
                        .extend(commits.iter().cloned());
                }
                authorship.insert(rel, rollup(&commits));
            }
            for (key, commits) in commits_by_change {
                change_rollups.insert(key, rollup(&commits));
            }
        }
    }

    let signature = compute_signature(project_root);

    Ok(RepoPayload {
        id: id.to_string(),
        files,
        authorship,
        change_rollups,
        has_git,
        head_sha,
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

/// Resolves the folder the user picked to the actual project root. A project
/// root is the folder that *contains* an `openspec/` directory. If the user
/// instead picked the `openspec/` directory itself, return its parent so
/// `<root>/openspec` resolves correctly. Any other folder is rejected, so the
/// add-repository flow can refuse it before a broken source is persisted.
#[tauri::command]
fn resolve_repo_root(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    // Already a valid root: it contains an openspec/ subdirectory.
    if p.join("openspec").is_dir() {
        return Ok(path);
    }
    // Picked the openspec/ dir itself: named "openspec" and holding the usual
    // OpenSpec contents. Use its parent so <parent>/openspec == the picked dir.
    let is_openspec_dir = p.file_name().map(|n| n == "openspec").unwrap_or(false)
        && (p.join("changes").is_dir()
            || p.join("specs").is_dir()
            || p.join("config.yaml").is_file());
    if is_openspec_dir {
        if let Some(parent) = p.parent() {
            return Ok(parent.to_string_lossy().into_owned());
        }
    }
    Err(format!("No openspec/ folder found inside {}", p.display()))
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
        let repo = Repository::open(&git_root).ok();
        let head = repo.as_ref().and_then(head_commit_sha).unwrap_or_default();
        let project_rel = project_root
            .strip_prefix(&git_root)
            .ok()
            .map(path_to_forward_slash)
            .unwrap_or_default();
        // Tracked = index entries; untracked-not-ignored = WT_NEW statuses.
        // BTreeSet gives a deterministic order and dedups paths that appear
        // in both sets.
        let mut paths: BTreeSet<Vec<u8>> = BTreeSet::new();
        if let Some(repo) = &repo {
            if let Ok(index) = repo.index() {
                for entry in index.iter() {
                    if in_subtree(&entry.path, &project_rel) {
                        paths.insert(entry.path.clone());
                    }
                }
            }
            let mut opts = git2::StatusOptions::new();
            opts.include_untracked(true)
                .recurse_untracked_dirs(true)
                .include_ignored(false)
                .include_unmodified(false);
            if !project_rel.is_empty() {
                opts.pathspec(&project_rel);
            }
            if let Ok(statuses) = repo.statuses(Some(&mut opts)) {
                for entry in statuses.iter() {
                    if entry.status().contains(git2::Status::WT_NEW)
                        && in_subtree(entry.path_bytes(), &project_rel)
                    {
                        paths.insert(entry.path_bytes().to_vec());
                    }
                }
            }
        }
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        for path_bytes in &paths {
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

/// True when `path` (repo-relative, forward slashes) is `prefix` itself or
/// lives under `prefix/`. An empty prefix matches everything (project root
/// == git root).
fn in_subtree(path: &[u8], prefix: &str) -> bool {
    if prefix.is_empty() {
        return true;
    }
    let p = prefix.as_bytes();
    path.starts_with(p) && (path.len() == p.len() || path[p.len()] == b'/')
}

fn head_commit_sha(repo: &Repository) -> Option<String> {
    repo.head().ok()?.target().map(|oid| oid.to_string())
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
/// further up - otherwise a folder loaded from inside an unrelated git checkout
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
        parts.next()?;
        Some(format!("archive/{}", slug))
    } else {
        parts.next()?;
        Some(first.to_string())
    }
}

/// (blob id, filemode) of `path` in `tree`, or None when the path is absent.
fn entry_sig(tree: &git2::Tree, path: &Path) -> Option<(git2::Oid, i32)> {
    tree.get_path(path).ok().map(|e| (e.id(), e.filemode()))
}

fn commit_info(mailmap: Option<&Mailmap>, commit: &git2::Commit) -> CommitInfo {
    // %aN/%aE semantics: resolve the author through the repo's mailmap when
    // one exists; otherwise this behaves like plain %an/%ae.
    let author: git2::Signature = match mailmap.and_then(|m| commit.author_with_mailmap(m).ok()) {
        Some(sig) => sig,
        None => commit.author(),
    };
    CommitInfo {
        hash: commit.id().to_string(),
        name: String::from_utf8_lossy(author.name_bytes()).into_owned(),
        email: String::from_utf8_lossy(author.email_bytes()).into_owned(),
        iso_date: format_iso8601(&author.when()),
    }
}

/// git's `%aI`: strict ISO 8601 rendered in the author's own UTC offset,
/// e.g. `2026-07-09T18:40:00+01:00`. Built by hand from git2's
/// (seconds-since-epoch, offset-minutes) pair to avoid a chrono dependency.
fn format_iso8601(time: &git2::Time) -> String {
    let offset = time.offset_minutes();
    let local_secs = time.seconds() + i64::from(offset) * 60;
    let days = local_secs.div_euclid(86_400);
    let secs_of_day = local_secs.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let sign = if offset < 0 { '-' } else { '+' };
    let abs = offset.abs();
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}{}{:02}:{:02}",
        year,
        month,
        day,
        secs_of_day / 3600,
        (secs_of_day % 3600) / 60,
        secs_of_day % 60,
        sign,
        abs / 60,
        abs % 60
    )
}

/// Days-since-epoch → (year, month, day) in the proleptic Gregorian calendar.
/// Howard Hinnant's `civil_from_days` algorithm.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097); // [0, 146096]
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32; // [1, 12]
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Single-pass authorship for every tracked file: the libgit2 equivalent of
/// running `git log --follow --format=%H%x09%aN%x09%aE%x09%aI -- <path>` for
/// each file, but with ONE revwalk over history instead of one per file.
/// Each commit is diffed against its parents with the diff restricted to
/// `pathspec` (the project's openspec/ subtree), and every touched path is
/// attributed to the tracked file currently at that path. The old per-file
/// walk was O(files x commits) and took minutes-to-hours on repos with
/// thousands of commits and thousands of specs; this is O(commits) with
/// cheap adjacent-tree diffs.
///
/// Per-path semantics match the old walk:
/// - A commit counts for a path when the path is TREESAME to no parent
///   (for merges: changed against every parent - the intersection of the
///   per-parent diffs).
/// - When a tracked path appears as an add (absent from every parent),
///   rename detection runs against the first parent and the old path is
///   followed into older history.
/// - Root commits count for every tracked path present in their tree.
///
/// Known divergences from `git log --follow` (mostly unchanged from the
/// per-file implementation):
/// - History simplification: when a merge is TREESAME to one parent, git
///   follows only that parent and prunes the other side. We record a commit
///   whenever the path changed against every parent, so commits whose
///   changes were later discarded by a merge can still be reported.
/// - Rename detection runs against the first parent only, and only when the
///   file is absent from every parent.
/// - Rename detection now happens inside the pathspec-limited diff, so a
///   rename whose old path lies outside the openspec/ subtree is seen as a
///   plain add (the per-file walk diffed the whole tree). Moves within
///   openspec/ - e.g. archiving a change - are followed as before.
/// - If a file was deleted and later re-added, we keep matching the same
///   path into older history instead of restarting follow at the re-add.
fn collect_file_histories(
    repo: &Repository,
    mailmap: Option<&Mailmap>,
    tracked: &HashMap<String, String>,
    pathspec: &str,
) -> Result<HashMap<String, Vec<CommitInfo>>, String> {
    let mut histories: HashMap<String, Vec<CommitInfo>> = HashMap::new();
    if tracked.is_empty() {
        return Ok(histories);
    }
    // Where each tracked file lives at the point in history the walk has
    // reached; rewritten as renames are discovered walking backward.
    let mut current: HashMap<PathBuf, String> = tracked
        .iter()
        .map(|(git_path, rel)| (PathBuf::from(git_path), rel.clone()))
        .collect();

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| e.to_string())?;
    if revwalk.push_head().is_err() {
        // Unborn HEAD (no commits yet): no history to report.
        return Ok(histories);
    }

    for oid in revwalk {
        let oid = match oid {
            Ok(o) => o,
            Err(_) => continue,
        };
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let tree = match commit.tree() {
            Ok(t) => t,
            Err(_) => continue,
        };
        let parent_trees: Vec<git2::Tree> =
            commit.parents().filter_map(|p| p.tree().ok()).collect();

        if parent_trees.is_empty() {
            // Root commit: introduces every tracked path present in its tree.
            for (path, rel) in &current {
                if entry_sig(&tree, path).is_some() {
                    histories
                        .entry(rel.clone())
                        .or_default()
                        .push(commit_info(mailmap, &commit));
                }
            }
            continue;
        }

        // Tracked paths touched against EVERY parent (path -> added flag).
        let mut touched: Option<HashMap<PathBuf, bool>> = None;
        let mut first_diff: Option<git2::Diff> = None;
        for (i, parent_tree) in parent_trees.iter().enumerate() {
            let mut opts = git2::DiffOptions::new();
            opts.pathspec(pathspec);
            let diff = match repo.diff_tree_to_tree(Some(parent_tree), Some(&tree), Some(&mut opts))
            {
                Ok(d) => d,
                Err(_) => continue,
            };
            let mut this_parent: HashMap<PathBuf, bool> = HashMap::new();
            for delta in diff.deltas() {
                let added = delta.status() == git2::Delta::Added;
                if let Some(p) = delta.new_file().path() {
                    if current.contains_key(p) {
                        this_parent.insert(p.to_path_buf(), added);
                    }
                }
                if let Some(p) = delta.old_file().path() {
                    if current.contains_key(p) {
                        this_parent.entry(p.to_path_buf()).or_insert(false);
                    }
                }
            }
            touched = Some(match touched {
                None => this_parent,
                // Merge: keep only paths changed against every parent seen
                // so far; "added" holds only if added against all of them.
                Some(prev) => prev
                    .into_iter()
                    .filter_map(|(p, added)| this_parent.get(&p).map(|a| (p, added && *a)))
                    .collect(),
            });
            if i == 0 {
                first_diff = Some(diff);
            }
            if touched.as_ref().is_some_and(|t| t.is_empty()) {
                break;
            }
        }
        let touched = touched.unwrap_or_default();
        if touched.is_empty() {
            continue;
        }

        let info = commit_info(mailmap, &commit);
        for path in touched.keys() {
            if let Some(rel) = current.get(path) {
                histories.entry(rel.clone()).or_default().push(info.clone());
            }
        }

        // Rename following for paths added against every parent.
        let adds: Vec<PathBuf> = touched
            .iter()
            .filter(|(_, &added)| added)
            .map(|(p, _)| p.clone())
            .collect();
        if adds.is_empty() {
            continue;
        }
        let Some(mut diff) = first_diff else { continue };
        let mut find_opts = git2::DiffFindOptions::new();
        find_opts.renames(true);
        if diff.find_similar(Some(&mut find_opts)).is_err() {
            continue;
        }
        for delta in diff.deltas() {
            if delta.status() != git2::Delta::Renamed {
                continue;
            }
            let (Some(new_path), Some(old_path)) =
                (delta.new_file().path(), delta.old_file().path())
            else {
                continue;
            };
            if adds.iter().any(|a| a == new_path) {
                if let Some(rel) = current.remove(new_path) {
                    current.insert(old_path.to_path_buf(), rel);
                }
            }
        }
    }
    Ok(histories)
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
    appimage::apply_startup_safeguards();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(ai::AiState::default())
        .invoke_handler(tauri::generate_handler![
            load_repo,
            repo_signature,
            resolve_repo_root,
            ai::ai_model_status,
            ai::ai_reveal_models_dir,
            ai::ai_download_model,
            ai::ai_delete_model,
            ai::ai_import_model,
            ai::ai_generate,
            ai::ai_cancel_generate
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            // Free llama.cpp's Metal resources before exit: ggml's static
            // destructors abort() if a model is still loaded (see
            // AiState::unload_for_exit).
            if let tauri::RunEvent::Exit = event {
                use tauri::Manager;
                app_handle.state::<ai::AiState>().unload_for_exit();
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{Signature, Time};

    /// Commits `content` at `rel` (repo-relative, forward slashes) on HEAD.
    fn commit_file(
        repo: &Repository,
        rel: &str,
        content: &str,
        name: &str,
        email: &str,
        when: Time,
        msg: &str,
    ) -> git2::Oid {
        let workdir = repo.workdir().unwrap();
        let full = workdir.join(rel);
        fs::create_dir_all(full.parent().unwrap()).unwrap();
        fs::write(&full, content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(rel)).unwrap();
        index.write().unwrap();
        commit_index(repo, &mut index, name, email, when, msg)
    }

    /// Renames `old` → `new` on disk and in the index, then commits.
    fn commit_rename(
        repo: &Repository,
        old: &str,
        new: &str,
        name: &str,
        email: &str,
        when: Time,
        msg: &str,
    ) -> git2::Oid {
        let workdir = repo.workdir().unwrap();
        let new_full = workdir.join(new);
        fs::create_dir_all(new_full.parent().unwrap()).unwrap();
        fs::rename(workdir.join(old), &new_full).unwrap();
        let mut index = repo.index().unwrap();
        index.remove_path(Path::new(old)).unwrap();
        index.add_path(Path::new(new)).unwrap();
        index.write().unwrap();
        commit_index(repo, &mut index, name, email, when, msg)
    }

    fn commit_index(
        repo: &Repository,
        index: &mut git2::Index,
        name: &str,
        email: &str,
        when: Time,
        msg: &str,
    ) -> git2::Oid {
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::new(name, email, &when).unwrap();
        let parent = repo
            .head()
            .ok()
            .and_then(|h| h.target())
            .map(|oid| repo.find_commit(oid).unwrap());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents)
            .unwrap()
    }

    /// Temporary benchmark against a real repo. Run with:
    /// SPECLENS_BENCH_REPO=/path cargo test --release bench_real_repo -- --ignored --nocapture
    #[test]
    #[ignore]
    fn bench_real_repo() {
        let Ok(path) = std::env::var("SPECLENS_BENCH_REPO") else {
            return;
        };
        let start = std::time::Instant::now();
        let payload = load_project("bench", Path::new(&path)).unwrap();
        println!(
            "load_project: {:?} ({} files, {} authorship entries)",
            start.elapsed(),
            payload.files.len(),
            payload.authorship.len()
        );
    }

    #[test]
    fn follows_file_across_rename() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = Repository::init(tmp.path()).unwrap();
        let content = "# Proposal\n\nEnough content for rename detection to be \
                       confident about similarity between the two blobs.\n";
        commit_file(
            &repo,
            "openspec/changes/foo/proposal.md",
            content,
            "Alice",
            "alice@example.com",
            Time::new(1_700_000_000, 0),
            "add proposal",
        );
        commit_rename(
            &repo,
            "openspec/changes/foo/proposal.md",
            "openspec/changes/bar/proposal.md",
            "Bob",
            "bob@example.com",
            Time::new(1_700_100_000, 60),
            "rename change",
        );

        let mailmap = repo.mailmap().ok();
        let rel = "openspec/changes/bar/proposal.md";
        let tracked = HashMap::from([(rel.to_string(), rel.to_string())]);
        let histories =
            collect_file_histories(&repo, mailmap.as_ref(), &tracked, "openspec").unwrap();
        let commits = &histories[rel];
        assert_eq!(commits.len(), 2, "rename + original add");
        // Newest-first, like `git log`.
        assert_eq!(commits[0].name, "Bob");
        assert_eq!(commits[1].name, "Alice");
        assert_eq!(commits[1].email, "alice@example.com");

        // And the rollup attributes creation to the pre-rename author.
        let doc = rollup(commits);
        assert_eq!(doc.created_by.name, "Alice");
        assert_eq!(doc.last_edited_by.name, "Bob");
        assert_eq!(doc.edit_count, 2);
    }

    #[test]
    fn single_walk_attributes_commits_per_file() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = Repository::init(tmp.path()).unwrap();
        let a = "openspec/changes/a/proposal.md";
        let b = "openspec/changes/b/proposal.md";
        commit_file(
            &repo,
            a,
            "a v1",
            "Alice",
            "alice@example.com",
            Time::new(1_700_000_000, 0),
            "add a",
        );
        commit_file(
            &repo,
            b,
            "b v1",
            "Bob",
            "bob@example.com",
            Time::new(1_700_100_000, 0),
            "add b",
        );
        // A commit outside openspec/ must not be attributed to either file.
        commit_file(
            &repo,
            "src/main.rs",
            "fn main() {}",
            "Carol",
            "carol@example.com",
            Time::new(1_700_150_000, 0),
            "unrelated",
        );
        commit_file(
            &repo,
            a,
            "a v2",
            "Carol",
            "carol@example.com",
            Time::new(1_700_200_000, 0),
            "edit a",
        );

        let tracked = HashMap::from([
            (a.to_string(), a.to_string()),
            (b.to_string(), b.to_string()),
        ]);
        let histories = collect_file_histories(&repo, None, &tracked, "openspec").unwrap();

        let a_commits = &histories[a];
        assert_eq!(a_commits.len(), 2, "add + edit");
        assert_eq!(a_commits[0].name, "Carol"); // newest-first
        assert_eq!(a_commits[1].name, "Alice");

        let b_commits = &histories[b];
        assert_eq!(b_commits.len(), 1);
        assert_eq!(b_commits[0].name, "Bob");
    }

    #[test]
    fn iso_date_matches_percent_a_i_shape() {
        // Known conversions, positive / negative / zero offsets.
        assert_eq!(
            format_iso8601(&Time::new(0, 0)),
            "1970-01-01T00:00:00+00:00"
        );
        assert_eq!(
            format_iso8601(&Time::new(0, 60)),
            "1970-01-01T01:00:00+01:00"
        );
        assert_eq!(
            format_iso8601(&Time::new(0, -330)),
            "1969-12-31T18:30:00-05:30"
        );
        // 1_000_000_000 = 2001-09-09T01:46:40Z.
        assert_eq!(
            format_iso8601(&Time::new(1_000_000_000, 90)),
            "2001-09-09T03:16:40+01:30"
        );

        // End-to-end through a real commit's author signature.
        let tmp = tempfile::tempdir().unwrap();
        let repo = Repository::init(tmp.path()).unwrap();
        commit_file(
            &repo,
            "openspec/changes/x/proposal.md",
            "hello",
            "Alice",
            "alice@example.com",
            Time::new(1_000_000_000, 90),
            "add",
        );
        let rel = "openspec/changes/x/proposal.md";
        let tracked = HashMap::from([(rel.to_string(), rel.to_string())]);
        let histories = collect_file_histories(&repo, None, &tracked, "openspec").unwrap();
        let commits = &histories[rel];
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].iso_date, "2001-09-09T03:16:40+01:30");
    }

    #[test]
    fn signature_tracks_content_and_untracked_files() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = Repository::init(tmp.path()).unwrap();
        commit_file(
            &repo,
            "openspec/changes/x/proposal.md",
            "one",
            "Alice",
            "alice@example.com",
            Time::new(1_700_000_000, 0),
            "add",
        );

        let s1 = compute_signature(tmp.path());
        assert!(s1.starts_with("git:"), "git-backed shape: {}", s1);
        // Stable when nothing changes.
        assert_eq!(s1, compute_signature(tmp.path()));

        // Changing a tracked file's content (uncommitted) changes it.
        fs::write(tmp.path().join("openspec/changes/x/proposal.md"), "two").unwrap();
        let s2 = compute_signature(tmp.path());
        assert_ne!(s1, s2);
        assert_eq!(s2, compute_signature(tmp.path()));

        // A new untracked (non-ignored) file changes it.
        fs::write(tmp.path().join("openspec/changes/x/tasks.md"), "- [ ] a").unwrap();
        let s3 = compute_signature(tmp.path());
        assert_ne!(s2, s3);
        assert_ne!(s1, s3);
        assert_eq!(s3, compute_signature(tmp.path()));
    }

    #[test]
    fn unborn_head_degrades_gracefully() {
        let tmp = tempfile::tempdir().unwrap();
        Repository::init(tmp.path()).unwrap();
        let dir = tmp.path().join("openspec/changes/x");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("proposal.md"), "# Draft").unwrap();

        let payload = load_project("x", tmp.path()).unwrap();
        assert!(payload.has_git);
        assert_eq!(payload.head_sha, None);
        assert!(payload.authorship.is_empty());
        assert!(payload.change_rollups.is_empty());
        assert_eq!(payload.files.len(), 1);
        // Signature keeps the git shape with an empty HEAD component.
        assert!(
            payload.signature.starts_with("git::"),
            "{}",
            payload.signature
        );
        // And it still reacts to content appearing.
        let s1 = payload.signature;
        fs::write(dir.join("tasks.md"), "- [ ] a").unwrap();
        assert_ne!(s1, compute_signature(tmp.path()));
    }
}
