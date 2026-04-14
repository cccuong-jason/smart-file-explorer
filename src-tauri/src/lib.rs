use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use std::{env, fs, io::Read};
use tauri::{AppHandle, Emitter, Manager, State};
use walkdir::{DirEntry, WalkDir};

const OPENROUTER_KEY_SERVICE: &str = "smart-file-explorer";
const OPENROUTER_KEY_ACCOUNT: &str = "openrouter_api_key";

struct AppState {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

#[derive(Clone, Serialize)]
struct FileEventPayload {
    kind: String,
    path: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ScanDirectorySuggestion {
    path: String,
    label: String,
    description: String,
}

#[derive(Debug, Serialize)]
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
        "rb", "php", "pdf", "docx", "png", "jpg", "jpeg",
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

fn save_cloud_config_file(app_handle: &AppHandle, config: &CloudIntelligenceConfig) -> Result<(), String> {
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
    keyring::Entry::new(OPENROUTER_KEY_SERVICE, OPENROUTER_KEY_ACCOUNT).map_err(|error| error.to_string())
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
    value
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
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
    entry.set_password(&normalize_openrouter_api_key(value))
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

fn build_cloud_intelligence_status(app_handle: Option<&AppHandle>, last_error: Option<String>) -> Result<CloudIntelligenceStatus, String> {
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
    let has_project_key = env::var("OPENROUTER_API_KEY").is_ok() || env::var("OPEN_ROUTER_API_KEY").is_ok();
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
        let body = response.text().await.unwrap_or_default();
        return Err(format_openrouter_http_error(status, &body));
    }

    let payload: OpenRouterResponse = response.json().await.map_err(|error| error.to_string())?;

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
    let request = FolderIntelligenceRequest {
        workspace_id: "connection-test".to_string(),
        title: "Connection Test".to_string(),
        path: "connection-test".to_string(),
        file_count: 1,
        ocr_count: 0,
        recent_count: 1,
        primary_type_label: "Documents".to_string(),
        project_keywords: vec!["test".to_string()],
        summary: "Connection test".to_string(),
        highlights: vec!["Connection test".to_string()],
        top_files: vec![FolderIntelligenceFileContext {
            path: "connection-test".to_string(),
            name: "connection-test.md".to_string(),
            group: Some("documents".to_string()),
            subtype: Some("text".to_string()),
            last_modified: now_timestamp_ms(),
            is_starred: false,
            is_likely_latest: true,
            indexing_stage: Some("semantic".to_string()),
            tags: vec![],
            snippet: Some("Connection test snippet".to_string()),
        }],
    };

    let result =
        request_openrouter_folder_summary(Some(&app_handle), &request, api_key, model.clone()).await;

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
fn clear_cloud_intelligence_config(app_handle: AppHandle) -> Result<CloudIntelligenceStatus, String> {
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
fn scan_directory(
    dir_path: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<FileMetadata>, String> {
    let mut watcher_lock = state.watcher.lock().unwrap();
    if watcher_lock.is_none() {
        let handle = app_handle.clone();
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
                        if let Some(p) = path.to_str() {
                            let _ = handle.emit(
                                "sys-file-event",
                                FileEventPayload {
                                    kind: kind_str.to_string(),
                                    path: p.to_string(),
                                },
                            );
                        }
                    }
                }
            }
        })
        .map_err(|e| e.to_string())?;

        *watcher_lock = Some(watcher);
    }

    if let Some(watcher) = watcher_lock.as_mut() {
        watcher
            .watch(Path::new(&dir_path), RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;
    }

    collect_scannable_files(&dir_path)
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
                watcher: Mutex::new(None),
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

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            get_recommended_scan_directories,
            open_file_native,
            get_file_metadata,
            extract_text_content,
            extract_document_segments,
            log_frontend_message,
            generate_folder_intelligence_summary,
            get_cloud_intelligence_status,
            save_cloud_intelligence_config,
            test_cloud_intelligence_connection,
            clear_cloud_intelligence_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
