use serde::Serialize;
use walkdir::{DirEntry, WalkDir};
use std::path::Path;
use std::sync::Mutex;
use notify::{Watcher, RecursiveMode, RecommendedWatcher};
use tauri::{AppHandle, Manager, Emitter, State};

struct AppState {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

#[derive(Clone, Serialize)]
struct FileEventPayload {
    kind: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    path: String,
    name: String,
    size: u64,
    #[serde(rename = "type")]
    file_type: String,
    last_modified: u64,
}

fn is_ignored_dir(entry: &DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return false;
    }
    entry.file_name()
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
      "txt", "md", "json", "js", "ts", "tsx", "jsx", "css", "html", "py",
      "java", "c", "cpp", "h", "hpp", "rs", "go", "yml", "yaml", "xml",
      "ini", "env", "sh", "bat", "ps1", "sql", "rb", "php", "pdf", "docx"
    ]
    .contains(&ext)
}

fn is_ignored_file_ext(ext: &str) -> bool {
    [
      "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff",
      "mp4", "mov", "avi", "mkv", "mp3", "wav", "ogg",
      "zip", "tar", "gz", "7z", "exe", "dll", "bin", "iso",
      "ds_store"
    ]
    .contains(&ext)
}

fn build_file_metadata(path: &Path, name: String, metadata: std::fs::Metadata, ext: &str) -> FileMetadata {
    let modified = metadata.modified()
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

    for entry in walker.filter_entry(|e| !is_ignored_dir(e)).filter_map(|e| e.ok()) {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) else {
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

#[tauri::command]
fn scan_directory(dir_path: String, app_handle: AppHandle, state: State<'_, AppState>) -> Result<Vec<FileMetadata>, String> {
    let mut watcher_lock = state.watcher.lock().unwrap();
    let handle = app_handle.clone();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
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
                        let _ = handle.emit("sys-file-event", FileEventPayload {
                            kind: kind_str.to_string(),
                            path: p.to_string(),
                        });
                    }
                }
            }
        }
    }).map_err(|e| e.to_string())?;

    watcher.watch(Path::new(&dir_path), RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    *watcher_lock = Some(watcher);

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

    let ext = p.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()).unwrap_or_default();
    let metadata = p.metadata().map_err(|e| e.to_string())?;

    Ok(build_file_metadata(
        p,
        p.file_name().unwrap_or_default().to_string_lossy().into_owned(),
        metadata,
        &ext,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        env::temp_dir().join(format!("smart-file-explorer-{label}-{}-{suffix}", std::process::id()))
    }

    #[test]
    fn collect_scannable_files_only_returns_supported_non_ignored_files() {
        let root = unique_temp_dir("scan");
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::create_dir_all(root.join("node_modules")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join("docs").join("readme.md"), "hello").unwrap();
        fs::write(root.join("docs").join("script.ts"), "const ok = true;").unwrap();
        fs::write(root.join("docs").join("archive.zip"), "ignored").unwrap();
        fs::write(root.join("node_modules").join("library.ts"), "ignored").unwrap();
        fs::write(root.join(".git").join("hidden.md"), "ignored").unwrap();

        let mut files = collect_scannable_files(root.to_str().unwrap()).unwrap();
        files.sort_by(|a, b| a.name.cmp(&b.name));
        let names: Vec<_> = files.iter().map(|file| file.name.as_str()).collect();

        assert_eq!(names, vec!["readme.md", "script.ts"]);
        assert!(files.iter().all(|file| file.file_type.starts_with("application/")));

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

        let ignored = entries.iter().find(|entry| entry.file_name().to_string_lossy() == "node_modules").unwrap();
        let kept = entries.iter().find(|entry| entry.file_name().to_string_lossy() == "docs").unwrap();

        assert!(is_ignored_dir(ignored));
        assert!(!is_ignored_dir(kept));

        fs::remove_dir_all(root).unwrap();
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
      let show_i = tauri::menu::MenuItem::with_id(app, "show", "Open Smart File Explorer", true, None::<&str>)?;
      let spotlight_i = tauri::menu::MenuItem::with_id(app, "spotlight", "Spotlight Search", true, None::<&str>)?;
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
        #[cfg(feature = "log")]
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![scan_directory, open_file_native, get_file_metadata])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
