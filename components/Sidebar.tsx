import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash, Coins, Medal, Settings, Home, Recycle } from "lucide-react";
import { useState } from "react";

const sidebarItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/report", icon: Recycle, label: "Recycle clothes" },
  { href: "/collect", icon: Trash, label: "Collect Clothes" },
  { href: "/rewards", icon: Coins, label: "Rewards" },
  { href: "/leaderboard", icon: Medal, label: "Leaderboard" },
];

interface SidebarProps {
  open: boolean;
}

export default function Sidebar({ open }: SidebarProps) {
  const pathname = usePathname();
  const [clickedHref, setClickedHref] = useState<string | null>(null);

  const handleClick = (href: string) => {
    if (!clickedHref) {
      setClickedHref(href);
      setTimeout(() => setClickedHref(null), 100);
    }
  };

  return (
    <aside
      className={`bg-white border-r pt-20 border-gray-200 text-gray-800 w-64 fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}
    >
      <nav className="h-full flex flex-col justify-between">
        <div className="px-4 py-6 space-y-8">
          {sidebarItems.map((item) => (
            <Link key={item.href} href={item.href} passHref>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={`w-full justify-start py-3 hover:cursor-pointer ${
                  pathname === item.href
                    ? "bg-green-100 text-green-800"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => handleClick(item.href)}
                disabled={clickedHref === item.href}
              >
                <item.icon className="mr-3 h-5 w-5" />
                <span className="text-base">{item.label}</span>
              </Button>
            </Link>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200">
          <Link href="/settings" passHref>
            <Button
              variant={pathname === "/settings" ? "secondary" : "outline"}
              className={`w-full py-3 ${
                pathname === "/settings"
                  ? "bg-green-100 text-green-800"
                  : "text-gray-600 border-gray-300 hover:bg-gray-100"
              }`}
              onClick={() => handleClick("/settings")}
              disabled={clickedHref === "/settings"}
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
