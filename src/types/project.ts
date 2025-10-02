export interface Project {
  id: string
  project_id: number  // 🆕 Numeric project ID for linking with products
  name: string
  description?: string
  slug: string

  // Owner & Manager
  owner_id: string
  manager_id?: string

  // WooCommerce Configuration
  woocommerce_base_url: string
  woocommerce_consumer_key: string
  woocommerce_consumer_secret: string

  // Database Configuration
  products_table: string
  audit_table: string

  // Settings
  settings: Record<string, any>
  is_active: boolean
  max_members: number

  // WooCommerce Store Reference (NEW)
  woocommerce_store_id?: number  // 🆕 Reference to normalized store

  // Timestamps
  created_at: string
  updated_at: string
  deleted_at?: string | null  // 🆕 For 2-tier deletion strategy

  // User's role in this project (populated from project_members)
  user_role?: 'admin' | 'manager' | 'product_editor' | 'project_viewer' | 'viewer'
}

// 🆕 WooCommerce Store Entity
export interface WooCommerceStore {
  id: number
  base_url: string
  store_name?: string
  consumer_key: string
  consumer_secret: string
  is_active: boolean
  last_tested_at?: string
  last_test_status?: 'success' | 'failed' | 'pending'
  last_error_message?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'admin' | 'manager' | 'product_editor' | 'project_viewer' | 'viewer'

  assigned_by: string
  assigned_at: string
  is_active: boolean
  permissions?: Record<string, any>

  // Populated fields
  user?: {
    id: string
    email: string
    full_name?: string
    role: string
    is_active: boolean
  }
}

export interface CreateProjectData {
  name: string
  description?: string
  // 🆕 New normalized approach
  woocommerce_store_id?: number
  // Legacy fields (for backward compatibility)
  woocommerce_base_url: string
  woocommerce_consumer_key: string
  woocommerce_consumer_secret: string
  products_table?: string
  audit_table?: string
  settings?: Record<string, any>
}

// Interface for backward compatibility (no longer needed with per-project config)
export interface ProjectWithWooConfig extends Project {
  // All WooCommerce config is now stored in the project itself
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  id: string
  is_active?: boolean
}

export interface ProjectWithMembers extends Project {
  members: ProjectMember[]
  member_count: number
  user_role?: 'admin' | 'manager' | 'product_editor' | 'project_viewer' | 'viewer'
  can_manage_members: boolean
  can_edit_project: boolean
}