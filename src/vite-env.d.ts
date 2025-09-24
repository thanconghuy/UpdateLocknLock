/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_WEBHOOK_SECRET: string
  readonly VITE_WOOCOMMERCE_BASE_URL: string
  readonly VITE_WOOCOMMERCE_CONSUMER_KEY: string
  readonly VITE_WOOCOMMERCE_CONSUMER_SECRET: string
  readonly VITE_DEFAULT_PRODUCTS_TABLE: string
  readonly VITE_DEFAULT_AUDIT_TABLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}