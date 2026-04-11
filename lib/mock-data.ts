import type {
  Client,
  AIProvider,
  ClientAIConfig,
  WhatsAppInstance,
  SystemDiagnosis,
  InboxMessage,
  AIModel,
} from './types'

export const mockClients: Client[] = [
  { id: 1, name: 'Acme Corp', tokenBalance: 45000, tokenLimit: 100000, isActive: true, createdAt: new Date('2024-01-15') },
  { id: 2, name: 'TechStart Inc', tokenBalance: 12000, tokenLimit: 50000, isActive: true, createdAt: new Date('2024-02-20') },
  { id: 3, name: 'Global Services', tokenBalance: 78000, tokenLimit: 200000, isActive: true, createdAt: new Date('2024-01-08') },
  { id: 4, name: 'Local Shop', tokenBalance: 3500, tokenLimit: 10000, isActive: true, createdAt: new Date('2024-03-10') },
  { id: 5, name: 'Enterprise Ltd', tokenBalance: 150000, tokenLimit: 500000, isActive: true, createdAt: new Date('2023-12-01') },
]

export const mockAIProviders: AIProvider[] = [
  { id: 1, clientId: null, providerName: 'OpenRouter', apiKey: 'sk-or-***', baseUrl: 'https://openrouter.ai/api/v1', priority: 1, isActive: true, lastError: null, updatedAt: new Date() },
  { id: 2, clientId: null, providerName: 'Groq', apiKey: 'gsk_***', baseUrl: 'https://api.groq.com/openai/v1', priority: 2, isActive: true, lastError: null, updatedAt: new Date() },
  { id: 3, clientId: null, providerName: 'OpenAI', apiKey: 'sk-***', baseUrl: 'https://api.openai.com/v1', priority: 3, isActive: true, lastError: 'Rate limit exceeded at 14:30 UTC', updatedAt: new Date() },
  { id: 4, clientId: 1, providerName: 'Anthropic', apiKey: 'sk-ant-***', baseUrl: 'https://api.anthropic.com', priority: 1, isActive: false, lastError: null, updatedAt: new Date() },
]

export const mockClientAIConfigs: ClientAIConfig[] = [
  { id: 1, clientId: 1, modelId: 'gpt-4-turbo', systemPrompt: 'You are a helpful customer service agent for Acme Corp...', vectorNamespace: 'acme-kb', temperature: 0.7, memoryTtlDays: 4 },
  { id: 2, clientId: 2, modelId: 'claude-3-sonnet', systemPrompt: 'You are TechStart support assistant...', vectorNamespace: 'techstart-docs', temperature: 0.5, memoryTtlDays: 2 },
  { id: 3, clientId: 3, modelId: 'mixtral-8x7b', systemPrompt: 'You represent Global Services...', vectorNamespace: null, temperature: 0.8, memoryTtlDays: 4 },
]

export const mockWhatsAppInstances: WhatsAppInstance[] = [
  { id: 1, clientId: 1, instanceName: 'acme-main', instanceApiKey: 'evo_***', webhookUrl: 'https://api.mantra.ai/webhook/acme', status: 'CONNECTED', updatedAt: new Date() },
  { id: 2, clientId: 1, instanceName: 'acme-support', instanceApiKey: 'evo_***', webhookUrl: 'https://api.mantra.ai/webhook/acme-support', status: 'CONNECTED', updatedAt: new Date() },
  { id: 3, clientId: 2, instanceName: 'techstart-wa', instanceApiKey: 'evo_***', webhookUrl: 'https://api.mantra.ai/webhook/techstart', status: 'DISCONNECTED', updatedAt: new Date() },
  { id: 4, clientId: 3, instanceName: 'global-primary', instanceApiKey: null, webhookUrl: null, status: 'CONNECTING', updatedAt: new Date() },
  { id: 5, clientId: 5, instanceName: 'enterprise-main', instanceApiKey: 'evo_***', webhookUrl: 'https://api.mantra.ai/webhook/enterprise', status: 'CONNECTED', updatedAt: new Date() },
]

export const mockSystemDiagnosis: SystemDiagnosis[] = [
  { id: 1, serviceName: 'PostgreSQL', status: 'healthy', latency: 12, lastCheck: new Date() },
  { id: 2, serviceName: 'Redis', status: 'healthy', latency: 3, lastCheck: new Date() },
  { id: 3, serviceName: 'Evolution API', status: 'degraded', latency: 450, lastCheck: new Date() },
]

export const mockInboxMessages: InboxMessage[] = [
  {
    id: '1',
    clientId: 1,
    clientName: 'Acme Corp',
    customerNumber: '+1234567890',
    message: 'Hi, I need help with my order #12345',
    direction: 'inbound',
    timestamp: new Date(Date.now() - 60000),
    aiThoughtProcess: 'Customer is asking about order status. Checking order database for #12345. Found order placed 3 days ago, currently in transit.',
    modelUsed: 'gpt-4-turbo',
  },
  {
    id: '2',
    clientId: 1,
    clientName: 'Acme Corp',
    customerNumber: '+1234567890',
    message: 'I found your order #12345. It was shipped on March 15th and is currently in transit. Expected delivery is March 18th.',
    direction: 'outbound',
    timestamp: new Date(Date.now() - 55000),
    modelUsed: 'gpt-4-turbo',
  },
  {
    id: '3',
    clientId: 2,
    clientName: 'TechStart Inc',
    customerNumber: '+9876543210',
    message: 'Can you explain the pricing for enterprise plan?',
    direction: 'inbound',
    timestamp: new Date(Date.now() - 120000),
    aiThoughtProcess: 'Pricing inquiry detected. Retrieving enterprise pricing from knowledge base. Customer seems to be comparing plans.',
    modelUsed: 'claude-3-sonnet',
  },
  {
    id: '4',
    clientId: 3,
    clientName: 'Global Services',
    customerNumber: '+5555555555',
    message: 'I want to cancel my subscription',
    direction: 'inbound',
    timestamp: new Date(Date.now() - 300000),
    aiThoughtProcess: 'Cancellation request detected. Initiating retention flow. Checking customer history - long-term customer with 2 years tenure.',
    modelUsed: 'mixtral-8x7b',
  },
  {
    id: '5',
    clientId: 5,
    clientName: 'Enterprise Ltd',
    customerNumber: '+1112223333',
    message: 'Schedule a demo for next week',
    direction: 'inbound',
    timestamp: new Date(Date.now() - 180000),
    aiThoughtProcess: 'Demo scheduling request. Checking available calendar slots for next week. Preparing confirmation message.',
    modelUsed: 'gpt-4-turbo',
  },
]

export const mockAIModels: AIModel[] = [
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', contextLength: 128000, pricing: { input: 0.01, output: 0.03 } },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', contextLength: 128000, pricing: { input: 0.005, output: 0.015 } },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', contextLength: 200000, pricing: { input: 0.015, output: 0.075 } },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', contextLength: 200000, pricing: { input: 0.003, output: 0.015 } },
  { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'Mistral', contextLength: 32000, pricing: { input: 0.0007, output: 0.0007 } },
  { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta', contextLength: 8192, pricing: { input: 0.0008, output: 0.0008 } },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', contextLength: 1000000, pricing: { input: 0.0035, output: 0.0105 } },
]
