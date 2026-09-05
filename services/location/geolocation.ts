import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { settingsService, MobileSettings } from '@/services/api/settingsService';

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
 * Reverse-geocode using the backend's HR location-api configuration
 * (mirrors the web portal's performGeocoding in the HR attendance page).
 * Returns null when the feature is disabled, unconfigured, or unreachable.
 */
async function performGeocoding(
  latitude: number,
  longitude: number,
  settings: MobileSettings | null
): Promise<string | null> {
  const hrSettings = settings?.setting?.hrSettings || {};
  const { location_api_enabled, location_api_provider, location_api_key, location_api_url } =
    hrSettings;

  if (Number(location_api_enabled) !== 1) {
    return null;
  }

  const contactEmail =
    settings?.setting?.email?.mail_from_address ||
    settings?.setting?.organization?.contactEmail ||
    'admin@example.com';

  let baseUrl = '';
  let params: Record<string, string> = {};

  if (location_api_provider === 'google') {
    baseUrl = location_api_url || 'https://maps.googleapis.com/maps/api/geocode/json';
    params = { latlng: `${latitude},${longitude}`, key: location_api_key || '' };
  } else if (location_api_provider === 'mapbox') {
    baseUrl = location_api_url || 'https://api.mapbox.com/search/geocode/v6/reverse';
    params = {
      longitude: String(longitude),
      latitude: String(latitude),
      access_token: location_api_key || '',
      limit: '1',
    };
  } else if (location_api_provider === 'opencage') {
    baseUrl = location_api_url || 'https://api.opencagedata.com/geocode/v1/json';
    params = {
      q: `${latitude}+${longitude}`,
      key: location_api_key || '',
      limit: '1',
      no_annotations: '1',
    };
  } else if (location_api_provider === 'nominatim') {
    baseUrl = location_api_url || 'https://nominatim.openstreetmap.org/reverse';
    params = { lat: String(latitude), lon: String(longitude), format: 'json', email: contactEmail };
  }

  if (!baseUrl) return null;

  try {
    const queryString = new URLSearchParams(params).toString();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${baseUrl}?${queryString}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (location_api_provider === 'google' && data.results?.[0]) {
        return data.results[0].formatted_address || null;
      }
      if (location_api_provider === 'mapbox' && data.features?.[0]) {
        return data.features[0].properties?.full_address || null;
      }
      if (location_api_provider === 'opencage' && data.results?.[0]) {
        return data.results[0].formatted || null;
      }
      if (location_api_provider === 'nominatim' && data.display_name) {
        return data.display_name || null;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Collect the device's current GPS position and a human-readable location name.
 * Uses the backend's HR location-api settings when enabled (web performGeocoding
 * parity); otherwise falls back to native/built-in reverse geocoding. Gracefully
 * returns null fields if a device/OS blocks geolocation, so punches go through.
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

    let settings: MobileSettings | null = null;
    try {
      const res = await settingsService.getSettings();
      settings = res?.data ?? null;
    } catch {
      settings = null;
    }

    let location_name = await performGeocoding(latitude, longitude, settings);

    if (!location_name) {
      location_name =
        Platform.OS === 'web'
          ? await reverseGeocodeNominatim(latitude, longitude)
          : await reverseGeocodeNative(latitude, longitude);
    }

    return { latitude, longitude, location_name: location_name ?? undefined };
  } catch (e: any) {
    if (e?.code === 'EACCES' || e?.message?.toLowerCase().includes('denied')) {
      return {};
    }
    return {};
  }
}