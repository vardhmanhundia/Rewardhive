export interface Card {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt?: string
}

export interface CardCreateRequest {
  title: string
  content: string
}

export interface CardUpdateRequest {
  title?: string
  content?: string
}

export interface ApiResponse<T> {
  data: T
  error?: string
  status: number
}
