// =======================================
// USER VALIDATION UTILITIES
// =======================================

import {
  CreateUserRequest,
  UpdateUserRequest,
  UserRoleChangeRequest,
  ValidationResult,
  UserErrorCode,
  USER_ROLES
} from '../types/userManagement'

export class UserValidation {

  // ========================================
  // EMAIL VALIDATION
  // ========================================

  /**
   * Validate email format
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!email) {
      errors.push('Email is required')
      return { isValid: false, errors, warnings }
    }

    if (typeof email !== 'string') {
      errors.push('Email must be a string')
      return { isValid: false, errors, warnings }
    }

    // Trim và lowercase
    email = email.trim().toLowerCase()

    if (email.length === 0) {
      errors.push('Email cannot be empty')
      return { isValid: false, errors, warnings }
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format')
      return { isValid: false, errors, warnings }
    }

    // Check email length
    if (email.length > 320) {
      errors.push('Email is too long (max 320 characters)')
      return { isValid: false, errors, warnings }
    }

    // Advanced email validation
    const [localPart, domain] = email.split('@')

    if (localPart.length > 64) {
      errors.push('Email local part is too long (max 64 characters)')
    }

    if (domain.length > 253) {
      errors.push('Email domain is too long (max 253 characters)')
    }

    // Check for consecutive dots
    if (email.includes('..')) {
      errors.push('Email cannot contain consecutive dots')
    }

    // Check for common typos
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
    const suspiciousDomains = ['gmial.com', 'yahooo.com', 'hotmial.com', 'outlokk.com']

    if (suspiciousDomains.some(suspicious => domain.includes(suspicious))) {
      warnings.push('Email domain may contain typos')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // ========================================
  // NAME VALIDATION
  // ========================================

  /**
   * Validate full name
   */
  static validateFullName(fullName?: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Full name is optional
    if (!fullName) {
      return { isValid: true, errors, warnings }
    }

    if (typeof fullName !== 'string') {
      errors.push('Full name must be a string')
      return { isValid: false, errors, warnings }
    }

    const trimmedName = fullName.trim()

    if (trimmedName.length === 0) {
      warnings.push('Full name is empty')
      return { isValid: true, errors, warnings }
    }

    if (trimmedName.length > 100) {
      errors.push('Full name is too long (max 100 characters)')
    }

    if (trimmedName.length < 2) {
      warnings.push('Full name is very short')
    }

    // Check for invalid characters
    const invalidChars = /[<>{}[\]\\\/\|`~!@#$%^&*()+=?]/
    if (invalidChars.test(trimmedName)) {
      errors.push('Full name contains invalid characters')
    }

    // Check for only numbers
    if (/^\d+$/.test(trimmedName)) {
      errors.push('Full name cannot be only numbers')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // ========================================
  // ROLE VALIDATION
  // ========================================

  /**
   * Validate role name
   */
  static validateRole(role: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!role) {
      errors.push('Role is required')
      return { isValid: false, errors, warnings }
    }

    if (typeof role !== 'string') {
      errors.push('Role must be a string')
      return { isValid: false, errors, warnings }
    }

    const trimmedRole = role.trim().toLowerCase()

    if (trimmedRole.length === 0) {
      errors.push('Role cannot be empty')
      return { isValid: false, errors, warnings }
    }

    // Check if role is valid
    const validRoles = Object.values(USER_ROLES)
    if (!validRoles.includes(trimmedRole as any)) {
      errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate role ID (UUID)
   */
  static validateRoleId(roleId: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!roleId) {
      errors.push('Role ID is required')
      return { isValid: false, errors, warnings }
    }

    if (typeof roleId !== 'string') {
      errors.push('Role ID must be a string')
      return { isValid: false, errors, warnings }
    }

    const trimmedRoleId = roleId.trim()

    if (trimmedRoleId.length === 0) {
      errors.push('Role ID cannot be empty')
      return { isValid: false, errors, warnings }
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(trimmedRoleId)) {
      errors.push('Invalid role ID format (must be UUID)')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // ========================================
  // USER DATA VALIDATION
  // ========================================

  /**
   * Validate CreateUserRequest
   */
  static validateCreateUserRequest(request: CreateUserRequest): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!request) {
      errors.push('User data is required')
      return { isValid: false, errors, warnings }
    }

    // Validate email
    const emailValidation = this.validateEmail(request.email)
    errors.push(...emailValidation.errors)
    warnings.push(...(emailValidation.warnings || []))

    // Validate full name
    const nameValidation = this.validateFullName(request.full_name)
    errors.push(...nameValidation.errors)
    warnings.push(...(nameValidation.warnings || []))

    // Validate role
    const roleValidation = this.validateRole(request.role)
    errors.push(...roleValidation.errors)
    warnings.push(...(roleValidation.warnings || []))

    // Validate role ID
    const roleIdValidation = this.validateRoleId(request.primary_role_id)
    errors.push(...roleIdValidation.errors)
    warnings.push(...(roleIdValidation.warnings || []))

    // Validate is_active (optional)
    if (request.is_active !== undefined && typeof request.is_active !== 'boolean') {
      errors.push('is_active must be a boolean')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate UpdateUserRequest
   */
  static validateUpdateUserRequest(request: UpdateUserRequest): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!request) {
      errors.push('Update data is required')
      return { isValid: false, errors, warnings }
    }

    // Check if at least one field is provided
    const hasFields = request.email || request.full_name || request.role ||
                     request.primary_role_id || request.is_active !== undefined

    if (!hasFields) {
      errors.push('At least one field must be provided for update')
      return { isValid: false, errors, warnings }
    }

    // Validate email if provided
    if (request.email !== undefined) {
      const emailValidation = this.validateEmail(request.email)
      errors.push(...emailValidation.errors)
      warnings.push(...(emailValidation.warnings || []))
    }

    // Validate full name if provided
    if (request.full_name !== undefined) {
      const nameValidation = this.validateFullName(request.full_name)
      errors.push(...nameValidation.errors)
      warnings.push(...(nameValidation.warnings || []))
    }

    // Validate role if provided
    if (request.role !== undefined) {
      const roleValidation = this.validateRole(request.role)
      errors.push(...roleValidation.errors)
      warnings.push(...(roleValidation.warnings || []))
    }

    // Validate role ID if provided
    if (request.primary_role_id !== undefined) {
      const roleIdValidation = this.validateRoleId(request.primary_role_id)
      errors.push(...roleIdValidation.errors)
      warnings.push(...(roleIdValidation.warnings || []))
    }

    // Validate is_active if provided
    if (request.is_active !== undefined && typeof request.is_active !== 'boolean') {
      errors.push('is_active must be a boolean')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate UserRoleChangeRequest
   */
  static validateRoleChangeRequest(request: UserRoleChangeRequest): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!request) {
      errors.push('Role change data is required')
      return { isValid: false, errors, warnings }
    }

    // Validate user ID
    const userIdValidation = this.validateRoleId(request.userId) // Reuse UUID validation
    if (!userIdValidation.isValid) {
      errors.push(`Invalid user ID: ${userIdValidation.errors.join(', ')}`)
    }

    // Validate new role ID
    const newRoleIdValidation = this.validateRoleId(request.newRoleId)
    errors.push(...newRoleIdValidation.errors)
    warnings.push(...(newRoleIdValidation.warnings || []))

    // Validate new role name
    const newRoleNameValidation = this.validateRole(request.newRoleName)
    errors.push(...newRoleNameValidation.errors)
    warnings.push(...(newRoleNameValidation.warnings || []))

    // Validate reason (optional)
    if (request.reason !== undefined) {
      if (typeof request.reason !== 'string') {
        errors.push('Reason must be a string')
      } else if (request.reason.trim().length > 500) {
        errors.push('Reason is too long (max 500 characters)')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return ''
    }
    return email.trim().toLowerCase()
  }

  /**
   * Sanitize full name input
   */
  static sanitizeFullName(fullName?: string): string {
    if (!fullName || typeof fullName !== 'string') {
      return ''
    }

    return fullName
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[<>{}[\]\\\/\|`~!@#$%^&*()+=?]/g, '') // Remove invalid characters
  }

  /**
   * Sanitize role input
   */
  static sanitizeRole(role: string): string {
    if (!role || typeof role !== 'string') {
      return ''
    }
    return role.trim().toLowerCase()
  }

  /**
   * Check if user data has changed
   */
  static hasUserDataChanged(
    original: Partial<CreateUserRequest>,
    updated: UpdateUserRequest
  ): boolean {
    const fields = ['email', 'full_name', 'role', 'primary_role_id', 'is_active'] as const

    return fields.some(field => {
      const originalValue = original[field]
      const updatedValue = updated[field]

      if (updatedValue === undefined) {
        return false // Field not being updated
      }

      return originalValue !== updatedValue
    })
  }

  /**
   * Create validation summary message
   */
  static createValidationSummary(validation: ValidationResult): string {
    const messages: string[] = []

    if (validation.errors.length > 0) {
      messages.push(`Errors: ${validation.errors.join(', ')}`)
    }

    if (validation.warnings && validation.warnings.length > 0) {
      messages.push(`Warnings: ${validation.warnings.join(', ')}`)
    }

    if (messages.length === 0) {
      return 'Validation passed'
    }

    return messages.join(' | ')
  }
}