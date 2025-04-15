"use client";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { User, Mail, Phone, MapPin, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type UserSettings = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notifications: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1 234 567 8900",
    address: "123 Tom Mboya Street, Nairobi City, 00100",
    notifications: true,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Simulate checking if the user is logged in
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Simulate an API call to check authentication status
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Replace this with actual authentication logic (e.g., check token/session)
        setIsLoggedIn(true); // Set to false if not logged in
      } catch (err) {
        setIsLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isLoggedIn) return; // Prevent changes if not logged in

    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLoggedIn) {
      toast.error("You must be logged in to save changes.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Simulate API call
      console.log("Saving settings...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Settings updated successfully!");
      setLoading(false);
      toast.success("Settings updated successfully!");
    } catch (error) {
      console.error("Error updating settings:", error);
      setLoading(false);
      setError("Failed to update settings. Please try again later.");
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Account Settings
      </h1>

      {/* Show error message if any */}
      {error && (
        <div className="mb-4 text-red-600 flex items-center">
          <AlertCircle size={20} className="mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Show warning message if user is not logged in */}
      {!isLoggedIn && (
        <div className="mb-4 text-yellow-600 flex items-center">
          <AlertCircle size={20} className="mr-2" />
          <span>You must be logged in to make changes.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Field */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Full Name
          </label>
          <div className="relative">
            <input
              type="text"
              id="name"
              name="name"
              value={settings.name}
              onChange={handleInputChange}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              disabled={!isLoggedIn || loading}
              placeholder="Full Name"
            />
            <User
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
          </div>
        </div>

        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email Address
          </label>
          <div className="relative">
            <input
              type="email"
              id="email"
              name="email"
              value={settings.email}
              onChange={handleInputChange}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              disabled={!isLoggedIn || loading}
              placeholder="Email Address"
            />
            <Mail
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
          </div>
        </div>

        {/* Phone Field */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone Number
          </label>
          <div className="relative">
            <input
              type="tel"
              id="phone"
              name="phone"
              value={settings.phone}
              onChange={handleInputChange}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              disabled={!isLoggedIn || loading}
              placeholder="Phone Number"
            />
            <Phone
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
          </div>
        </div>

        {/* Address Field */}
        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Address
          </label>
          <div className="relative">
            <input
              type="text"
              id="address"
              name="address"
              value={settings.address}
              onChange={handleInputChange}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              disabled={!isLoggedIn || loading}
              placeholder="Address"
            />
            <MapPin
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
          </div>
        </div>

        {/* Notifications Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="notifications"
            name="notifications"
            checked={settings.notifications}
            onChange={handleInputChange}
            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            disabled={!isLoggedIn || loading}
          />
          <label
            htmlFor="notifications"
            className="ml-2 block text-sm text-gray-700"
          >
            Receive email notifications
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className={`w-full ${
            !isLoggedIn || loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          } text-white`}
          disabled={!isLoggedIn || loading}
        >
          {loading ? (
            <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}

          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
