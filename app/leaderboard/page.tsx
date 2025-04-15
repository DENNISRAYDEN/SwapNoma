"use client";
import { useState, useEffect } from "react";
import { getAllRewards, getUserByEmail } from "@/utils/database/actions";
import { Loader, Award, User, Trophy, Crown } from "lucide-react";
import { toast } from "react-hot-toast";

type Reward = {
  id: number;
  userId: number;
  points: number;
  level: number;
  createdAt: Date;
  userName: string | null;
};

export default function LeaderboardPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const fetchRewardsAndUser = async () => {
      setLoading(true);
      try {
        const fetchedRewards = await getAllRewards();
        setRewards(fetchedRewards);

        const userEmail = localStorage.getItem("userEmail");
        if (userEmail) {
          const fetchedUser = await getUserByEmail(userEmail);
          if (fetchedUser) {
            setUser(fetchedUser);
          } else {
            toast.error("User not found. Please log in again.");
          }
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        toast.error("Failed to load leaderboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchRewardsAndUser();
  }, []);

  // Group and sum points per user
  const aggregatedUsers = rewards.reduce(
    (acc, reward) => {
      const existing = acc.find((u) => u.userId === reward.userId);
      if (existing) {
        existing.totalPoints += reward.points;
        existing.rewards.push(reward);
      } else {
        acc.push({
          userId: reward.userId,
          userName: reward.userName || "Unknown",
          totalPoints: reward.points,
          level: reward.level,
          rewards: [reward],
        });
      }
      return acc;
    },
    [] as {
      userId: number;
      userName: string;
      totalPoints: number;
      level: number;
      rewards: Reward[];
    }[]
  );

  // Filter out users with zero points
  const filteredUsers = aggregatedUsers.filter((user) => user.totalPoints > 0);

  // Sort the remaining users by total points
  const sortedUsers = filteredUsers.sort(
    (a, b) => b.totalPoints - a.totalPoints
  );

  return (
    <div className="bg-white min-h-screen p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6 text-gray-800">
          Leaderboard
        </h1>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader className="animate-spin h-8 w-8 text-gray-600" />
          </div>
        ) : (
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 flex items-center justify-between">
              <Trophy className="h-8 w-8 text-white" />
              <span className="text-xl font-bold text-white">
                Top Performers
              </span>
              <Award className="h-8 w-8 text-white" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((entry, index) => {
                    const isCurrentUser = user?.id === entry.userId;
                    return (
                      <tr
                        key={entry.userId}
                        className={`${
                          isCurrentUser ? "bg-indigo-50" : ""
                        } hover:bg-gray-50 transition-colors`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            {index < 3 ? (
                              <Crown
                                className={`h-6 w-6 ${
                                  index === 0
                                    ? "text-yellow-400"
                                    : index === 1
                                    ? "text-gray-400"
                                    : "text-yellow-600"
                                }`}
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">
                                {index + 1}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className="hidden md:flex h-8 w-8 rounded-full bg-gray-200 text-gray-500 p-1">
                              <User className="h-full w-full" />
                            </div>
                            <div className="truncate max-w-[150px] text-sm font-medium text-gray-900">
                              {entry.userName}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <Award className="h-5 w-5 text-indigo-500 mr-2" />
                            <div className="text-sm font-semibold text-gray-900">
                              {entry.totalPoints.toLocaleString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-sm font-semibold rounded-full bg-indigo-100 text-indigo-800">
                            Level {entry.rewards[0]?.level ?? 1}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
