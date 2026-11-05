export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      advance_transactions: {
        Row: {
          amount: number;
          created_at: string;
          date: string;
          employee_id: number;
          id: string;
          notes: string;
          payment_method: string;
          reason: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          date?: string;
          employee_id: number;
          id?: string;
          notes?: string;
          payment_method?: string;
          reason?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          date?: string;
          employee_id?: number;
          id?: string;
          notes?: string;
          payment_method?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advance_transactions_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          actor_email: string | null;
          actor_id: string | null;
          changed_at: string;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          operation: string;
          record_id: string | null;
          table_name: string;
        };
        Insert: {
          actor_email?: string | null;
          actor_id?: string | null;
          changed_at?: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          operation: string;
          record_id?: string | null;
          table_name: string;
        };
        Update: {
          actor_email?: string | null;
          actor_id?: string | null;
          changed_at?: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          operation?: string;
          record_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      employee_salary_history: {
        Row: {
          change_reason: string | null;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          employee_id: number;
          hourly_rate: number;
          id: string;
        };
        Insert: {
          change_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          employee_id: number;
          hourly_rate: number;
          id?: string;
        };
        Update: {
          change_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          employee_id?: number;
          hourly_rate?: number;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_salary_history_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_salary_history_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_salary_history_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      employee_site_assignments: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string;
          effective_to: string | null;
          employee_id: number;
          foreman: string | null;
          foreman_user_id: string | null;
          id: string;
          project_id: string | null;
          site: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          effective_to?: string | null;
          employee_id: number;
          foreman?: string | null;
          foreman_user_id?: string | null;
          id?: string;
          project_id?: string | null;
          site: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          employee_id?: number;
          foreman?: string | null;
          foreman_user_id?: string | null;
          id?: string;
          project_id?: string | null;
          site?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_site_assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_site_assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_site_assignments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employee_site_assignments_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_site_assignments_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_site_assignments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      employee_transfer_requests: {
        Row: {
          created_at: string;
          effective_on: string;
          employee_id: number;
          from_project_id: string | null;
          from_site: string | null;
          id: string;
          requested_by: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          to_foreman: string | null;
          to_foreman_user_id: string | null;
          to_project_id: string | null;
          to_site: string;
        };
        Insert: {
          created_at?: string;
          effective_on: string;
          employee_id: number;
          from_project_id?: string | null;
          from_site?: string | null;
          id?: string;
          requested_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          to_foreman?: string | null;
          to_foreman_user_id?: string | null;
          to_project_id?: string | null;
          to_site: string;
        };
        Update: {
          created_at?: string;
          effective_on?: string;
          employee_id?: number;
          from_project_id?: string | null;
          from_site?: string | null;
          id?: string;
          requested_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          to_foreman?: string | null;
          to_foreman_user_id?: string | null;
          to_project_id?: string | null;
          to_site?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_transfer_requests_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employee_transfer_requests_from_project_id_fkey";
            columns: ["from_project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employee_transfer_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_transfer_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_transfer_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_transfer_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_transfer_requests_to_foreman_user_id_fkey";
            columns: ["to_foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_transfer_requests_to_foreman_user_id_fkey";
            columns: ["to_foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "employee_transfer_requests_to_project_id_fkey";
            columns: ["to_project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          created_at: string;
          hourly_rate: number;
          id: number;
          id_number: string;
          name: string;
          status: string;
          trade: string;
        };
        Insert: {
          created_at?: string;
          hourly_rate?: number;
          id?: number;
          id_number?: string;
          name: string;
          status?: string;
          trade?: string;
        };
        Update: {
          created_at?: string;
          hourly_rate?: number;
          id?: number;
          id_number?: string;
          name?: string;
          status?: string;
          trade?: string;
        };
        Relationships: [];
      };
      leave_requests: {
        Row: {
          created_at: string;
          employee_id: number;
          end_date: string;
          id: string;
          leave_type_id: string | null;
          reason: string | null;
          requested_by: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          start_date: string;
          status: string;
          to_project_id: string | null;
        };
        Insert: {
          created_at?: string;
          employee_id: number;
          end_date: string;
          id?: string;
          leave_type_id?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          start_date: string;
          status?: string;
          to_project_id?: string | null;
        };
        Update: {
          created_at?: string;
          employee_id?: number;
          end_date?: string;
          id?: string;
          leave_type_id?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          start_date?: string;
          status?: string;
          to_project_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey";
            columns: ["leave_type_id"];
            isOneToOne: false;
            referencedRelation: "leave_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "leave_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "leave_requests_to_project_id_fkey";
            columns: ["to_project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_types: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          is_paid: boolean;
          name: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_paid?: boolean;
          name: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_paid?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      manager_project_assignments: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          id: string;
          manager_user_id: string;
          project_id: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          manager_user_id: string;
          project_id: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          manager_user_id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manager_project_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "manager_project_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "manager_project_assignments_manager_user_id_fkey";
            columns: ["manager_user_id"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "manager_project_assignments_manager_user_id_fkey";
            columns: ["manager_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "manager_project_assignments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_batches: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          foreman: string;
          foreman_user_id: string | null;
          id: string;
          locked_at: string | null;
          locked_by: string | null;
          month: string;
          paid_at: string | null;
          paid_by: string | null;
          project_id: string | null;
          site: string;
          status: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          foreman?: string;
          foreman_user_id?: string | null;
          id?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          month: string;
          paid_at?: string | null;
          paid_by?: string | null;
          project_id?: string | null;
          site?: string;
          status?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          foreman?: string;
          foreman_user_id?: string | null;
          id?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          month?: string;
          paid_at?: string | null;
          paid_by?: string | null;
          project_id?: string | null;
          site?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_batches_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "payroll_batches_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "payroll_batches_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_lines: {
        Row: {
          advance_recovery: number | null;
          allowances: number | null;
          batch_id: string;
          calculation_version: string | null;
          created_at: string;
          deductions: number | null;
          employee_id: number;
          food_deduction: number;
          foreman: string;
          foreman_user_id: string | null;
          gross_pay: number | null;
          hours: number;
          id: string;
          month: string;
          net_pay: number | null;
          net_salary: number;
          new_advance: number;
          other_deduction: number;
          overtime_hours: number | null;
          overtime_multiplier: number | null;
          overtime_pay: number | null;
          paid: number;
          prev_advance: number;
          rate: number;
          rate_segments: Json | null;
          regular_hours: number | null;
          regular_pay: number | null;
        };
        Insert: {
          advance_recovery?: number | null;
          allowances?: number | null;
          batch_id: string;
          calculation_version?: string | null;
          created_at?: string;
          deductions?: number | null;
          employee_id: number;
          food_deduction?: number;
          foreman?: string;
          foreman_user_id?: string | null;
          gross_pay?: number | null;
          hours?: number;
          id?: string;
          month: string;
          net_pay?: number | null;
          net_salary?: number;
          new_advance?: number;
          other_deduction?: number;
          overtime_hours?: number | null;
          overtime_multiplier?: number | null;
          overtime_pay?: number | null;
          paid?: number;
          prev_advance?: number;
          rate?: number;
          rate_segments?: Json | null;
          regular_hours?: number | null;
          regular_pay?: number | null;
        };
        Update: {
          advance_recovery?: number | null;
          allowances?: number | null;
          batch_id?: string;
          calculation_version?: string | null;
          created_at?: string;
          deductions?: number | null;
          employee_id?: number;
          food_deduction?: number;
          foreman?: string;
          foreman_user_id?: string | null;
          gross_pay?: number | null;
          hours?: number;
          id?: string;
          month?: string;
          net_pay?: number | null;
          net_salary?: number;
          new_advance?: number;
          other_deduction?: number;
          overtime_hours?: number | null;
          overtime_multiplier?: number | null;
          overtime_pay?: number | null;
          paid?: number;
          prev_advance?: number;
          rate?: number;
          rate_segments?: Json | null;
          regular_hours?: number | null;
          regular_pay?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_lines_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "payroll_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_lines_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_lines_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "payroll_lines_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
        ];
      };
      payroll_settings: {
        Row: {
          overtime_multiplier: number | null;
          singleton: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          overtime_multiplier?: number | null;
          singleton?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          overtime_multiplier?: number | null;
          singleton?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      payroll_site_allocations: {
        Row: {
          allocated_allowances: number;
          allocated_gross_cost: number;
          allocated_overtime_pay: number;
          allocated_regular_pay: number;
          allocation_basis: string;
          calculation_version: string | null;
          created_at: string;
          employee_id: number;
          foreman: string;
          id: string;
          month: string;
          overtime_hours: number;
          payroll_line_id: string;
          project_id: string | null;
          regular_hours: number;
          site: string;
        };
        Insert: {
          allocated_allowances?: number;
          allocated_gross_cost?: number;
          allocated_overtime_pay?: number;
          allocated_regular_pay?: number;
          allocation_basis: string;
          calculation_version?: string | null;
          created_at?: string;
          employee_id: number;
          foreman?: string;
          id?: string;
          month: string;
          overtime_hours?: number;
          payroll_line_id: string;
          project_id?: string | null;
          regular_hours?: number;
          site: string;
        };
        Update: {
          allocated_allowances?: number;
          allocated_gross_cost?: number;
          allocated_overtime_pay?: number;
          allocated_regular_pay?: number;
          allocation_basis?: string;
          calculation_version?: string | null;
          created_at?: string;
          employee_id?: number;
          foreman?: string;
          id?: string;
          month?: string;
          overtime_hours?: number;
          payroll_line_id?: string;
          project_id?: string | null;
          regular_hours?: number;
          site?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_site_allocations_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_site_allocations_payroll_line_id_fkey";
            columns: ["payroll_line_id"];
            isOneToOne: false;
            referencedRelation: "payroll_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_site_allocations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          active: boolean;
          code: string | null;
          created_at: string;
          foreman_user_id: string | null;
          id: string;
          location: string | null;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code?: string | null;
          created_at?: string;
          foreman_user_id?: string | null;
          id?: string;
          location?: string | null;
          name: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string | null;
          created_at?: string;
          foreman_user_id?: string | null;
          id?: string;
          location?: string | null;
          name?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "projects_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
        ];
      };
      timesheets: {
        Row: {
          break_hours: number;
          created_at: string;
          employee_id: number;
          foreman: string;
          foreman_user_id: string | null;
          id: string;
          in_time: string | null;
          out_time: string | null;
          overtime_hours: number;
          project_id: string | null;
          regular_hours: number | null;
          remarks: string | null;
          site: string;
          status: string;
          total_hours: number | null;
          work_date: string;
        };
        Insert: {
          break_hours?: number;
          created_at?: string;
          employee_id: number;
          foreman: string;
          foreman_user_id?: string | null;
          id?: string;
          in_time?: string | null;
          out_time?: string | null;
          overtime_hours?: number;
          project_id?: string | null;
          regular_hours?: number | null;
          remarks?: string | null;
          site: string;
          status?: string;
          total_hours?: number | null;
          work_date: string;
        };
        Update: {
          break_hours?: number;
          created_at?: string;
          employee_id?: number;
          foreman?: string;
          foreman_user_id?: string | null;
          id?: string;
          in_time?: string | null;
          out_time?: string | null;
          overtime_hours?: number;
          project_id?: string | null;
          regular_hours?: number | null;
          remarks?: string | null;
          site?: string;
          status?: string;
          total_hours?: number | null;
          work_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timesheets_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timesheets_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "user_roles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "timesheets_foreman_user_id_fkey";
            columns: ["foreman_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "timesheets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          is_active: boolean;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          is_active?: boolean;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          is_active?: boolean;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      user_roles: {
        Row: {
          role: string | null;
          user_id: string | null;
        };
        Insert: {
          role?: string | null;
          user_id?: string | null;
        };
        Update: {
          role?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      assign_employees_to_project: {
        Args: {
          target_effective_on: string;
          target_employee_ids: number[];
          target_project_id: string;
        };
        Returns: number;
      };
      can_access_employee: {
        Args: { target_employee_id: number };
        Returns: boolean;
      };
      can_access_employee_project: {
        Args: { target_employee_id: number; target_project_id: string };
        Returns: boolean;
      };
      can_access_payroll_batch: {
        Args: { target_batch_id: string };
        Returns: boolean;
      };
      can_access_project: {
        Args: { target_project_id: string };
        Returns: boolean;
      };
      has_payroll_role: { Args: { required_roles: string[] }; Returns: boolean };
      payroll_advance_balances_before: {
        Args: { target_month: string };
        Returns: {
          balance: number;
          employee_id: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
