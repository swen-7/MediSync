export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          created_at: string
          created_by: string
          event_date: string
          id: string
          patient_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_date: string
          id?: string
          patient_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_date?: string
          id?: string
          patient_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          confirmed_at: string | null
          created_at: string
          due_at: string
          id: string
          medication_id: string
          missed_alert_sent_at: string | null
          notes: string | null
          patient_id: string
          photo1_url: string | null
          photo2_url: string | null
          resolved_at: string | null
          resolved_by_supervisor_id: string | null
          status: Database["public"]["Enums"]["log_status"]
          updated_at: string
          video_url: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          medication_id: string
          missed_alert_sent_at?: string | null
          notes?: string | null
          patient_id: string
          photo1_url?: string | null
          photo2_url?: string | null
          resolved_at?: string | null
          resolved_by_supervisor_id?: string | null
          status?: Database["public"]["Enums"]["log_status"]
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          medication_id?: string
          missed_alert_sent_at?: string | null
          notes?: string | null
          patient_id?: string
          photo1_url?: string | null
          photo2_url?: string | null
          resolved_at?: string | null
          resolved_by_supervisor_id?: string | null
          status?: Database["public"]["Enums"]["log_status"]
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          created_at: string
          custom_days: number[]
          dosage: string
          frequency: string
          id: string
          meal_timing: string
          med_name: string
          patient_id: string
          picture_url: string | null
          refill_reminder_days: number
          remaining_qty: number
          scheduled_time: string
          total_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          custom_days?: number[]
          dosage?: string
          frequency?: string
          id?: string
          meal_timing?: string
          med_name: string
          patient_id: string
          picture_url?: string | null
          refill_reminder_days?: number
          remaining_qty?: number
          scheduled_time?: string
          total_qty?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          custom_days?: number[]
          dosage?: string
          frequency?: string
          id?: string
          meal_timing?: string
          med_name?: string
          patient_id?: string
          picture_url?: string | null
          refill_reminder_days?: number
          remaining_qty?: number
          scheduled_time?: string
          total_qty?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_settings: {
        Row: {
          affirmation_notifications_enabled: boolean
          caregiver_phone: string | null
          patient_id: string
          push_notifications_enabled: boolean
          updated_at: string
        }
        Insert: {
          affirmation_notifications_enabled?: boolean
          caregiver_phone?: string | null
          patient_id: string
          push_notifications_enabled?: boolean
          updated_at?: string
        }
        Update: {
          affirmation_notifications_enabled?: boolean
          caregiver_phone?: string | null
          patient_id?: string
          push_notifications_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      patients_supervisors: {
        Row: {
          id: string
          linked_at: string
          patient_id: string
          supervisor_id: string
        }
        Insert: {
          id?: string
          linked_at?: string
          patient_id: string
          supervisor_id: string
        }
        Update: {
          id?: string
          linked_at?: string
          patient_id?: string
          supervisor_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          created_at: string
          current_streak: number
          full_name: string
          id: string
          invite_code: string | null
          language_pref: Database["public"]["Enums"]["lang_code"]
          last_streak_date: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          current_streak?: number
          full_name?: string
          id: string
          invite_code?: string | null
          language_pref?: Database["public"]["Enums"]["lang_code"]
          last_streak_date?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          created_at?: string
          current_streak?: number
          full_name?: string
          id?: string
          invite_code?: string | null
          language_pref?: Database["public"]["Enums"]["lang_code"]
          last_streak_date?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vitals: {
        Row: {
          acknowledged_at: string | null
          blood_glucose: number | null
          blood_pressure_dia: number | null
          blood_pressure_sys: number | null
          created_at: string
          id: string
          note: string | null
          patient_id: string
          pulse: number | null
          taken_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          blood_glucose?: number | null
          blood_pressure_dia?: number | null
          blood_pressure_sys?: number | null
          created_at?: string
          id?: string
          note?: string | null
          patient_id: string
          pulse?: number | null
          taken_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          blood_glucose?: number | null
          blood_pressure_dia?: number | null
          blood_pressure_sys?: number | null
          created_at?: string
          id?: string
          note?: string | null
          patient_id?: string
          pulse?: number | null
          taken_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_user_account: { Args: never; Returns: undefined }
      ensure_my_profile: {
        Args: { _role?: Database["public"]["Enums"]["app_role"] }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      factory_reset_patient_data: {
        Args: { _patient_id: string }
        Returns: undefined
      }
      generate_invite_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_linked_supervisor: { Args: { _patient_id: string }; Returns: boolean }
      redeem_invite_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "supervisor" | "patient"
      lang_code: "en" | "ms" | "zh"
      log_status: "confirmed" | "missed" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["supervisor", "patient"],
      lang_code: ["en", "ms", "zh"],
      log_status: ["confirmed", "missed", "pending"],
    },
  },
} as const
