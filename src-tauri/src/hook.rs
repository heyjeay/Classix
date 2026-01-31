use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM, HINSTANCE, HMODULE};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, SetWindowsHookExW, UnhookWindowsHookEx, HHOOK, WH_KEYBOARD_LL, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_SYSKEYDOWN, WM_KEYUP, WM_SYSKEYUP
};
use windows::Win32::UI::Input::KeyboardAndMouse::{VK_LWIN, VK_RWIN};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use tauri::{AppHandle, Manager, PhysicalPosition, Position};
use std::ptr;

static mut HOOK_HANDLE: HHOOK = HHOOK(ptr::null_mut());
static mut APP_HANDLE: Option<AppHandle> = None;

unsafe extern "system" fn low_level_keyboard_proc(code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if code >= 0 {
        let kbd_struct = *(l_param.0 as *const KBDLLHOOKSTRUCT);
        let key_code = kbd_struct.vkCode;
        
        // Check for Windows Key
        if key_code == VK_LWIN.0 as u32 || key_code == VK_RWIN.0 as u32 {
            let msg = w_param.0 as u32;
            
            // Only trigger on KeyDown
            if msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN {
                if let Some(app) = &APP_HANDLE {
                     if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            // Position at bottom left
                            if let Ok(Some(monitor)) = window.current_monitor() {
                                let screen_size = monitor.size();
                                if let Ok(window_size) = window.outer_size() {
                                    // Raise up by 55px to avoid covering taskbar
                                    let y = screen_size.height as i32 - window_size.height as i32 - 55;
                                    let _ = window.set_position(Position::Physical(PhysicalPosition { x: 0, y }));
                                }
                            }
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                // Return 1 to consume the key and prevent Windows Start Menu
                return LRESULT(1);
            }
            // Also consume KeyUp
            if msg == WM_KEYUP || msg == WM_SYSKEYUP {
                return LRESULT(1);
            }
        }
    }
    CallNextHookEx(Some(HOOK_HANDLE), code, w_param, l_param)
}

pub fn setup_hook(app: &AppHandle) {
    unsafe {
        APP_HANDLE = Some(app.clone());
        // GetModuleHandleW returns Result<HMODULE>. 
        // We use unwrap() because getting the current module handle shouldn't fail.
        let module_handle: HMODULE = GetModuleHandleW(None).unwrap();
        
        // Convert HMODULE to HINSTANCE for SetWindowsHookExW
        let h_instance: HINSTANCE = module_handle.into();
        
        HOOK_HANDLE = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard_proc),
            Some(h_instance),
            0
        ).expect("Failed to install keyboard hook");
    }
}

pub fn remove_hook() {
    unsafe {
        if !HOOK_HANDLE.is_invalid() {
            let _ = UnhookWindowsHookEx(HOOK_HANDLE);
        }
    }
}
