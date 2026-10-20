import axios from 'axios'

const configuredBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'
const normalizedBase = configuredBase.startsWith('http') ? configuredBase : `https://${configuredBase}`
const api = axios.create({
  baseURL: normalizedBase.endsWith('/api/v1') ? normalizedBase : `${normalizedBase}/api/v1`,
  withCredentials: true,
})

function csrfToken() {
  return document.cookie.split('; ').find((cookie) => cookie.startsWith('csrftoken='))?.split('=').slice(1).join('=')
}

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  if (method && !['get', 'head', 'options', 'trace'].includes(method)) {
    const token = csrfToken()
    if (token) config.headers['X-CSRFToken'] = decodeURIComponent(token)
  }
  return config
})

export default api

export type Parrot = { id: number; name: string; species_name?: string; species?: number | null; weight_grams?: number | null }
export type RoutineTask = { id: number; title: string; category: string; essential: boolean; completed_today: boolean }
export type Article = { id: number; title: string; body: string; source_title: string; source_url: string; reviewed: boolean }
export type Weight = { id: number; grams: number; measured_at: string }