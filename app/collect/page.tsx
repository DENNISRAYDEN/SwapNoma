"use client";
import { useState, useEffect } from "react";
import {
  Trash2,
  MapPin,
  CheckCircle,
  Clock,
  Upload,
  Loader,
  Calendar,
  Weight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import {
  getClothCollectionTasks,
  updateTaskStatus,
  saveReward,
  saveCollectedCloth,
  getUserByEmail,
} from "@/utils/database/actions";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Make sure to set your Gemini API key in your environment variables
const geminiApiKey = process.env.GEMINI_API_KEY;

type CollectionTask = {
  id: number;
  location: string;
  clothType: string;
  amount: string;
  status: "pending" | "in_progress" | "completed" | "verified";
  date: string;
  collectorId: number | null;
};

const ITEMS_PER_PAGE = 5;

export default function CollectPage() {
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredclothType, setHoveredclothType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name: string;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // To prevent multiple clicks
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [verificationImage, setVerificationImage] = useState<string | null>(
    null
  );
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");
  const [verificationResult, setVerificationResult] = useState<{
    clothTypeMatch: boolean;
    quantityMatch: boolean;
    confidence: number;
  } | null>(null);
  const [reward, setReward] = useState<number | null>(null);

  useEffect(() => {
    const fetchUserAndTasks = async () => {
      setLoading(true);
      try {
        // Fetch user
        const userEmail = localStorage.getItem("userEmail");
        if (userEmail) {
          const fetchedUser = await getUserByEmail(userEmail);
          if (fetchedUser) {
            setUser(fetchedUser);
            const fetchedTasks = await getClothCollectionTasks(fetchedUser.id);
            setTasks(fetchedTasks as CollectionTask[]);
          } else {
            toast.error("User not found. Please log in again.");
          }
        }
      } catch (error) {
        console.error("Error fetching user and tasks:", error);
        toast.error("Failed to load user data and tasks. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndTasks();
  }, []);

  const handleStatusChange = async (
    taskId: number,
    newStatus: CollectionTask["status"]
  ) => {
    if (!user) {
      toast.error("Please log in to collect clothes.");
      return;
    }
    if (isUpdatingStatus) return; // Prevent multiple clicks
    setIsUpdatingStatus(true); // Disable button
    try {
      const updatedTask = await updateTaskStatus(taskId, newStatus, user.id);
      if (updatedTask) {
        setTasks(
          tasks.map((task) =>
            task.id === taskId
              ? { ...task, status: newStatus, collectorId: user.id }
              : task
          )
        );
        toast.success("Task status updated successfully");
      } else {
        toast.error("Failed to update task status. Please try again.");
      }
    } catch (error) {
      console.error("Error updating task status:", error);
      toast.error("Failed to update task status. Please try again.");
    } finally {
      setIsUpdatingStatus(false); // Re-enable button
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVerificationImage(reader.result as string);
        toast.success("Clothes uploaded successfully!");
      };
      reader.onerror = () => {
        toast.error("Failed to upload image. Please try again.");
      };
      reader.readAsDataURL(file);
    }
  };

  const readFileAsBase64 = (dataUrl: string): string => {
    return dataUrl.split(",")[1];
  };

  const handleVerify = async () => {
    if (!selectedTask || !verificationImage || !user) {
      toast.error("Missing required information for verification.");
      return;
    }
    setVerificationStatus("verifying");
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64Data = readFileAsBase64(verificationImage);
      const imageParts = [
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg", // Adjust this if you know the exact type
          },
        },
      ];
      const prompt = `You are an expert in cloth management and recycling. Analyze this image and provide:
        1. Confirm if the cloth type matches: ${selectedTask.clothType}
        2. Estimate if the quantity matches: ${selectedTask.amount}
        3. Your confidence level in this assessment (as a percentage)
        Respond in JSON format like this:
        {
          "clothTypeMatch": true/false,
          "quantityMatch": true/false,
          "confidence": confidence level as a number between 0 and 1
        }`;
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      const cleanText = text
        .replace(/```json|```/g, "")
        .trim()
        .replace(/\n/g, "");
      try {
        const parsedResult = JSON.parse(cleanText);
        setVerificationResult({
          clothTypeMatch: parsedResult.clothTypeMatch,
          quantityMatch: parsedResult.quantityMatch,
          confidence: parsedResult.confidence,
        });
        setVerificationStatus("success");

        if (
          parsedResult.clothTypeMatch &&
          parsedResult.quantityMatch &&
          parsedResult.confidence > 0.7
        ) {
          await handleStatusChange(selectedTask.id, "verified");
          const earnedReward = Math.floor(Math.random() * 50) + 10;
          await saveReward(user.id, earnedReward);
          const reportId = `report_${Date.now()}`;
          await saveCollectedCloth(selectedTask.id, user.id, parsedResult);
          setReward(earnedReward);
          toast.success(
            `Verification successful! You earned ${earnedReward} tokens!`
          );
        } else {
          toast.error(
            "Verification failed. The collected clothes do not match the reported ones."
          );
        }
      } catch (error) {
        console.error("Failed to parse cleaned JSON response:", cleanText);
        toast.error(
          "Please try again. The image you submitted does not match."
        );
        setVerificationStatus("failure");
      }
    } catch (error) {
      console.error("Error verifying clothes:", error);
      setVerificationStatus("failure");
    } finally {
      setVerificationImage(null);
      setVerificationResult(null);
      setVerificationStatus("idle");
      setSelectedTask(null);
    }
  };

  const filteredTasks = tasks.filter((task) =>
    task.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pageCount = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto relative">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Clothes Collection Tasks
      </h1>
      <div className="mb-4 flex items-center">
        <Input
          type="text"
          placeholder="Search by area..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mr-2"
        />
        <Button variant="outline" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin h-8 w-8 text-gray-500" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          No collection tasks available.
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
              >
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-medium text-gray-800 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                    {task.location}
                  </h2>
                  <StatusBadge status={task.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                  <div className="flex items-center relative">
                    <Trash2 className="w-4 h-4 mr-2 text-gray-500" />
                    <span
                      onMouseEnter={() => setHoveredclothType(task.clothType)}
                      onMouseLeave={() => setHoveredclothType(null)}
                      className="cursor-pointer"
                    >
                      {task.clothType && task.clothType.length > 8
                        ? `${task.clothType.slice(0, 8)}...`
                        : task.clothType || "Unknown"}
                    </span>
                    {hoveredclothType === task.clothType && (
                      <div className="absolute left-0 top-full mt-1 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                        {task.clothType}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center">
                    <Weight className="w-4 h-4 mr-2 text-gray-500" />
                    {task.amount}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                    {task.date}
                  </div>
                </div>
                <div className="flex justify-end">
                  {task.status === "pending" && (
                    <Button
                      onClick={() => {
                        if (!user) {
                          toast.error("Please log in to collect clothes.");
                          return;
                        }
                        handleStatusChange(task.id, "in_progress");
                      }}
                      variant="outline"
                      size="sm"
                      disabled={isUpdatingStatus} // Disable button during update
                    >
                      {isUpdatingStatus ? "Starting..." : "Start Collection"}
                    </Button>
                  )}
                  {task.status === "in_progress" &&
                    task.collectorId === user?.id && (
                      <Button
                        onClick={() => setSelectedTask(task)}
                        variant="outline"
                        size="sm"
                      >
                        Complete & Verify
                      </Button>
                    )}
                  {task.status === "in_progress" &&
                    task.collectorId !== user?.id && (
                      <span className="text-yellow-600 text-sm font-medium">
                        In progress by another collector
                      </span>
                    )}
                  {task.status === "verified" && (
                    <span className="text-green-600 text-sm font-medium">
                      Reward Earned
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="mr-2"
            >
              Previous
            </Button>
            <span className="mx-2 self-center">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, pageCount))
              }
              disabled={currentPage === pageCount}
              className="ml-2"
            >
              Next
            </Button>
          </div>
        </>
      )}
      {selectedTask && (
        <>
          {/* Dark overlay */}
          <div className="fixed inset-0 bg-gray-90 bg-opacity-50 pointer-events-none backdrop-blur-sm z-20 "></div>
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto ">
              <h3 className="text-xl font-semibold mb-4 ">Verify Collection</h3>
              <p className="mb-4 text-sm text-gray-600">
                Upload a photo of the collected clothes to verify and earn your
                reward.
              </p>
              <div className="mb-4">
                <label
                  htmlFor="verification-image"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Upload clothes
                </label>
                <div
                  onClick={() =>
                    document.getElementById("verification-image")?.click()
                  }
                  className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-green-300"
                >
                  {verificationImage ? (
                    <img
                      src={verificationImage}
                      alt="Uploaded Verification"
                      className="max-w-full max-h-40 object-contain"
                    />
                  ) : (
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="verification-image"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Upload a file</span>
                          <input
                            id="verification-image"
                            name="verification-image"
                            type="file"
                            className="sr-only"
                            onChange={handleImageUpload}
                            accept="image/*"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, GIF up to 10MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <Button
                onClick={handleVerify}
                className="w-full cursor-pointer"
                disabled={
                  !verificationImage || verificationStatus === "verifying"
                }
              >
                {verificationStatus === "verifying" ? (
                  <>
                    <Loader className="animate-spin -ml-1 mr-3 h-5 w-5" />
                    Verifying...
                  </>
                ) : (
                  "Verify Collection"
                )}
              </Button>
              {verificationStatus === "success" && verificationResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                  <p>
                    Clothes Type Match:{" "}
                    {verificationResult.clothTypeMatch ? "Yes" : "No"}
                  </p>
                  <p>
                    Quantity Match:{" "}
                    {verificationResult.quantityMatch ? "Yes" : "No"}
                  </p>
                  <p>
                    Confidence:{" "}
                    {(verificationResult.confidence * 100).toFixed(2)}%
                  </p>
                </div>
              )}
              {verificationStatus === "failure" && (
                <p className="mt-2 text-red-600 text-center text-sm">
                  Verification failed. Please try again.
                </p>
              )}
              <Button
                onClick={() => setSelectedTask(null)}
                variant="outline"
                className="w-full mt-2 hover:bg-red-100 hover:text-red-600 cursor-pointer"
                disabled={verificationStatus === "verifying"}
              >
                Close
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CollectionTask["status"] }) {
  const statusConfig = {
    pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
    in_progress: { color: "bg-blue-100 text-blue-800", icon: Trash2 },
    completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
    verified: { color: "bg-purple-100 text-purple-800", icon: CheckCircle },
  };
  const { color, icon: Icon } = statusConfig[status];
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${color} flex items-center`}
    >
      <Icon className="mr-1 h-3 w-3" />
      {status.replace("_", " ")}
    </span>
  );
}
