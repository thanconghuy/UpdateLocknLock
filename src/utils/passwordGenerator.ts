/**
 * Password Generator Utility
 * Generates secure random passwords for new users
 */

export interface PasswordGeneratorOptions {
  length?: number
  includeUppercase?: boolean
  includeLowercase?: boolean
  includeNumbers?: boolean
  includeSymbols?: boolean
  excludeSimilarCharacters?: boolean
  excludeAmbiguous?: boolean
}

const DEFAULT_OPTIONS: PasswordGeneratorOptions = {
  length: 12,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeSimilarCharacters: true, // Exclude i, l, 1, L, o, 0, O
  excludeAmbiguous: true // Exclude { } [ ] ( ) / \ ' " ` ~ , ; : . < >
}

export class PasswordGenerator {
  private static readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
  private static readonly UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  private static readonly NUMBERS = '0123456789'
  private static readonly SYMBOLS = '!@#$%^&*-_=+?'

  // Similar characters that might be confused
  private static readonly SIMILAR_CHARS = 'il1Lo0O'

  // Ambiguous symbols
  private static readonly AMBIGUOUS_CHARS = '{}[]()/\\\'"`~,;:.<>'

  /**
   * Generate a random secure password
   */
  static generate(options: PasswordGeneratorOptions = {}): string {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    // Build character pool
    let charPool = ''
    let requiredChars: string[] = []

    if (opts.includeLowercase) {
      let lowerChars = this.LOWERCASE
      if (opts.excludeSimilarCharacters) {
        lowerChars = lowerChars.replace(/[ilo]/g, '')
      }
      charPool += lowerChars
      // Ensure at least one lowercase
      requiredChars.push(lowerChars[Math.floor(Math.random() * lowerChars.length)])
    }

    if (opts.includeUppercase) {
      let upperChars = this.UPPERCASE
      if (opts.excludeSimilarCharacters) {
        upperChars = upperChars.replace(/[ILO]/g, '')
      }
      charPool += upperChars
      // Ensure at least one uppercase
      requiredChars.push(upperChars[Math.floor(Math.random() * upperChars.length)])
    }

    if (opts.includeNumbers) {
      let numChars = this.NUMBERS
      if (opts.excludeSimilarCharacters) {
        numChars = numChars.replace(/[01]/g, '')
      }
      charPool += numChars
      // Ensure at least one number
      requiredChars.push(numChars[Math.floor(Math.random() * numChars.length)])
    }

    if (opts.includeSymbols) {
      let symbolChars = this.SYMBOLS
      if (opts.excludeAmbiguous) {
        // Already using safe symbols
      }
      charPool += symbolChars
      // Ensure at least one symbol
      requiredChars.push(symbolChars[Math.floor(Math.random() * symbolChars.length)])
    }

    if (charPool.length === 0) {
      throw new Error('No character types selected for password generation')
    }

    const length = opts.length || 12
    if (length < 8) {
      throw new Error('Password length must be at least 8 characters')
    }

    // Generate random password
    let password = ''

    // Fill remaining length with random characters
    const remainingLength = length - requiredChars.length
    for (let i = 0; i < remainingLength; i++) {
      const randomIndex = Math.floor(Math.random() * charPool.length)
      password += charPool[randomIndex]
    }

    // Add required characters
    password += requiredChars.join('')

    // Shuffle the password to randomize position of required characters
    password = this.shuffleString(password)

    return password
  }

  /**
   * Generate multiple passwords
   */
  static generateMultiple(count: number, options: PasswordGeneratorOptions = {}): string[] {
    const passwords: string[] = []
    for (let i = 0; i < count; i++) {
      passwords.push(this.generate(options))
    }
    return passwords
  }

  /**
   * Validate password strength
   */
  static validateStrength(password: string): {
    isStrong: boolean
    score: number // 0-100
    feedback: string[]
  } {
    const feedback: string[] = []
    let score = 0

    // Length check
    if (password.length >= 12) {
      score += 25
    } else if (password.length >= 8) {
      score += 15
      feedback.push('Password should be at least 12 characters for better security')
    } else {
      feedback.push('Password is too short (minimum 8 characters)')
    }

    // Character variety checks
    if (/[a-z]/.test(password)) score += 15
    else feedback.push('Add lowercase letters')

    if (/[A-Z]/.test(password)) score += 15
    else feedback.push('Add uppercase letters')

    if (/[0-9]/.test(password)) score += 15
    else feedback.push('Add numbers')

    if (/[!@#$%^&*\-_=+?]/.test(password)) score += 20
    else feedback.push('Add special characters')

    // Bonus points for extra length
    if (password.length >= 16) score += 10

    const isStrong = score >= 70

    return {
      isStrong,
      score,
      feedback
    }
  }

  /**
   * Shuffle string characters randomly
   */
  private static shuffleString(str: string): string {
    const arr = str.split('')
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.join('')
  }

  /**
   * Generate a memorable password (using words pattern)
   * Format: Word-Word-Number-Symbol (e.g., Happy-Tree-42!)
   */
  static generateMemorable(): string {
    const adjectives = [
      'Happy', 'Swift', 'Bright', 'Quick', 'Smart', 'Bold', 'Calm', 'Wise',
      'Lucky', 'Strong', 'Brave', 'Clear', 'Fresh', 'Noble', 'Pure', 'True'
    ]

    const nouns = [
      'Tiger', 'Eagle', 'River', 'Mountain', 'Ocean', 'Forest', 'Star', 'Moon',
      'Cloud', 'Thunder', 'Phoenix', 'Dragon', 'Wolf', 'Hawk', 'Bear', 'Lion'
    ]

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const num = Math.floor(Math.random() * 99) + 1
    const symbols = '!@#$%&*'
    const symbol = symbols[Math.floor(Math.random() * symbols.length)]

    return `${adj}-${noun}-${num}${symbol}`
  }
}

// Export convenience function
export const generatePassword = (options?: PasswordGeneratorOptions) =>
  PasswordGenerator.generate(options)

export const generateMemorablePassword = () =>
  PasswordGenerator.generateMemorable()
