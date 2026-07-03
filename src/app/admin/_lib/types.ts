import type { UUID } from "@/types/db";

/**
 * Admin-module tables that are not (yet) part of the shared schema contract.
 * Keep in sync with supabase migrations for the rights module.
 */

export interface ContentRightDocument {
  id: UUID;
  right_id: UUID;
  file_name: string;
  file_path: string; // storage path inside the private "rights-docs" bucket
  mime_type: string;
  size_bytes: number;
  uploaded_by: UUID | null;
  created_at: string;
}

export interface PartnerRevenueShare {
  id: UUID;
  partner_id: UUID;
  period_start: string;
  period_end: string;
  amount_mnt: number;
  percent: number;
  note: string | null;
  created_at: string;
}

export interface UserRoleRow {
  id: UUID;
  user_id: UUID;
  role: "user" | "content_manager" | "admin" | "super_admin";
  created_at: string;
}
