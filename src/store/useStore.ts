import create from 'zustand'
import type { ProductData, UpdateLog } from '../types'
import { wooCommerceService } from '../services/woocommerce'

type State = {
  products: ProductData[]
  setProducts: (p: ProductData[]) => void
  updateLogs: UpdateLog[]
  setUpdateLogs: (logs: UpdateLog[]) => void
  addUpdateLog: (log: UpdateLog) => void
  updateProductInWooCommerce: (product: ProductData) => Promise<boolean>
  syncProductFromWooCommerce: (websiteId: string, productId: string) => Promise<ProductData | null>
}

export const useStore = create<State>((set, get) => ({
  products: [],
  setProducts: (p) => set({ products: p }),
  updateLogs: [],
  setUpdateLogs: (logs) => set({ updateLogs: logs }),
  addUpdateLog: (log) => set((state) => ({ 
    updateLogs: [log, ...state.updateLogs] 
  })),
  updateProductInWooCommerce: async (product) => {
    if (!product.websiteId) {
      const errorLog: UpdateLog = {
        id: Date.now().toString(),
        productId: product.id,
        websiteId: product.websiteId,
        title: product.title,
        status: 'failed',
        timestamp: new Date(),
        error: 'No website ID provided for product',
        operation: 'update'
      }
      get().addUpdateLog(errorLog)
      return false
    }

    try {
      const success = await wooCommerceService.updateProduct(product.websiteId, product)
      
      const log: UpdateLog = {
        id: Date.now().toString(),
        productId: product.id,
        websiteId: product.websiteId,
        title: product.title,
        status: success ? 'success' : 'failed',
        timestamp: new Date(),
        error: success ? undefined : 'WooCommerce API update failed',
        operation: 'update'
      }
      
      get().addUpdateLog(log)
      return success
    } catch (error) {
      const errorLog: UpdateLog = {
        id: Date.now().toString(),
        productId: product.id,
        websiteId: product.websiteId,
        title: product.title,
        status: 'failed',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        operation: 'update'
      }
      
      get().addUpdateLog(errorLog)
      return false
    }
  },
  
  syncProductFromWooCommerce: async (websiteId: string, productId: string) => {
    try {
      const productData = await wooCommerceService.getProduct(websiteId)
      
      if (productData) {
        // Set the correct internal ID
        productData.id = productId
        
        const syncLog: UpdateLog = {
          id: Date.now().toString(),
          productId: productId,
          websiteId: websiteId,
          title: productData.title,
          status: 'success',
          timestamp: new Date(),
          error: undefined,
          operation: 'sync'
        }
        
        get().addUpdateLog(syncLog)
        return productData
      } else {
        const errorLog: UpdateLog = {
          id: Date.now().toString(),
          productId: productId,
          websiteId: websiteId,
          title: 'Unknown',
          status: 'failed',
          timestamp: new Date(),
          error: 'Failed to fetch product data from WooCommerce',
          operation: 'sync'
        }
        
        get().addUpdateLog(errorLog)
        return null
      }
    } catch (error) {
      const errorLog: UpdateLog = {
        id: Date.now().toString(),
        productId: productId,
        websiteId: websiteId,
        title: 'Unknown',
        status: 'failed',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown sync error',
        operation: 'sync'
      }
      
      get().addUpdateLog(errorLog)
      return null
    }
  }
}))
