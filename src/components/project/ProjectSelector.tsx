import React, { useState, useEffect } from 'react'
import { useProject } from '../../contexts/ProjectContext'
import { useAuth } from '../../contexts/AuthContext'
import { CreateProjectData, WooCommerceStore } from '../../types/project'
import { WooCommerceStoreService } from '../../services/woocommerceStoreService'

export default function ProjectSelector() {
  const {
    projects,
    currentProject,
    loading,
    switchProject,
    createProject,
    setShowProjectSelector
  } = useProject()

  const { userProfile } = useAuth()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState<CreateProjectData>({
    name: '',
    description: '',
    woocommerce_base_url: '',
    woocommerce_consumer_key: '',
    woocommerce_consumer_secret: '',
    products_table: 'products_new',
    audit_table: 'product_updates'
  })

  // 🆕 WooCommerce Store Management
  const [stores, setStores] = useState<WooCommerceStore[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null)
  const [showNewStoreForm, setShowNewStoreForm] = useState(false)
  const [loadingStores, setLoadingStores] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)

  // Load existing stores
  useEffect(() => {
    if (showCreateForm) {
      loadWooCommerceStores()
    }
  }, [showCreateForm])

  const loadWooCommerceStores = async () => {
    setLoadingStores(true)
    try {
      const storesData = await WooCommerceStoreService.getAccessibleStores()
      setStores(storesData)
    } catch (error) {
      console.error('❌ Error loading stores:', error)
    } finally {
      setLoadingStores(false)
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên project')
      return
    }

    // Check if using existing store or creating new one
    let storeToUse: WooCommerceStore | null = null

    if (selectedStoreId) {
      // Using existing store
      storeToUse = stores.find(s => s.id === selectedStoreId) || null
      if (!storeToUse) {
        alert('Store đã chọn không tồn tại')
        return
      }
    } else {
      // Creating new store - validate fields
      if (!formData.woocommerce_base_url.trim() ||
          !formData.woocommerce_consumer_key.trim() ||
          !formData.woocommerce_consumer_secret.trim()) {
        alert('Vui lòng nhập đầy đủ thông tin WooCommerce')
        return
      }

      // Create or get existing store
      storeToUse = await WooCommerceStoreService.createOrGetStore({
        base_url: formData.woocommerce_base_url,
        consumer_key: formData.woocommerce_consumer_key,
        consumer_secret: formData.woocommerce_consumer_secret
      })

      if (!storeToUse) {
        alert('Không thể tạo hoặc tìm thấy WooCommerce store')
        return
      }
    }

    try {
      setCreating(true)

      // Create project with store reference
      const projectData = {
        ...formData,
        woocommerce_store_id: storeToUse.id,
        // Keep legacy fields for backward compatibility (temporary)
        woocommerce_base_url: storeToUse.base_url,
        woocommerce_consumer_key: storeToUse.consumer_key,
        woocommerce_consumer_secret: storeToUse.consumer_secret
      }

      const newProject = await createProject(projectData)

      if (newProject) {
        console.log('✅ Project created:', newProject.name)
        console.log('🏪 Using WooCommerce store:', storeToUse.store_name || storeToUse.base_url)

        // Reset form
        setShowCreateForm(false)
        setSelectedStoreId(null)
        setShowNewStoreForm(false)
        setFormData({
          name: '',
          description: '',
          woocommerce_base_url: '',
          woocommerce_consumer_key: '',
          woocommerce_consumer_secret: '',
          products_table: 'products_new',
          audit_table: 'product_updates'
        })
      }
    } catch (error) {
      console.error('❌ Error creating project:', error)
      alert('Có lỗi xảy ra khi tạo project')
    } finally {
      setCreating(false)
    }
  }

  const handleSelectProject = (projectId: string) => {
    switchProject(projectId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Chào mừng, {userProfile?.full_name || 'User'}!
          </h1>
          <p className="text-gray-600">
            Chọn project để bắt đầu quản lý sản phẩm, hoặc tạo project mới
          </p>
        </div>

        {!showCreateForm ? (
          <div className="space-y-6">
            {/* Existing Projects */}
            {projects.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Projects của bạn ({projects.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleSelectProject(project.id)}
                      className={`p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-2 ${
                        currentProject?.id === project.id
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {project.name}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          project.user_role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : project.user_role === 'manager'
                            ? 'bg-blue-100 text-blue-800'
                            : project.user_role === 'product_editor'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {project.user_role}
                        </span>
                      </div>

                      {project.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-500">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                          {project.woocommerce_base_url.replace(/https?:\/\//, '')}
                        </div>
                        <div className="flex items-center justify-between text-gray-500">
                          <span>{project.member_count} thành viên</span>
                          <span>{new Date(project.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>

                      {currentProject?.id === project.id && (
                        <div className="mt-3 text-center">
                          <span className="text-blue-600 text-sm font-medium">
                            ✓ Đang được chọn
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {projects.length === 0 && (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">🏢</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Chưa có project nào
                </h3>
                <p className="text-gray-500 mb-6">
                  Tạo project đầu tiên để bắt đầu quản lý sản phẩm WooCommerce
                </p>
              </div>
            )}

            {/* Create New Project Button */}
            <div className="text-center">
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <span className="mr-2">➕</span>
                Tạo Project Mới
              </button>
            </div>

            {/* Skip for now (if has projects) */}
            {projects.length > 0 && (
              <div className="text-center">
                <button
                  onClick={() => setShowProjectSelector(false)}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Bỏ qua, chọn sau
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Create Project Form - Approach 2: Clean & Focused */
          <div className="max-w-2xl mx-auto">
            {/* Current Context Header */}
            {currentProject && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-blue-600 text-lg mr-2">🟢</span>
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Project hiện tại</p>
                    <p className="text-blue-800 font-semibold">{currentProject.name}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  🎯 Tạo Project Mới
                </h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Project *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="VD: Shopee Store Management"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mô tả
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Mô tả ngắn gọn về project..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WooCommerce Base URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.woocommerce_base_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, woocommerce_base_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://yourstore.com"
                  />
                </div>

                {/* WooCommerce Consumer Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consumer Key *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.woocommerce_consumer_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, woocommerce_consumer_key: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ck_xxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>

                {/* WooCommerce Consumer Secret */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consumer Secret *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.woocommerce_consumer_secret}
                    onChange={(e) => setFormData(prev => ({ ...prev, woocommerce_consumer_secret: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="cs_xxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>

                {/* Database Configuration removed - now hardcoded to use products_new and product_updates for consistency */}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !formData.name.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {creating ? (
                      <span className="flex items-center">
                        <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Đang tạo...
                      </span>
                    ) : (
                      'Tạo Project'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}