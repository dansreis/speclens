mod ai;

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
            // For each tracked file, derive authorship across renames
            // (the libgit2 equivalent of `git log --follow`).
            let mut commits_by_change: HashMap<String, Vec<CommitInfo>> = HashMap::new();
            for rel in files.keys() {
                let git_path = if project_rel_str.is_empty() {
                    rel.clone()
                } else {
                    format!("{}/{}", project_rel_str, rel)
                };
                let commits = match git_log_follow(&repo, mailmap.as_ref(), &git_path) {
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

/// When `path` was added by `commit` (absent from every parent), run rename
/// detection against the first parent and return the old path if the "add"
/// was really a rename. This is what lets us keep following the file.
fn find_rename_source(repo: &Repository, commit: &git2::Commit, path: &Path) -> Option<PathBuf> {
    let parent_tree = commit.parent(0).ok()?.tree().ok()?;
    let tree = commit.tree().ok()?;
    let mut diff = repo
        .diff_tree_to_tree(Some(&parent_tree), Some(&tree), None)
        .ok()?;
    let mut opts = git2::DiffFindOptions::new();
    opts.renames(true);
    diff.find_similar(Some(&mut opts)).ok()?;
    for delta in diff.deltas() {
        if delta.status() == git2::Delta::Renamed && delta.new_file().path() == Some(path) {
            return delta.old_file().path().map(|p| p.to_path_buf());
        }
    }
    None
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

/// The libgit2 equivalent of
/// `git log --follow --format=%H%x09%aN%x09%aE%x09%aI -- <file_path>`:
/// walks history from HEAD newest-first (commit-time order, git log's
/// default), records every commit where the tracked path's blob differs from
/// its parents', and when the file first appears as an add, uses rename
/// detection to discover the old path and keeps following it.
///
/// Known divergences from `git log --follow`:
/// - History simplification: when a merge is TREESAME to one parent, git
///   silently follows only that parent and prunes the other side entirely.
///   We walk all parents (skipping merge commits that are TREESAME to any
///   parent), so commits whose changes were later discarded by a merge can
///   still be reported.
/// - Rename detection runs against the first parent only, and only when the
///   file is absent from every parent.
/// - If a file was deleted and later re-added, we keep matching the same
///   path into older history instead of restarting follow at the re-add.
fn git_log_follow(
    repo: &Repository,
    mailmap: Option<&Mailmap>,
    file_path: &str,
) -> Result<Vec<CommitInfo>, String> {
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| e.to_string())?;
    if revwalk.push_head().is_err() {
        // Unborn HEAD (no commits yet): no history to report.
        return Ok(Vec::new());
    }
    let mut current_path = PathBuf::from(file_path);
    let mut commits: Vec<CommitInfo> = Vec::new();
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
        let cur = entry_sig(&tree, &current_path);
        let parent_sigs: Vec<Option<(git2::Oid, i32)>> = commit
            .parents()
            .map(|p| p.tree().ok().and_then(|t| entry_sig(&t, &current_path)))
            .collect();
        if parent_sigs.is_empty() {
            // Root commit: only relevant if it introduced the file.
            if cur.is_none() {
                continue;
            }
        } else if parent_sigs.contains(&cur) {
            // TREESAME to at least one parent: the commit didn't touch the
            // tracked path (or, for a merge, simply took one side's version).
            continue;
        }
        commits.push(commit_info(mailmap, &commit));
        // File added in this commit (absent from every parent): check
        // whether the add was really a rename and keep following.
        if cur.is_some() && !parent_sigs.is_empty() && parent_sigs.iter().all(|p| p.is_none()) {
            if let Some(old) = find_rename_source(repo, &commit, &current_path) {
                current_path = old;
            }
        }
    }
    Ok(commits)
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
        let commits =
            git_log_follow(&repo, mailmap.as_ref(), "openspec/changes/bar/proposal.md").unwrap();
        assert_eq!(commits.len(), 2, "rename + original add");
        // Newest-first, like `git log`.
        assert_eq!(commits[0].name, "Bob");
        assert_eq!(commits[1].name, "Alice");
        assert_eq!(commits[1].email, "alice@example.com");

        // And the rollup attributes creation to the pre-rename author.
        let doc = rollup(&commits);
        assert_eq!(doc.created_by.name, "Alice");
        assert_eq!(doc.last_edited_by.name, "Bob");
        assert_eq!(doc.edit_count, 2);
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
        let commits = git_log_follow(&repo, None, "openspec/changes/x/proposal.md").unwrap();
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
