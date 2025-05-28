import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  TruckIcon,
  Coins,
  Medal,
  Settings,
  Home,
  Recycle,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";

const sidebarItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/report", icon: Recycle, label: "Recycle Items" },
  { href: "/collect", icon: TruckIcon, label: "Market Place" },
  { href: "/rewards", icon: Coins, label: "Rewards" },
  { href: "/leaderboard", icon: Medal, label: "Leaderboard" },
];

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        open &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, setOpen]);

  return (
    <aside
      ref={sidebarRef}
      className={`bg-white border-r border-gray-200 text-gray-800 w-64 z-50 transform transition-transform duration-300 ease-in-out
        fixed left-0
        ${open ? "translate-x-0" : "-translate-x-full"}
        top-0 h-screen lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0`}
    >
      {/* Logo and Close Button for Mobile */}
      <div className="absolute top-4 left-4 right-4 lg:hidden z-50 flex items-center justify-between">
        <div className="flex flex-col ml-4">
          <span className="font-bold text-base md:text-lg text-gray-800">
            Swap <span className="text-green-500">Noma</span>
          </span>
          <span className="text-[8px] md:text-[10px] text-gray-500 -mt-1">
            Recycle Now.Safe World
          </span>
        </div>
        <button onClick={() => setOpen(false)}>
          <X className="h-6 w-6 text-gray-600 hover:text-gray-800" />
        </button>
      </div>

      {/* Nav Items */}
      <nav className="h-full flex flex-col justify-between pt-24 lg:pt-6">
        <div className="px-4 space-y-8">
          {sidebarItems.map((item) => (
            <Link key={item.href} href={item.href} passHref>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={`w-full justify-start py-3 hover:cursor-pointer ${
                  pathname === item.href
                    ? "bg-green-100 text-green-800"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                <span className="text-base">{item.label}</span>
              </Button>
            </Link>
          ))}
        </div>

        {/* Settings Button */}
        <div className="p-4 border-t border-gray-200">
          <Link href="/settings" passHref>
            <Button
              variant={pathname === "/settings" ? "secondary" : "outline"}
              className={`w-full py-3 ${
                pathname === "/settings"
                  ? "bg-green-100 text-green-800"
                  : "text-gray-600 border-gray-300 hover:bg-gray-100"
              }`}
            >
              <Settings className="mr-3 h-5 w-5" />
              <span className="text-base">Settings</span>
            </Button>
          </Link>
        </div>
      </nav>
    </aside>
  );
}
