import { database } from "./databaseConfig";
import {
  Users,
  Reports,
  Rewards,
  CollectedClothes,
  Notifications,
  Transactions,
} from "./schema";
import { eq, sql, and, desc, ne } from "drizzle-orm";

export async function createUser(email: string, name: string, points: number) {
  try {
    const [user] = await database
      .insert(Users)
      .values({ email, name })
      .returning()
      .execute();
    return user;
  } catch (error) {
    console.error("Error creating user:", error);
    return null;
  }
}

export async function getUserByEmail(email: string) {
  try {
    const [user] = await database
      .select()
      .from(Users)
      .where(eq(Users.email, email))
      .execute();
    return user;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return null;
  }
}

export async function createReport(
  userId: number,
  location: string,
  clothType: string,
  amount: string,
  imageUrl?: string,
  type?: string,
  verificationResult?: any
) {
  try {
    const [report] = await database
      .insert(Reports)
      .values({
        userId,
        location,
        clothType,
        amount,
        imageUrl,
        verificationResult,
        status: "pending",
      })
      .returning()
      .execute();

    // Award 10 points for reporting cloth
    const pointsEarned = 100;
    await updateRewardPoints(userId, pointsEarned);

    // Create a transaction for the earned points
    await createTransaction(
      userId,
      "earned_report",
      pointsEarned,
      "Points earned for recycling clothes"
    );

    // Create a notification for the user
    await createNotification(
      userId,
      `You've earned ${pointsEarned} points for recycling clothes!`,
      "reward"
    );

    return report;
  } catch (error) {
    console.error("Error creating report:", error);
    return null;
  }
}

export async function getReportsByUserId(userId: number) {
  try {
    const reports = await database
      .select()
      .from(Reports)
      .where(eq(Reports.userId, userId))
      .execute();
    return reports;
  } catch (error) {
    console.error("Error fetching reports:", error);
    return [];
  }
}

export async function getOrCreateReward(userId: number) {
  try {
    let [reward] = await database
      .select()
      .from(Rewards)
      .where(eq(Rewards.userId, userId))
      .execute();
    if (!reward) {
      [reward] = await database
        .insert(Rewards)
        .values({
          userId,
          name: "Default Reward",
          collectionInfo: "Default Collection Info",
          points: 0,
          level: 1,
          isAvailable: true,
        })
        .returning()
        .execute();
    }
    return reward;
  } catch (error) {
    console.error("Error getting or creating reward:", error);
    return null;
  }
}

export async function updateRewardPoints(userId: number, pointsToAdd: number) {
  try {
    const [updatedReward] = await database
      .update(Rewards)
      .set({
        points: sql`${Rewards.points} + ${pointsToAdd}`,
        updatedAt: new Date(),
      })
      .where(eq(Rewards.userId, userId))
      .returning()
      .execute();
    return updatedReward;
  } catch (error) {
    console.error("Error updating reward points:", error);
    return null;
  }
}

export async function createCollectedClothes(
  reportId: number,
  collectorId: number,
  notes?: string
) {
  try {
    const [collectedCloth] = await database
      .insert(CollectedClothes)
      .values({
        reportId,
        collectorId,
        collectionDate: new Date(),
      })
      .returning()
      .execute();
    return collectedCloth;
  } catch (error) {
    console.error("Error creating collected clothes:", error);
    return null;
  }
}

export async function getCollectedClothesByCollector(collectorId: number) {
  try {
    return await database
      .select()
      .from(CollectedClothes)
      .where(eq(CollectedClothes.collectorId, collectorId))
      .execute();
  } catch (error) {
    console.error("Error fetching collected clothes:", error);
    return [];
  }
}

