use serde::Serialize;
use walkdir::{DirEntry, WalkDir};

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
             || s == "node_modules" 
             || s == "dist" 
             || s == "build" 
             || s == "target"
         })
         .unwrap_or(false)
}

#[tauri::command]
fn scan_directory(dir_path: &str) -> Vec<FileMetadata> {
    let mut files = Vec::new();

    let text_exts = [
      "txt", "md", "json", "js", "ts", "tsx", "jsx", "css", "html", "py", 
      "java", "c", "cpp", "h", "hpp", "rs", "go", "yml", "yaml", "xml", 
      "ini", "env", "sh", "bat", "ps1", "sql", "rb", "php", "pdf", "docx"
    ];

    let ignored_exts = [
      "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff",
      "mp4", "mov", "avi", "mkv", "mp3", "wav", "ogg",
      "zip", "tar", "gz", "7z", "exe", "dll", "bin", "iso",
      "ds_store"
    ];

    let walker = WalkDir::new(dir_path).into_iter();

    for entry in walker.filter_entry(|e| !is_ignored_dir(e)).filter_map(|e| e.ok()) {
        let path = entry.path();
        
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) {
                if ignored_exts.contains(&ext.as_str()) {
                    continue;
                }
                if text_exts.contains(&ext.as_str()) {
                    if let Ok(metadata) = entry.metadata() {
                        let modified = metadata.modified()
                            .ok()
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                            
                        files.push(FileMetadata {
                            path: path.to_string_lossy().into_owned(),
                            name: entry.file_name().to_string_lossy().into_owned(),
                            size: metadata.len(),
                            file_type: format!("application/{}", ext),
                            last_modified: modified,
                        });
                    }
                }
            }
        }
    }
    
    files
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
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
    .invoke_handler(tauri::generate_handler![scan_directory])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
