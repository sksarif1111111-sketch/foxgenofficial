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
      activity_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: string | null
          id: string
          module: string
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: string | null
          id?: string
          module: string
          status?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: string | null
          id?: string
          module?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          button_text: string | null
          button_url: string | null
          created_at: string
          id: string
          image_url: string | null
          message: string
          publish_date: string
          status: string
          title: string
        }
        Insert: {
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          message: string
          publish_date?: string
          status?: string
          title: string
        }
        Update: {
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string
          publish_date?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      bot_action_locks: {
        Row: {
          created_at: string
          lock_key: string
        }
        Insert: {
          created_at?: string
          lock_key: string
        }
        Update: {
          created_at?: string
          lock_key?: string
        }
        Relationships: []
      }
      bot_error_logs: {
        Row: {
          category: string
          context: string | null
          created_at: string
          id: string
          message: string
          telegram_user_id: number | null
        }
        Insert: {
          category: string
          context?: string | null
          created_at?: string
          id?: string
          message: string
          telegram_user_id?: number | null
        }
        Update: {
          category?: string
          context?: string | null
          created_at?: string
          id?: string
          message?: string
          telegram_user_id?: number | null
        }
        Relationships: []
      }
      campaign_awards: {
        Row: {
          awarded_at: string
          campaign_id: string
          credits_awarded: number
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          campaign_id: string
          credits_awarded: number
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          campaign_id?: string
          credits_awarded?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_awards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          bonus_credits: number
          campaign_type: string
          conditions: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          target_referrals: number
        }
        Insert: {
          bonus_credits?: number
          campaign_type?: string
          conditions?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          target_referrals?: number
        }
        Update: {
          bonus_credits?: number
          campaign_type?: string
          conditions?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          target_referrals?: number
        }
        Relationships: []
      }
      communities: {
        Row: {
          created_at: string
          display_order: number
          enabled: boolean
          icon: string | null
          id: string
          name: string
          platform: string
          telegram_chat_id: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          enabled?: boolean
          icon?: string | null
          id?: string
          name: string
          platform?: string
          telegram_chat_id?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          enabled?: boolean
          icon?: string | null
          id?: string
          name?: string
          platform?: string
          telegram_chat_id?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_guide_pages: {
        Row: {
          body: string
          created_at: string
          display_order: number
          heading: string
          id: string
          published: boolean
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          display_order?: number
          heading: string
          id?: string
          published?: boolean
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          display_order?: number
          heading?: string
          id?: string
          published?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_inventory: {
        Row: {
          added_at: string
          created_at: string
          duration_days: number
          id: string
          license_key: string
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
        }
        Insert: {
          added_at?: string
          created_at?: string
          duration_days: number
          id?: string
          license_key: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
        }
        Update: {
          added_at?: string
          created_at?: string
          duration_days?: number
          id?: string
          license_key?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_inventory_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_redemptions: {
        Row: {
          credits_used: number
          duration_days: number
          id: string
          license_key: string
          redeemed_at: string
          reward_name: string
          user_id: string
        }
        Insert: {
          credits_used: number
          duration_days: number
          id?: string
          license_key: string
          redeemed_at?: string
          reward_name: string
          user_id: string
        }
        Update: {
          credits_used?: number
          duration_days?: number
          id?: string
          license_key?: string
          redeemed_at?: string
          reward_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          activated_at: string | null
          check_count: number
          created_at: string
          created_by: string | null
          device_id: string | null
          duration_seconds: number | null
          expires_at: string | null
          id: string
          last_seen_at: string | null
          license_key: string
          note: string | null
          plan_days: number | null
          status: string
        }
        Insert: {
          activated_at?: string | null
          check_count?: number
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          last_seen_at?: string | null
          license_key: string
          note?: string | null
          plan_days?: number | null
          status?: string
        }
        Update: {
          activated_at?: string | null
          check_count?: number
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          last_seen_at?: string | null
          license_key?: string
          note?: string | null
          plan_days?: number | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          channel: string
          config: Json
          created_at: string
          currency: string
          display_order: number
          enabled: boolean
          id: string
          instructions: string | null
          name: string
          network: string | null
          provider: string
          recipient: string | null
          recipient_label: string | null
          reference_label: string | null
          settlement_asset: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          config?: Json
          created_at?: string
          currency?: string
          display_order?: number
          enabled?: boolean
          id?: string
          instructions?: string | null
          name: string
          network?: string | null
          provider?: string
          recipient?: string | null
          recipient_label?: string | null
          reference_label?: string | null
          settlement_asset?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          currency?: string
          display_order?: number
          enabled?: boolean
          id?: string
          instructions?: string | null
          name?: string
          network?: string | null
          provider?: string
          recipient?: string | null
          recipient_label?: string | null
          reference_label?: string | null
          settlement_asset?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          enabled: boolean
          icon_url: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          icon_url?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          icon_url?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_files: {
        Row: {
          created_at: string
          display_order: number
          enabled: boolean
          file_url: string | null
          id: string
          label: string
          product_id: string
          telegram_file_id: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          enabled?: boolean
          file_url?: string | null
          id?: string
          label: string
          product_id: string
          telegram_file_id?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          enabled?: boolean
          file_url?: string | null
          id?: string
          label?: string
          product_id?: string
          telegram_file_id?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          amount: number
          created_at: string
          credit_cost: number
          currency: string
          display_order: number
          duration_days: number | null
          enabled: boolean
          id: string
          label: string
          product_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          credit_cost?: number
          currency?: string
          display_order?: number
          duration_days?: number | null
          enabled?: boolean
          id?: string
          label: string
          product_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_cost?: number
          currency?: string
          display_order?: number
          duration_days?: number | null
          enabled?: boolean
          id?: string
          label?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability: string
          banner_url: string | null
          category_id: string | null
          created_at: string
          credit_cost: number
          credits_per_interval: number | null
          currency: string
          delivery_method: string
          description: string | null
          display_order: number
          download_file_path: string | null
          download_url: string | null
          duration_label: string | null
          emoji: string | null
          featured: boolean
          features: Json
          giveaway_enabled: boolean
          icon_url: string | null
          id: string
          image_url: string | null
          installation_guide_url: string | null
          installation_instructions: string | null
          is_free: boolean
          license_required: boolean
          logo_url: string | null
          max_per_order: number
          name: string
          price: number
          price_inr: number | null
          price_stars: number | null
          price_usdt: number | null
          private_delivery_notes: string | null
          product_type: string
          referral_required: boolean
          renewal_interval: string | null
          requires_buyer_email: boolean
          shop_order: number
          shop_published: boolean
          short_description: string | null
          short_name: string | null
          slug: string | null
          status: string
          stock_mode: string
          stock_quantity: number | null
          terms: string | null
          tutorial_url: string | null
          updated_at: string
        }
        Insert: {
          availability?: string
          banner_url?: string | null
          category_id?: string | null
          created_at?: string
          credit_cost?: number
          credits_per_interval?: number | null
          currency?: string
          delivery_method?: string
          description?: string | null
          display_order?: number
          download_file_path?: string | null
          download_url?: string | null
          duration_label?: string | null
          emoji?: string | null
          featured?: boolean
          features?: Json
          giveaway_enabled?: boolean
          icon_url?: string | null
          id?: string
          image_url?: string | null
          installation_guide_url?: string | null
          installation_instructions?: string | null
          is_free?: boolean
          license_required?: boolean
          logo_url?: string | null
          max_per_order?: number
          name: string
          price?: number
          price_inr?: number | null
          price_stars?: number | null
          price_usdt?: number | null
          private_delivery_notes?: string | null
          product_type?: string
          referral_required?: boolean
          renewal_interval?: string | null
          requires_buyer_email?: boolean
          shop_order?: number
          shop_published?: boolean
          short_description?: string | null
          short_name?: string | null
          slug?: string | null
          status?: string
          stock_mode?: string
          stock_quantity?: number | null
          terms?: string | null
          tutorial_url?: string | null
          updated_at?: string
        }
        Update: {
          availability?: string
          banner_url?: string | null
          category_id?: string | null
          created_at?: string
          credit_cost?: number
          credits_per_interval?: number | null
          currency?: string
          delivery_method?: string
          description?: string | null
          display_order?: number
          download_file_path?: string | null
          download_url?: string | null
          duration_label?: string | null
          emoji?: string | null
          featured?: boolean
          features?: Json
          giveaway_enabled?: boolean
          icon_url?: string | null
          id?: string
          image_url?: string | null
          installation_guide_url?: string | null
          installation_instructions?: string | null
          is_free?: boolean
          license_required?: boolean
          logo_url?: string | null
          max_per_order?: number
          name?: string
          price?: number
          price_inr?: number | null
          price_stars?: number | null
          price_usdt?: number | null
          private_delivery_notes?: string | null
          product_type?: string
          referral_required?: boolean
          renewal_interval?: string | null
          requires_buyer_email?: boolean
          shop_order?: number
          shop_published?: boolean
          short_description?: string | null
          short_name?: string | null
          slug?: string | null
          status?: string
          stock_mode?: string
          stock_quantity?: number | null
          terms?: string | null
          tutorial_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credits_available: number
          credits_earned: number
          credits_spent: number
          first_name: string | null
          id: string
          last_name: string | null
          referral_code: string
          referred_by: string | null
          status: string
          telegram_user_id: number
          telegram_username: string | null
          updated_at: string
          web_token: string
        }
        Insert: {
          created_at?: string
          credits_available?: number
          credits_earned?: number
          credits_spent?: number
          first_name?: string | null
          id?: string
          last_name?: string | null
          referral_code: string
          referred_by?: string | null
          status?: string
          telegram_user_id: number
          telegram_username?: string | null
          updated_at?: string
          web_token?: string
        }
        Update: {
          created_at?: string
          credits_available?: number
          credits_earned?: number
          credits_spent?: number
          first_name?: string | null
          id?: string
          last_name?: string | null
          referral_code?: string
          referred_by?: string | null
          status?: string
          telegram_user_id?: number
          telegram_username?: string | null
          updated_at?: string
          web_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          credit_awarded: boolean
          id: string
          referred_user_id: string
          referrer_id: string
          status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          credit_awarded?: boolean
          id?: string
          referred_user_id: string
          referrer_id: string
          status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          credit_awarded?: boolean
          id?: string
          referred_user_id?: string
          referrer_id?: string
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          created_at: string
          credit_cost: number
          description: string | null
          display_order: number
          duration_days: number
          enabled: boolean
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          credit_cost: number
          description?: string | null
          display_order?: number
          duration_days: number
          enabled?: boolean
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          credit_cost?: number
          description?: string | null
          display_order?: number
          duration_days?: number
          enabled?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      shop_delivery_jobs: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          order_id: string
          payload: Json
          sent_at: string | null
          status: string
          target: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          order_id: string
          payload?: Json
          sent_at?: string | null
          status?: string
          target?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          order_id?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_delivery_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_fulfillments: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          order_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          order_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_order_events: {
        Row: {
          actor: string | null
          created_at: string
          details: string | null
          event: string
          id: string
          order_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          details?: string | null
          event: string
          id?: string
          order_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          details?: string | null
          event?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_order_items: {
        Row: {
          created_at: string
          currency: string
          delivery_email: string | null
          id: string
          line_total: number | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          snapshot: Json
          unit_price: number | null
          unit_stars: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          delivery_email?: string | null
          id?: string
          line_total?: number | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          snapshot?: Json
          unit_price?: number | null
          unit_stars?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          delivery_email?: string | null
          id?: string
          line_total?: number | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          snapshot?: Json
          unit_price?: number | null
          unit_stars?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          approved_by: string | null
          channel: string
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_name: string | null
          delivered_at: string | null
          delivery_emails: string | null
          email_body: string | null
          email_confirmed_at: string | null
          email_draft_generated_at: string | null
          email_subject: string | null
          expires_at: string | null
          id: string
          info_request: string | null
          order_number: string
          payment_evidence_url: string | null
          payment_method_id: string | null
          payment_method_name: string | null
          payment_network: string | null
          payment_recipient: string | null
          payment_reference: string | null
          profile_id: string | null
          reject_reason: string | null
          rejected_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          stars_total: number | null
          status: string
          stock_consumed: boolean
          stock_reserved: boolean
          submitted_at: string | null
          telegram_charge_id: string | null
          telegram_user_id: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          channel?: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          delivered_at?: string | null
          delivery_emails?: string | null
          email_body?: string | null
          email_confirmed_at?: string | null
          email_draft_generated_at?: string | null
          email_subject?: string | null
          expires_at?: string | null
          id?: string
          info_request?: string | null
          order_number?: string
          payment_evidence_url?: string | null
          payment_method_id?: string | null
          payment_method_name?: string | null
          payment_network?: string | null
          payment_recipient?: string | null
          payment_reference?: string | null
          profile_id?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          stars_total?: number | null
          status?: string
          stock_consumed?: boolean
          stock_reserved?: boolean
          submitted_at?: string | null
          telegram_charge_id?: string | null
          telegram_user_id?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          channel?: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          delivered_at?: string | null
          delivery_emails?: string | null
          email_body?: string | null
          email_confirmed_at?: string | null
          email_draft_generated_at?: string | null
          email_subject?: string | null
          expires_at?: string | null
          id?: string
          info_request?: string | null
          order_number?: string
          payment_evidence_url?: string | null
          payment_method_id?: string | null
          payment_method_name?: string | null
          payment_network?: string | null
          payment_recipient?: string | null
          payment_reference?: string | null
          profile_id?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          stars_total?: number | null
          status?: string
          stock_consumed?: boolean
          stock_reserved?: boolean
          submitted_at?: string | null
          telegram_charge_id?: string | null
          telegram_user_id?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_tasks: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          enabled: boolean
          id: string
          name: string
          platform: string
          required: boolean
          telegram_chat_id: string | null
          url: string | null
          verification_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          name: string
          platform: string
          required?: boolean
          telegram_chat_id?: string | null
          url?: string | null
          verification_type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          name?: string
          platform?: string
          required?: boolean
          telegram_chat_id?: string | null
          url?: string | null
          verification_type?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          task_id: string
          user_id: string
          verification_method: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          task_id: string
          user_id: string
          verification_method?: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          task_id?: string
          user_id?: string
          verification_method?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "social_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_processed_updates: {
        Row: {
          processed_at: string
          update_id: number
        }
        Insert: {
          processed_at?: string
          update_id: number
        }
        Update: {
          processed_at?: string
          update_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_verified_profile: {
        Args: { _user_id: string }
        Returns: {
          activated: boolean
          referral_awarded: boolean
        }[]
      }
      award_referral: { Args: { _referred_user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      redeem_reward: {
        Args: { _generated_key: string; _reward_id: string; _user_id: string }
        Returns: {
          credits_used: number
          duration_days: number
          license_key: string
          reward_name: string
        }[]
      }
      reject_referral: { Args: { _referral_id: string }; Returns: boolean }
      require_admin: { Args: { _user_id: string }; Returns: boolean }
      shop_release_stock: { Args: { _order_id: string }; Returns: boolean }
      shop_reserve_stock: {
        Args: { _product_id: string; _qty: number }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
