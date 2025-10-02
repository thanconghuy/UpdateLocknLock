interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WOOCOMMERCE_BASE_URL: string;
  WOOCOMMERCE_CONSUMER_KEY: string;
  WOOCOMMERCE_CONSUMER_SECRET: string;
  DEFAULT_PRODUCTS_TABLE: string;
  DEFAULT_AUDIT_TABLE: string;
}

export const ENV: EnvConfig = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  WOOCOMMERCE_BASE_URL: import.meta.env.VITE_WOOCOMMERCE_BASE_URL || 'https://locknlockvietnam.com',
  WOOCOMMERCE_CONSUMER_KEY: import.meta.env.VITE_WOOCOMMERCE_CONSUMER_KEY || '',
  WOOCOMMERCE_CONSUMER_SECRET: import.meta.env.VITE_WOOCOMMERCE_CONSUMER_SECRET || '',
  DEFAULT_PRODUCTS_TABLE: import.meta.env.VITE_DEFAULT_PRODUCTS_TABLE || 'products',
  DEFAULT_AUDIT_TABLE: import.meta.env.VITE_DEFAULT_AUDIT_TABLE || 'product_updates'
}

export const isProductionMode = (): boolean => {
  return import.meta.env.PROD === true;
}

export const validateEnv = (): void => {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'WOOCOMMERCE_CONSUMER_KEY',
    'WOOCOMMERCE_CONSUMER_SECRET'
  ] as const;

  const missingVars = requiredVars.filter(key => !ENV[key]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
}

export const hasRequiredEnvVars = (): boolean => {
  try {
    // Only validate essential Supabase credentials for now
    const essentialVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;
    const missingEssential = essentialVars.filter(key => !ENV[key]);

    if (missingEssential.length > 0) {
      throw new Error(`Missing essential variables: ${missingEssential.join(', ')}`);
    }

    return true;
  } catch {
    return false;
  }
}