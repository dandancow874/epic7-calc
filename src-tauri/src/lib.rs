use std::fs;
use std::path::PathBuf;
use std::process::Command;
use serde::Serialize;

#[cfg(target_os = "windows")]
use base64::Engine;
#[cfg(target_os = "windows")]
use windows::{
  Globalization::Language,
  Graphics::Imaging::BitmapDecoder,
  Media::Ocr::OcrEngine,
  Storage::Streams::{DataWriter, InMemoryRandomAccessStream},
};

#[derive(Serialize)]
struct ImageRect {
  x: f32,
  y: f32,
  width: f32,
  height: f32,
}

#[derive(Serialize)]
struct OcrWordLayout {
  text: String,
  rect: ImageRect,
}

#[derive(Serialize)]
struct OcrLineLayout {
  text: String,
  words: Vec<OcrWordLayout>,
  rect: ImageRect,
}

#[derive(Serialize)]
struct OcrImageLayout {
  width: u32,
  height: u32,
  text: String,
  lines: Vec<OcrLineLayout>,
}

#[tauri::command]
fn read_data_file(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
  let path = data_file_path(&app, &name)?;
  if !path.exists() {
    return Ok(None);
  }
  fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_data_file(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
  let path = data_file_path(&app, &name)?;
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
  }
  fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn data_dir(app: tauri::AppHandle) -> Result<String, String> {
  let dir = app_data_dir(&app)?;
  fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
  Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn save_hero_patch(hero_code: String, patch_json: String) -> Result<(), String> {
  if hero_code.is_empty() || !hero_code.chars().all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-') {
    return Err("invalid hero code".to_string());
  }
  let patch: serde_json::Value = serde_json::from_str(&patch_json).map_err(|error| format!("invalid patch JSON: {error}"))?;
  if !patch.is_object() {
    return Err("hero patch must be a JSON object".to_string());
  }
  let directory = project_root()?.join("library-maintenance").join("heroes");
  fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
  let path = directory.join(format!("{hero_code}.json"));
  let mut current = if path.exists() {
    serde_json::from_str::<serde_json::Value>(&fs::read_to_string(&path).map_err(|error| error.to_string())?)
      .map_err(|error| format!("existing hero patch is invalid: {error}"))?
  } else {
    serde_json::json!({})
  };
  merge_json(&mut current, patch);
  let contents = serde_json::to_string_pretty(&current).map_err(|error| error.to_string())?;
  fs::write(path, format!("{contents}\n")).map_err(|error| error.to_string())
}

#[tauri::command]
fn rebuild_library_data() -> Result<String, String> {
  let root = project_root()?;
  let output = Command::new("npm.cmd")
    .args(["run", "library:build"])
    .current_dir(&root)
    .output()
    .map_err(|error| format!("cannot start library build: {error}"))?;
  if !output.status.success() {
    let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
    return Err(if message.is_empty() { "library build failed".to_string() } else { message });
  }
  Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn merge_json(target: &mut serde_json::Value, patch: serde_json::Value) {
  match (target, patch) {
    (serde_json::Value::Object(target_map), serde_json::Value::Object(patch_map)) => {
      for (key, value) in patch_map {
        if let Some(target_value) = target_map.get_mut(&key) {
          merge_json(target_value, value);
        } else {
          target_map.insert(key, value);
        }
      }
    }
    (target_value, patch_value) => *target_value = patch_value,
  }
}

fn project_root() -> Result<PathBuf, String> {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .parent()
    .map(PathBuf::from)
    .ok_or_else(|| "cannot locate project root".to_string())
}

#[tauri::command]
fn ocr_image(data_url: String) -> Result<String, String> {
  #[cfg(target_os = "windows")]
  {
    let bitmap = decode_software_bitmap(&data_url)?;
    let engine = create_ocr_engine()?;
    let result = engine.RecognizeAsync(&bitmap).and_then(|operation| operation.get()).map_err(|error| error.to_string())?;
    return result.Text().map(|text| text.to_string()).map_err(|error| error.to_string());
  }
  #[cfg(not(target_os = "windows"))]
  {
    let _ = data_url;
    Err("system OCR is only available on Windows".to_string())
  }
}

#[tauri::command]
fn ocr_image_layout(data_url: String) -> Result<OcrImageLayout, String> {
  #[cfg(target_os = "windows")]
  {
    let bitmap = decode_software_bitmap(&data_url)?;
    let width = bitmap.PixelWidth().map_err(|error| error.to_string())? as u32;
    let height = bitmap.PixelHeight().map_err(|error| error.to_string())? as u32;
    let engine = create_ocr_engine()?;
    let result = engine.RecognizeAsync(&bitmap).and_then(|operation| operation.get()).map_err(|error| error.to_string())?;
    let mut lines = Vec::new();
    let ocr_lines = result.Lines().map_err(|error| error.to_string())?;
    for line_index in 0..ocr_lines.Size().map_err(|error| error.to_string())? {
      let line = ocr_lines.GetAt(line_index).map_err(|error| error.to_string())?;
      let mut words = Vec::new();
      let ocr_words = line.Words().map_err(|error| error.to_string())?;
      for word_index in 0..ocr_words.Size().map_err(|error| error.to_string())? {
        let word = ocr_words.GetAt(word_index).map_err(|error| error.to_string())?;
        let rect = word.BoundingRect().map_err(|error| error.to_string())?;
        words.push(OcrWordLayout {
          text: word.Text().map_err(|error| error.to_string())?.to_string(),
          rect: ImageRect { x: rect.X, y: rect.Y, width: rect.Width, height: rect.Height },
        });
      }
      let rect = bounding_rect(&words);
      lines.push(OcrLineLayout {
        text: line.Text().map_err(|error| error.to_string())?.to_string(),
        words,
        rect,
      });
    }
    return Ok(OcrImageLayout {
      width,
      height,
      text: result.Text().map_err(|error| error.to_string())?.to_string(),
      lines,
    });
  }
  #[cfg(not(target_os = "windows"))]
  {
    let _ = data_url;
    Err("system OCR is only available on Windows".to_string())
  }
}

#[cfg(target_os = "windows")]
fn create_ocr_engine() -> Result<OcrEngine, String> {
  for language_tag in ["zh-Hans", "zh-CN", "en-US"] {
    let language = Language::CreateLanguage(&language_tag.into()).map_err(|error| error.to_string())?;
    if OcrEngine::IsLanguageSupported(&language).unwrap_or(false) {
      if let Ok(engine) = OcrEngine::TryCreateFromLanguage(&language) {
        return Ok(engine);
      }
    }
  }
  OcrEngine::TryCreateFromUserProfileLanguages()
    .map_err(|error| format!("没有可用的 Windows OCR 语言包：{error}"))
}

#[cfg(target_os = "windows")]
fn decode_software_bitmap(data_url: &str) -> Result<windows::Graphics::Imaging::SoftwareBitmap, String> {
  let encoded = data_url.split_once(',').map(|(_, value)| value).unwrap_or(data_url);
  let bytes = base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|error| error.to_string())?;
  let stream = InMemoryRandomAccessStream::new().map_err(|error| error.to_string())?;
  let writer = DataWriter::CreateDataWriter(&stream).map_err(|error| error.to_string())?;
  writer.WriteBytes(&bytes).map_err(|error| error.to_string())?;
  writer.StoreAsync().and_then(|operation| operation.get()).map_err(|error| error.to_string())?;
  writer.FlushAsync().and_then(|operation| operation.get()).map_err(|error| error.to_string())?;
  stream.Seek(0).map_err(|error| error.to_string())?;
  let decoder = BitmapDecoder::CreateAsync(&stream).and_then(|operation| operation.get()).map_err(|error| error.to_string())?;
  decoder.GetSoftwareBitmapAsync().and_then(|operation| operation.get()).map_err(|error| error.to_string())
}

fn bounding_rect(words: &[OcrWordLayout]) -> ImageRect {
  if words.is_empty() {
    return ImageRect { x: 0.0, y: 0.0, width: 0.0, height: 0.0 };
  }
  let x = words.iter().map(|word| word.rect.x).fold(f32::INFINITY, f32::min);
  let y = words.iter().map(|word| word.rect.y).fold(f32::INFINITY, f32::min);
  let right = words.iter().map(|word| word.rect.x + word.rect.width).fold(0.0, f32::max);
  let bottom = words.iter().map(|word| word.rect.y + word.rect.height).fold(0.0, f32::max);
  ImageRect { x, y, width: right - x, height: bottom - y }
}

fn data_file_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
  let clean = name.replace('\\', "/");
  if clean.starts_with('/') || clean.contains("../") || clean == ".." {
    return Err("invalid data file name".to_string());
  }
  Ok(app_data_dir(app)?.join(clean))
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let _ = app;
  let exe = std::env::current_exe().map_err(|error| error.to_string())?;
  let parent = exe.parent().ok_or_else(|| "cannot locate exe directory".to_string())?;
  Ok(parent.join("data"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![read_data_file, write_data_file, data_dir, save_hero_patch, rebuild_library_data, ocr_image, ocr_image_layout])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn merges_nested_json_without_copying_unmodified_fields() {
    let mut current = serde_json::json!({ "skills": { "s1": { "description": "old", "soulGain": 1 } } });
    merge_json(&mut current, serde_json::json!({ "skills": { "s1": { "description": "new" } } }));
    assert_eq!(current, serde_json::json!({ "skills": { "s1": { "description": "new", "soulGain": 1 } } }));
  }

  #[test]
  fn saves_a_valid_hero_patch_file() {
    let code = "codex-save-command-test";
    let path = project_root().unwrap().join("library-maintenance").join("heroes").join(format!("{code}.json"));
    if path.exists() { fs::remove_file(&path).unwrap(); }
    save_hero_patch(code.to_string(), r#"{"baseStats":{"atk":1001}}"#.to_string()).unwrap();
    let saved: serde_json::Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(saved["baseStats"]["atk"], 1001);
    fs::remove_file(path).unwrap();
  }

}
