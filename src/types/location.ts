// src/types/location.ts — Shared UserLocation type (server + client safe)

export interface UserLocation {
  city: string;
  country: string;
  countryCode: string;
  region?: string;
  currency: string;
  timezone?: string;
  source: "ip" | "gps" | "manual" | "default";
}

export const DEFAULT_LOCATION: UserLocation = {
  city: "",
  country: "",
  countryCode: "",
  currency: "USD",
  source: "default",
};
