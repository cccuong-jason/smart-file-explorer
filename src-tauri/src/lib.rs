use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Duration;
use std::{
    env, fs,
    io::{Read, Seek, SeekFrom},
};
use tauri::{AppHandle, Emitter, Manager, State};
use walkdir::{DirEntry, WalkDir};

const OPENROUTER_KEY_SERVICE: &str = "smart-file-explorer";
const OPENROUTER_KEY_ACCOUNT: &str = "openrouter_api_key";
const RECENT_FRONTEND_EVENT_LIMIT: usize = 500;
const DIAGNOSTIC_LOG_FILE_LIMIT: usize = 5;
const DIAGNOSTIC_LOG_TAIL_BYTES: u64 = 200_000;

struct AppState {
    watch_manager: Mutex<WatchManagerState>,
    debounce_tokens: Arc<Mutex<HashMap<String, u64>>>,
    next_debounce_token: Arc<AtomicU64>,
    scan_sessions: Arc<Mutex<HashMap<String, NativeScanSessionControl>>>,
    next_scan_session_id: Arc<AtomicU64>,
    recent_frontend_events: Mutex<VecDeque<FrontendLogEvent>>,
}

struct WatchManagerState {
    watcher: Option<RecommendedWatcher>,
    active_roots: Vec<PathBuf>,
}

