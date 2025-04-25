export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      family_links: {
        Row: {
          created_at: string | null
          guardian_profile_id: string
          id: string
          managed_profile_id: string
        }
        Insert: {
          created_at?: string | null
          guardian_profile_id: string
          id?: string
          managed_profile_id: string
        }
        Update: {
          created_at?: string | null
          guardian_profile_id?: string
          id?: string
          managed_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_links_guardian_profile_id_fkey"
            columns: ["guardian_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_links_managed_profile_id_fkey"
            columns: ["managed_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_logs: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          prescription_id: string
          schedule_id: string | null
          taken_at: string
          taken_by_profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          prescription_id: string
          schedule_id?: string | null
          taken_at: string
          taken_by_profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          prescription_id?: string
          schedule_id?: string | null
          taken_at?: string
          taken_by_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicine_logs_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medicine_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_logs_taken_by_profile_id_fkey"
            columns: ["taken_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_schedules: {
        Row: {
          created_at: string | null
          days_of_week: number[] | null
          dosage_amount: number
          id: string
          prescription_id: string
          time_of_day: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_of_week?: number[] | null
          dosage_amount: number
          id?: string
          prescription_id: string
          time_of_day: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_of_week?: number[] | null
          dosage_amount?: number
          id?: string
          prescription_id?: string
          time_of_day?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicine_schedules_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          created_at: string | null
          description: string | null
          dosage: string | null
          form: string | null
          id: string
          name: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          dosage?: string | null
          form?: string | null
          id?: string
          name: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          dosage?: string | null
          form?: string | null
          id?: string
          name?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          medicine_id: string
          notes: string | null
          profile_id: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          medicine_id: string
          notes?: string | null
          profile_id: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          medicine_id?: string
          notes?: string | null
          profile_id?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          mobile_number: string | null
          type: Database["public"]["Enums"]["profile_type"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          mobile_number?: string | null
          type: Database["public"]["Enums"]["profile_type"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          mobile_number?: string | null
          type?: Database["public"]["Enums"]["profile_type"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      recordings: {
        Row: {
          created_at: string | null
          duration: number
          error: string | null
          id: string
          metadata: Json | null
          profile_id: string
          raw_transcript: string | null
          status: string
          storage_path: string
          structured_details: Json | null
          summary: string | null
          title: string
          transcription: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration: number
          error?: string | null
          id?: string
          metadata?: Json | null
          profile_id: string
          raw_transcript?: string | null
          status?: string
          storage_path: string
          structured_details?: Json | null
          summary?: string | null
          title: string
          transcription?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: number
          error?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string
          raw_transcript?: string | null
          status?: string
          storage_path?: string
          structured_details?: Json | null
          summary?: string | null
          title?: string
          transcription?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      get_my_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_my_managed_profile: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      requesting_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      set_rls_profile_id: {
        Args: { profile_id: string }
        Returns: undefined
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      profile_type: "GUARDIAN" | "MANAGED_MEMBER"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  SchemaName extends keyof Database = "public",
  TableName extends keyof Database[SchemaName]["Tables"] = never
> = Database[SchemaName]["Tables"][TableName] extends { Row: infer R }
  ? R
  : never;

export type TablesInsert<
  SchemaName extends keyof Database = "public",
  TableName extends keyof Database[SchemaName]["Tables"] = never
> = Database[SchemaName]["Tables"][TableName] extends { Insert: infer I }
  ? I
  : never;

export type TablesUpdate<
  SchemaName extends keyof Database = "public",
  TableName extends keyof Database[SchemaName]["Tables"] = never
> = Database[SchemaName]["Tables"][TableName] extends { Update: infer U }
  ? U
  : never;

export type Enums<
  SchemaName extends keyof Database = "public",
  EnumName extends keyof Database[SchemaName]["Enums"] = never
> = Database[SchemaName]["Enums"][EnumName];

export type CompositeTypes<
  SchemaName extends keyof Database = "public",
  TypeName extends keyof Database[SchemaName]["CompositeTypes"] = never
> = Database[SchemaName]["CompositeTypes"][TypeName];


export const Constants = {
  public: {
    Enums: {
      profile_type: ["GUARDIAN", "MANAGED_MEMBER"],
    },
  },
} as const 