use std::fs;
use std::path::Path;
use serde::Serialize;
use std::env;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::mem;
use std::io::Cursor;
use base64::{Engine as _, engine::general_purpose};
use image::{RgbaImage, ImageFormat};

use windows::Win32::UI::Shell::{SHGetFileInfoW, SHGFI_ICON, SHGFI_SMALLICON, SHFILEINFOW};
use windows::Win32::Graphics::Gdi::{
    GetDC, ReleaseDC, GetObjectW, BITMAP, GetDIBits, BITMAPINFOHEADER, DIB_RGB_COLORS, 
    DeleteObject, BI_RGB, HGDIOBJ
};
use windows::Win32::UI::WindowsAndMessaging::{HICON, DestroyIcon, GetIconInfo};
use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
use windows::core::PCWSTR;

#[derive(Serialize, Clone, Debug)]
pub struct ProgramItem {
    name: String,
    path: String,
    is_folder: bool,
    children: Vec<ProgramItem>,
    icon: Option<String>,
}

fn to_pcwstr(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(Some(0)).collect()
}

// RAII wrapper for cleanup
struct DeferCleanup {
    hbm_mask: windows::Win32::Graphics::Gdi::HBITMAP,
    hbm_color: windows::Win32::Graphics::Gdi::HBITMAP,
}

impl Drop for DeferCleanup {
    fn drop(&mut self) {
        unsafe {
            if !self.hbm_mask.is_invalid() { DeleteObject(HGDIOBJ(self.hbm_mask.0)); }
            if !self.hbm_color.is_invalid() { DeleteObject(HGDIOBJ(self.hbm_color.0)); }
        }
    }
}

unsafe fn icon_to_base64(h_icon: HICON) -> Option<String> {
    let mut icon_info = mem::zeroed();
    if GetIconInfo(h_icon, &mut icon_info).is_err() {
        return None;
    }
    
    let hbm_mask = icon_info.hbmMask;
    let hbm_color = icon_info.hbmColor;
    
    let _defer_cleanup = DeferCleanup { hbm_mask, hbm_color };

    if hbm_color.is_invalid() {
        return None;
    }

    let mut bitmap: BITMAP = mem::zeroed();
    if GetObjectW(
        HGDIOBJ(hbm_color.0), 
        mem::size_of::<BITMAP>() as i32, 
        Some(&mut bitmap as *mut _ as *mut _)
    ) == 0 {
        return None;
    }

    let width = bitmap.bmWidth;
    let height = bitmap.bmHeight;
    
    let hdc = GetDC(None);
    let mut bi = BITMAPINFOHEADER {
        biSize: mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: width,
        biHeight: -height, // Top-down
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB.0,
        ..Default::default()
    };
    
    let size = (width * height * 4) as usize;
    let mut pixels = vec![0u8; size];
    
    let result = GetDIBits(
        hdc,
        hbm_color,
        0,
        height.abs() as u32,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bi as *mut _ as *mut _,
        DIB_RGB_COLORS
    );
    
    ReleaseDC(None, hdc);

    if result == 0 {
        return None;
    }

    // BGRA to RGBA
    for chunk in pixels.chunks_mut(4) {
        let b = chunk[0];
        let r = chunk[2];
        chunk[0] = r;
        chunk[2] = b;
    }
    
    if let Some(img) = RgbaImage::from_raw(width as u32, height.abs() as u32, pixels) {
        let mut buffer = Cursor::new(Vec::new());
        if img.write_to(&mut buffer, ImageFormat::Png).is_ok() {
             return Some(general_purpose::STANDARD.encode(buffer.get_ref()));
        }
    }

    None
}

fn extract_icon(path: &str) -> Option<String> {
    unsafe {
        let wide_path = to_pcwstr(path);
        let mut sh_file_info = SHFILEINFOW::default();
        
        let result = SHGetFileInfoW(
            PCWSTR(wide_path.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut sh_file_info),
            mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_SMALLICON 
        );

        if result == 0 || sh_file_info.hIcon.is_invalid() {
            return None;
        }

        let h_icon = sh_file_info.hIcon;
        let icon_base64 = icon_to_base64(h_icon);
        
        DestroyIcon(h_icon);
        icon_base64
    }
}

fn scan_directory(dir: &Path) -> Vec<ProgramItem> {
    let mut items = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if file_name.starts_with('.') || file_name == "desktop.ini" {
                continue;
            }

            if path.is_dir() {
                let children = scan_directory(&path);
                if !children.is_empty() {
                    items.push(ProgramItem {
                        name: file_name,
                        path: path.to_string_lossy().to_string(),
                        is_folder: true,
                        children,
                        icon: None, // Folders use default icon for now
                    });
                }
            } else if let Some(extension) = path.extension() {
                if extension == "lnk" || extension == "exe" {
                    let name = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                    let path_str = path.to_string_lossy().to_string();
                    let icon = extract_icon(&path_str);
                    
                    items.push(ProgramItem {
                        name,
                        path: path_str,
                        is_folder: false,
                        children: vec![],
                        icon,
                    });
                }
            }
        }
    }

    items.sort_by(|a, b| {
        if a.is_folder && !b.is_folder {
            std::cmp::Ordering::Less
        } else if !a.is_folder && b.is_folder {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    items
}

pub fn get_all_programs() -> Vec<ProgramItem> {
    let mut all_items = Vec::new();

    if let Ok(program_data) = env::var("ProgramData") {
        let system_start_menu = Path::new(&program_data)
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs");
        
        let mut system_items = scan_directory(&system_start_menu);
        all_items.append(&mut system_items);
    }

    if let Ok(app_data) = env::var("APPDATA") {
        let user_start_menu = Path::new(&app_data)
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs");
        
        let mut user_items = scan_directory(&user_start_menu);
        all_items.append(&mut user_items);
    }

    let mut merged_items: Vec<ProgramItem> = Vec::new();
    
    for item in all_items {
        if let Some(existing) = merged_items.iter_mut().find(|i| i.name == item.name && i.is_folder) {
            if item.is_folder {
                existing.children.extend(item.children);
                existing.children.sort_by(|a, b| {
                    if a.is_folder && !b.is_folder {
                        std::cmp::Ordering::Less
                    } else if !a.is_folder && b.is_folder {
                        std::cmp::Ordering::Greater
                    } else {
                        a.name.to_lowercase().cmp(&b.name.to_lowercase())
                    }
                });
            }
        } else {
            merged_items.push(item);
        }
    }

    merged_items.sort_by(|a, b| {
        if a.is_folder && !b.is_folder {
            std::cmp::Ordering::Less
        } else if !a.is_folder && b.is_folder {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    merged_items
}
