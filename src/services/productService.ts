// New ProductService with project_id filtering
import { supabase } from '../lib/supabase'
import type { ProductData } from '../types'
import type { Project } from '../types/project'

export interface ProductFilter {
  search?: string
  platform?: string
  stockStatus?: 'instock' | 'outofstock'
  recentlyUpdated?: boolean
  timeFilter?: string
  page?: number
  pageSize?: number
}

export interface ProductStats {
  total: number
  inStock: number
  outOfStock: number
  platforms: {
    shopee: number
    tiktok: number
    lazada: number
    dmx: number
    tiki: number
  }
}

export class ProductService {
  /**
   * Get products for a specific project with filtering
   */
  static async getProjectProducts(
    projectId: number,
    filter: ProductFilter = {}
  ): Promise<{ data: ProductData[], count: number }> {
    try {
      console.log('📋 ProductService: Loading products for project:', projectId)

      let query = supabase
        .from('products_new')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId) // 🔑 Key filter by project
        .order('updated_at', { ascending: false })

      // Apply filters
      if (filter.search) {
        query = query.or(`title.ilike.%${filter.search}%,sku.ilike.%${filter.search}%`)
      }

      if (filter.stockStatus === 'instock') {
        query = query.eq('het_hang', false)
      } else if (filter.stockStatus === 'outofstock') {
        query = query.eq('het_hang', true)
      }

      if (filter.platform) {
        const platformField = `link_${filter.platform}`
        query = query.not(platformField, 'is', null)
      }

      if (filter.recentlyUpdated) {
        const timeThreshold = new Date()
        timeThreshold.setHours(timeThreshold.getHours() - 24)
        query = query.gte('updated_at', timeThreshold.toISOString())
      }

      // Pagination
      const page = filter.page || 1
      const pageSize = filter.pageSize || 50
      const offset = (page - 1) * pageSize
      query = query.range(offset, offset + pageSize - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('❌ ProductService: Query error:', error)
        throw error
      }

      console.log(`✅ ProductService: Loaded ${data?.length || 0} products (total: ${count})`)
      return { data: data || [], count: count || 0 }

    } catch (error) {
      console.error('❌ ProductService: Exception:', error)
      throw error
    }
  }

  /**
   * Get product by ID within a project
   */
  static async getProjectProduct(projectId: number, productId: string): Promise<ProductData | null> {
    try {
      const { data, error } = await supabase
        .from('products_new')
        .select('*')
        .eq('project_id', projectId)
        .eq('id', productId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Product not found
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('❌ ProductService: Error getting product:', error)
      throw error
    }
  }

  /**
   * Create product in a project
   */
  static async createProduct(projectId: number, productData: Partial<ProductData>): Promise<ProductData> {
    try {
      const { data, error } = await supabase
        .from('products_new')
        .insert([{
          project_id: projectId,
          ...productData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error

      console.log('✅ ProductService: Created product:', data.id)
      return data
    } catch (error) {
      console.error('❌ ProductService: Error creating product:', error)
      throw error
    }
  }

  /**
   * Update product within a project
   */
  static async updateProduct(
    projectId: number,
    productId: string,
    updates: Partial<ProductData>
  ): Promise<ProductData> {
    try {
      const { data, error } = await supabase
        .from('products_new')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', projectId)
        .eq('id', productId)
        .select()
        .single()

      if (error) throw error

      console.log('✅ ProductService: Updated product:', productId)
      return data
    } catch (error) {
      console.error('❌ ProductService: Error updating product:', error)
      throw error
    }
  }

  /**
   * Delete product from a project
   */
  static async deleteProduct(projectId: number, productId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('products_new')
        .delete()
        .eq('project_id', projectId)
        .eq('id', productId)

      if (error) throw error

      console.log('✅ ProductService: Deleted product:', productId)
      return true
    } catch (error) {
      console.error('❌ ProductService: Error deleting product:', error)
      return false
    }
  }

  /**
   * Get product statistics for a project
   */
  static async getProjectStats(projectId: number): Promise<ProductStats> {
    try {
      const { data, error } = await supabase
        .from('products_new')
        .select('het_hang, link_shopee, link_tiktok, link_lazada, link_dmx, link_tiki')
        .eq('project_id', projectId)

      if (error) throw error

      const stats: ProductStats = {
        total: data.length,
        inStock: data.filter(p => !p.het_hang).length,
        outOfStock: data.filter(p => p.het_hang).length,
        platforms: {
          shopee: data.filter(p => p.link_shopee).length,
          tiktok: data.filter(p => p.link_tiktok).length,
          lazada: data.filter(p => p.link_lazada).length,
          dmx: data.filter(p => p.link_dmx).length,
          tiki: data.filter(p => p.link_tiki).length
        }
      }

      return stats
    } catch (error) {
      console.error('❌ ProductService: Error getting stats:', error)
      throw error
    }
  }

  /**
   * Bulk import products to a project
   */
  static async bulkImportProducts(projectId: number, products: Partial<ProductData>[]): Promise<{
    success: number
    failed: number
    errors: string[]
  }> {
    try {
      const now = new Date().toISOString()
      const productsWithProject = products.map(p => ({
        project_id: projectId,
        ...p,
        created_at: now,
        updated_at: now
      }))

      const { data, error } = await supabase
        .from('products_new')
        .insert(productsWithProject)
        .select('id')

      if (error) {
        return {
          success: 0,
          failed: products.length,
          errors: [error.message]
        }
      }

      return {
        success: data.length,
        failed: 0,
        errors: []
      }
    } catch (error) {
      console.error('❌ ProductService: Bulk import error:', error)
      return {
        success: 0,
        failed: products.length,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Search products across projects (for admin users)
   */
  static async searchAllProjects(searchTerm: string, limit = 20): Promise<{
    projectId: number
    projectName: string
    products: ProductData[]
  }[]> {
    try {
      // This would require joining with projects table
      const { data, error } = await supabase
        .from('products_new')
        .select(`
          *,
          projects:project_id(project_id, name)
        `)
        .or(`title.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
        .limit(limit)

      if (error) throw error

      // Group by project
      const grouped = data.reduce((acc, product) => {
        const projectId = product.project_id
        const projectName = (product.projects as any)?.name || 'Unknown'

        if (!acc[projectId]) {
          acc[projectId] = {
            projectId,
            projectName,
            products: []
          }
        }

        acc[projectId].products.push(product)
        return acc
      }, {} as Record<number, any>)

      return Object.values(grouped)
    } catch (error) {
      console.error('❌ ProductService: Search error:', error)
      throw error
    }
  }
}

export default ProductService