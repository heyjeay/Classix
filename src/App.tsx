import { useState, useEffect, useRef } from "react";
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
  Globe,
  File,
  Folder
} from "lucide-react";
import "./App.css";

interface ProgramItem {
  name: String;
  path: String;
  is_folder: boolean;
  children: ProgramItem[];
  icon?: string;
}

function SubMenu({ items, visible, onLaunch }: { items: ProgramItem[], visible: boolean, parentId?: string, onLaunch: (path: string) => void }) {
  const [render, setRender] = useState(visible);
  
  useEffect(() => {
    if (visible) setRender(true);
    else {
      const timer = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!render) return null;

  return (
    <div 
      className={`
        absolute left-full top-0 ml-[-4px]
        min-w-[250px] max-w-[400px] max-h-[500px] overflow-y-auto
        bg-gray-200/90 backdrop-blur-xl
        border-t-[1px] border-l-[1px] border-white/60
        border-r-[2px] border-b-[2px] border-black/40
        shadow-[4px_4px_10px_rgba(0,0,0,0.5)]
        flex flex-col py-1
        transition-all duration-300 ease-out origin-left
        ${visible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-4 scale-95'}
      `}
      style={{ zIndex: 50 }}
    >
      {items.length === 0 ? (
         <div className="px-4 py-2 text-gray-500 italic text-sm">No programs found...</div>
      ) : (
         items.map((item, idx) => (
           <SubMenuItem key={idx} item={item} onLaunch={onLaunch} />
         ))
      )}
    </div>
  );
}

function SubMenuItem({ item, onLaunch }: { item: ProgramItem, onLaunch: (path: string) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [showSubmenu, setShowSubmenu] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (item.is_folder) {
        hoverTimeoutRef.current = setTimeout(() => {
            setShowSubmenu(true);
        }, 500) as unknown as number;
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
    }
    setShowSubmenu(false);
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent bubbling
      if (!item.is_folder) {
          onLaunch(item.path as string);
      } else {
          setShowSubmenu(true);
      }
  };

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className={`
          flex items-center px-2 py-1 mx-1
          cursor-default select-none
          ${isHovered ? 'bg-[#000080] text-white' : 'text-black'}
        `}
        onClick={handleClick}
      >
        <div className="w-5 h-5 flex items-center justify-center mr-2">
            {item.icon ? (
                <img src={`data:image/png;base64,${item.icon}`} className="w-4 h-4 object-contain" alt="" />
            ) : (
                item.is_folder ? 
                <Folder size={16} className={isHovered ? "text-white" : "text-yellow-600"} fill={isHovered ? "white" : "#eab308"} /> : 
                <File size={16} className={isHovered ? "text-white" : "text-gray-600"} />
            )}
        </div>
        <span className="flex-1 truncate text-sm">{item.name}</span>
        {item.is_folder && <ChevronRight size={14} />}
      </div>
      
      {item.is_folder && item.children.length > 0 && (
          <SubMenu items={item.children} visible={showSubmenu} parentId={item.name as string} onLaunch={onLaunch} />
      )}
    </div>
  )
}

function App() {
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [programsList, setProgramsList] = useState<ProgramItem[]>([]);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Load programs on mount
  useEffect(() => {
      invoke<ProgramItem[]>('get_programs_list').then(setProgramsList).catch(console.error);
  }, []);

  const handleItemMouseEnter = (id: string) => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      
      // If "programs", wait 3 seconds before showing and expand window
      if (id === 'programs') {
          hoverTimeoutRef.current = setTimeout(() => {
              setActiveItem(id);
              invoke('set_window_size', { width: 800, height: 550 });
          }, 3000) as unknown as number;
      } else {
          // Immediate or short delay for others?
          // For now, let's keep others simple or clear active item
           if (activeItem === 'programs') {
               // If moving away from programs, shrink window
               invoke('set_window_size', { width: 320, height: 550 });
           }
           setActiveItem(null); 
      }
  };

  const handleItemMouseLeave = () => {
      if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
      }
      // If we leave the whole menu area (e.g. to desktop), we should shrink
      // But we can't detect "desktop" easily from here if it's outside window.
      // However, if we leave "Programs" item, handleItemMouseEnter of another item triggers shrink.
  };
  
  // We need a way to close submenu if not hovering either parent or submenu.
  // The simplest React way is to clear activeItem when hovering something else.


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
    if (id === 'programs') {
        // Instant open on click
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setActiveItem(id);
        invoke('set_window_size', { width: 800, height: 550 });
    } else if (id === 'logoff' || id === 'shutdown') {
       await invoke('launch_action', { id });
    } else {
        // Only launch directly for non-submenu items
        await invoke('launch_action', { id });
    }
  };

  return (
    <div className="w-screen h-screen flex items-end justify-start p-2 bg-transparent">
      {/* Start Menu Container */}
      <div className="
        w-[320px] h-full
        flex flex-row 
        bg-gray-200/85 backdrop-blur-xl
        border-t-[1px] border-l-[1px] border-white/60
        border-r-[2px] border-b-[2px] border-black/40
        shadow-[4px_4px_10px_rgba(0,0,0,0.5)]
        rounded-tr-lg
        overflow-visible
      ">
        
        {/* Left Sidebar (Classic Branding Strip) */}
        <div className="
          w-10 
          bg-gradient-to-b from-[#000080] to-[#1084d0]
          flex flex-col justify-end items-center
          pb-12
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
        <div className="flex-1 flex flex-col py-1 pl-1 pr-1 relative">
          
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
              const isPrograms = item.id === 'programs';
              
              return (
                <div 
                  key={item.id}
                  className={`
                    group flex items-center justify-between px-2 py-2
                    cursor-default select-none transition-colors duration-100
                    ${activeItem === item.id ? 'bg-[#000080] text-white' : 'hover:bg-[#000080] hover:text-white text-gray-800'}
                  `}
                  onMouseEnter={() => handleItemMouseEnter(item.id)}
                  onMouseLeave={handleItemMouseLeave}
                  onClick={() => handleItemClick(item.id)}
                >
                  <div className="flex items-center">
                    <Icon size={20} className="mr-3" />
                    <span className="font-medium tracking-wide text-sm">{item.label}</span>
                  </div>
                  {item.hasSubmenu && <ChevronRight size={16} />}
                  
                  {/* Programs Submenu */}
                  {isPrograms && (
                      <SubMenu 
                          items={programsList} 
                          visible={activeItem === 'programs'} 
                          parentId="programs" 
                          onLaunch={(path) => invoke('launch_action', { id: path })}
                      />
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
