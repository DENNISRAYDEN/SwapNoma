// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Coins,
  Leaf,
  Search,
  Bell,
  User,
  ChevronDown,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import {
  createUser,
  getUnreadNotifications,
  markNotificationAsRead,
  getUserByEmail,
  getUserBalance,
} from "@/utils/database/actions";
import toast, { Toaster } from "react-hot-toast";

const clientId = process.env.WEB3_AUTH_CLIENT_ID || "YOUR_WEB3AUTH_CLIENT_ID";

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xaa36a7",
  rpcTarget: "https://sepolia.infura.io/v3/dc9ccfaf5be74385a9e87c76192e0753",
  displayName: "Ethereum Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

const web3auth = new Web3Auth({
  clientId,
  web3AuthNetwork: "sapphire_devnet",
  privateKeyProvider,
});

interface HeaderProps {
  onMenuClick: () => void;
  totalEarnings: number;
}

interface Notification {
  id: number;
  type: string;
  message: string;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [provider, setProvider] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [balance, setBalance] = useState(0);
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    const checkUserLogin = async () => {
      const email = localStorage.getItem("userEmail");
      if (email) {
        setLoading(true);
        try {
          await web3auth.initModal();
          setProvider(web3auth.provider);
          if (web3auth.connected) {
            setLoggedIn(true);
            const user = await web3auth.getUserInfo();
            setUserInfo(user);

            if (user.email && user.email === email) {
              const existingUser = await getUserByEmail(user.email);
              if (!existingUser) {
                await createUser(user.email, user.name || "Anonymous User");
                toast.success("User created successfully!");
              }
            }
          }
        } catch (error) {
          console.error("Web3Auth init error:", error);
          toast.error("Web3Auth init failed.");
        } finally {
          setLoading(false);
        }
      }
    };

    checkUserLogin();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (userInfo?.email) {
        const user = await getUserByEmail(userInfo.email);
        if (user) {
          const unread = await getUnreadNotifications(user.id);
          setNotifications(unread);
        }
      }
    };

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 2000);
    return () => clearInterval(interval);
  }, [userInfo]);

  useEffect(() => {
    const fetchUserBalance = async () => {
      if (userInfo?.email) {
        const user = await getUserByEmail(userInfo.email);
        if (user) {
          const userBalance = await getUserBalance(user.id);
          setBalance(userBalance);
        }
      }
    };

    fetchUserBalance();

    const handleBalanceUpdate = (event: CustomEvent) => {
      setBalance(event.detail);
    };

    window.addEventListener("balanceUpdated", handleBalanceUpdate);

    return () => {
      window.removeEventListener("balanceUpdated", handleBalanceUpdate);
    };
  }, [userInfo]);

  const initWeb3Auth = async () => {
    try {
      setLoading(true);
      await web3auth.initModal();
      setProvider(web3auth.provider);

      if (web3auth.connected) {
        setLoggedIn(true);
        const user = await web3auth.getUserInfo();
        setUserInfo(user);

        if (user.email) {
          localStorage.setItem("userEmail", user.email);
          const existingUser = await getUserByEmail(user.email);
          if (!existingUser) {
            await createUser(user.email, user.name || "Anonymous User");
            toast.success("User created successfully!");
          }
        }
      }
    } catch (error) {
      console.error("Web3Auth init error:", error);
      toast.error("Web3Auth init failed.");
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    if (!web3auth) {
      toast.error("Web3Auth not ready.");
      return;
    }

    if (!provider) {
      await initWeb3Auth();
    }

    try {
      const web3authProvider = await web3auth.connect();
      setProvider(web3authProvider);
      setLoggedIn(true);
      const user = await web3auth.getUserInfo();
      setUserInfo(user);

      if (user.email) {
        localStorage.setItem("userEmail", user.email);
        const existingUser = await getUserByEmail(user.email);
        if (!existingUser) {
          await createUser(user.email, user.name || "Anonymous User");
          toast.success(`Welcome, ${user.name || "User"}!`);
        } else {
          toast.success(`Welcome back, ${user.name || "User"}!`);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed.");
    }
  };

  const logout = async () => {
    try {
      await web3auth.logout();
      setProvider(null);
      setLoggedIn(false);
      setUserInfo(null);
      localStorage.removeItem("userEmail");
      toast.success("Logged out.");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed.");
    }
  };

  const handleNotificationClick = async (notificationId: number) => {
    await markNotificationAsRead(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    const user = await getUserByEmail(userInfo.email);
    const updatedBalance = await getUserBalance(user.id);
    setBalance(updatedBalance);

    window.dispatchEvent(
      new CustomEvent("balanceUpdated", { detail: updatedBalance })
    );
  };

  return (
    <>
      <Toaster />
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="mr-2 md:mr-4"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <Link href="/" className="flex items-center">
              <Leaf className="h-6 w-6 md:h-8 md:w-8 text-green-500 mr-1 md:mr-2" />
              <div className="flex flex-col">
                <span className="font-bold text-base md:text-lg text-gray-800">
                  Swap <span className="text-green-500">Noma</span>
                </span>
                <span className="text-[8px] md:text-[10px] text-gray-500 -mt-1">
                  Home of Fashion.
                </span>
              </div>
            </Link>
          </div>

          {!isMobile && (
            <div className="flex-1 max-w-xl mx-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-6">
            {" "}
            {/* Space between items */}
            {/* Notification Bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-6 w-6" />
                  {notifications.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-5">
                      {notifications.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id)}
                    >
                      <div className="flex flex-col mr-10">
                        <span className="text-sm text-gray-500">
                          You've earned 100 points for reporting cloth
                          recycling.
                        </span>
                        <hr className="my-2 " />
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem>No new notifications</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Balance Display (optional, adjust based on design) */}
            {/* <div className="flex items-center bg-gray-100 rounded-full px-2 py-1">
              <Coins className="h-4 w-4 text-green-500" />
              <span className="font-semibold text-sm text-gray-800">{balance.toFixed(2)}</span>
            </div> */}
            {/* Login Button / User Profile */}
            {!loggedIn ? (
              <Button
                onClick={login}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white text-sm"
              >
                {loading ? "Log in" : "Login"}
                <LogIn className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex items-center"
                  >
                    {userInfo?.profileImage ? (
                      <img
                        src={userInfo.profileImage}
                        alt="Profile"
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <User className="h-5 w-5 mr-1" />
                    )}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    {userInfo?.name || "User"}
                  </DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
