"use client";
import { useState, useCallback, useEffect } from "react";
import { MapPin, Upload, CheckCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { StandaloneSearchBox, useJsApiLoader } from "@react-google-maps/api";
import { Libraries } from "@react-google-maps/api";
import {
  createUser,
  getUserByEmail,
  createReport,
  getRecentReports,
} from "@/utils/database/actions";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

const geminiApiKey = process.env.GEMINI_API_KEY;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const libraries: Libraries = ["places"];

export default function ReportPage() {
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name: string;
    points: number;
  } | null>(null);
  const router = useRouter();
  const [reports, setReports] = useState<
    Array<{
      id: number;
      location: string;
      clothType: string;
      amount: string;
      estimatedValue: string;
      createdAt: string;
    }>
  >([]);
  const [newReport, setNewReport] = useState({
    location: "",
    type: "",
    amount: "",
    estimatedValue: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");
  const [verificationResult, setVerificationResult] = useState<{
    clothType: string;
    quantity: string;
    confidence: number;
    estimatedValue: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchBox, setSearchBox] =
    useState<google.maps.places.SearchBox | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleMapsApiKey!,
    libraries: libraries,
  });

  // onLoad function for StandaloneSearchBox
  const onLoad = useCallback((ref: google.maps.places.SearchBox) => {
    setSearchBox(ref);
  }, []);

  // onPlacesChanged function for StandaloneSearchBox
  const onPlacesChanged = () => {
    if (searchBox) {
      const places = searchBox.getPlaces();
      if (places && places.length > 0) {
        const place = places[0];
        setNewReport((prev) => ({
          ...prev,
          location: place.formatted_address || "",
        }));
      }
    }
  };

  // Handle input changes for form fields
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewReport((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Function to calculate points based on estimated value
  const calculatePoints = (estimatedValue: string): number => {
    const match = estimatedValue.match(/(\d+)-(\d+)/);
    if (match) {
      const min = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);
      const average = Math.round((min + max) / 2);
      return Math.floor(average * 0.1); // 10% of the average value
    }
    return 0;
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      toast.error("You must be logged in to upload an image.");
      return;
    }
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  // Helper function to read file as Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle clothing verification using Gemini AI
  const handleVerify = async () => {
    if (!user) {
      toast.error("You must be logged in to verify clothing.");
      return;
    }
    if (!file) {
      toast.error("Please upload an image of clothing.");
      return;
    }
    setVerificationStatus("verifying");

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey!);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64Data = await readFileAsBase64(file);
      const imageParts = [
        {
          inlineData: {
            data: base64Data.split(",")[1],
            mimeType: file.type,
          },
        },
      ];
      const prompt = `Analyze this image and provide:
        1. The type of cloth (e.g., cotton, polyester, wool, silk)
        2. An estimate of the quantity or amount (in kg or pieces)
        3. An estimated monetary value of the clothing in the format "Approximately 1000-2000 KSH"
        4. Your confidence level in this assessment (as a percentage)
        Respond in JSON format like this:
        {
          "clothType": "type of cloth",
          "quantity": "estimated quantity with unit",
          "estimatedValue": "Approximately 1000-2000 KSH",
          "confidence": confidence level as a number between 0 and 1
        }`;
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      try {
        let parsedText = text
          .trim()
          .replace(/```json|```/g, "")
          .trim();
        const parsedResult = JSON.parse(parsedText);

        if (
          parsedResult.clothType &&
          parsedResult.quantity &&
          parsedResult.estimatedValue &&
          parsedResult.confidence
        ) {
          setVerificationResult(parsedResult);
          setVerificationStatus("success");
          setNewReport({
            ...newReport,
            type: parsedResult.clothType,
            amount: parsedResult.quantity,
            estimatedValue: parsedResult.estimatedValue,
          });
        } else {
          console.error("Invalid verification result:", parsedResult);
          setVerificationStatus("failure");
          toast.error("No clothes detected. Please upload a valid image.");
        }
      } catch (error) {
        console.error("Failed to parse JSON response:", text);
        setVerificationStatus("failure");
        toast.error("Error verifying clothing. Please try again.");
      }
    } catch (error) {
      console.error("Error verifying cloth:", error);
      setVerificationStatus("failure");
      toast.error("Error verifying clothing. Please try again.");
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to submit a report.");
      return;
    }

    if (
      !newReport.location ||
      !newReport.type ||
      !newReport.amount ||
      !newReport.estimatedValue ||
      verificationStatus !== "success"
    ) {
      toast.error("All fields are required and clothing must be verified.");
      return;
    }

    setIsSubmitting(true);
    try {
      const pointsEarned = calculatePoints(newReport.estimatedValue);

      // Create the report in the database
      const report = (await createReport(
        user.id,
        newReport.location,
        newReport.type,
        newReport.amount,
        preview || undefined,
        verificationResult ? JSON.stringify(verificationResult) : undefined
      )) as any;

      // Update the user's points in the database
      await fetch("/api/update-user-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, pointsEarned }),
      });

      // Fetch updated user data
      const updatedUser = await getUserByEmail(user.email);
      const transformedUser = updatedUser
        ? { ...updatedUser, points: 0 }
        : null;
      setUser(transformedUser);

      // Format the new report for display
      const formattedReport = {
        id: report.id,
        location: report.location,
        clothType: report.clothType,
        amount: report.amount,
        estimatedValue: report.estimatedValue,
        createdAt: report.createdAt.toISOString().split("T")[0],
      };

      // Add the new report to the top of the list
      setReports([formattedReport, ...reports]);

      // Reset form fields
      setNewReport({ location: "", type: "", amount: "", estimatedValue: "" });
      setFile(null);
      setPreview(null);
      setVerificationStatus("idle");
      setVerificationResult(null);

      toast.success(
        `Report submitted successfully! You've earned ${pointsEarned} points for reporting cloth recycling.`
      );
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch user and recent reports on component mount
  useEffect(() => {
    const checkUser = async () => {
      const email = localStorage.getItem("userEmail");
      if (email) {
        try {
          let user = await getUserByEmail(email);
          if (!user) {
            user = await createUser(email, "Anonymous User", 0);
          }

          // Transform the user object to include the 'points' property
          const transformedUser = user
            ? { ...user, points: 0 } // Add 'points' with a default value of 0
            : null;

          setUser(transformedUser); // Pass the transformed object to setUser
        } catch (error) {
          console.error("Error fetching or creating user:", error);
        }
      }

      // Fetch recent reports regardless of login status
      try {
        const recentReports = await getRecentReports();

        // Transform the reports to match the expected structure
        const formattedReports = recentReports.map((report) => ({
          id: report.id,
          location: report.location,
          clothType: report.clothType, // Map 'clothType' to 'clothType'
          amount: report.amount,
          estimatedValue: "N/A", // Add a placeholder for 'estimatedValue'
          createdAt: report.createdAt.toISOString().split("T")[0], // Format date
        }));

        setReports(formattedReports); // Pass the transformed array to setReports
      } catch (error) {
        console.error("Error fetching recent reports:", error);
      }
    };

    checkUser();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Clothes Recycling Report
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-full p-4 sm:p-6 md:p-8 rounded-2xl shadow-lg mb-12 overflow-x-hidden"
      >
        {/* Image Upload Section */}
        <div className="mb-8 ">
          <label
            htmlFor="cloth-image"
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            Upload Clothing Image
          </label>
          <div
            onClick={() => {
              if (!user) {
                toast.error("You must be logged in to upload an image.");
                return;
              }
              document.getElementById("cloth-image")?.click();
            }}
            className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-500 transition-colors duration-300 cursor-pointer"
          >
            <div className="space-y-1 text-center">
              {preview ? (
                <img
                  src={preview}
                  alt="Cloth preview"
                  className="max-w-full h-auto rounded-xl shadow-md cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering the parent div's click event
                    document.getElementById("cloth-image")?.click();
                  }}
                />
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="cloth-image"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="cloth-image"
                        name="cloth-image"
                        type="file"
                        className="sr-only"
                        onChange={handleFileChange}
                        accept="image/*"
                        disabled={!user}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Verify Clothing Button */}
        <Button
          type="button"
          onClick={handleVerify}
          className="w-full mb-8 bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg rounded-xl transition-colors duration-300"
          disabled={!file || verificationStatus === "verifying" || !user}
        >
          {verificationStatus === "verifying" ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Verifying...
            </>
          ) : (
            "Verify Clothing"
          )}
        </Button>

        {/* Display Verification Result */}
        {verificationStatus === "success" && verificationResult && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8 rounded-r-xl">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-green-800">
                  Verification Successful
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Clothing Type: {verificationResult.clothType}</p>
                  <p>Quantity: {verificationResult.quantity}</p>
                  <p>Estimated Value: {verificationResult.estimatedValue}</p>
                  <p>
                    Confidence:{" "}
                    {(verificationResult.confidence * 100).toFixed(2)}%
                  </p>
                  <p>
                    Points Earned: {calculatePoints(newReport.estimatedValue)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>
            {isLoaded ? (
              <StandaloneSearchBox
                onLoad={onLoad}
                onPlacesChanged={onPlacesChanged}
              >
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={newReport.location}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                  placeholder="Enter cloth location"
                />
              </StandaloneSearchBox>
            ) : (
              <input
                type="text"
                id="location"
                name="location"
                value={newReport.location}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
                placeholder="Enter cloth location"
              />
            )}
          </div>
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Clothing Type
            </label>
            <input
              type="text"
              id="type"
              name="type"
              value={newReport.type}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified cloth type"
              readOnly
            />
          </div>
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Estimated Amount (kg or pieces)
            </label>
            <input
              type="text"
              id="amount"
              name="amount"
              value={newReport.amount}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified amount"
              readOnly
            />
          </div>
          <div>
            <label
              htmlFor="estimatedValue"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Estimated Value (KSH)
            </label>
            <input
              type="text"
              id="estimatedValue"
              name="estimatedValue"
              value={newReport.estimatedValue}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified value"
              readOnly
            />
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-xl transition-colors duration-300 flex items-center justify-center"
          disabled={isSubmitting || !user}
        >
          {isSubmitting ? (
            <>
              <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              Submitting...
            </>
          ) : (
            "Submit Report"
          )}
        </Button>
      </form>

      {/* Recent Reports Table */}
      <h2 className="text-3xl font-semibold mb-6 text-gray-800">
        Recent Reports
      </h2>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <MapPin className="inline-block w-4 h-4 mr-2 text-green-500" />
                    {report?.location
                      ? report.location.split(" ").slice(0, 3).join(" ") + "..."
                      : "—"}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.amount}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(report.createdAt).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
