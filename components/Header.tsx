// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Search,
  HandCoins,
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
  const [provider, setProvider] = useState<any>(null);
  const [loggedIn, setLoggedIn] = useState(false); // Initialize as false
  const [userInfo, setUserInfo] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [balance, setBalance] = useState(0);
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(
    null
  );
  const [notificationFetchError, setNotificationFetchError] = useState<
    string | null
  >(null);
  const [balanceFetchError, setBalanceFetchError] = useState<string | null>(
    null
  );

  const initializeWeb3Auth = useCallback(async () => {
    setIsInitializing(true);
    setInitializationError(null);
    try {
      await web3auth.initModal();
      setProvider(web3auth.provider);

      if (web3auth.connected) {
        setLoggedIn(true);
        const user = await web3auth.getUserInfo();
        setUserInfo(user);
        if (user.email) {
          localStorage.setItem("userEmail", user.email);
          try {
            const existingUser = await getUserByEmail(user.email);
            if (!existingUser) {
              await createUser(user.email, user.name || "Anonymous User");
              toast.success(`Welcome, ${user.name || "New User"}!`);
            }
          } catch (error: any) {
            console.error("Error creating/fetching user:", error);
            toast.error("Error during user setup.");
          }
        }
      } else {
        setLoggedIn(false);
        setUserInfo(null);
        localStorage.removeItem("userEmail");
      }
    } catch (error: any) {
      console.error("Web3Auth init error:", error);
      let errorMessage = "Failed to initialize Web3Auth.";
      if (error?.message) {
        errorMessage += ` Details: ${error.message}`;
      }
      toast.error(errorMessage);
      setInitializationError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initializeWeb3Auth();
  }, [initializeWeb3Auth]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (userInfo?.email) {
        setNotificationFetchError(null);
        try {
          const user = await getUserByEmail(userInfo.email);
          if (user) {
            const unread = await getUnreadNotifications(user.id);
            setNotifications(unread);
          }
        } catch (error: any) {
          console.error("Error fetching notifications:", error);
          setNotificationFetchError("Failed to fetch notifications.");
          toast.error("Failed to fetch notifications.");
        }
      } else {
        setNotifications([]);
      }
    };

    if (loggedIn && !isInitializing) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 5000); // Adjusted interval
      return () => clearInterval(interval);
    }
  }, [userInfo, loggedIn, isInitializing]);

  useEffect(() => {
    const fetchUserBalance = async () => {
      if (userInfo?.email) {
        setBalanceFetchError(null);
        try {
          const user = await getUserByEmail(userInfo.email);
          if (user) {
            const userBalance = await getUserBalance(user.id);
            setBalance(userBalance);
          } else {
            setBalance(0);
          }
        } catch (error: any) {
          console.error("Error fetching user balance:", error);
          setBalanceFetchError("Failed to fetch user balance.");
          toast.error("Failed to fetch user balance.");
          setBalance(0);
        }
      } else {
        setBalance(0);
      }
    };

    if (loggedIn && !isInitializing) {
      fetchUserBalance();
    }

    const handleBalanceUpdate = (event: CustomEvent) => {
      setBalance(event.detail);
    };

    window.addEventListener("balanceUpdated", handleBalanceUpdate);

    return () => {
      window.removeEventListener("balanceUpdated", handleBalanceUpdate);
    };
  }, [userInfo, loggedIn, isInitializing]);

  const login = async () => {
    if (!web3auth) {
      toast.error("Web3Auth not ready. Please try again.");
      return;
    }

    try {
      const web3authProvider = await web3auth.connect();
      setProvider(web3authProvider);
      setLoggedIn(true);
      const user = await web3auth.getUserInfo();
      setUserInfo(user);

      if (user.email) {
        localStorage.setItem("userEmail", user.email);
        try {
          const existingUser = await getUserByEmail(user.email);
          if (!existingUser) {
            await createUser(user.email, user.name || "Anonymous User");
            toast.success(`Welcome, ${user.name || "New User"}!`);
          } else {
            toast.success(`Welcome back, ${user.name || "User"}!`);
          }
        } catch (error: any) {
          console.error("Error creating/fetching user after login:", error);
          toast.error("Error during user setup after login.");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error?.message?.includes("User closed modal")) {
        toast.error("Login cancelled by user.");
      } else {
        let errorMessage = "Login failed. Please try again.";
        if (error?.message) {
          errorMessage += ` Details: ${error.message}`;
        }
        toast.error(errorMessage);
      }
      setLoggedIn(false);
      setUserInfo(null);
      localStorage.removeItem("userEmail");
    }
  };

  const logout = async () => {
    try {
      await web3auth.logout();
      setProvider(null);
      setLoggedIn(false);
      setUserInfo(null);
      localStorage.removeItem("userEmail");
      toast.success("Logged out successfully.");
    } catch (error: any) {
      console.error("Logout error:", error);
      let errorMessage = "Logout failed. Please try again.";
      if (error?.message) {
        errorMessage += ` Details: ${error.message}`;
      }
      toast.error(errorMessage);
    }
  };

  const handleNotificationClick = async (notificationId: number) => {
    if (userInfo?.email) {
      try {
        await markNotificationAsRead(notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

        const user = await getUserByEmail(userInfo.email);
        if (user) {
          const updatedBalance = await getUserBalance(user.id);
          setBalance(updatedBalance);
          window.dispatchEvent(
            new CustomEvent("balanceUpdated", { detail: updatedBalance })
          );
        }
      } catch (error: any) {
        console.error("Error marking notification as read:", error);
        toast.error("Failed to update notification.");
      }
    }
  };

  return (
    <>
      <Toaster />
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center lg:ml-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="mr-2 md:mr-4 lg:hidden"
              disabled={isInitializing}
            >
              {/* Show Menu icon only on mobile */}
              <Menu className="h-6 w-6 lg:hidden" />
            </Button>
            <Link href="/" className="flex items-center">
              <div className="flex flex-col">
                <span className="font-bold text-base md:text-lg text-gray-800">
                  Swap <span className="text-green-500">Noma</span>
                </span>
                <span className="text-[8px] md:text-[10px] text-gray-500 -mt-1">
                  Recycle Now.Save World
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  disabled={isInitializing}
                >
                  <Bell className="h-6 w-6" />
                  {notifications.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-5">
                      {notifications.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {notificationFetchError && (
                  <DropdownMenuItem disabled>
                    Error loading notifications.
                  </DropdownMenuItem>
                )}
                {!notificationFetchError && notifications.length > 0
                  ? notifications.map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={() => handleNotificationClick(n.id)}
                      >
                        <div className="flex flex-col mr-10">
                          <span className="text-sm text-gray-500">
                            {n.message}
                          </span>
                          <hr className="my-2 " />
                        </div>
                      </DropdownMenuItem>
                    ))
                  : !notificationFetchError && (
                      <DropdownMenuItem>No new notifications</DropdownMenuItem>
                    )}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Login Button / User Profile */}
            {isInitializing ? (
              <Button variant="ghost" size="icon" disabled>
                <User className="h-5 w-5 mr-1 animate-pulse" />{" "}
                {/* Show a placeholder during initialization */}
                <ChevronDown className="h-4 w-4" />
              </Button>
            ) : !loggedIn ? (
              <Button
                onClick={login}
                className="bg-green-600 hover:bg-green-700 text-white text-sm"
                disabled={isInitializing}
              >
                Login
                <LogIn className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex items-center"
                    disabled={isInitializing}
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
                  <DropdownMenuItem disabled>
                    {userInfo?.name || "User"}
                  </DropdownMenuItem>
                  <Link href="/settings">
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                  </Link>

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
