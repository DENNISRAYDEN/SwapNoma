"use client";

import { useState, useEffect } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "react-hot-toast";
import { getAvailableRewards, getUserByEmail } from "@/utils/database/actions";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [currentYear, setCurrentYear] = useState<number>(0);

  // Fetch total earnings and set current year after component mounts
  useEffect(() => {
    const fetchTotalEarnings = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (userEmail) {
          const user = await getUserByEmail(userEmail);
          console.log("user from layout", user);

          if (user) {
            const availableRewards = (await getAvailableRewards(
              user.id
            )) as any;
            console.log("availableRewards from layout", availableRewards);
            setTotalEarnings(availableRewards);
          }
        }
      } catch (error) {
        console.error("Error fetching total earnings:", error);
      }
    };

    fetchTotalEarnings();
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Header
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            totalEarnings={totalEarnings}
          />
          <div className="flex flex-1">
            <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
            <main className="flex-1 p-4 lg:p-8 ml-0 lg:ml-64 transition-all duration-300">
              {children}
            </main>
          </div>
          <footer className="bg-green-50 text-gray-700 py-6 mt-12 border-t border-gray-200 shadow-lg rounded-tl-2xl rounded-tr-2xl lg:ml-[250px]">
            <div className="max-w-screen-xl mx-auto px-6 text-center">
              {/* Company Info */}
              <p className="text-xl font-semibold text-green-600 mb-4">
                <span className="text-gray-800 text-xl font-semibold">
                  Swap
                </span>{" "}
                Noma
              </p>
              <p className="text-sm">
                Give your old items a second life and earn rewards. Join the
                fight against waste!
              </p>

              {/* Navigation Links */}
              <div className="mt-4">
                <a href="/" className="text-gray-600 hover:text-green-600 px-3">
                  Home
                </a>
                <a
                  href="/report"
                  className="text-gray-600 hover:text-green-600 px-3"
                >
                  Recycle Items
                </a>
                <a
                  href="/collect"
                  className="text-gray-600 hover:text-green-600 px-3"
                >
                  Collect Items
                </a>
                <a
                  href="/rewards"
                  className="text-gray-600 hover:text-green-600 px-3"
                >
                  Rewards
                </a>
                <a
                  href="/leaderboard"
                  className="text-gray-600 hover:text-green-600 px-3"
                >
                  Leaderboard
                </a>
              </div>

              {/* Copyright */}
              <div className="mt-4 text-sm text-gray-500">
                <p>© {currentYear} SwapNoma. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
