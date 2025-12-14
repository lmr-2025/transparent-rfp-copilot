"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type BrandingSettings = {
  appName: string;
  tagline: string;
  primaryColor: string;
};

const defaultBranding: BrandingSettings = {
  appName: "Transparent Trust",
  tagline: "AI-powered RFP and security questionnaire assistant",
  primaryColor: "#0ea5e9",
};

type BrandingContextType = {
  branding: BrandingSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  isLoading: true,
  refresh: async () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const res = await fetch("/api/branding");
      if (res.ok) {
        const data = await res.json();
        if (data.branding) {
          setBranding(data.branding);
        }
      }
    } catch (error) {
      console.error("Failed to fetch branding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refresh: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
