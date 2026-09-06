import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface Earning {
  id: number;
  name: string;
}

export interface Retirement {
  id: number;
  name: string;
  retirement_type?: string;
  recovery_type?: string | null;
  order?: number;
}

export interface LoanAndAdvance {
  id: number;
  name: string;
  retirement_type?: string | null;
  recovery_type?: string;
  order?: number;
}

export interface EmployeePayrunData {
  id: number;
  contact_id: number;
  employee_code: string;
  employee_name: string;
  days: number;
  gross_salary: number;
  total_statutory: number;
  total_deduction: number;
  sst_adjustment_tax: number;
  remuneration_adjustment_tax: number;
  total_tax: number;
  net_monthly_payable: number;
  earnings: Record<number, number> | null;
  statutory: Record<number, number> | null;
  loan_and_advance: Record<number, number> | null;
  sst_tax: number;
  remuneration_tax: number;
  monthly_tax?: Record<number, number> | null;
}

export interface Payrun {
  payrun_id: number;
  run_type: string;
  remarks: string | null;
  title: string;
  fiscal_year_id: number;
  calendar_type: string;
  period_number: number;
  bs_year: number;
  bs_month: number;
  bs_month_name: string;
  from_date_bs: string;
  to_date_bs: string;
  from_date_ad: string;
  to_date_ad: string;
  total_days: number;
  working_days: number;
  employee: EmployeePayrunData;
  earnings: Earning[] | Record<string, Earning> | null;
  retirements: Retirement[] | Record<string, Retirement> | null;
  loan_and_advances: Array<LoanAndAdvance> | Record<string, LoanAndAdvance> | null;
  gross_salary: number;
  net_salary: number;
  total_deduction: number;
  total_tax: number;
  sst_tax: number;
  remuneration_tax: number;
}

export interface MyPaysResponse {
  status: string;
  data?: {
    payruns?: Payrun[] | Record<string, Payrun> | null;
    employee?: any;
  };
}

export const payService = {
  async getMyPays(): Promise<MyPaysResponse> {
    return apiClient.get<MyPaysResponse>(API_ENDPOINTS.MY_PAYS);
  },
};