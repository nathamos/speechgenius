export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      annotation_comments: {
        Row: {
          annotation_id: string
          author_id: string
          body: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          annotation_id: string
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          annotation_id?: string
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
      }
      annotation_votes: {
        Row: {
          annotation_id: string
          created_at: string | null
          id: string
          user_id: string
          value: number
        }
        Insert: {
          annotation_id: string
          created_at?: string | null
          id?: string
          user_id: string
          value: number
        }
        Update: {
          annotation_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
          value?: number
        }
      }
      annotations: {
        Row: {
          author_id: string
          body: string | null
          char_end: number
          char_start: number
          created_at: string | null
          id: string
          media_url: string | null
          selected_text: string
          speech_id: string
          status: string
          updated_at: string | null
          upvotes: number
        }
        Insert: {
          author_id: string
          body?: string | null
          char_end: number
          char_start: number
          created_at?: string | null
          id?: string
          media_url?: string | null
          selected_text: string
          speech_id: string
          status?: string
          updated_at?: string | null
          upvotes?: number
        }
        Update: {
          author_id?: string
          body?: string | null
          char_end?: number
          char_start?: number
          created_at?: string | null
          id?: string
          media_url?: string | null
          selected_text?: string
          speech_id?: string
          status?: string
          updated_at?: string | null
          upvotes?: number
        }
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
        }
      }
      speech_stanzas: {
        Row: {
          body: string
          created_at: string | null
          id: string
          position: number
          speech_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          position: number
          speech_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          position?: number
          speech_id?: string
        }
      }
      speeches: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          hero_image: string | null
          id: string
          slug: string
          speaker_name: string
          status: string
          title: string
          updated_at: string | null
          view_count: number
          wedding_id: string
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          hero_image?: string | null
          id?: string
          slug: string
          speaker_name: string
          status?: string
          title: string
          updated_at?: string | null
          view_count?: number
          wedding_id: string
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          hero_image?: string | null
          id?: string
          slug?: string
          speaker_name?: string
          status?: string
          title?: string
          updated_at?: string | null
          view_count?: number
          wedding_id?: string
        }
      }
      wedding_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string
          user_id: string
          wedding_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string
          user_id: string
          wedding_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
          wedding_id?: string
        }
      }
      weddings: {
        Row: {
          cover_image: string | null
          created_at: string | null
          date: string | null
          id: string
          join_mode: string
          join_password: string | null
          location: string | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          join_mode?: string
          join_password?: string | null
          location?: string | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          join_mode?: string
          join_password?: string | null
          location?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
      }
    }
    Views: Record<never, never>
    Functions: {
      can_access_wedding: { Args: { wid: string }; Returns: boolean }
      is_wedding_member: { Args: { wid: string }; Returns: boolean }
      is_wedding_role: { Args: { r: string; wid: string }; Returns: boolean }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
