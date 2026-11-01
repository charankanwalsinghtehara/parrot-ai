
import axios from 'axios'

const configuredBase =
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:8000/api/v1'

const normalizedBase = configuredBase.startsWith('http')
  ? configuredBase
  : `https://${configuredBase}`

const baseURL = normalizedBase.endsWith('/api/v1')
  ? normalizedBase
  : `${normalizedBase}/api/v1`

const api = axios.create({
  baseURL,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

// Django's CSRF endpoint must return { csrfToken: "..." }.
// Keep the token in memory because the API cookie is not
// readable from JavaScript running on the frontend domain.
let csrfToken: string | null = null
let csrfRequest: Promise<string> | null = null

async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken
  }

  if (!csrfRequest) {
    csrfRequest = axios
      .get<{ csrfToken: string }>(`${baseURL}/auth/csrf/`, {
        withCredentials: true,
      })
      .then((response) => {
        const token = response.data?.csrfToken

        if (!token) {
          throw new Error(
            'CSRF token missing from /auth/csrf/ response. ' +
              'Update the Django csrf_cookie view.',
          )
        }

        csrfToken = token
        return token
      })
      .finally(() => {
        csrfRequest = null
      })
  }

  return csrfRequest
}

api.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase()

  const isUnsafeMethod =
    method &&
    !['get', 'head', 'options', 'trace'].includes(method)

  if (isUnsafeMethod) {
    const token = await getCsrfToken()

    config.headers.set('X-CSRFToken', token)
  }

  return config
})

// If the server rejects a token, clear the cached token so
// the next request can obtain a fresh one.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 403 &&
      error.config?.headers?.['X-CSRFToken']
    ) {
      csrfToken = null
    }

    return Promise.reject(error)
  },
)

export default api

export type Parrot = {
  id: number
  name: string
  species_name?: string
  species?: number | null
  weight_grams?: number | null
}

export type RoutineTask = {
  id: number
  title: string
  category: string
  essential: boolean
  completed_today: boolean
}

export type Article = {
  id: number
  title: string
  body: string
  source_title: string
  source_url: string
  reviewed: boolean
}

export type Weight = {
  id: number
  grams: number
  measured_at: string
}
