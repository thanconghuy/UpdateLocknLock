export const ENV = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  WOOCOMMERCE_BASE_URL: import.meta.env.VITE_WOOCOMMERCE_BASE_URL || 'https://locknlockvietnam.com',
  WOOCOMMERCE_CONSUMER_KEY: import.meta.env.VITE_WOOCOMMERCE_CONSUMER_KEY || '',
  WOOCOMMERCE_CONSUMER_SECRET: import.meta.env.VITE_WOOCOMMERCE_CONSUMER_SECRET || '',
  DEFAULT_PRODUCTS_TABLE: import.meta.env.VITE_DEFAULT_PRODUCTS_TABLE || 'products',
  DEFAULT_AUDIT_TABLE: import.meta.env.VITE_DEFAULT_AUDIT_TABLE || 'product_updates'
}

export const isProductionMode = () => {
  return import.meta.env.PROD
}

export const hasRequiredEnvVars = () => {
  return Boolean(
    ENV.SUPABASE_URL &&
    ENV.SUPABASE_ANON_KEY &&
    ENV.WOOCOMMERCE_CONSUMER_KEY &&
    ENV.WOOCOMMERCE_CONSUMER_SECRET
  )
}