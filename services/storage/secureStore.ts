import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { User, Branch } from '@/types/auth';

const TOKEN_KEY = 'vritico_auth_token';
const USER_KEY = 'vritico_user_data';
const BRANCHES_KEY = 'vritico_user_branches';
const ACTIVE_BRANCH_KEY = 'vritico_active_branch';

// Web in-memory fallback if localStorage isn't available
const memoryStorage: Record<string, string> = {};

const getItem = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStorage[key] || null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`[SecureStore] Error reading key ${key}:`, error);
    return null;
  }
};

const setItem = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.error(`[SecureStore] Error writing key ${key}:`, error);
  }
};

const deleteItem = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      } else {
        delete memoryStorage[key];
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (error) {
    console.error(`[SecureStore] Error deleting key ${key}:`, error);
  }
};

export const StorageService = {
  // Token
  saveToken: async (token: string): Promise<void> => setItem(TOKEN_KEY, token),
  getToken: async (): Promise<string | null> => getItem(TOKEN_KEY),
  removeToken: async (): Promise<void> => deleteItem(TOKEN_KEY),

  // User
  saveUser: async (user: User): Promise<void> => setItem(USER_KEY, JSON.stringify(user)),
  getUser: async (): Promise<User | null> => {
    const raw = await getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  removeUser: async (): Promise<void> => deleteItem(USER_KEY),

  // Branches
  saveBranches: async (branches: Branch[]): Promise<void> => setItem(BRANCHES_KEY, JSON.stringify(branches)),
  getBranches: async (): Promise<Branch[]> => {
    const raw = await getItem(BRANCHES_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  // Active Branch
  saveActiveBranch: async (branch: Branch): Promise<void> => setItem(ACTIVE_BRANCH_KEY, JSON.stringify(branch)),
  getActiveBranch: async (): Promise<Branch | null> => {
    const raw = await getItem(ACTIVE_BRANCH_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // Clear all
  clearAll: async (): Promise<void> => {
    await deleteItem(TOKEN_KEY);
    await deleteItem(USER_KEY);
    await deleteItem(BRANCHES_KEY);
    await deleteItem(ACTIVE_BRANCH_KEY);
  },
};
