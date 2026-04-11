// Types based on schema.ts

export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'STAFF'
export type InstanceStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR'

export interface User {
  id: number
  email: string
  role: UserRole
  createdAt: Date
}

export interface Client {
  id: number
  name: string
  tokenBalance: number
  tokenLimit: number
  isActive: boolean
  createdAt: Date
}

export interface AIProvider {
  id: number
  clientId: number | null
  providerName: string
  apiKey: string
  baseUrl: string | null
  priority: number
  isActive: boolean
  lastError: string | null
  updatedAt: Date
}

export interface ClientAIConfig {
  id: number
  clientId: number
  modelId: string
  systemPrompt: string
  vectorNamespace: string | null
  temperature: number
  memoryTtlDays: number
}

export interface WhatsAppInstance {
  id: number
  clientId: number
  instanceName: string
  instanceApiKey: string | null
  webhookUrl: string | null
  status: InstanceStatus
  updatedAt: Date
}

export interface CustomerMemory {
  id: number
  clientId: number
  customerNumber: string
  summary: string | null
  rawHistory: Record<string, unknown>[] | null
  expiresAt: Date
  updatedAt: Date
}

export interface SystemDiagnosis {
  id: number
  serviceName: string
  status: string
  latency: number
  lastCheck: Date
}

// Message types for Inbox
export interface InboxMessage {
  id: string
  clientId: number
  clientName: string
  customerNumber: string
  message: string
  direction: 'inbound' | 'outbound'
  timestamp: Date
  aiThoughtProcess?: string
  modelUsed?: string
}

// Provider models
export interface AIModel {
  id: string
  name: string
  provider: string
  contextLength: number
  pricing: {
    input: number
    output: number
  }
}
