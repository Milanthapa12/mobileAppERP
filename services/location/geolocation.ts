import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface PunchLocation {
  latitude?: number;
  longitude?: number;
  location_name?: string;
}

const isCollectEnabled =
  Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator;

function formatReverseAddress(addr: Location.LocationGeocodedAddress): string {
  const parts = [
    addr.name,
    addr.street ? [addr.streetNumber, addr.street].filter(Boolean).join(' ') : addr.streetNumber,
    addr.district,
    addr.city,
    addr.region,
    addr.postalCode,
    addr.country,
  ].filter(Boolean);
  return parts.join(', ').trim();
}

async function reverseGeocodeNative(latitude: number, longitude: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const address = results?.[0];
    if (!address) return null;
    const formatted = address.formattedAddress || formatReverseAddress(address);
    return formatted || null;
  } catch {
    return null;
  }
}

async function reverseGeocodeNominatim(latitude: number, longitude: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18` +
      `&lat=${latitude}&lon=${longitude}&email=hr%40vritico.com`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

/**
 * Collect the device's current GPS position and a human-readable location name.
 * Gracefully falls back to null fields if a device/OS blocks geolocation, so
 * punches still go through (matching the web portal behaviour).
 */
export async function getPunchLocation(): Promise<PunchLocation> {
  try {
    if (isCollectEnabled && Platform.OS === 'web' && !navigator?.geolocation) {
      return {};
    }

    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const res = await Location.requestForegroundPermissionsAsync();
      status = res.status;
    }

    if (status !== 'granted') {
      return {};
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const latitude = pos.coords.latitude;
    const longitude = pos.coords.longitude;

    const location_name =
      Platform.OS === 'web'
        ? await reverseGeocodeNominatim(latitude, longitude)
        : await reverseGeocodeNative(latitude, longitude);

    return { latitude, longitude, location_name: location_name ?? undefined };
  } catch (e: any) {
    if (e?.code === 'EACCES' || e?.message?.toLowerCase().includes('denied')) {
      return {};
    }
    return {};
  }
}