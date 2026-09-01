import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, Branch, DeviceLoginPayload, AuthState, AuthApiResponse } from '@/types/auth';
import { authService } from '@/services/api/authService';
import { StorageService } from '@/services/storage/secureStore';
import { ApiError } from '@/services/api/apiClient';

export interface AuthContextType extends AuthState {
  login: (payload: DeviceLoginPayload) => Promise<AuthApiResponse>;
  logout: () => Promise<void>;
  switchBranch: (branchId: number | string) => Promise<void>;
  clearError: () => void;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state on mount and preserve active session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = await StorageService.getToken();
        const storedUser = await StorageService.getUser();
        const storedBranches = await StorageService.getBranches();
        const storedActiveBranch = await StorageService.getActiveBranch();

        if (storedToken && storedUser) {
          // Preserve session from storage so user stays logged in
          setToken(storedToken);
          setUser(storedUser);
          setBranches(storedBranches);
          setActiveBranch(storedActiveBranch);

          // Verify token status with backend in background
          try {
            const meRes = await authService.fetchMe();
            const meData = meRes.data || meRes;

            if (meData.user) {
              setUser(meData.user);
              await StorageService.saveUser(meData.user);
            }
            if (meData.current_branch) {
              setActiveBranch(meData.current_branch);
              await StorageService.saveActiveBranch(meData.current_branch);
            }
            if (meData.accessible_branches) {
              setBranches(meData.accessible_branches);
              await StorageService.saveBranches(meData.accessible_branches);
            }
          } catch (verifyErr: any) {
            console.warn('[AuthContext] Background token check:', verifyErr?.message);
            // If server explicitly responds 401 Unauthorized or Unauthenticated, session expired
            if (
              verifyErr instanceof ApiError &&
              (verifyErr.status === 401 || verifyErr.status === 403)
            ) {
              await StorageService.clearAll();
              setToken(null);
              setUser(null);
              setBranches([]);
              setActiveBranch(null);
            }
          }
        }
      } catch (err) {
        console.error('[AuthContext] Failed to hydrate auth state:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (payload: DeviceLoginPayload): Promise<AuthApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.deviceLogin(payload);

      // Extract values from response (supports flat & nested structures)
      const responseData = response.data || response;
      const authToken = responseData.token || response.token;
      const authUser = responseData.user || response.user;
      const userBranches =
        responseData.accessible_branches ||
        response.accessible_branches ||
        responseData.branches ||
        response.branches ||
        [];
      const branchActive =
        responseData.current_branch ||
        response.current_branch ||
        responseData.active_branch ||
        response.active_branch ||
        (userBranches.length > 0 ? userBranches[0] : null);

      if (!authToken || !authUser) {
        throw new Error(response.message || 'Login failed: Invalid server response structure.');
      }

      // Persist to secure storage
      await StorageService.saveToken(authToken);
      await StorageService.saveUser(authUser);
      if (userBranches.length > 0) {
        await StorageService.saveBranches(userBranches);
      }
      if (branchActive) {
        await StorageService.saveActiveBranch(branchActive);
      }

      // Update state
      setToken(authToken);
      setUser(authUser);
      setBranches(userBranches);
      setActiveBranch(branchActive);

      return response;
    } catch (err: any) {
      let message = 'Login failed. Please check your credentials and try again.';
      if (err instanceof ApiError) {
        message = err.message;
      } else if (err.message) {
        message = err.message;
      }

      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // 1. Notify backend API first while token is present in storage
      await authService.logout();
    } catch (err) {
      console.warn('[AuthContext] Backend logout request warning:', err);
    } finally {
      // 2. Clear storage & reset memory state
      await StorageService.clearAll();
      setToken(null);
      setUser(null);
      setBranches([]);
      setActiveBranch(null);
      setError(null);
      setIsLoading(false);
    }
  };

  const switchBranch = async (branchId: number | string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.switchBranch(branchId);
      const resData = response.data || response;
      const newToken = resData.token || response.token;
      const targetBranch =
        resData.current_branch ||
        response.current_branch ||
        branches.find((b) => String(b.id) === String(branchId)) ||
        resData.branch;
      const updatedUser = resData.user || response.user;

      if (newToken) {
        await StorageService.saveToken(newToken);
        setToken(newToken);
      }
      if (targetBranch) {
        await StorageService.saveActiveBranch(targetBranch);
        setActiveBranch(targetBranch);
      }
      if (updatedUser) {
        await StorageService.saveUser(updatedUser);
        setUser(updatedUser);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to switch branch.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  const isAuthenticated = Boolean(token && user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        branches,
        activeBranch,
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        switchBranch,
        clearError,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
