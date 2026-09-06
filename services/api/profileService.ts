import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface ProfileEmploymentInfoRow {
  id?: number;
  info_type?: string;
  employment_info_id?: number | null;
  employment_info_type?: string | null;
  info_value?: string | null;
  effective_from?: string | null;
  revision?: number;
  superseded_at?: string | null;
  employment_info?: { id?: number; name?: string } | null;
  display_name?: string | null;
  is_department_head?: boolean;
}

export interface EmployeeContactProfile {
  gender?: string | null;
  dob?: string | null;
  marital_status?: string | null;
  tax_marital_status?: string | null;
  handicapped?: boolean | number;
  joining_date?: string | null;
  contract_end_date?: string | null;
  employee_status?: { name?: string } | null;
  employee_type?: { name?: string } | null;
  is_consultant?: number;
  bank?: { name?: string } | null;
  bank_account_number?: string | null;
  branch_name?: string | null;
  payment_frequency?: string | null;
  payment_mode?: string | null;
  nationality_id?: number | null;
  ethnicity_id?: number | null;
  religion_id?: number | null;
  qualification_gap?: string | null;
}

export interface EmployeeProfile {
  id?: number;
  name?: string | null;
  code?: string | null;
  email?: string | null;
  phone_number?: string | null;
  pan_number?: string | null;
  employee_contact?: EmployeeContactProfile | null;
  employee_addresses?: any[];
  employee_additional_contacts?: any[];
  employee_academic_records?: any[];
  employee_skills?: any[];
  employee_work_experiences?: any[];
  employee_assets?: any[];
  employee_facilities?: any[];
  training?: any[];
  employee_health?: any | null;
  employee_families?: any[];
  employee_nominees?: any[];
  employee_references?: any[];
  employee_seminars?: any[];
  employee_awards?: any[];
  employee_publications?: any[];
  employee_professional_licenses?: any[];
}

export interface ProfileBasic {
  id?: number;
  name?: string | null;
  code?: string | null;
  department?: string | null;
  designation?: string | null;
  joining_date?: string | null;
}

export interface EmployeeProfileResponse {
  status: string;
  data?: {
    employee?: EmployeeProfile | null;
    profileUrl?: Array<{ url?: string } | null> | null;
    basic?: ProfileBasic | null;
    employeeInfo?:
      | Record<string, ProfileEmploymentInfoRow | null>
      | Array<ProfileEmploymentInfoRow | null>
      | null;
    employeeInfoHistory?: Record<string, ProfileEmploymentInfoRow[] | null>;
  };
}

export const profileService = {
  async getProfile(): Promise<EmployeeProfileResponse> {
    return apiClient.get<EmployeeProfileResponse>(API_ENDPOINTS.PROFILE);
  },
};