import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export async function retry(fn: any, retries: number, delay = 0) {
  try {
    return await fn()
  } catch (err) {
    if (retries === 0) throw err

    if (delay) await new Promise((res) => setTimeout(res, delay))

    return retry(fn, retries - 1, delay)
  }
}

export const fetchWithRetry = (url: string, options?: RequestInit) =>
  retry(() => fetch(url, options), 2, 400 + Math.random() * 600)