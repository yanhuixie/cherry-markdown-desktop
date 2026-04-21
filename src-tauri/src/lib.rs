// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Local;
use log::{LevelFilter, Metadata, Record};
use std::backtrace::Backtrace;
use std::fs::OpenOptions;
use std::io::Write;
use std::panic;
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

// 使用 chrono 生成准确的本地时间戳
fn chrono_timestamp() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

// 设置全局 panic hook，捕获所有未处理的 panic
fn setup_global_panic_hook() {
    panic::set_hook(Box::new(|panic_info| {
        // 获取 panic 的消息
        let payload = panic_info.payload();
        let payload_str = if let Some(s) = payload.downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown payload".to_string()
        };

        // 获取 panic 的位置
        let location = if let Some(loc) = panic_info.location() {
            format!("{}:{}:{}", loc.file(), loc.line(), loc.column())
        } else {
            "Unknown location".to_string()
        };

        // 获取 backtrace
        let backtrace = Backtrace::capture();

        // 构建完整的 panic 信息
        let panic_message = format!(
            "=== APPLICATION PANIC ===\n\
             Time: {}\n\
             Message: {}\n\
             Location: {}\n\
             Backtrace:\n{:?}\n\
             =========================",
            chrono_timestamp(),
            payload_str,
            location,
            backtrace
        );

        // 尝试写入日志文件
        let log_path = get_log_path();
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
            let _ = file.write_all(panic_message.as_bytes());
            let _ = file.write_all(b"\n");
            let _ = file.flush();
        }

        // 同时输出到 stderr
        eprintln!("{}", panic_message);

        // 在 Windows 上，也尝试输出到调试器
        #[cfg(target_os = "windows")]
        {
            // 确保消息被刷新
            use std::io::Write;
            let _ = std::io::stderr().flush();
        }
    }));
}

// 获取日志文件路径
fn get_log_path() -> std::path::PathBuf {
    if let Ok(mut exe_path) = std::env::current_exe() {
        exe_path.pop();
        exe_path.push("cherrymarkdowndesktop.log");
        exe_path
    } else {
        std::path::PathBuf::from("cherrymarkdowndesktop.log")
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

/// 测试命令：用于验证异常捕获功能
/// 注意：这个命令仅用于测试，仅在 debug 模式下可用
#[cfg(debug_assertions)]
#[tauri::command]
fn test_panic(mode: String) -> Result<String, String> {
    log::warn!("Test panic command called with mode: {}", mode);

    match mode.as_str() {
        "unwrap" => {
            log::error!("Triggering unwrap panic for testing");
            let _none: Option<&str> = None;
            let _ = _none.unwrap(); // 这会触发 panic
            Ok("This should never be reached".to_string())
        }
        "expect" => {
            log::error!("Triggering expect panic for testing");
            let _none: Option<&str> = None;
            let _ = _none.expect("Test expect panic"); // 这会触发 panic
            Ok("This should never be reached".to_string())
        }
        "panic" => {
            log::error!("Triggering explicit panic for testing");
            panic!("Test panic from command");
        }
        "error" => {
            log::error!("Returning error for testing");
            Err("Test error returned from command".to_string())
        }
        _ => {
            log::info!("Test command called with unknown mode");
            Ok(format!(
                "Unknown mode: {}. Use: unwrap, expect, panic, or error",
                mode
            ))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 【步骤 1】首先设置全局 panic hook，必须在任何可能 panic 的操作之前调用
    setup_global_panic_hook();

    // 【步骤 2】初始化日志系统
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

    // 【步骤 3】构建并运行 Tauri 应用，使用自定义错误处理而不是 expect()
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // 当尝试启动第二个实例时，这个回调会被执行
            log::info!(
                "Single instance: Another instance tried to start with args: {:?}",
                args
            );

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
                if file_path_lower.ends_with(".md")
                    || file_path_lower.ends_with(".markdown")
                    || file_path_lower.ends_with(".html")
                    || file_path_lower.ends_with(".htm")
                {
                    log::info!("Single instance: Opening file: {}", file_path);

                    // 3. 向前端发送事件，传递文件路径
                    if let Err(e) = app.emit("open-file-request", file_path) {
                        log::error!("Single instance: Failed to emit event: {}", e);
                    } else {
                        log::info!("Single instance: Event emitted successfully");
                    }
                } else {
                    log::warn!(
                        "Single instance: File is not a markdown file: {}",
                        file_path
                    );
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
                                || file_path_lower.ends_with(".html")
                                || file_path_lower.ends_with(".htm")
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
        .invoke_handler(tauri::generate_handler![
            get_pending_file,
            greet,
            log_frontend,
            #[cfg(debug_assertions)]
            test_panic
        ])
        .run(tauri::generate_context!());

    // 【步骤 4】处理应用运行时的错误
    if let Err(e) = result {
        // 构建详细的错误信息
        let error_message = format!(
            "=== APPLICATION RUNTIME ERROR ===\n\
             Time: {}\n\
             Error: {}\n\
             =================================",
            chrono_timestamp(),
            e
        );

        // 记录到日志文件
        let log_path = get_log_path();
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
            let _ = file.write_all(error_message.as_bytes());
            let _ = file.write_all(b"\n");
            let _ = file.flush();
        }

        // 输出到 stderr
        eprintln!("{}", error_message);

        // 在开发模式下，使用 std::process::exit 会触发 panic hook
        // 在生产模式下，我们记录错误后优雅退出
        if cfg!(debug_assertions) {
            // 开发模式：直接 panic 以便看到完整堆栈
            panic!("Application runtime error: {}", e);
        } else {
            // 生产模式：记录日志后退出
            log::error!("Application runtime error: {}", e);
            std::process::exit(1);
        }
    }
}
