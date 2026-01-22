// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::{LevelFilter, Metadata, Record};
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use tauri_plugin_cli::CliExt;

// 全局状态：保存待打开的文件路径
struct AppState {
    pending_file: Mutex<Option<String>>,
}

impl AppState {
    fn new() -> Self {
        AppState {
            pending_file: Mutex::new(None),
        }
    }

    fn take_pending_file(&self) -> Option<String> {
        let mut pending = self.pending_file.lock().unwrap();
        pending.take()
    }

    fn set_pending_file(&self, path: String) {
        let mut pending = self.pending_file.lock().unwrap();
        *pending = Some(path);
    }
}

// 简单的文件日志记录器
struct FileLogger {
    file: Mutex<std::fs::File>,
}

impl FileLogger {
    fn new() -> std::io::Result<Self> {
        // 获取日志文件路径（在可执行文件同目录下）
        let mut exe_path = std::env::current_exe()?;
        exe_path.pop();
        exe_path.push("cherrymarkdowndesktop.log");

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&exe_path)?;

        Ok(FileLogger {
            file: Mutex::new(file),
        })
    }
}

impl log::Log for FileLogger {
    fn enabled(&self, _metadata: &Metadata) -> bool {
        true
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let timestamp = chrono_timestamp();
            let log_line = format!("[{} {}] {}\n", timestamp, record.level(), record.args());

            if let Ok(mut file) = self.file.lock() {
                let _ = file.write_all(log_line.as_bytes());
                let _ = file.flush();
            }
        }
    }

    fn flush(&self) {
        if let Ok(mut file) = self.file.lock() {
            let _ = file.flush();
        }
    }
}

// 简单的时间戳生成（避免引入 chrono 依赖）
fn chrono_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    if let Ok(duration) = SystemTime::now().duration_since(UNIX_EPOCH) {
        let secs = duration.as_secs();
        // 简单格式化为 ISO 时间
        format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
            (secs / 31536000) + 1970,        // 粗略计算年份
            (secs % 31536000 / 2592000) + 1, // 粗略计算月份
            (secs % 2592000 / 86400) + 1,    // 粗略计算日期
            (secs % 86400 / 3600),           // 小时
            (secs % 3600 / 60),              // 分钟
            secs % 60                        // 秒
        )
    } else {
        "Unknown".to_string()
    }
}

#[tauri::command]
fn get_pending_file(state: State<AppState>) -> Option<String> {
    let file_path = state.take_pending_file();
    log::info!("get_pending_file called, returning: {:?}", file_path);
    file_path
}

#[tauri::command]
fn log_frontend(message: String) {
    // 将前端日志写入到同一个日志文件
    log::info!("[FRONTEND] {}", message);
}

#[tauri::command]
fn greet(name: &str) -> String {
    log::info!("greet called with name: {}", name);
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    let log_level = if cfg!(debug_assertions) {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    };

    // 尝试初始化文件日志记录器
    if let Ok(file_logger) = FileLogger::new() {
        let _ = log::set_boxed_logger(Box::new(file_logger));
        log::set_max_level(log_level);
        log::info!("File logger initialized");
    } else {
        // 失败时使用 env_logger 作为后备
        env_logger::Builder::new().filter_level(log_level).init();
        log::info!("Env logger initialized as fallback");
    }

    log::info!("Cherry Markdown Desktop starting...");
    log::info!(
        "Command line args: {:?}",
        std::env::args().collect::<Vec<_>>()
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // 当尝试启动第二个实例时，这个回调会被执行
            log::info!("Single instance: Another instance tried to start with args: {:?}", args);

            // 1. 聚焦到主窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                log::info!("Single instance: Focused main window");
            }

            // 2. 从启动参数中提取文件路径
            // args[0] 通常是可执行文件路径，args[1] 是通过文件关联打开时的文件路径
            if let Some(file_path) = args.get(1) {
                let file_path_lower = file_path.to_lowercase();

                // 验证文件是否是 md 文件（大小写不敏感）
                if file_path_lower.ends_with(".md") || file_path_lower.ends_with(".markdown") {
                    log::info!("Single instance: Opening markdown file: {}", file_path);

                    // 3. 向前端发送事件，传递文件路径
                    if let Err(e) = app.emit("open-file-request", file_path) {
                        log::error!("Single instance: Failed to emit event: {}", e);
                    } else {
                        log::info!("Single instance: Event emitted successfully");
                    }
                } else {
                    log::warn!("Single instance: File is not a markdown file: {}", file_path);
                }
            } else {
                log::info!("Single instance: No file path in arguments");
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_cli::init())
        .manage(AppState::new())
        .setup(|app| {
            log::info!("Application setup started");

            // 获取命令行参数
            match app.cli().matches() {
                Ok(matches) => {
                    log::info!("CLI matches: {:?}", matches);

                    // 尝试获取位置参数（文件路径）
                    if let Some(file_arg) = matches.args.get("file") {
                        // value 是 serde_json::Value 类型
                        let file_path_value = &file_arg.value;

                        if let Some(file_path_str) = file_path_value.as_str() {
                            let file_path_lower = file_path_str.to_lowercase();

                            log::info!("File argument received: {}", file_path_str);

                            // 验证文件是否是 md 文件（大小写不敏感）
                            if file_path_lower.ends_with(".md")
                                || file_path_lower.ends_with(".markdown")
                            {
                                log::info!("Saving markdown file to state: {}", file_path_str);

                                // 将文件路径保存到状态中，等待前端请求
                                let state = app.state::<AppState>();
                                state.set_pending_file(file_path_str.to_string());
                            } else {
                                log::warn!("File is not a markdown file: {}", file_path_str);
                            }
                        }
                    } else {
                        log::info!("No file argument provided");
                    }
                }
                Err(e) => {
                    log::error!("Failed to parse CLI arguments: {}", e);
                }
            }

            log::info!("Application setup completed");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_pending_file, greet, log_frontend])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
