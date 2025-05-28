"use client";
import { useState, useCallback, useEffect } from "react";
import { MapPin, Upload, CheckCircle, Loader, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
    condition: "", // Changed from amount to condition
    discount: "", // Added discount
    estimatedValue: "",
    waste_type: "",
    dicount: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "failure"
  >("idle");
  const [verificationResult, setVerificationResult] = useState<Record<
    string,
    any
  > | null>(null);
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
      return Math.floor(average * 0.1);
    }
    return 0;
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      toast.error("You must be logged in to upload an image.");
      return;
    }

    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 300;
        const maxHeight = 300;
        let { width, height } = img;

        if (width > height && width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        } else if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL(selectedFile.type);
          setPreview(resizedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(selectedFile);
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
      toast.error("You must be logged in to verify items.");
      return;
    }
    if (!file) {
      toast.error("Please upload an image of the item.");
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

      let prompt = "";

      switch (newReport.waste_type) {
        case "clothes":
          prompt = `
            Analyze this clothing image and provide:
            1. The type of cloth (e.g., cotton, polyester, wool, silk)
            2. Color of the clothing
            3. Condition of the clothing one word choose from (e.g., new, Clean, Undamaged)
            4. Your confidence level in this assessment (as a percentage)

            Respond in JSON format like this:
            {
              "clothType": "type of cloth",
              "color": "color of the clothing",
              "condition": "condition of the clothing",
              "confidence": confidence level as a number between 0 and 1
            }
          `;
          break;

        case "appliances":
          prompt = `
            Analyze this appliance image and provide:
            1. The type of appliance (e.g., microwave, refrigerator, washing machine)
            2. Brand and model (if visible)
            3. Working condition (e.g., functional, non-functional, needs repair)
            4. Your confidence level in this assessment (as a percentage)

            Respond in JSON format like this:
            {
              "applianceType": "type of appliance",
              "brandModel": "brand and model",
              "condition": "working condition",
              "confidence": confidence level as a number between 0 and 1
            }
          `;
          break;

        case "electronics":
          prompt = `
            Analyze this electronic device image and provide:
            1. The type of device (e.g., smartphone, laptop, tablet)
            2. Brand and model (if visible)
            3. Physical and functional condition
            4. Your confidence level in this assessment (as a percentage)

            Respond in JSON format like this:
            {
              "deviceType": "type of electronic device",
              "brandModel": "brand and model",
              "condition": "physical and functional condition",
              "confidence": confidence level as a number between 0 and 1
            }
          `;
          break;

        case "books_paper":
          prompt = `
            Analyze this book or paper image and provide:
            1. The type of material (e.g., textbook, novel, magazine, notebook)
            2. Condition of the clothing one word choose from (e.g., new, Clean, Undamaged)
            3. Your confidence level in this assessment (as a percentage)

            Respond in JSON format like this:
            {
              "materialType": "type of book or paper",
              "condition": "condition of the material",
              "confidence": confidence level as a number between 0 and 1
            }
          `;
          break;

        case "furniture":
          prompt = `
            Analyze this furniture image and provide:
            1. The type of furniture (e.g., chair, table, sofa, bed)
            2. Material one word choose from (e.g., wood, metal, plastic)
            4. Condition one word choose from (e.g., good, worn, broken parts)
            5. Your confidence level in this assessment (as a percentage)

            Respond in JSON format like this:
            {
              "furnitureType": "type of furniture",
              "material": "material of the furniture",
              "condition": "condition of the furniture",
              "confidence": confidence level as a number between 0 and 1
            }
          `;
          break;

        default:
          toast.error("Please select a valid item type.");
          setVerificationStatus("failure");
          return;
      }

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
          parsedResult &&
          typeof parsedResult.confidence === "number" &&
          parsedResult.confidence >= 0.5
        ) {
          setVerificationResult(parsedResult);
          setVerificationStatus("success");
          toast.success(
            `Upload successful, confidence (${(
              parsedResult.confidence * 100
            ).toFixed(1)}%). Please wait while we verify the item.`
          );

          // Map result fields dynamically to the form
          const type =
            parsedResult.clothType ||
            parsedResult.applianceType ||
            parsedResult.deviceType ||
            parsedResult.materialType ||
            parsedResult.furnitureType ||
            "Unknown";

          const condition = parsedResult.condition || "N/A";

          setNewReport({
            ...newReport,
            type,
            condition,
          });
        } else {
          console.error("Invalid verification result:", parsedResult);
          setVerificationStatus("failure");
          toast.error(
            "Could not verify the item. Please upload a clear image."
          );
        }
      } catch (error) {
        console.error("Failed to parse JSON response:", text);
        setVerificationStatus("failure");
        toast.error("Error verifying item. Please try again.");
      }
    } catch (error) {
      console.error("Error during verification:", error);
      setVerificationStatus("failure");
      toast.error("Error verifying item. Please try again.");
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
      !newReport.condition || // Changed from amount to condition
      !newReport.discount || // Added discount
      verificationStatus !== "success"
    ) {
      toast.error("All fields are required and item must be verified.");
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
        newReport.condition, // Changed from amount to condition
        newReport.estimatedValue ? Number(newReport.estimatedValue) : undefined, // price (number)
        newReport.discount ? Number(newReport.discount) : undefined, // discount (number)
        preview || undefined, // imageUrl
        newReport.waste_type || undefined, // type
        verificationResult ? JSON.stringify(verificationResult) : undefined // verificationResult
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
        amount: report.amount, // This might need adjustment based on your data structure
        estimatedValue: report.estimatedValue,
        createdAt: report.createdAt.toISOString().split("T")[0],
      };

      // Add the new report to the top of the list
      setReports([formattedReport, ...reports]);

      // Reset form fields
      setNewReport({
        location: "",
        type: "",
        condition: "", // Changed from amount to condition
        discount: "", // Added discount
        estimatedValue: "",
        waste_type: "",
        dicount: "",
      });
      setFile(null);
      setPreview(null);
      setVerificationStatus("idle");
      setVerificationResult(null);

      toast.success(
        `Report submitted successfully! You've earned ${pointsEarned} points for reporting item recycling.`
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
          const transformedUser = user ? { ...user, points: 0 } : null;

          setUser(transformedUser);
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
          clothType: report.clothType,
          amount: report.amount,
          estimatedValue: "N/A",
          createdAt: report.createdAt.toISOString().split("T")[0], // Format date
        }));

        setReports(formattedReports);
      } catch (error) {
        console.error("Error fetching recent reports:", error);
      }
    };

    checkUser();
  }, []);

  return (
    <div className="w-full px-1 py-1 sm:px-1 sm:py-4 mx-auto max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Items Recycling Report
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-full p-4 sm:p-6 md:p-8 rounded-2xl shadow-lg mb-12 overflow-x-hidden"
      >
        {/* Image Upload Section */}
        <div className="mb-8 ">
          <div className="w-full sm:w-1/2 lg:w-1/3 max-w-xs relative">
            <Select
              onValueChange={(value) =>
                setNewReport({ ...newReport, waste_type: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Item Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="appliances">Appliances</SelectItem>
                <SelectItem value="clothes">Clothes</SelectItem>
                <SelectItem value="books_paper">Books & Paper</SelectItem>
                <SelectItem value="electronics">Electronics</SelectItem>
                <SelectItem value="furniture">Furniture</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                  alt="Item preview"
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
            "Verify Items"
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
                {newReport.waste_type === "clothes" && (
                  <>
                    <p>Clothing Type: {verificationResult.clothType}</p>
                    <p>Color: {verificationResult.color}</p>
                    <p>Condition: {verificationResult.condition}</p>
                  </>
                )}
                {newReport.waste_type === "appliances" && (
                  <>
                    <p>Appliance Type: {verificationResult.applianceType}</p>
                    <p>Brand/Model: {verificationResult.brandModel}</p>
                    <p>Working Condition: {verificationResult.condition}</p>
                  </>
                )}
                {newReport.waste_type === "electronics" && (
                  <>
                    <p>Device Type: {verificationResult.deviceType}</p>
                    <p>Brand/Model: {verificationResult.brandModel}</p>
                    <p>
                      Physical/Functional Condition:{" "}
                      {verificationResult.condition}
                    </p>
                  </>
                )}
                {newReport.waste_type === "books_paper" && (
                  <>
                    <p>Material Type: {verificationResult.materialType}</p>
                    <p>Condition: {verificationResult.condition}</p>
                  </>
                )}
                {newReport.waste_type === "furniture" && (
                  <>
                    <p>Furniture Type: {verificationResult.furnitureType}</p>
                    <p>Material: {verificationResult.material}</p>
                    <p>Condition: {verificationResult.condition}</p>
                  </>
                )}
                <p>
                  Confidence: {(verificationResult.confidence * 100).toFixed(2)}
                  %
                </p>
                <p>
                  Points Earned: {calculatePoints(newReport.estimatedValue)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <label
              htmlFor="estimatedValue"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Set Your Price (KSH)
            </label>
            <input
              type="text"
              id="estimatedValue"
              name="estimatedValue"
              required
              placeholder="e.g., 1500"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
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
                  placeholder="Enter item location"
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
                placeholder="Enter item location"
              />
            )}
          </div>
          <div>
            <label
              htmlFor="discount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Discount (%)
            </label>
            <Input
              type="number"
              id="discount"
              name="discount"
              value={newReport.discount}
              onChange={handleInputChange}
              required
              placeholder="Enter discount percentage"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
              min={0}
              max={100}
            />
          </div>
          <div>
            <label
              htmlFor="condition"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Item Condition
            </label>
            <input
              type="text"
              id="condition"
              name="condition"
              value={newReport.condition}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 bg-gray-100"
              placeholder="Verified condition"
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
                  Item Type
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Condition
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <thead></thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-green-50 transition-colors duration-200 "
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <MapPin className="inline-block w-4 h-4 mr-2 text-green-500" />
                    {report?.location
                      ? report.location.length > 30
                        ? `${report.location.substring(0, 30)}...`
                        : report.location
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 ">
                    {report.clothType && report.clothType.length > 20
                      ? `${report.clothType.substring(0, 20)}...`
                      : report.clothType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {report.amount && report.amount.length > 20
                      ? `${report.amount.substring(0, 20)}...`
                      : report.amount}
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
