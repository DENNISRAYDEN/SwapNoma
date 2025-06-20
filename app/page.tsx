"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  PlusIcon,
  Leaf,
  Recycle,
  Users,
  Coins,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function AnimatedGlobe() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-8">
      <div className="absolute inset-0 rounded-full bg-green-500 opacity-20 animate-pulse"></div>
      <div className="absolute inset-2 rounded-full bg-green-400 opacity-40 animate-ping"></div>
      <div className="absolute inset-4 rounded-full bg-green-300 opacity-60 animate-spin"></div>
      <div className="absolute inset-6 rounded-full bg-green-200 opacity-80 animate-bounce"></div>
      <Leaf className="absolute inset-0 m-auto h-16 w-16 text-green-600 animate-pulse" />
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRecycleClick = () => {
    setLoading(true);
    router.push("/report");
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <section className="text-center mb-20">
        <AnimatedGlobe />
        <h2 className="text-6xl font-bold mb-6 tracking-tight">
          <span className="text-gray-800">Recycle </span>

          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-green-500 to-green-600">
            Anything
          </span>
          <span className="text-gray-800"> & Earn </span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600">
            Rewards
          </span>
        </h2>

        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
          Join our community in collecting used items, sorting them by type, and
          separating reusable materials to make recycling more efficient and
          rewarding!
        </p>

        <Button
          onClick={handleRecycleClick}
          disabled={loading}
          className={`bg-gradient-to-r from-green-400 via-green-500 to-green-600 hover:from-green-500 hover:via-green-600 hover:to-green-700 text-white text-lg py-6 px-10 rounded-full font-medium transition-all duration-300 ease-in-out transform ${
            loading ? "opacity-50 cursor-not-allowed" : "hover:cursor-pointer"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner />
            </span>
          ) : (
            <>
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </section>

      <section className="grid md:grid-cols-3 gap-10 mb-20">
        <FeatureCard
          icon={Leaf}
          title="Eco-Friendly"
          description="Play your part in a cleaner environment by recycling items: collect, sort, and repurpose for a sustainable future!"
        />
        <FeatureCard
          icon={Coins}
          title="Earn Rewards"
          description="Earn tokens for your efforts in recycling and repurposing items!"
        />
        <FeatureCard
          icon={Users}
          title="Community-Driven"
          description="Join today and be part of a thriving community dedicated to sustainable items recycling!"
        />
      </section>

      <section className="bg-white p-10 rounded-3xl shadow-lg ">
        <h2 className="text-4xl font-bold mb-12 text-center text-gray-800">
          Our Impact on the Environment
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <ImpactCard
            title="Recycled Items"
            value={
              <span className="flex items-center gap-1 font-medium">
                <PlusIcon className="w-8 h-8 font-bold" />
                2000
              </span>
            }
            icon={Recycle}
          />

          <ImpactCard
            title="Collected Items"
            value={
              <span className="flex items-center gap-1 font-medium">
                <PlusIcon className="w-8 h-8 font-bold" />
                500
              </span>
            }
            icon={MapPin}
          />

          <ImpactCard
            title="Tokens Earned"
            value={
              <span className="flex items-center gap-1 font-medium">
                <PlusIcon className="w-8 h-8 font-bold" />
                2000
              </span>
            }
            icon={Coins}
          />

          <ImpactCard
            title="CO₂ Offset"
            value={
              <span className="flex items-center gap-1 font-medium">
                <PlusIcon className="w-8 h-8 font-bold" />
                50kg
              </span>
            }
            icon={Leaf}
          />
        </div>
      </section>
    </div>
  );
}

// Feature card component
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex flex-col items-center text-center">
      <div className="bg-green-100 p-4 rounded-full mb-6">
        <Icon className="h-8 w-8 text-green-600" />
      </div>
      <h3 className="text-xl font-semibold mb-4 text-gray-800">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

// Impact card component
function ImpactCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) {
  const formattedValue =
    typeof value === "number"
      ? value.toLocaleString("en-US", { maximumFractionDigits: 1 })
      : value;

  return (
    <div className="flex justify-center items-center p-4">
      <div className="p-8 rounded-xl bg-gray-50 border border-gray-100 transition-all duration-300 ease-in-out hover:shadow-md text-center space-y-4">
        <Icon className="h-12 w-12 text-green-500 mx-auto" />
        <p className="text-4xl font-bold text-gray-800">{formattedValue}</p>
        <p className="text-sm text-gray-600">{title}</p>
      </div>
    </div>
  );
}
