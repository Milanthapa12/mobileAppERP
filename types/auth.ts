/**
 * Authentication & User Data Types
 */

export interface Branch {
  id: number | string;
  name: string;
  code?: string;
  domain?: string;
  organization_id?: number;
  is_active?: boolean;
  is_main?: number | boolean;
  db_name?: string;
}

export interface User {
  id: number | string;
  name: string;
  email: string;
  role?: string;
  employee_code?: string;
  avatar?: string;
  branch_id?: number | string;
  is_super?: boolean;
  [key: string]: any;
}

export interface DeviceLoginPayload {
  email: string;
  password: string;
  device_name?: string;
  device_id?: string;
  branch_id?: number | string;
}

export interface LoginResponseData {
  token: string;
  token_type?: string;
  user: User;
  branches?: Branch[];
  accessible_branches?: Branch[];
  active_branch?: Branch | null;
  current_branch?: Branch | null;
}

export interface AuthApiResponse {
  status: boolean | string;
  message?: string;
  data?: LoginResponseData;
  token?: string;
  user?: User;
  branches?: Branch[];
  accessible_branches?: Branch[];
  active_branch?: Branch | null;
  current_branch?: Branch | null;
  errors?: Record<string, string[]>;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  branches: Branch[];
  activeBranch: Branch | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
