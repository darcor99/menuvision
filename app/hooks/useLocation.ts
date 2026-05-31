import { useState, useEffect } from "react";

export type LocationStatus =
  | "idle"
  | "detecting"
  | "resolved"
  | "denied"
  | "error";

export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      return;
    }

    setStatus("detecting");

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client` +
              `?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();
          // Prefer city, fall back to locality or principal subdivision
          const city: string =
            data.city || data.locality || data.principalSubdivision || "";
          const country: string = data.countryName || "";
          setLabel([city, country].filter(Boolean).join(", "));
          setStatus("resolved");
        } catch {
          setStatus("error");
        }
      },
      (err) => {
        // err.code 1 = PERMISSION_DENIED, 2 = UNAVAILABLE, 3 = TIMEOUT
        setStatus(err.code === 1 ? "denied" : "error");
      },
      {
        timeout: 10_000,
        maximumAge: 300_000, // reuse a cached position for up to 5 min
      }
    );
  }, []);

  return { status, label, setLabel };
}
