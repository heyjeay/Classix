import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  Monitor, 
  FolderOpen, 
  Settings, 
  Search, 
  HelpCircle, 
  Play, 
  LogOut, 
  Power,
  ChevronRight,
  User,
  Globe
} from "lucide-react";
import "./App.css";

function App() {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  // Function to handle window position (simulated for now, would be Rust backend)
  useEffect(() => {
    // In a real app, we'd use tauri's window API to position this at the bottom left
    // near the start button.
  }, []);

  const menuItems = [
    { id: "update", label: "Windows Update", icon: Globe, hasSubmenu: false },
    { id: "divider1", type: "divider" },
    { id: "programs", label: "Programs", icon: Monitor, hasSubmenu: true },
    { id: "documents", label: "Documents", icon: FolderOpen, hasSubmenu: true },
    { id: "settings", label: "Settings", icon: Settings, hasSubmenu: true },
    { id: "find", label: "Find", icon: Search, hasSubmenu: true },
    { id: "help", label: "Help", icon: HelpCircle, hasSubmenu: false },
    { id: "run", label: "Run...", icon: Play, hasSubmenu: false },
    { id: "divider2", type: "divider" },
    { id: "logoff", label: "Log Off...", icon: LogOut, hasSubmenu: false },
    { id: "shutdown", label: "Shut Down...", icon: Power, hasSubmenu: false },
  ];

  const handleItemClick = async (id: string) => {
    if (id === 'logoff' || id === 'shutdown') {
       await invoke('exit_app');
    }
  };

  return (
    <div className="w-screen h-screen flex items-end justify-start p-2 bg-transparent">
      {/* Start Menu Container */}
      <div className="
        w-full h-full
        flex flex-row 
        bg-gray-200/85 backdrop-blur-xl
        border-t-[1px] border-l-[1px] border-white/60
        border-r-[2px] border-b-[2px] border-black/40
        shadow-[4px_4px_10px_rgba(0,0,0,0.5)]
        rounded-tr-lg
        overflow-hidden
      ">
        
        {/* Left Sidebar (Classic Branding Strip) */}
        <div className="
          w-10 
          bg-gradient-to-b from-[#000080] to-[#1084d0]
          flex flex-col justify-end items-center
          pb-4
        ">
          <span className="
            text-white font-bold text-xl tracking-widest 
            -rotate-90 whitespace-nowrap mb-4
            drop-shadow-[1px_1px_2px_rgba(0,0,0,0.5)]
          ">
            <span className="font-normal opacity-90">Classix</span> <span className="font-extrabold">98</span>
          </span>
        </div>

        {/* Main Menu Items */}
        <div className="flex-1 flex flex-col py-1 pl-1 pr-1">
          
          {/* User Profile (Modern Touch) */}
          <div className="flex items-center p-2 mb-1 border-b border-gray-400/30">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-300 mr-3 shadow-sm">
              <User size={18} className="text-blue-600" />
            </div>
            <span className="font-semibold text-gray-800">User</span>
          </div>

          <div className="flex-1 flex flex-col justify-end space-y-[2px]">
            {menuItems.map((item, index) => {
              if (item.type === "divider") {
                return <div key={`div-${index}`} className="h-[1px] bg-gray-400/50 my-1 mx-1" />;
              }

              const Icon = item.icon as any;
              
              return (
                <div 
                  key={item.id}
                  className={`
                    group flex items-center justify-between px-2 py-2
                    cursor-pointer transition-all duration-100
                    ${activeItem === item.id ? 'bg-[#000080] text-white shadow-inner' : 'hover:bg-[#000080] hover:text-white'}
                    ${activeItem === item.id ? 'bg-opacity-90' : ''}
                  `}
                  onMouseEnter={() => setActiveItem(item.id)}
                  onMouseLeave={() => setActiveItem(null)}
                  onClick={() => handleItemClick(item.id)}
                >
                  <div className="flex items-center gap-3">
                    {Icon && <Icon size={24} className={`
                      ${activeItem === item.id ? 'text-white' : 'text-gray-700'} 
                      group-hover:text-white drop-shadow-sm
                    `} />}
                    <span className="text-sm font-medium tracking-wide">
                      {item.label}
                    </span>
                  </div>
                  
                  {item.hasSubmenu && (
                    <ChevronRight size={14} className={`
                      ${activeItem === item.id ? 'text-white' : 'text-gray-900'} 
                      group-hover:text-white
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