#[derive(Clone, Debug, Default)]
struct NativeScanSessionControl {
    paused: bool,
    cancelled: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct NativeWatchStateSnapshot {
    watched_folders: Vec<WatchedFolderRecord>,
    active_roots: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct FrontendLogEvent {
    id: String,
    timestamp: String,
    level: String,
    area: String,
    event: String,
    message: String,
    correlation_id: Option<String>,
    session_id: Option<String>,
    path: Option<String>,
    data: Option<serde_json::Value>,
    error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticSnapshot {
    source: String,
    app_version: String,
    generated_at: String,
    log_file_path: Option<String>,
    native_log_files: Vec<DiagnosticLogFile>,
    watched_folders: Vec<WatchedFolderRecord>,
    active_watch_roots: Vec<String>,
    recent_frontend_events: Vec<FrontendLogEvent>,
    scan_sessions: Vec<ScanSessionDiagnostic>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticLogFile {
    path: String,
    truncated: bool,
    content: String,
}

#[derive(Clone, Serialize)]
struct FileEventPayload {
    kind: String,
    path: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeScanSessionEvent {
    event_type: String,
    session_id: String,
    scope: String,
    phase: String,
    discovered_count: u64,
    total_known_count: u64,
    current_path: Option<String>,
    watch_path: Option<String>,
    batch: Option<Vec<FileMetadata>>,
    error: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ScanSessionDiagnostic {
    session_id: String,
    paused: bool,
    cancelled: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct WatchedFolderRecord {
    path: String,
    enabled: bool,
    status: String,
    last_scan_started_at: Option<u64>,
    last_scan_completed_at: Option<u64>,
    last_error: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ScanDirectorySuggestion {
    path: String,
    label: String,
    description: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    path: String,
    name: String,
    size: u64,
    #[serde(rename = "type")]
    file_type: String,
    last_modified: u64,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ExtractedSegment {
    text: String,
    page_number: Option<u32>,
    source_label: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct FolderIntelligenceFileContext {
    path: String,
    name: String,
    group: Option<String>,
    subtype: Option<String>,
    last_modified: u64,
    is_starred: bool,
    is_likely_latest: bool,
    indexing_stage: Option<String>,
    tags: Vec<String>,
    snippet: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct FolderIntelligenceRequest {
    workspace_id: String,
    title: String,
    path: String,
    file_count: u32,
    ocr_count: u32,
    recent_count: u32,
    primary_type_label: String,
    project_keywords: Vec<String>,
    summary: String,
    highlights: Vec<String>,
    top_files: Vec<FolderIntelligenceFileContext>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct FolderIntelligenceSummary {
    workspace_id: String,
    title: Option<String>,
    summary: String,
    highlights: Vec<String>,
    rationale: Vec<String>,
    model: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CloudIntelligenceConfig {
    model: String,
    last_tested_at: Option<u64>,
    last_error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CloudIntelligenceStatus {
    configured: bool,
    source: String,
    model: String,
    last_tested_at: Option<u64>,
    last_error: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveCloudIntelligenceConfigInput {
    api_key: String,
    model: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TestCloudIntelligenceConnectionInput {
    api_key: Option<String>,
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenRouterMessage {
    content: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterMessage,
}

#[derive(Debug, Deserialize)]
struct OpenRouterResponse {
    choices: Vec<OpenRouterChoice>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
struct OpenRouterConnectionProbe {
    ok: bool,
}

#[derive(Debug, Deserialize)]
struct FolderIntelligenceSummaryPayload {
    title: Option<String>,
    summary: String,
    highlights: Vec<String>,
    rationale: Vec<String>,
}

fn is_ignored_dir(entry: &DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return false;
    }
    entry
        .file_name()
        .to_str()
        .map(|s| {
            s.starts_with('.')
                || s.starts_with('$')
                || s == "node_modules"
                || s == "dist"
                || s == "build"
                || s == "target"
                || s == "System Volume Information"
                || s == "Windows"
                || s == "ProgramData"
        })
        .unwrap_or(false)
}

fn is_supported_text_ext(ext: &str) -> bool {
    [
        "txt", "md", "json", "js", "ts", "tsx", "jsx", "css", "html", "py", "java", "c", "cpp",
        "h", "hpp", "rs", "go", "yml", "yaml", "xml", "ini", "env", "sh", "bat", "ps1", "sql",
        "rb", "php", "pdf", "doc", "docx", "png", "jpg", "jpeg",
    ]
    .contains(&ext)
}

fn is_ignored_file_ext(ext: &str) -> bool {
    [
        "gif", "bmp", "webp", "svg", "ico", "tiff", "mp4", "mov", "avi", "mkv", "mp3", "wav",
        "ogg", "zip", "tar", "gz", "7z", "exe", "dll", "bin", "iso", "ds_store",
    ]
    .contains(&ext)
}

fn build_file_metadata(
    path: &Path,
    name: String,
    metadata: std::fs::Metadata,
    ext: &str,
) -> FileMetadata {
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    FileMetadata {
        path: path.to_string_lossy().into_owned(),
        name,
        size: metadata.len(),
        file_type: format!("application/{ext}"),
        last_modified: modified,
    }
}

fn collect_scannable_files(dir_path: &str) -> Result<Vec<FileMetadata>, String> {
    let mut files = Vec::new();
    let walker = WalkDir::new(dir_path).into_iter();

    for entry in walker
        .filter_entry(|e| !is_ignored_dir(e))
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let Some(ext) = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase())
        else {
            continue;
        };

        if is_ignored_file_ext(&ext) || !is_supported_text_ext(&ext) {
            continue;
        }

        if let Ok(metadata) = entry.metadata() {
            files.push(build_file_metadata(
                path,
                entry.file_name().to_string_lossy().into_owned(),
                metadata,
                &ext,
            ));
        }
    }

    Ok(files)
}

fn extract_text_by_extension(path: &Path, ext: &str) -> Result<String, String> {
    match ext {
        "pdf" => pdf_extract::extract_text(path).map_err(|e| e.to_string()),
        "docx" => extract_docx_text(path),
        _ => fs::read_to_string(path)
            .or_else(|_| fs::read(path).map(|bytes| String::from_utf8_lossy(&bytes).into_owned()))
            .map_err(|e| e.to_string()),
    }
}

fn extract_docx_text(path: &Path) -> Result<String, String> {
    let segments = extract_docx_segments(path)?;
    Ok(segments
        .into_iter()
        .map(|segment| segment.text)
        .collect::<Vec<_>>()
        .join("\n"))
}

fn split_plain_text_segments(text: &str) -> Vec<ExtractedSegment> {
    text.split("\n\n")
        .map(|part| part.replace('\r', "").trim().to_string())
        .filter(|part| !part.is_empty())
        .map(|text| ExtractedSegment {
            text,
            page_number: None,
            source_label: None,
        })
        .collect()
}

fn extract_docx_segments(path: &Path) -> Result<Vec<ExtractedSegment>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut document_xml = String::new();

    archive
        .by_name("word/document.xml")
        .map_err(|e| e.to_string())?
        .read_to_string(&mut document_xml)
        .map_err(|e| e.to_string())?;

    let mut reader = Reader::from_str(&document_xml);
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut segments = Vec::new();
    let mut current = String::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Text(text)) => {
                let value = text.xml_content().map_err(|e| e.to_string())?.into_owned();
                if !value.trim().is_empty() {
                    if !current.is_empty() {
                        current.push(' ');
                    }
                    current.push_str(value.trim());
                }
            }
            Ok(Event::End(end)) if end.name().as_ref() == b"w:p" => {
                let paragraph = current.trim().to_string();
                if !paragraph.is_empty() {
                    segments.push(ExtractedSegment {
                        text: paragraph,
                        page_number: None,
                        source_label: Some(format!("Paragraph {}", segments.len() + 1)),
                    });
                }
                current.clear();
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(error.to_string()),
        }
        buffer.clear();
    }

    if !current.trim().is_empty() {
        segments.push(ExtractedSegment {
            text: current.trim().to_string(),
            page_number: None,
            source_label: Some(format!("Paragraph {}", segments.len() + 1)),
        });
    }

    Ok(segments)
}

fn extract_document_segments_by_extension(
    path: &Path,
    ext: &str,
) -> Result<Vec<ExtractedSegment>, String> {
    match ext {
        "pdf" => {
            let pages = pdf_extract::extract_text_by_pages(path).map_err(|e| e.to_string())?;
            Ok(pages
                .into_iter()
                .enumerate()
                .map(|(_index, page)| page.replace('\r', "").trim().to_string())
                .filter(|page| !page.is_empty())
                .enumerate()
                .map(|(index, text)| ExtractedSegment {
                    text,
                    page_number: Some(index as u32 + 1),
                    source_label: Some(format!("Page {}", index + 1)),
                })
                .collect())
        }
        "doc" => Ok(Vec::new()),
        "docx" => extract_docx_segments(path),
        "png" | "jpg" | "jpeg" => Ok(Vec::new()),
        _ => {
            let text = extract_text_by_extension(path, ext)?;
            Ok(split_plain_text_segments(&text))
        }
    }
}

fn project_env_candidates() -> Vec<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let manifest_parent = manifest_dir.parent().map(Path::to_path_buf);
    let current_dir = env::current_dir().ok();

    [
        current_dir.clone().map(|dir| dir.join(".env.local")),
        current_dir.map(|dir| dir.join(".env")),
        manifest_parent.clone().map(|dir| dir.join(".env.local")),
        manifest_parent.map(|dir| dir.join(".env")),
        Some(manifest_dir.join(".env.local")),
        Some(manifest_dir.join(".env")),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn load_project_env_files() {
    for candidate in project_env_candidates() {
        if candidate.exists() {
            let _ = dotenvy::from_path_override(candidate);
        }
    }
}

fn watched_folders_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|error| error.to_string())?;
    Ok(config_dir.join("watched-folders.json"))
}

fn load_watched_folder_records(app_handle: &AppHandle) -> Result<Vec<WatchedFolderRecord>, String> {
    let path = watched_folders_path(app_handle)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn save_watched_folder_records(
    app_handle: &AppHandle,
    records: &[WatchedFolderRecord],
) -> Result<(), String> {
    let path = watched_folders_path(app_handle)?;
    let content = serde_json::to_string_pretty(records).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn unix_timestamp_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn diagnostic_log_file_path(app_handle: &AppHandle) -> Option<String> {
    app_handle
        .path()
        .app_log_dir()
        .ok()
        .map(|path| path.to_string_lossy().into_owned())
}

fn read_diagnostic_log_tail(path: &Path) -> Result<(String, bool), String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let size = file.metadata().map_err(|error| error.to_string())?.len();
    let truncated = size > DIAGNOSTIC_LOG_TAIL_BYTES;

    if truncated {
        file.seek(SeekFrom::Start(size - DIAGNOSTIC_LOG_TAIL_BYTES))
            .map_err(|error| error.to_string())?;
    }

    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;

    Ok((String::from_utf8_lossy(&bytes).into_owned(), truncated))
}

fn read_native_log_files(app_handle: &AppHandle) -> Vec<DiagnosticLogFile> {
    let Ok(log_dir) = app_handle.path().app_log_dir() else {
        return Vec::new();
    };
    let Ok(entries) = fs::read_dir(log_dir) else {
        return Vec::new();
    };

    let mut files = entries
        .flatten()
        .filter(|entry| {
            entry
                .file_type()
                .map(|file_type| file_type.is_file())
                .unwrap_or(false)
        })
        .filter(|entry| {
            entry
                .path()
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| extension.eq_ignore_ascii_case("log"))
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();

    files.sort_by(|left, right| {
        let left_modified = left
            .metadata()
            .and_then(|metadata| metadata.modified())
            .ok();
        let right_modified = right
            .metadata()
            .and_then(|metadata| metadata.modified())
            .ok();
        right_modified.cmp(&left_modified)
    });

    files
        .into_iter()
        .take(DIAGNOSTIC_LOG_FILE_LIMIT)
        .filter_map(|entry| {
            let path = entry.path();
            read_diagnostic_log_tail(&path)
                .ok()
                .map(|(content, truncated)| DiagnosticLogFile {
                    path: path.to_string_lossy().into_owned(),
                    truncated,
                    content,
                })
        })
        .collect()
}

fn build_diagnostic_snapshot(
    app_handle: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<DiagnosticSnapshot, String> {
    let watched_folders = load_watched_folder_records(app_handle)?;
    let active_watch_roots = state
        .watch_manager
        .lock()
        .unwrap()
        .active_roots
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    let recent_frontend_events = state
        .recent_frontend_events
        .lock()
        .unwrap()
        .iter()
        .cloned()
        .collect::<Vec<_>>();
    let scan_sessions = state
        .scan_sessions
        .lock()
        .unwrap()
        .iter()
        .map(|(session_id, session)| ScanSessionDiagnostic {
            session_id: session_id.clone(),
            paused: session.paused,
            cancelled: session.cancelled,
        })
        .collect::<Vec<_>>();

    Ok(DiagnosticSnapshot {
        source: "native".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        generated_at: unix_timestamp_millis().to_string(),
        log_file_path: diagnostic_log_file_path(app_handle),
        native_log_files: read_native_log_files(app_handle),
        watched_folders,
        active_watch_roots,
        recent_frontend_events,
        scan_sessions,
    })
}

fn normalize_watch_path(value: &str) -> String {
    let path = PathBuf::from(value.trim());
    fs::canonicalize(&path)
        .unwrap_or(path)
        .to_string_lossy()
        .into_owned()
}

fn normalize_watched_folder_record(record: WatchedFolderRecord) -> WatchedFolderRecord {
    WatchedFolderRecord {
        path: normalize_watch_path(&record.path),
        ..record
    }
}

fn upsert_watched_folder_record(
    app_handle: &AppHandle,
    folder: WatchedFolderRecord,
) -> Result<Vec<WatchedFolderRecord>, String> {
    let folder = normalize_watched_folder_record(folder);
    let mut records = load_watched_folder_records(app_handle)?;

    if let Some(existing) = records.iter_mut().find(|record| record.path == folder.path) {
        *existing = folder;
    } else {
        records.push(folder);
    }

    records.sort_by(|a, b| a.path.cmp(&b.path));
    save_watched_folder_records(app_handle, &records)?;
    Ok(records)
}

fn update_watched_folder_enabled(
    app_handle: &AppHandle,
    path: &str,
    enabled: bool,
) -> Result<Vec<WatchedFolderRecord>, String> {
    let normalized_path = normalize_watch_path(path);
    let mut records = load_watched_folder_records(app_handle)?;

    if let Some(existing) = records
        .iter_mut()
        .find(|record| record.path == normalized_path)
    {
        existing.enabled = enabled;
        existing.status = if enabled { "watching" } else { "paused" }.to_string();
        existing.last_error = None;
    }

    save_watched_folder_records(app_handle, &records)?;
    Ok(records)
}

fn remove_watched_folder_record(
    app_handle: &AppHandle,
    path: &str,
) -> Result<Vec<WatchedFolderRecord>, String> {
    let normalized_path = normalize_watch_path(path);
    let mut records = load_watched_folder_records(app_handle)?;
    records.retain(|record| record.path != normalized_path);
    save_watched_folder_records(app_handle, &records)?;
    Ok(records)
}

fn effective_watch_roots(records: &[WatchedFolderRecord]) -> Vec<PathBuf> {
    let mut enabled_paths = records
        .iter()
        .filter(|record| record.enabled)
        .map(|record| PathBuf::from(&record.path))
        .collect::<Vec<_>>();

    enabled_paths.sort();

    let mut roots: Vec<PathBuf> = Vec::new();
    for path in enabled_paths {
        if roots.iter().any(|existing| path.starts_with(existing)) {
            continue;
        }
        roots.retain(|existing| !existing.starts_with(&path));
        roots.push(path);
    }

    roots
}

fn is_temporary_or_partial_download(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();
    file_name.starts_with("~$")
        || file_name.ends_with(".tmp")
        || file_name.ends_with(".temp")
        || file_name.ends_with(".part")
        || file_name.ends_with(".partial")
        || file_name.ends_with(".crdownload")
}

#[cfg(test)]
fn should_emit_watched_file_event(path: &Path) -> bool {
    watched_file_event_rejection_reason(path).is_none()
}

fn watched_file_event_rejection_reason(path: &Path) -> Option<&'static str> {
    if !path.is_file() {
        return Some("not_a_file");
    }

    if is_temporary_or_partial_download(path) {
        return Some("temporary_or_incomplete_download");
    }

    let Some(ext) = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
    else {
        return Some("missing_extension");
    };

    if is_ignored_file_ext(&ext) || !is_supported_text_ext(&ext) {
        return Some("unsupported_extension");
    }

    None
}

fn should_include_scanned_file(path: &Path) -> bool {
    if !path.is_file() || is_temporary_or_partial_download(path) {
        return false;
    }

    let Some(ext) = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
    else {
        return false;
    };

    !is_ignored_file_ext(&ext) && is_supported_text_ext(&ext)
}

fn emit_scan_session_event(app_handle: &AppHandle, event: NativeScanSessionEvent) {
    let _ = app_handle.emit("scan-session-event", event);
}

fn wait_for_scan_session_turn(
    scan_sessions: &Arc<Mutex<HashMap<String, NativeScanSessionControl>>>,
    session_id: &str,
) -> Result<(), String> {
    loop {
        let state = scan_sessions
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
            .unwrap_or_default();

        if state.cancelled {
            return Err("cancelled".to_string());
        }

        if !state.paused {
            return Ok(());
        }

        std::thread::sleep(Duration::from_millis(25));
    }
}

fn emit_debounced_watch_event(
    app_handle: AppHandle,
    tokens: Arc<Mutex<HashMap<String, u64>>>,
    next_debounce_token: Arc<AtomicU64>,
    kind: &str,
    path: &Path,
) {
    let path_string = path.to_string_lossy().into_owned();
    let kind_string = kind.to_string();

    if kind_string == "remove" {
        log::info!("[watch] emitting remove event for {}", path_string);
        tokens.lock().unwrap().remove(&path_string);
        let _ = app_handle.emit(
            "sys-file-event",
            FileEventPayload {
                kind: kind_string,
                path: path_string,
            },
        );
        return;
    }

    if let Some(reason) = watched_file_event_rejection_reason(path) {
        log::info!(
            "[watch] ignoring event kind={} path={} reason={}",
            kind_string,
            path_string,
            reason
        );
        return;
    }

    let token = next_debounce_token.fetch_add(1, Ordering::SeqCst) + 1;
    log::info!(
        "[watch] accepted event kind={} path={} token={} status=enqueued_for_background_indexing",
        kind_string,
        path_string,
        token
    );
    tokens.lock().unwrap().insert(path_string.clone(), token);

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(325));
        let should_emit = tokens
            .lock()
            .unwrap()
            .get(&path_string)
            .copied()
            .map(|current| current == token)
            .unwrap_or(false);

        if should_emit {
            log::info!(
                "[watch] emitting debounced event kind={} path={} token={}",
                kind_string,
                path_string,
                token
            );
            let _ = app_handle.emit(
                "sys-file-event",
                FileEventPayload {
                    kind: kind_string.clone(),
                    path: path_string.clone(),
                },
            );
        }
    });
}

fn rebuild_native_watch_roots(
    app_handle: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<Vec<WatchedFolderRecord>, String> {
    let records = load_watched_folder_records(app_handle)?;
    let next_roots = effective_watch_roots(&records);
    log::info!("[watch] rebuilding native watch roots: {:?}", next_roots);
    let mut manager = state.watch_manager.lock().unwrap();

    if manager.watcher.is_none() {
        let handle = app_handle.clone();
        let debounce_tokens = Arc::clone(&state.debounce_tokens);
        let next_debounce_token = Arc::clone(&state.next_debounce_token);
        let watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            if let Ok(event) = res {
                let kind_str = match event.kind {
                    notify::EventKind::Create(_) => "create",
                    notify::EventKind::Modify(notify::event::ModifyKind::Name(_)) => "rename",
                    notify::EventKind::Modify(_) => "modify",
                    notify::EventKind::Remove(_) => "remove",
                    _ => "other",
                };

                if kind_str != "other" {
                    for path in event.paths {
                        emit_debounced_watch_event(
                            handle.clone(),
                            Arc::clone(&debounce_tokens),
                            Arc::clone(&next_debounce_token),
                            kind_str,
                            &path,
                        );
                    }
                }
            }
        })
        .map_err(|error| error.to_string())?;

        manager.watcher = Some(watcher);
    }

    let previous_roots = manager.active_roots.clone();
    if let Some(watcher) = manager.watcher.as_mut() {
        for existing_root in previous_roots.iter() {
            if !next_roots
                .iter()
                .any(|next_root| next_root == existing_root)
            {
                let _ = watcher.unwatch(existing_root);
            }
        }

        for next_root in next_roots.iter() {
            if !previous_roots
                .iter()
                .any(|existing_root| existing_root == next_root)
            {
                log::info!(
                    "[watch] starting watcher for {}",
                    next_root.to_string_lossy()
                );
                watcher
                    .watch(next_root, RecursiveMode::Recursive)
                    .map_err(|error| error.to_string())?;
            }
        }
    }

    manager.active_roots = next_roots;
    Ok(records)
}

fn cloud_config_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|error| error.to_string())?;
    Ok(config_dir.join("cloud-intelligence.json"))
}

fn load_cloud_config(app_handle: &AppHandle) -> Result<CloudIntelligenceConfig, String> {
    let path = cloud_config_path(app_handle)?;
    if !path.exists() {
        return Ok(CloudIntelligenceConfig {
            model: "qwen/qwen3.6-plus".to_string(),
            last_tested_at: None,
            last_error: None,
        });
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut config: CloudIntelligenceConfig =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;
    config.model = normalize_openrouter_model(&config.model);
    Ok(config)
}

fn save_cloud_config_file(
    app_handle: &AppHandle,
    config: &CloudIntelligenceConfig,
) -> Result<(), String> {
    let path = cloud_config_path(app_handle)?;
    let content = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn clear_cloud_config_file(app_handle: &AppHandle) -> Result<(), String> {
    let path = cloud_config_path(app_handle)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(OPENROUTER_KEY_SERVICE, OPENROUTER_KEY_ACCOUNT)
        .map_err(|error| error.to_string())
}

fn get_user_openrouter_api_key() -> Result<Option<String>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn normalize_openrouter_api_key(value: &str) -> String {
    let normalized = value
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .to_string();

    normalized
        .strip_prefix("Bearer ")
        .or_else(|| normalized.strip_prefix("bearer "))
        .unwrap_or(normalized.as_str())
        .trim()
        .to_string()
}

fn normalize_openrouter_model(value: &str) -> String {
    let trimmed = value.trim();
    match trimmed {
        "" | "qwen/qwen3.6-plus:free" => "qwen/qwen3.6-plus".to_string(),
        _ => trimmed.to_string(),
    }
}

fn set_user_openrouter_api_key(value: &str) -> Result<(), String> {
    let entry = keyring_entry()?;
    entry
        .set_password(&normalize_openrouter_api_key(value))
        .map_err(|error| error.to_string())
}

fn clear_user_openrouter_api_key() -> Result<(), String> {
    let entry = keyring_entry()?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn openrouter_model(app_handle: Option<&AppHandle>) -> String {
    if let Some(app_handle) = app_handle {
        if let Ok(config) = load_cloud_config(app_handle) {
            return normalize_openrouter_model(&config.model);
        }
    }

    load_project_env_files();
    normalize_openrouter_model(
        &env::var("OPENROUTER_MODEL").unwrap_or_else(|_| "qwen/qwen3.6-plus".to_string()),
    )
}

fn openrouter_api_key() -> Result<(String, String), String> {
    if let Some(user_key) = get_user_openrouter_api_key()? {
        return Ok((normalize_openrouter_api_key(&user_key), "user".to_string()));
    }

    load_project_env_files();
    env::var("OPENROUTER_API_KEY")
        .or_else(|_| env::var("OPEN_ROUTER_API_KEY"))
        .map(|value| (normalize_openrouter_api_key(&value), "project".to_string()))
        .map_err(|_| "Missing OpenRouter key".to_string())
}

fn openrouter_site_url() -> Option<String> {
    load_project_env_files();
    env::var("OPENROUTER_SITE_URL").ok()
}

fn now_timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn build_cloud_intelligence_status(
    app_handle: Option<&AppHandle>,
    last_error: Option<String>,
) -> Result<CloudIntelligenceStatus, String> {
    let user_key = get_user_openrouter_api_key()?;
    let config = if let Some(app_handle) = app_handle {
        load_cloud_config(app_handle)?
    } else {
        CloudIntelligenceConfig {
            model: "qwen/qwen3.6-plus".to_string(),
            last_tested_at: None,
            last_error: None,
        }
    };

    load_project_env_files();
    let has_project_key =
        env::var("OPENROUTER_API_KEY").is_ok() || env::var("OPEN_ROUTER_API_KEY").is_ok();
    let source = if user_key.is_some() {
        "user"
    } else if has_project_key {
        "project"
    } else {
        "none"
    };

    Ok(CloudIntelligenceStatus {
        configured: source != "none",
        source: source.to_string(),
        model: config.model,
        last_tested_at: config.last_tested_at,
        last_error: last_error.or(config.last_error),
    })
}

fn extract_openrouter_content(content: &serde_json::Value) -> Option<String> {
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }

    content
        .as_array()
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| {
                    part.get("text")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string())
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|text| !text.trim().is_empty())
}

fn extract_json_object_slice(value: &str) -> Option<&str> {
    let start = value.find('{')?;
    let end = value.rfind('}')?;
    (end > start).then_some(&value[start..=end])
}

fn decode_response_bytes_lossy(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

fn build_folder_intelligence_prompt(request: &FolderIntelligenceRequest) -> String {
    let evidence = serde_json::json!({
        "workspaceId": request.workspace_id,
        "title": request.title,
        "path": request.path,
        "fileCount": request.file_count,
        "ocrCount": request.ocr_count,
        "recentCount": request.recent_count,
        "primaryTypeLabel": request.primary_type_label,
        "projectKeywords": request.project_keywords,
        "existingSummary": request.summary,
        "existingHighlights": request.highlights,
        "topFiles": request.top_files,
    });

    format!(
        "You are helping a local-first file intelligence app explain why a workspace matters to an end user focused on work documents and personal productivity.\n\
Return strict JSON only with this shape:\n\
{{\"title\":\"string or null\",\"summary\":\"2-3 grounded sentences\",\"highlights\":[\"max 3 short bullets\"],\"rationale\":[\"max 2 short evidence lines\"]}}\n\
Rules:\n\
- Stay grounded in the provided evidence only.\n\
- Focus on the likely primary document, active project context, and what deserves attention next.\n\
- If evidence is thin, say that briefly instead of inventing.\n\
- No markdown, no code fences, no extra keys.\n\
Evidence:\n{}",
        evidence
    )
}

fn format_openrouter_http_error(status: reqwest::StatusCode, body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return format!("OpenRouter request failed with HTTP {status}");
    }

    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(message) = payload
            .get("error")
            .and_then(|value| value.get("message").or_else(|| value.get("metadata")))
            .and_then(|value| value.as_str())
        {
            return format!("OpenRouter request failed with HTTP {status}: {message}");
        }

        if let Some(message) = payload.get("message").and_then(|value| value.as_str()) {
            return format!("OpenRouter request failed with HTTP {status}: {message}");
        }
    }

    format!("OpenRouter request failed with HTTP {status}: {trimmed}")
}

async fn request_openrouter_folder_summary(
    app_handle: Option<&AppHandle>,
    request: &FolderIntelligenceRequest,
    api_key_override: Option<String>,
    model_override: Option<String>,
) -> Result<FolderIntelligenceSummary, String> {
    let (api_key, _) = match api_key_override {
        Some(api_key) => (api_key, "user".to_string()),
        None => openrouter_api_key()?,
    };
    let model = model_override.unwrap_or_else(|| openrouter_model(app_handle));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| error.to_string())?;

    let mut request_builder = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .header("X-OpenRouter-Title", "Smart File Explorer");

    if let Some(site_url) = openrouter_site_url() {
        request_builder = request_builder.header("HTTP-Referer", site_url);
    }

    let payload = serde_json::json!({
        "model": model,
        "temperature": 0.2,
        "max_tokens": 320,
        "messages": [
            {
                "role": "system",
                "content": "You produce grounded JSON summaries for workspace intelligence cards."
            },
            {
                "role": "user",
                "content": build_folder_intelligence_prompt(request)
            }
        ]
    });

    let response = request_builder
        .json(&payload)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response
            .bytes()
            .await
            .map(|bytes| decode_response_bytes_lossy(bytes.as_ref()))
            .unwrap_or_default();
        return Err(format_openrouter_http_error(status, &body));
    }

    let body = response
        .bytes()
        .await
        .map(|bytes| decode_response_bytes_lossy(bytes.as_ref()))
        .map_err(|error| format!("Failed to read OpenRouter response body: {error}"))?;
    let payload: OpenRouterResponse = serde_json::from_str(&body).map_err(|error| {
        let body_preview = body.chars().take(240).collect::<String>();
        format!("Failed to decode OpenRouter response body: {error}. Body preview: {body_preview}")
    })?;

    let content = payload
        .choices
        .first()
        .and_then(|choice| extract_openrouter_content(&choice.message.content))
        .ok_or_else(|| "OpenRouter returned no message content".to_string())?;

    let payload = extract_json_object_slice(&content).unwrap_or(content.as_str());
    let summary: FolderIntelligenceSummaryPayload = serde_json::from_str(payload)
        .map_err(|error| format!("Failed to parse OpenRouter folder summary: {error}"))?;

    Ok(FolderIntelligenceSummary {
        workspace_id: request.workspace_id.clone(),
        title: summary.title,
        summary: summary.summary.trim().to_string(),
        highlights: summary
            .highlights
            .into_iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .take(3)
            .collect(),
        rationale: summary
            .rationale
            .into_iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .take(2)
            .collect(),
        model,
    })
}

async fn request_openrouter_connection_probe(
    app_handle: Option<&AppHandle>,
    api_key_override: Option<String>,
    model_override: Option<String>,
) -> Result<(), String> {
    let (api_key, _) = match api_key_override {
        Some(api_key) => (api_key, "user".to_string()),
        None => openrouter_api_key()?,
    };
    let model = model_override.unwrap_or_else(|| openrouter_model(app_handle));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;

    let mut request_builder = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .header("X-OpenRouter-Title", "Smart File Explorer");

    if let Some(site_url) = openrouter_site_url() {
        request_builder = request_builder.header("HTTP-Referer", site_url);
    }

    let payload = serde_json::json!({
        "model": model,
        "temperature": 0,
        "max_tokens": 24,
        "messages": [
            {
                "role": "user",
                "content": "Return strict JSON only: {\"ok\":true}"
            }
        ]
    });

    let response = request_builder
        .json(&payload)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = response
        .bytes()
        .await
        .map(|bytes| decode_response_bytes_lossy(bytes.as_ref()))
        .map_err(|error| format!("Failed to read OpenRouter response body: {error}"))?;

    if !status.is_success() {
        return Err(format_openrouter_http_error(status, &body));
    }

    let payload: OpenRouterResponse = serde_json::from_str(&body).map_err(|error| {
        let body_preview = body.chars().take(240).collect::<String>();
        format!("Failed to decode OpenRouter response body: {error}. Body preview: {body_preview}")
    })?;

    let content = payload
        .choices
        .first()
        .and_then(|choice| extract_openrouter_content(&choice.message.content))
        .ok_or_else(|| "OpenRouter returned no message content".to_string())?;

    let probe_payload = extract_json_object_slice(&content).unwrap_or(content.as_str());
    let probe: OpenRouterConnectionProbe = serde_json::from_str(probe_payload)
        .map_err(|error| format!("Failed to parse OpenRouter connection probe: {error}"))?;

    if !probe.ok {
        return Err("OpenRouter connection probe returned ok=false".to_string());
    }

    Ok(())
}

fn default_home_dir() -> Option<std::path::PathBuf> {
    env::var_os("USERPROFILE")
        .map(std::path::PathBuf::from)
        .or_else(|| env::var_os("HOME").map(std::path::PathBuf::from))
}

fn recommended_scan_directories(home_dir: &Path) -> Vec<ScanDirectorySuggestion> {
    [
        ("Documents", "Work documents, drafts, and PDFs"),
        ("Desktop", "Recent files that still need organizing"),
        ("Downloads", "Incoming files and attachments"),
    ]
    .into_iter()
    .filter_map(|(name, description)| {
        let path = home_dir.join(name);
        if path.is_dir() {
            Some(ScanDirectorySuggestion {
                path: path.to_string_lossy().into_owned(),
                label: name.to_string(),
                description: description.to_string(),
            })
        } else {
            None
        }
    })
    .collect()
}

#[tauri::command]
fn extract_text_content(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("Not a file".into());
    }

    let ext = file_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
        .unwrap_or_default();

    extract_text_by_extension(file_path, &ext)
}

#[tauri::command]
fn extract_document_segments(path: String) -> Result<Vec<ExtractedSegment>, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("Not a file".into());
    }

    let ext = file_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
        .unwrap_or_default();

    extract_document_segments_by_extension(file_path, &ext)
}

#[tauri::command]
fn log_frontend_event(event: FrontendLogEvent, state: State<'_, AppState>) -> Result<(), String> {
    {
        let mut events = state.recent_frontend_events.lock().unwrap();
        events.push_back(event.clone());
        while events.len() > RECENT_FRONTEND_EVENT_LIMIT {
            events.pop_front();
        }
    }

    let payload = event
        .data
        .as_ref()
        .and_then(|value| serde_json::to_string(value).ok())
        .unwrap_or_else(|| "{}".to_string());
    let prefix = format!("[frontend:{}:{}] ", event.area, event.event);
    let detail = format!(
        "{}{} correlation_id={:?} session_id={:?} path={:?} data={} error={:?}",
        prefix,
        event.message,
        event.correlation_id,
        event.session_id,
        event.path,
        payload,
        event.error
    );

    match event.level.as_str() {
        "debug" => log::debug!("{detail}"),
        "info" => log::info!("{detail}"),
        "warn" => log::warn!("{detail}"),
        "error" => log::error!("{detail}"),
        _ => log::info!("{detail}"),
    }

    Ok(())
}

#[tauri::command]
fn log_frontend_message(
    level: String,
    message: String,
    context: Option<String>,
) -> Result<(), String> {
    let context_prefix = context
        .as_deref()
        .map(|value| format!("[frontend:{value}] "))
        .unwrap_or_else(|| "[frontend] ".to_string());

    match level.as_str() {
        "info" => log::info!("{context_prefix}{message}"),
        "warn" => log::warn!("{context_prefix}{message}"),
        "error" => log::error!("{context_prefix}{message}"),
        _ => log::info!("{context_prefix}{message}"),
    }

    Ok(())
}

#[tauri::command]
fn get_diagnostic_snapshot(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<DiagnosticSnapshot, String> {
    build_diagnostic_snapshot(&app_handle, &state)
}

#[tauri::command]
fn export_diagnostic_bundle(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let snapshot = build_diagnostic_snapshot(&app_handle, &state)?;
    let diagnostics_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("diagnostics");
    fs::create_dir_all(&diagnostics_dir).map_err(|error| error.to_string())?;
    let path = diagnostics_dir.join(format!(
        "smart-file-explorer-diagnostics-{}.json",
        unix_timestamp_millis()
    ));
    let content = serde_json::to_string_pretty(&snapshot).map_err(|error| error.to_string())?;
    fs::write(&path, content).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn generate_folder_intelligence_summary(
    app_handle: AppHandle,
    request: FolderIntelligenceRequest,
) -> Result<FolderIntelligenceSummary, String> {
    request_openrouter_folder_summary(Some(&app_handle), &request, None, None).await
}

#[tauri::command]
fn get_cloud_intelligence_status(app_handle: AppHandle) -> Result<CloudIntelligenceStatus, String> {
    build_cloud_intelligence_status(Some(&app_handle), None)
}

#[tauri::command]
fn save_cloud_intelligence_config(
    app_handle: AppHandle,
    input: SaveCloudIntelligenceConfigInput,
) -> Result<CloudIntelligenceStatus, String> {
    log::info!("Saving cloud intelligence config");
    set_user_openrouter_api_key(input.api_key.trim())?;
    save_cloud_config_file(
        &app_handle,
        &CloudIntelligenceConfig {
            model: if input.model.trim().is_empty() {
                "qwen/qwen3.6-plus".to_string()
            } else {
                normalize_openrouter_model(input.model.trim())
            },
            last_tested_at: None,
            last_error: None,
        },
    )?;
    build_cloud_intelligence_status(Some(&app_handle), None)
}

#[tauri::command]
async fn test_cloud_intelligence_connection(
    app_handle: AppHandle,
    input: TestCloudIntelligenceConnectionInput,
) -> Result<CloudIntelligenceStatus, String> {
    log::info!("Testing cloud intelligence connection");
    let api_key = input
        .api_key
        .clone()
        .map(|value| normalize_openrouter_api_key(&value))
        .filter(|value| !value.is_empty());
    let model = input
        .model
        .clone()
        .map(|value| normalize_openrouter_model(&value))
        .filter(|value| !value.is_empty());
    let result =
        request_openrouter_connection_probe(Some(&app_handle), api_key, model.clone()).await;

    match result {
        Ok(_) => {
            let mut config = load_cloud_config(&app_handle)?;
            if let Some(model) = model {
                config.model = model;
            }
            config.last_tested_at = Some(now_timestamp_ms());
            config.last_error = None;
            save_cloud_config_file(&app_handle, &config)?;
            log::info!("Cloud intelligence connection test passed");
            build_cloud_intelligence_status(Some(&app_handle), None)
        }
        Err(error) => {
            log::error!("Cloud intelligence connection test failed: {error}");
            let mut config = load_cloud_config(&app_handle)?;
            if let Some(model) = model {
                config.model = model;
            }
            config.last_error = Some(error.clone());
            config.last_tested_at = Some(now_timestamp_ms());
            save_cloud_config_file(&app_handle, &config)?;
            build_cloud_intelligence_status(Some(&app_handle), Some(error))
        }
    }
}

#[tauri::command]
fn clear_cloud_intelligence_config(
    app_handle: AppHandle,
) -> Result<CloudIntelligenceStatus, String> {
    log::info!("Clearing cloud intelligence config");
    clear_user_openrouter_api_key()?;
    clear_cloud_config_file(&app_handle)?;
    build_cloud_intelligence_status(Some(&app_handle), None)
}

#[tauri::command]
fn get_recommended_scan_directories() -> Result<Vec<ScanDirectorySuggestion>, String> {
    let home_dir = default_home_dir().ok_or_else(|| "Home directory unavailable".to_string())?;
    Ok(recommended_scan_directories(&home_dir))
}

#[tauri::command]
fn start_scan_session(
    dir_paths: Vec<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let normalized_paths = dir_paths
        .into_iter()
        .map(|path| normalize_watch_path(&path))
        .collect::<Vec<_>>();

    if normalized_paths.is_empty() {
        return Err("No directories provided for scan session".to_string());
    }

    let session_id = format!(
        "scan-{}",
        state.next_scan_session_id.fetch_add(1, Ordering::SeqCst) + 1
    );
    let started_at = now_timestamp_ms();

    for path in normalized_paths.iter() {
        upsert_watched_folder_record(
            &app_handle,
            WatchedFolderRecord {
                path: path.clone(),
                enabled: true,
                status: "indexing".to_string(),
                last_scan_started_at: Some(started_at),
                last_scan_completed_at: None,
                last_error: None,
            },
        )?;
    }

    rebuild_native_watch_roots(&app_handle, &state)?;
    state
        .scan_sessions
        .lock()
        .unwrap()
        .insert(session_id.clone(), NativeScanSessionControl::default());

    log::info!(
        "[scan-session] start session_id={} roots={:?}",
        session_id,
        normalized_paths
    );
    emit_scan_session_event(
        &app_handle,
        NativeScanSessionEvent {
            event_type: "started".to_string(),
            session_id: session_id.clone(),
            scope: "foreground".to_string(),
            phase: "discovering".to_string(),
            discovered_count: 0,
            total_known_count: 0,
            current_path: Some(normalized_paths[0].clone()),
            watch_path: None,
            batch: None,
            error: None,
        },
    );

    let handle = app_handle.clone();
    let scan_sessions = Arc::clone(&state.scan_sessions);
    let roots = normalized_paths.clone();
    let session_id_for_thread = session_id.clone();

    std::thread::spawn(move || {
        const SCAN_BATCH_SIZE: usize = 128;
        const WALK_YIELD_EVERY: usize = 256;
        let mut discovered_count = 0_u64;
        let mut batch: Vec<FileMetadata> = Vec::with_capacity(SCAN_BATCH_SIZE);
        let mut current_path = None::<String>;

        let run_result = (|| -> Result<(), String> {
            for root in roots.iter() {
                let walker = WalkDir::new(root).into_iter();

                for (index, entry) in walker
                    .filter_entry(|entry| !is_ignored_dir(entry))
                    .filter_map(|entry| entry.ok())
                    .enumerate()
                {
                    wait_for_scan_session_turn(&scan_sessions, &session_id_for_thread)?;
                    let path = entry.path();

                    if !should_include_scanned_file(path) {
                        continue;
                    }

                    let Some(ext) = path
                        .extension()
                        .and_then(|value| value.to_str())
                        .map(|value| value.to_lowercase())
                    else {
                        continue;
                    };

                    if let Ok(metadata) = entry.metadata() {
                        let file = build_file_metadata(
                            path,
                            entry.file_name().to_string_lossy().into_owned(),
                            metadata,
                            &ext,
                        );
                        discovered_count += 1;
                        current_path = Some(file.path.clone());
                        batch.push(file);
                    }

                    if batch.len() >= SCAN_BATCH_SIZE {
                        log::info!(
                            "[scan-session] batch discovered session_id={} discovered={} batch={}",
                            session_id_for_thread,
                            discovered_count,
                            batch.len()
                        );
                        emit_scan_session_event(
                            &handle,
                            NativeScanSessionEvent {
                                event_type: "batch".to_string(),
                                session_id: session_id_for_thread.clone(),
                                scope: "foreground".to_string(),
                                phase: "discovering".to_string(),
                                discovered_count,
                                total_known_count: discovered_count,
                                current_path: current_path.clone(),
                                watch_path: None,
                                batch: Some(std::mem::take(&mut batch)),
                                error: None,
                            },
                        );
                    }

                    if index > 0 && index % WALK_YIELD_EVERY == 0 {
                        std::thread::sleep(Duration::from_millis(1));
                    }
                }
            }

            if !batch.is_empty() {
                log::info!(
                    "[scan-session] batch discovered session_id={} discovered={} batch={}",
                    session_id_for_thread,
                    discovered_count,
                    batch.len()
                );
                emit_scan_session_event(
                    &handle,
                    NativeScanSessionEvent {
                        event_type: "batch".to_string(),
                        session_id: session_id_for_thread.clone(),
                        scope: "foreground".to_string(),
                        phase: "discovering".to_string(),
                        discovered_count,
                        total_known_count: discovered_count,
                        current_path: current_path.clone(),
                        watch_path: None,
                        batch: Some(std::mem::take(&mut batch)),
                        error: None,
                    },
                );
            }

            Ok(())
        })();

        match run_result {
            Ok(()) => {
                let completed_at = now_timestamp_ms();
                for root in roots.iter() {
                    let _ = upsert_watched_folder_record(
                        &handle,
                        WatchedFolderRecord {
                            path: root.clone(),
                            enabled: true,
                            status: "watching".to_string(),
                            last_scan_started_at: Some(started_at),
                            last_scan_completed_at: Some(completed_at),
                            last_error: None,
                        },
                    );
                }

                log::info!(
                    "[scan-session] complete session_id={} discovered={}",
                    session_id_for_thread,
                    discovered_count
                );
                emit_scan_session_event(
                    &handle,
                    NativeScanSessionEvent {
                        event_type: "completed".to_string(),
                        session_id: session_id_for_thread.clone(),
                        scope: "foreground".to_string(),
                        phase: "indexing".to_string(),
                        discovered_count,
                        total_known_count: discovered_count,
                        current_path,
                        watch_path: None,
                        batch: None,
                        error: None,
                    },
                );
            }
            Err(error) if error == "cancelled" => {
                log::info!(
                    "[scan-session] cancelled session_id={}",
                    session_id_for_thread
                );
                emit_scan_session_event(
                    &handle,
                    NativeScanSessionEvent {
                        event_type: "cancelled".to_string(),
                        session_id: session_id_for_thread.clone(),
                        scope: "foreground".to_string(),
                        phase: "finalizing".to_string(),
                        discovered_count,
                        total_known_count: discovered_count,
                        current_path,
                        watch_path: None,
                        batch: None,
                        error: None,
                    },
                );
            }
            Err(error) => {
                for root in roots.iter() {
                    let _ = upsert_watched_folder_record(
                        &handle,
                        WatchedFolderRecord {
                            path: root.clone(),
                            enabled: true,
                            status: "error".to_string(),
                            last_scan_started_at: Some(started_at),
                            last_scan_completed_at: None,
                            last_error: Some(error.clone()),
                        },
                    );
                }

                log::error!(
                    "[scan-session] error session_id={} discovered={} error={}",
                    session_id_for_thread,
                    discovered_count,
                    error
                );
                emit_scan_session_event(
                    &handle,
                    NativeScanSessionEvent {
                        event_type: "error".to_string(),
                        session_id: session_id_for_thread.clone(),
                        scope: "foreground".to_string(),
                        phase: "finalizing".to_string(),
                        discovered_count,
                        total_known_count: discovered_count,
                        current_path,
                        watch_path: None,
                        batch: None,
                        error: Some(error),
                    },
                );
            }
        }

        let _ = rebuild_native_watch_roots(&handle, &handle.state::<AppState>());
        scan_sessions.lock().unwrap().remove(&session_id_for_thread);
    });

    Ok(session_id)
}

#[tauri::command]
fn set_scan_session_paused(
    session_id: String,
    paused: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut sessions = state.scan_sessions.lock().unwrap();
    let Some(session) = sessions.get_mut(&session_id) else {
        return Err(format!("Scan session not found: {session_id}"));
    };

    session.paused = paused;
    log::info!(
        "[scan-session] {} session_id={}",
        if paused { "paused" } else { "resumed" },
        session_id
    );
    Ok(())
}

#[tauri::command]
fn inspect_scan_sessions(state: State<'_, AppState>) -> Result<Vec<ScanSessionDiagnostic>, String> {
    let sessions = state.scan_sessions.lock().unwrap();
    Ok(sessions
        .iter()
        .map(|(session_id, control)| ScanSessionDiagnostic {
            session_id: session_id.clone(),
            paused: control.paused,
            cancelled: control.cancelled,
        })
        .collect())
}

#[tauri::command]
fn scan_directory(
    dir_path: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<FileMetadata>, String> {
    let normalized_path = normalize_watch_path(&dir_path);
    let started_at = now_timestamp_ms();
    upsert_watched_folder_record(
        &app_handle,
        WatchedFolderRecord {
            path: normalized_path.clone(),
            enabled: true,
            status: "indexing".to_string(),
            last_scan_started_at: Some(started_at),
            last_scan_completed_at: None,
            last_error: None,
        },
    )?;
    let files = collect_scannable_files(&normalized_path);

    match files {
        Ok(files) => {
            upsert_watched_folder_record(
                &app_handle,
                WatchedFolderRecord {
                    path: normalized_path,
                    enabled: true,
                    status: "watching".to_string(),
                    last_scan_started_at: Some(started_at),
                    last_scan_completed_at: Some(now_timestamp_ms()),
                    last_error: None,
                },
            )?;
            rebuild_native_watch_roots(&app_handle, &state)?;
            Ok(files)
        }
        Err(error) => {
            upsert_watched_folder_record(
                &app_handle,
                WatchedFolderRecord {
                    path: normalized_path,
                    enabled: true,
                    status: "error".to_string(),
                    last_scan_started_at: Some(started_at),
                    last_scan_completed_at: None,
                    last_error: Some(error.clone()),
                },
            )?;
            rebuild_native_watch_roots(&app_handle, &state)?;
            Err(error)
        }
    }
}

#[tauri::command]
fn load_watched_folders(app_handle: AppHandle) -> Result<Vec<WatchedFolderRecord>, String> {
    load_watched_folder_records(&app_handle)
}

#[tauri::command]
fn save_watched_folder(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    folder: WatchedFolderRecord,
) -> Result<Vec<WatchedFolderRecord>, String> {
    upsert_watched_folder_record(&app_handle, folder)?;
    rebuild_native_watch_roots(&app_handle, &state)
}

#[tauri::command]
fn set_watched_folder_enabled(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    path: String,
    enabled: bool,
) -> Result<Vec<WatchedFolderRecord>, String> {
    update_watched_folder_enabled(&app_handle, &path, enabled)?;
    rebuild_native_watch_roots(&app_handle, &state)
}

#[tauri::command]
fn remove_watched_folder_native(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<WatchedFolderRecord>, String> {
    remove_watched_folder_record(&app_handle, &path)?;
    rebuild_native_watch_roots(&app_handle, &state)
}

#[tauri::command]
fn start_native_watchers(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<WatchedFolderRecord>, String> {
    rebuild_native_watch_roots(&app_handle, &state)
}

#[tauri::command]
fn inspect_native_watch_state(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<NativeWatchStateSnapshot, String> {
    let watched_folders = load_watched_folder_records(&app_handle)?;
    let active_roots = state
        .watch_manager
        .lock()
        .unwrap()
        .active_roots
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();

    Ok(NativeWatchStateSnapshot {
        watched_folders,
        active_roots,
    })
}

#[tauri::command]
fn open_file_native(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open '{}': {}", path, e))
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let p = Path::new(&path);
    if !p.is_file() {
        return Err("Not a file".into());
    }

    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let metadata = p.metadata().map_err(|e| e.to_string())?;

    Ok(build_file_metadata(
        p,
        p.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        metadata,
        &ext,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};
    use zip::write::SimpleFileOptions;

    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        env::temp_dir().join(format!(
            "smart-file-explorer-{label}-{}-{suffix}",
            std::process::id()
        ))
    }

    #[test]
    fn collect_scannable_files_only_returns_supported_non_ignored_files() {
        let root = unique_temp_dir("scan");
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::create_dir_all(root.join("node_modules")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join("docs").join("readme.md"), "hello").unwrap();
        fs::write(root.join("docs").join("script.ts"), "const ok = true;").unwrap();
        fs::write(root.join("docs").join("scan.png"), "image").unwrap();
        fs::write(root.join("docs").join("archive.zip"), "ignored").unwrap();
        fs::write(root.join("node_modules").join("library.ts"), "ignored").unwrap();
        fs::write(root.join(".git").join("hidden.md"), "ignored").unwrap();

        let mut files = collect_scannable_files(root.to_str().unwrap()).unwrap();
        files.sort_by(|a, b| a.name.cmp(&b.name));
        let names: Vec<_> = files.iter().map(|file| file.name.as_str()).collect();

        assert_eq!(names, vec!["readme.md", "scan.png", "script.ts"]);
        assert!(files
            .iter()
            .all(|file| file.file_type.starts_with("application/")));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn get_file_metadata_returns_file_details_and_rejects_directories() {
        let root = unique_temp_dir("metadata");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("notes.txt");
        fs::write(&file_path, "notes").unwrap();

        let metadata = get_file_metadata(file_path.to_string_lossy().into_owned()).unwrap();
        assert_eq!(metadata.name, "notes.txt");
        assert_eq!(metadata.file_type, "application/txt");
        assert!(metadata.size > 0);

        let error = get_file_metadata(root.to_string_lossy().into_owned()).unwrap_err();
        assert_eq!(error, "Not a file");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn is_ignored_dir_matches_hidden_and_system_like_directories() {
        let root = unique_temp_dir("ignored-dirs");
        fs::create_dir_all(root.join("node_modules")).unwrap();
        fs::create_dir_all(root.join("docs")).unwrap();

        let entries: Vec<_> = WalkDir::new(&root)
            .min_depth(1)
            .max_depth(1)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .collect();

        let ignored = entries
            .iter()
            .find(|entry| entry.file_name().to_string_lossy() == "node_modules")
            .unwrap();
        let kept = entries
            .iter()
            .find(|entry| entry.file_name().to_string_lossy() == "docs")
            .unwrap();

        assert!(is_ignored_dir(ignored));
        assert!(!is_ignored_dir(kept));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn extract_text_content_reads_plain_text_files() {
        let root = unique_temp_dir("extract-txt");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("notes.txt");
        fs::write(&file_path, "hello from rust extractor").unwrap();

        let text = extract_text_content(file_path.to_string_lossy().into_owned()).unwrap();

        assert!(text.contains("hello from rust extractor"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn extract_document_segments_reads_pdf_pages() {
        let root = unique_temp_dir("extract-pdf-pages");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("sample.pdf");
        fs::write(&file_path, minimal_pdf_bytes("Hello PDF")).unwrap();

        let segments = extract_document_segments(file_path.to_string_lossy().into_owned()).unwrap();

        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].page_number, Some(1));
        assert_eq!(segments[0].source_label.as_deref(), Some("Page 1"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn extract_text_content_reads_docx_document_xml() {
        let root = unique_temp_dir("extract-docx");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("proposal.docx");
        let file = fs::File::create(&file_path).unwrap();
        let mut writer = zip::ZipWriter::new(file);
        let options = SimpleFileOptions::default();

        writer.start_file("[Content_Types].xml", options).unwrap();
        writer.write_all(br#"<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>"#).unwrap();
        writer.start_file("word/document.xml", options).unwrap();
        writer
            .write_all(
                br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:r><w:t>Acme proposal final pricing</w:t></w:r></w:p>
                <w:p><w:r><w:t>Approved scope and delivery plan</w:t></w:r></w:p>
              </w:body>
            </w:document>"#,
            )
            .unwrap();
        writer.finish().unwrap();

        let text = extract_text_content(file_path.to_string_lossy().into_owned()).unwrap();

        assert!(text.contains("Acme proposal final pricing"));
        assert!(text.contains("Approved scope and delivery plan"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_doc_files_are_treated_as_supported_metadata_only_documents() {
        let root = unique_temp_dir("extract-doc");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("proposal.doc");
        fs::write(&file_path, b"\xd0\xcf\x11\xe0legacy-doc").unwrap();

        assert!(should_emit_watched_file_event(&file_path));

        let segments = extract_document_segments(file_path.to_string_lossy().into_owned()).unwrap();
        assert!(segments.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn temporary_downloads_are_excluded_from_watch_events() {
        let root = unique_temp_dir("temp-downloads");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("proposal.doc.crdownload");
        fs::write(&file_path, "partial").unwrap();

        assert!(!should_emit_watched_file_event(&file_path));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recommended_scan_directories_prefers_existing_productivity_folders() {
        let root = unique_temp_dir("starter-folders");
        fs::create_dir_all(root.join("Documents")).unwrap();
        fs::create_dir_all(root.join("Desktop")).unwrap();
        fs::create_dir_all(root.join("Downloads")).unwrap();

        let suggestions = recommended_scan_directories(&root);
        let labels: Vec<_> = suggestions.iter().map(|item| item.label.as_str()).collect();

        assert_eq!(labels, vec!["Documents", "Desktop", "Downloads"]);
        assert!(suggestions.iter().all(|item| !item.path.is_empty()));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn extract_text_content_reads_simple_pdf() {
        let root = unique_temp_dir("extract-pdf");
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("sample.pdf");
        fs::write(&file_path, minimal_pdf_bytes("Hello PDF")).unwrap();

        let text = extract_text_content(file_path.to_string_lossy().into_owned()).unwrap();

        assert!(text.contains("Hello PDF"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn format_openrouter_http_error_uses_error_message_from_json_body() {
        let message = format_openrouter_http_error(
            reqwest::StatusCode::NOT_FOUND,
            r#"{"error":{"message":"No route found for model qwen/qwen3.6-plus:free"}}"#,
        );

        assert!(message.contains("HTTP 404"));
        assert!(message.contains("No route found for model"));
    }

    #[test]
    fn normalize_openrouter_api_key_accepts_bearer_prefixed_values() {
        assert_eq!(
            normalize_openrouter_api_key("Bearer sk-or-v1-abc123"),
            "sk-or-v1-abc123"
        );
        assert_eq!(
            normalize_openrouter_api_key(" bearer sk-or-v1-abc123 "),
            "sk-or-v1-abc123"
        );
        assert_eq!(
            normalize_openrouter_api_key("'Bearer sk-or-v1-abc123'"),
            "sk-or-v1-abc123"
        );
    }

    #[test]
    fn decode_response_bytes_lossy_handles_invalid_utf8() {
        let decoded = decode_response_bytes_lossy(&[0x66, 0x6f, 0x80, 0x6f]);
        assert!(decoded.starts_with("fo"));
        assert!(decoded.ends_with('o'));
    }

    fn minimal_pdf_bytes(text: &str) -> Vec<u8> {
        let stream = format!("BT\n/F1 24 Tf\n72 120 Td\n({text}) Tj\nET");
        let objects = vec![
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".to_string(),
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n".to_string(),
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n".to_string(),
            format!("4 0 obj\n<< /Length {} >>\nstream\n{stream}\nendstream\nendobj\n", stream.len()),
            "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n".to_string(),
        ];

        let mut pdf = String::from("%PDF-1.4\n");
        let mut offsets = Vec::new();

        for object in &objects {
            offsets.push(pdf.len());
            pdf.push_str(object);
        }

        let xref_offset = pdf.len();
        pdf.push_str(&format!("xref\n0 {}\n", objects.len() + 1));
        pdf.push_str("0000000000 65535 f \n");
        for offset in offsets {
            pdf.push_str(&format!("{offset:010} 00000 n \n"));
        }
        pdf.push_str(&format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            objects.len() + 1,
            xref_offset
        ));

        pdf.into_bytes()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_drag::init())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            app.manage(AppState {
                watch_manager: Mutex::new(WatchManagerState {
                    watcher: None,
                    active_roots: Vec::new(),
                }),
                debounce_tokens: Arc::new(Mutex::new(HashMap::new())),
                next_debounce_token: Arc::new(AtomicU64::new(0)),
                scan_sessions: Arc::new(Mutex::new(HashMap::new())),
                next_scan_session_id: Arc::new(AtomicU64::new(0)),
                recent_frontend_events: Mutex::new(VecDeque::new()),
            });

            use tauri::Manager;

            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = tauri::menu::MenuItem::with_id(
                app,
                "show",
                "Open Smart File Explorer",
                true,
                None::<&str>,
            )?;
            let spotlight_i = tauri::menu::MenuItem::with_id(
                app,
                "spotlight",
                "Spotlight Search",
                true,
                None::<&str>,
            )?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &spotlight_i, &quit_i])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app: &tauri::AppHandle, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "spotlight" => {
                        if let Some(window) = app.get_webview_window("spotlight") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => (),
                })
                .build(app)?;

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_scan_session,
            set_scan_session_paused,
            inspect_scan_sessions,
            scan_directory,
            load_watched_folders,
            save_watched_folder,
            set_watched_folder_enabled,
            remove_watched_folder_native,
            start_native_watchers,
            inspect_native_watch_state,
            get_recommended_scan_directories,
            open_file_native,
            get_file_metadata,
            extract_text_content,
            extract_document_segments,
            log_frontend_event,
            log_frontend_message,
            get_diagnostic_snapshot,
            export_diagnostic_bundle,
            generate_folder_intelligence_summary,
            get_cloud_intelligence_status,
            save_cloud_intelligence_config,
            test_cloud_intelligence_connection,
            clear_cloud_intelligence_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
