// =======================================
// USER MANAGEMENT COMPONENT - Modern UI
// =======================================

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { UserManagementController } from '../../services/UserManagementController'
import { RoleDataService } from '../../services/RoleDataService'
import {
  UserProfile,
  Role,
  UserQueryParams,
  CreateUserRequest,
  UpdateUserRequest,
  UserListResponse,
  SecurityContext
} from '../../types/userManagement'
import { UserValidation } from '../../utils/userValidation'

export default function UserManagement() {
  const { userProfile } = useAuth()
  const [controller] = useState(() => UserManagementController.getInstance())
  const [roleService] = useState(() => RoleDataService.getInstance())

  // State management
  const [users, setUsers] = useState<UserProfile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [securityContext, setSecurityContext] = useState<SecurityContext | null>(null)

  // Pagination & filtering
  const [currentPage, setCurrentPage] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    email: '',
    full_name: '',
    role: 'viewer',
    primary_role_id: '',
    is_active: true
  })
  const [editForm, setEditForm] = useState<UpdateUserRequest>({})

  const pageSize = 10

  // Initialize
  useEffect(() => {
    initializeComponent()
  }, [])

  // Load users when filters change
  useEffect(() => {
    if (securityContext) {
      loadUsers()
    }
  }, [currentPage, searchTerm, filterRole, filterActive, securityContext])

  const initializeComponent = async () => {
    if (!userProfile?.id) {
      console.log('❌ UserManagement: No userProfile.id found')
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('🔄 UserManagement: Initializing...')
      console.log('🔄 UserProfile:', userProfile)

      // Load security context
      console.log('🔄 Loading security context for user:', userProfile.id)
      const contextResult = await controller.getSecurityContext(userProfile.id)

      console.log('🔄 Security context result:', contextResult)

      if (!contextResult.success || !contextResult.data) {
        console.error('❌ Failed to load security context:', contextResult.error)
        setError(`Failed to load security context: ${contextResult.error}`)
        return
      }

      setSecurityContext(contextResult.data)
      console.log('✅ Security context loaded:', contextResult.data.permissions)

      // Load roles
      console.log('🔄 Loading roles...')
      const rolesResult = await roleService.getAllRoles()
      console.log('🔄 Roles result:', rolesResult)

      if (rolesResult.success && rolesResult.data) {
        setRoles(rolesResult.data)
        console.log(`✅ Loaded ${rolesResult.data.length} roles`)

        // Set default role ID for create form
        const defaultRole = rolesResult.data.find(role => role.name === 'viewer')
        if (defaultRole) {
          setCreateForm(prev => ({ ...prev, primary_role_id: defaultRole.id }))
        }
      } else {
        console.error('❌ Failed to load roles:', rolesResult.error)
        setError(`Failed to load roles: ${rolesResult.error}`)
      }

    } catch (error) {
      console.error('❌ Error initializing UserManagement:', error)
      setError(`Failed to initialize user management: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    if (!userProfile?.id || !securityContext?.permissions.canViewUsers) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const params: UserQueryParams = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search: searchTerm || undefined,
        role: filterRole || undefined,
        isActive: filterActive,
        sortBy: 'created_at',
        sortOrder: 'desc'
      }

      console.log('🔍 Loading users with params:', params)

      const result = await controller.getUsers(userProfile.id, params)

      if (result.success && result.data) {
        setUsers(result.data.users)
        setTotalUsers(result.data.total)
        console.log(`✅ Loaded ${result.data.users.length} of ${result.data.total} users`)
      } else {
        setError(result.error || 'Failed to load users')
      }

    } catch (error) {
      console.error('❌ Error loading users:', error)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userProfile?.id) return

    try {
      setLoading(true)
      setError(null)

      // Client-side validation
      const validation = UserValidation.validateCreateUserRequest(createForm)
      if (!validation.isValid) {
        setError(`Validation failed: ${validation.errors.join(', ')}`)
        return
      }

      console.log('🔨 Creating user:', createForm)

      const result = await controller.createUser(userProfile.id, createForm)

      if (result.success && result.data) {
        setSuccess(`User ${result.data.email} created successfully`)
        setShowCreateModal(false)
        setCreateForm({
          email: '',
          full_name: '',
          role: 'viewer',
          primary_role_id: roles.find(r => r.name === 'viewer')?.id || '',
          is_active: true
        })
        await loadUsers()
      } else {
        setError(result.error || 'Failed to create user')
      }

    } catch (error) {
      console.error('❌ Error creating user:', error)
      setError('Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userProfile?.id || !selectedUser) return

    try {
      setLoading(true)
      setError(null)

      // Client-side validation
      const validation = UserValidation.validateUpdateUserRequest(editForm)
      if (!validation.isValid) {
        setError(`Validation failed: ${validation.errors.join(', ')}`)
        return
      }

      console.log('🔄 Updating user:', selectedUser.id, editForm)

      const result = await controller.updateUser(userProfile.id, selectedUser.id, editForm)

      if (result.success && result.data) {
        setSuccess(`User ${result.data.email} updated successfully`)
        setShowEditModal(false)
        setSelectedUser(null)
        setEditForm({})
        await loadUsers()
      } else {
        setError(result.error || 'Failed to update user')
      }

    } catch (error) {
      console.error('❌ Error updating user:', error)
      setError('Failed to update user')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleUserStatus = async (user: UserProfile) => {
    if (!userProfile?.id) return

    try {
      setLoading(true)
      setError(null)

      console.log(`🔄 Toggling user status: ${user.id} (${user.is_active ? 'deactivate' : 'activate'})`)

      const result = user.is_active
        ? await controller.deactivateUser(userProfile.id, user.id)
        : await controller.activateUser(userProfile.id, user.id)

      if (result.success) {
        setSuccess(`User ${user.email} ${user.is_active ? 'deactivated' : 'activated'} successfully`)
        await loadUsers()
      } else {
        setError(result.error || 'Failed to change user status')
      }

    } catch (error) {
      console.error('❌ Error toggling user status:', error)
      setError('Failed to change user status')
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user)
    setEditForm({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      primary_role_id: user.primary_role_id,
      is_active: user.is_active
    })
    setShowEditModal(true)
  }

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  // Show loading while initializing
  if (loading || !securityContext) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <div className="text-4xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Loading...</h2>
        <p className="text-gray-600">
          Initializing user management module...
        </p>
      </div>
    )
  }

  // Double check - chỉ Admin được truy cập
  if (userProfile?.role !== 'admin') {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <div className="text-red-500 text-6xl mb-4">🛡️</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Admin Access Required</h2>
        <p className="text-gray-600 mb-4">
          User Management module is restricted to administrators only.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-center mb-2">
            <span className="text-red-600 font-medium">Access Denied</span>
          </div>
          <div className="text-sm text-red-700 space-y-1">
            <p>Current role: <span className="font-mono bg-red-100 px-2 py-1 rounded">{userProfile?.role || 'Unknown'}</span></p>
            <p>Required role: <span className="font-mono bg-red-100 px-2 py-1 rounded">admin</span></p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Contact your administrator to request admin privileges if needed.
        </p>
      </div>
    )
  }

  // Additional check - permissions level
  if (!securityContext.permissions.canViewUsers) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Permission Error</h2>
        <p className="text-gray-600 mb-4">
          Your admin account doesn't have user management permissions.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">
            This may be a configuration issue. Contact system administrator.
          </p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalUsers / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
            <p className="text-gray-600 mt-1">Manage system users and their roles</p>
          </div>
          {securityContext?.permissions.canCreateUsers && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              + Add User
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {(error || success) && (
        <div className={`rounded-lg p-4 ${error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-center justify-between">
            <p className={`font-medium ${error ? 'text-red-800' : 'text-green-800'}`}>
              {error ? '❌ ' + error : '✅ ' + success}
            </p>
            <button
              onClick={clearMessages}
              className={`${error ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Roles</option>
              {roles.map(role => (
                <option key={role.id} value={role.name}>
                  {role.display_name || role.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filterActive === undefined ? '' : filterActive.toString()}
              onChange={(e) => setFilterActive(e.target.value === '' ? undefined : e.target.value === 'true')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterRole('')
                setFilterActive(undefined)
                setCurrentPage(1)
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">👥</div>
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          {user.full_name && <div className="text-sm text-gray-500">{user.full_name}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'editor' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {securityContext?.permissions.canUpdateUsers && (
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {securityContext?.permissions.canUpdateUsers && (
                          <button
                            onClick={() => handleToggleUserStatus(user)}
                            className={`${
                              user.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                            } transition-colors`}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-3 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} users
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Create New User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select
                  required
                  value={createForm.role}
                  onChange={(e) => {
                    const selectedRole = roles.find(r => r.name === e.target.value)
                    setCreateForm(prev => ({
                      ...prev,
                      role: e.target.value,
                      primary_role_id: selectedRole?.id || ''
                    }))
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.name}>
                      {role.display_name || role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="create-active"
                  checked={createForm.is_active}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="create-active" className="text-sm text-gray-700">Active user</label>
              </div>
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Edit User: {selectedUser.email}</h3>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={editForm.role || ''}
                  onChange={(e) => {
                    const selectedRole = roles.find(r => r.name === e.target.value)
                    setEditForm(prev => ({
                      ...prev,
                      role: e.target.value,
                      primary_role_id: selectedRole?.id || ''
                    }))
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.name}>
                      {role.display_name || role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editForm.is_active || false}
                  onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="edit-active" className="text-sm text-gray-700">Active user</label>
              </div>
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}