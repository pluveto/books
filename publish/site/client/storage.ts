/** localStorage that tolerates private mode and disabled storage. */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Preference simply is not remembered.
    }
  },
}
