"use client";
import { useState, useEffect } from "react";
import {
  MapPin,
  ShoppingCart,
  Loader2 as Loader,
  Search,
  Tag,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { getRecentReports, getUserByEmail } from "@/utils/database/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Define the shape of a recycled item
type RecycledItem = {
  id: number;
  location: string;
  waste_type:
    | "clothes"
    | "appliances"
    | "electronics"
    | "books_paper"
    | "furniture";
  clothType?: string;
  type?: string;
  amount: string;
  estimatedValue: string;
  createdAt: Date;
  imageUrl?: string;
};

const ITEMS_PER_PAGE = 8;

export default function MarketplacePage() {
  const [items, setItems] = useState<RecycledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name: string;
  } | null>(null);
  const [randomPrices, setRandomPrices] = useState<{ [id: number]: number }>(
    {}
  );

  useEffect(() => {
    const fetchUserAndData = async () => {
      setLoading(true);
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (userEmail) {
          const fetchedUser = await getUserByEmail(userEmail);
          setUser(fetchedUser);
        }

        const reports = await getRecentReports();

        const formattedReports = reports.map((report) => {
          let price = "0";
          try {
            const result = JSON.parse(report.verificationResult as string);
            price = result?.price?.toString() ?? "0";
          } catch (e) {
            console.warn(
              `Error parsing verificationResult for ID ${report.id}:`,
              e
            );
          }

          return {
            id: report.id,
            location: report.location,
            waste_type: (report.clothType ||
              "clothes") as RecycledItem["waste_type"],
            clothType: report.clothType,
            type: undefined,
            amount: report.amount,
            estimatedValue: `KSH ${price}`,
            createdAt: new Date(report.createdAt),
            imageUrl: report.imageUrl ?? undefined,
          };
        });

        setItems(formattedReports);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load recycled items.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndData();
  }, []);

  useEffect(() => {
    setRandomPrices((prev) => {
      const updated = { ...prev };
      items.forEach((item) => {
        const valueStr = item.estimatedValue.replace(/\D/g, "");
        const numericValue = parseInt(valueStr, 10);

        if (!updated[item.id]) {
          updated[item.id] =
            numericValue > 0
              ? numericValue
              : Math.floor(Math.random() * 5000) + 5000;
        }
      });
      return updated;
    });
  }, [items]);

  const filteredItems = items.filter((item) =>
    item.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pageCount = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getCategoryPlaceholder = (waste_type: RecycledItem["waste_type"]) => {
    switch (waste_type) {
      case "clothes":
        return "/placeholders/clothes.jpg";
      case "electronics":
        return "/placeholders/electronics.jpg";
      case "appliances":
        return "/placeholders/appliances.jpg";
      case "furniture":
        return "/placeholders/furniture.jpg";
      case "books_paper":
        return "/placeholders/books-paper.jpg";
      default:
        return "/placeholders/recycle-default.jpg";
    }
  };

  const handleBuyClick = (item: RecycledItem) => {
    toast.success(`You've ordered ${item.type || item.waste_type}`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-semibold mb-8 text-gray-800 dark:text-gray-200">
        Recycled Items Market place
      </h1>

      <div className="mb-8 flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="relative w-full sm:w-2/3">
          <Input
            type="text"
            placeholder="Search by location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-600 dark:text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin h-10 w-10 text-green-500 dark:text-green-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
          No recycled items available yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {paginatedItems.map((item) => (
              <Card
                key={item.id}
                className={cn(
                  "transition-all duration-300",
                  "hover:shadow-lg ",
                  "border border-gray-200 dark:border-gray-700",
                  "bg-white dark:bg-gray-800",
                  "shadow-md"
                )}
              >
                <CardHeader>
                  <div className="relative h-48 bg-gray-100 dark:bg-gray-700 rounded-t-lg overflow-hidden mb-4">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.type || item.waste_type}
                        className="w-full h-full object-cover hover:scale-[1.01] transition-all duration-300 ease-in-out"
                      />
                    ) : (
                      <img
                        src={getCategoryPlaceholder(item.waste_type)}
                        alt={`Placeholder for ${item.waste_type}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <hr />
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {item.type || item.clothType || item.waste_type}
                  </CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                    <MapPin className="w-4 h-4" />
                    {item.location}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 ">
                    <div className="flex items-center gap-1">
                      <Tag className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        Condition: {item.amount}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        Added:{" "}
                        {item.createdAt.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    Ksh. {randomPrices[item.id] || 0}
                  </span>
                  <Button
                    onClick={() => handleBuyClick(item)}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 transition-colors duration-200 rounded-md"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Order Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-2 ">
            <Button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 cursor-pointer"
            >
              Previous
            </Button>
            <span className="self-center px-2 text-gray-700 dark:text-gray-300">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, pageCount))}
              disabled={currentPage === pageCount}
              className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 cursor-pointer"
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
