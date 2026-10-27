export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'

export const ENDPOINTS = {
  HEALTH: '/health',
  CARDS: '/cards',
  CARD_BY_ID: (id: string) => `/cards/${id}`,
}
