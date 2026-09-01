import { API_CONFIG } from '@/constants/api';
import { StorageService } from '@/services/storage/secureStore';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  timeout?: number;
  skipAuth?: boolean;
}

export const apiClient = {
  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeout = API_CONFIG.TIMEOUT, skipAuth = false, headers = {}, ...customConfig } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const defaultHeaders: Record<string, string> = {
      ...API_CONFIG.HEADERS,
    };

    if (!skipAuth) {
      const token = await StorageService.getToken();
      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const activeBranch = await StorageService.getActiveBranch();
    if (activeBranch?.id) {
      defaultHeaders['X-Branch-ID'] = String(activeBranch.id);
      defaultHeaders['X-Tenant-ID'] = String(activeBranch.id);
    }

    let requestBody = customConfig.body;
    if (requestBody && typeof requestBody === 'string' && activeBranch?.id) {
      try {
        const parsed = JSON.parse(requestBody);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          if (!parsed.branch_id && !parsed.tenant_id) {
            parsed.branch_id = activeBranch.id;
            parsed.tenant_id = activeBranch.id;
            requestBody = JSON.stringify(parsed);
          }
        }
      } catch (e) {}
    }

    const config: RequestInit = {
      ...customConfig,
      body: requestBody,
      headers: {
        ...defaultHeaders,
        ...(headers as Record<string, string>),
      },
      signal: controller.signal,
    };

    const cleanBaseUrl = API_CONFIG.BASE_URL.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${cleanBaseUrl}${cleanEndpoint}`;

    try {
      const response = await fetch(url, config);
      clearTimeout(id);

      let responseData: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        let errorMessage = 'An error occurred during request execution.';
        if (typeof responseData === 'object' && responseData !== null) {
          if (responseData.message) {
            errorMessage = responseData.message;
          } else if (responseData.error) {
            errorMessage = responseData.error;
          } else if (responseData.errors) {
            const firstErrorKey = Object.keys(responseData.errors)[0];
            if (firstErrorKey && responseData.errors[firstErrorKey].length > 0) {
              errorMessage = responseData.errors[firstErrorKey][0];
            }
          }
        } else if (typeof responseData === 'string' && responseData.length > 0) {
          errorMessage = responseData;
        }

        throw new ApiError(errorMessage, response.status, responseData);
      }

      return responseData as T;
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw new ApiError('Request timed out. Please check your network connection.', 408);
      }
      if (error instanceof ApiError) {
        throw error;
      }

      // Check for mobile DNS / local domain resolution issues
      let networkMsg = error.message || 'Network request failed.';
      if (url.includes('.test') || url.includes('localhost') || url.includes('127.0.0.1')) {
        networkMsg = `Cannot reach "${url}". Mobile devices cannot resolve ".test" or "localhost" domains. Please use your computer's LAN IP address (e.g. http://192.168.X.X:8000).`;
      }

      throw new ApiError(networkMsg, 500);
    }
  },

  get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
