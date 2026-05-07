class GroqApiKeyManager {
  static readonly instance = new GroqApiKeyManager()

  private readonly apiKeys: string[]
  private currentKeyIndex = 0
  private readonly cooldownMap = new Map<string, number>()

  private constructor() {
    this.apiKeys = process.env.GROQ_API_KEYS?.split("|").filter(Boolean) || []
  }

  getNextApiKey() {
    if (this.apiKeys.length === 0) {
      throw new Error("No GROQ API keys provided in GROQ_API_KEYS env variable")
    }

    const now = Date.now()

    for (let i = 0; i < this.apiKeys.length; i++) {
      const key = this.apiKeys[this.currentKeyIndex]
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length

      const cooldownUntil = this.cooldownMap.get(key)
      if (!cooldownUntil || cooldownUntil < now) {
        return key
      }
    }

    throw new Error("All GROQ API keys are temporarily exhausted")
  }

  markKeyCooldown(key: string, ms = 60000) {
    this.cooldownMap.set(key, Date.now() + ms)
  }
}

export const groqApiKeyManager = GroqApiKeyManager.instance
