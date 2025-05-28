"use client";
import { useState, useEffect } from "react";
import {
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  AlertCircle,
  Loader,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getUserByEmail,
  getRewardTransactions,
  getAvailableRewards,
  redeemReward,
  createTransaction,
} from "@/utils/database/actions";
import { toast } from "react-hot-toast";

type Transaction = {
  id: number;
  type: "earned_report" | "earned_collect" | "earned_recycle" | "redeemed";
  amount: number;
  description: string;
  date: string;
};

type Reward = {
  id: number;
  name: string;
  cost: number;
  description: string | null;
  collectionInfo: string;
};

export default function RewardsPage() {
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name: string;
  } | null>(null);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false); // Track redemption state

  useEffect(() => {
    const fetchUserDataAndRewards = async () => {
      setLoading(true);
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (userEmail) {
          const fetchedUser = await getUserByEmail(userEmail);
          if (fetchedUser) {
            setUser(fetchedUser);
            const fetchedTransactions = await getRewardTransactions(
              fetchedUser.id
            );
            setTransactions(fetchedTransactions as Transaction[]);
            const fetchedRewards = await getAvailableRewards(fetchedUser.id);
            setRewards(fetchedRewards.filter((r) => r.cost > 0)); // Filter out rewards with 0 points
            const calculatedBalance = fetchedTransactions.reduce(
              (acc, transaction) => {
                return transaction.type.startsWith("earned")
                  ? acc + transaction.amount
                  : acc - transaction.amount;
              },
              0
            );
            setBalance(Math.max(calculatedBalance, 0)); // Ensure balance is never negative
          } else {
            toast.error("User not found. Please log in again.");
          }
        }
      } catch (error) {
        console.error("Error fetching user data and rewards:", error);
        toast.error("Failed to load rewards data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserDataAndRewards();
  }, []);

  const handleRedeemReward = async (rewardId: number) => {
    if (!user) {
      toast.error("Please log in to redeem rewards.");
      return;
    }

    const reward = rewards.find((r) => r.id === rewardId);
    if (reward && balance >= reward.cost && reward.cost > 0) {
      try {
        setIsRedeeming(true); // Disable interactions during redemption

        // Update database
        await redeemReward(user.id, rewardId);

        // Create a new transaction record for redeeming the reward
        const newTransaction: Transaction = {
          id: Date.now(), // Optimistic ID, will be replaced on next fetch if needed
          type: "redeemed",
          amount: reward.cost,
          description: `Redeemed ${reward.name}`,
          date: new Date().toLocaleDateString(), // Simple date
        };

        // Update state immediately
        setBalance((prevBalance) => prevBalance - reward.cost);
        setTransactions((prevTransactions) => [
          newTransaction,
          ...prevTransactions,
        ]);

        toast.success(`You have successfully redeemed: ${reward.name}`);
      } catch (error) {
        console.error("Error redeeming reward:", error);
        toast.error("Failed to redeem reward. Please try again.");
        // Optionally, revert state changes on error if you don't want optimistic updates
      } finally {
        setIsRedeeming(false); // Re-enable interactions
      }
    } else {
      toast.error("Insufficient balance or invalid reward cost");
    }
  };

  const handleRedeemAllPoints = async () => {
    if (!user) {
      toast.error("Please log in to redeem points.");
      return;
    }

    if (balance <= 0) {
      toast.error("No points available to redeem.");
      return;
    }

    try {
      setIsRedeeming(true); // Disable interactions during redemption

      // Update database: Redeem all points
      await redeemReward(user.id, 0);

      // Create a new transaction record for redeeming all points
      const newTransaction: Transaction = {
        id: Date.now(), // Optimistic ID
        type: "redeemed",
        amount: balance,
        description: "Redeemed all points",
        date: new Date().toLocaleDateString(), // Simple date
      };

      // Update state immediately
      setBalance(0);
      setTransactions((prevTransactions) => [
        newTransaction,
        ...prevTransactions,
      ]);

      toast.success(`You have successfully redeemed all your points!`);
    } catch (error) {
      console.error("Error redeeming all points:", error);
      toast.error("Failed to redeem all points. Please try again.");
      // Optionally, revert state changes on error
    } finally {
      setIsRedeeming(false); // Re-enable interactions
    }
  };

  // We are now updating state directly in the handleRedeem functions,
  // so refreshUserData is no longer strictly necessary for immediate UI updates.
  // You might still call it in the background or on a timer to ensure data consistency.
  // const refreshUserData = async () => { ... };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-8 w-8 text-gray-600" />
      </div>
    );
  }

  // Slice to show only the last 5 transactions
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">Rewards</h1>

      {/* Reward Balance */}
      <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col justify-between h-full border-l-4 border-green-500 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Reward Balance
        </h2>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center">
            <Coins className="w-10 h-10 mr-3 text-green-500" />
            <div>
              <span className="text-4xl font-bold text-green-500">
                {balance}
              </span>
              <p className="text-sm text-gray-500">Available Points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions and Available Rewards */}
      <div className="grid gap-8 lg:grid-cols-2 lg:grid-flow-col">
        {/* Available Rewards (on left) */}
        <div className="lg:order-first">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            Available Rewards
          </h2>
          <div className="space-y-4">
            {rewards.length > 0 ? (
              rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="bg-white p-4 rounded-xl shadow-md"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {reward.name}
                    </h3>
                    <span className="text-green-500 font-semibold">
                      {reward.cost} points
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2">{reward.description}</p>
                  <p className="text-sm text-gray-500 mb-4">
                    {reward.collectionInfo}
                  </p>
                  {reward.id === 0 ? (
                    <div className="space-y-2">
                      <Button
                        onClick={handleRedeemAllPoints}
                        className="w-full bg-green-500 hover:bg-green-600 text-white hover:cursor-pointer"
                        disabled={balance === 0 || isRedeeming}
                      >
                        <Gift className="w-4 h-4 mr-2 hover:cursor-pointer" />
                        Redeem All Points
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleRedeemReward(reward.id)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white hover:cursor-pointer"
                        disabled={balance < reward.cost || isRedeeming}
                      >
                        <Gift className="w-4 h-4 mr-2 hover:cursor-pointer" />
                        Redeem Reward
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="h-6 w-6 text-yellow-400 mr-3" />
                  <p className="text-yellow-700">
                    No rewards available at the moment.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions (on right) */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            Recent Transactions
          </h2>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex items-center">
                      {transaction.type === "earned_report" ? (
                        <ArrowUpRight className="w-5 h-5 text-green-500 mr-3" />
                      ) : transaction.type === "earned_collect" ? (
                        <ArrowUpRight className="w-5 h-5 text-blue-500 mr-3" />
                      ) : transaction.type === "earned_recycle" ? (
                        <ArrowUpRight className="w-5 h-5 text-green-500 mr-3" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-red-500 mr-3" />
                      )}
                      <div>
                        <p className="font-medium text-gray-800">
                          {transaction.description}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.date}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-semibold ${
                        transaction.type.startsWith("earned")
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {transaction.type.startsWith("earned") ? "+" : "-"}
                      {transaction.amount}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No transactions yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