export async function createNotification(
  userId: number,
  message: string,
  type: string
) {
  try {
    const [notification] = await database
      .insert(Notifications)
      .values({ userId, message, type })
      .returning()
      .execute();
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

export async function getUnreadNotifications(userId: number) {
  try {
    return await database
      .select()
      .from(Notifications)
      .where(
        and(eq(Notifications.userId, userId), eq(Notifications.isRead, false))
      )
      .execute();
  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId: number) {
  try {
    await database
      .update(Notifications)
      .set({ isRead: true })
      .where(eq(Notifications.id, notificationId))
      .execute();
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

export async function getPendingReports() {
  try {
    return await database
      .select()
      .from(Reports)
      .where(eq(Reports.status, "pending"))
      .execute();
  } catch (error) {
    console.error("Error fetching pending reports:", error);
    return [];
  }
}

export async function updateReportStatus(reportId: number, status: string) {
  try {
    const [updatedReport] = await database
      .update(Reports)
      .set({ status })
      .where(eq(Reports.id, reportId))
      .returning()
      .execute();
    return updatedReport;
  } catch (error) {
    console.error("Error updating report status:", error);
    return null;
  }
}

export async function getRecentReports(limit: number = 10) {
  try {
    const reports = await database
      .select()
      .from(Reports)
      .orderBy(desc(Reports.createdAt))
      .limit(limit)
      .execute();
    return reports;
  } catch (error) {
    console.error("Error fetching recent reports:", error);
    return [];
  }
}

export async function getClothCollectionTasks(
  userId: number,
  limit: number = 20
) {
  try {
    const tasks = await database
      .select({
        id: Reports.id,
        location: Reports.location,
        clothType: Reports.clothType,
        amount: Reports.amount,
        status: Reports.status,
        date: Reports.createdAt,
        collectorId: Reports.collectorId,
        userId: Reports.userId, // needed for filtering
      })
      .from(Reports)
      .where(ne(Reports.userId, userId)) // filter out own reports
      .limit(limit)
      .execute();

    return tasks.map((task) => ({
      id: task.id,
      location: task.location,
      clothType: task.clothType,
      amount: task.amount,
      status: task.status,
      collectorId: task.collectorId,
      date: new Date(task.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    }));
  } catch (error) {
    console.error("Error fetching clothes collection tasks:", error);
    return [];
  }
}

export async function saveReward(userId: number, amount: number) {
  try {
    const [updatedReward] = await database
      .update(Rewards)
      .set({
        points: sql`${Rewards.points} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(Rewards.userId, userId))
      .returning()
      .execute();

    // If no reward row exists, insert one
    if (!updatedReward) {
      const [newReward] = await database
        .insert(Rewards)
        .values({
          userId,
          name: "Clothes Collection Reward",
          collectionInfo: "Points earned from clothes collection",
          points: amount,
          level: 1,
          isAvailable: true,
        })
        .returning()
        .execute();

      await createTransaction(
        userId,
        "earned_collect",
        amount,
        "Points earned for collecting clothes"
      );

      return newReward;
    }

    await createTransaction(
      userId,
      "earned_collect",
      amount,
      "Points earned for collecting clothes"
    );

    return updatedReward;
  } catch (error) {
    console.error("Error saving reward:", error);
    throw error;
  }
}

export async function saveCollectedCloth(
  reportId: number,
  collectorId: number,
  verificationResult: any
) {
  try {
    const [collectedCloth] = await database
      .insert(CollectedClothes)
      .values({
        reportId,
        collectorId,
        collectionDate: new Date(),
        status: "verified",
      })
      .returning()
      .execute();
    return collectedCloth;
  } catch (error) {
    console.error("Error saving collected clothes:", error);
    throw error;
  }
}

export async function updateTaskStatus(
  reportId: number,
  newStatus: string,
  collectorId?: number
) {
  try {
    const updateData: any = { status: newStatus };
    if (collectorId !== undefined) {
      updateData.collectorId = collectorId;
    }
    const [updatedReport] = await database
      .update(Reports)
      .set(updateData)
      .where(eq(Reports.id, reportId))
      .returning()
      .execute();
    return updatedReport;
  } catch (error) {
    console.error("Error updating task status:", error);
    throw error;
  }
}

export async function getAllRewards() {
  try {
    const rewards = await database
      .select({
        id: Rewards.id,
        userId: Rewards.userId,
        points: Rewards.points,
        level: Rewards.level,
        createdAt: Rewards.createdAt,
        userName: Users.name,
      })
      .from(Rewards)
      .leftJoin(Users, eq(Rewards.userId, Users.id))
      .orderBy(desc(Rewards.points))
      .execute();

    return rewards;
  } catch (error) {
    console.error("Error fetching all rewards:", error);
    return [];
  }
}

export async function getRewardTransactions(userId: number) {
  try {
    console.log("Fetching transactions for user ID:", userId);
    const transactions = await database
      .select({
        id: Transactions.id,
        type: Transactions.type,
        amount: Transactions.amount,
        description: Transactions.description,
        date: Transactions.date,
      })
      .from(Transactions)
      .where(eq(Transactions.userId, userId))
      .orderBy(desc(Transactions.date))
      .limit(10)
      .execute();

    console.log("Raw transactions from database:", transactions);

    const formattedTransactions = transactions.map((t) => ({
      ...t,
      date: t.date.toISOString().split("T")[0], // Format date as YYYY-MM-DD
    }));

    console.log("Formatted transactions:", formattedTransactions);
    return formattedTransactions;
  } catch (error) {
    console.error("Error fetching reward transactions:", error);
    return [];
  }
}

export async function getAvailableRewards(userId: number) {
  try {
    console.log("Fetching available rewards for user:", userId);

    // Get user's total points
    const userTransactions = await getRewardTransactions(userId);
    const userPoints = userTransactions.reduce((total, transaction) => {
      return transaction.type.startsWith("earned")
        ? total + transaction.amount
        : total - transaction.amount;
    }, 0);
    console.log("User total points:", userPoints);

    // Return only the user's total points as a single reward
    const allRewards = [
      {
        id: 0, // Use a special ID for user's points
        name: "Your Points",
        cost: userPoints,
        description: "Redeem your earned points",
        collectionInfo: "Points earned from reporting and collecting clothes",
      },
    ];

    console.log("All available rewards:", allRewards);
    return allRewards;
  } catch (error) {
    console.error("Error fetching available rewards:", error);
    return [];
  }
}

export async function createTransaction(
  userId: number,
  type: "earned_report" | "earned_collect" | "redeemed",
  amount: number,
  description: string
) {
  try {
    const [transaction] = await database
      .insert(Transactions)
      .values({ userId, type, amount, description })
      .returning()
      .execute();
    return transaction;
  } catch (error) {
    console.error("Error creating transaction:", error);
    throw error;
  }
}

export async function redeemReward(userId: number, rewardId: number) {
  try {
    const userReward = (await getOrCreateReward(userId)) as any;

    if (rewardId === 0) {
      // Redeem all points
      const [updatedReward] = await database
        .update(Rewards)
        .set({
          points: 0,
          updatedAt: new Date(),
        })
        .where(eq(Rewards.userId, userId))
        .returning()
        .execute();

      // Create a transaction for this redemption
      await createTransaction(
        userId,
        "redeemed",
        userReward.points,
        `Redeemed all points`
      );

      return updatedReward;
    } else {
      // Existing logic for redeeming specific rewards
      const availableReward = await database
        .select()
        .from(Rewards)
        .where(eq(Rewards.id, rewardId))
        .execute();

      if (
        !userReward ||
        !availableReward[0] ||
        userReward.points < availableReward[0].points
      ) {
        throw new Error("Insufficient points or invalid reward");
      }

      const [updatedReward] = await database
        .update(Rewards)
        .set({
          points: sql`${Rewards.points} - ${availableReward[0].points}`,
          updatedAt: new Date(),
        })
        .where(eq(Rewards.userId, userId))
        .returning()
        .execute();

      // Create a transaction for this redemption
      await createTransaction(
        userId,
        "redeemed",
        availableReward[0].points,
        `Redeemed: ${availableReward[0].name}`
      );

      return updatedReward;
    }
  } catch (error) {
    console.error("Error redeeming reward:", error);
    throw error;
  }
}

export async function getUserBalance(userId: number): Promise<number> {
  const transactions = await getRewardTransactions(userId);
  const balance = transactions.reduce((acc, transaction) => {
    return transaction.type.startsWith("earned")
      ? acc + transaction.amount
      : acc - transaction.amount;
  }, 0);
  return Math.max(balance, 0);
}
