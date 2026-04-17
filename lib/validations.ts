import { z } from 'zod'

// AI Provider Schema - matches schema.ts aiProviders table
export const aiProviderSchema = z.object({
  providerName: z.string().min(1, 'Provider name is required'),
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url('Must be a valid URL').nullable().optional(),
  priority: z.number().int().min(1).max(10).default(1),
  isActive: z.boolean().default(true),
  clientId: z.number().int().nullable().optional(),
})

export type AIProviderFormData = z.infer<typeof aiProviderSchema>

// WhatsApp Instance Schema - matches schema.ts whatsappInstances table
export const whatsappInstanceSchema = z.object({
  instanceName: z
    .string()
    .min(3, 'Instance name must be at least 3 characters')
    .max(50, 'Instance name must be less than 50 characters')
    .regex(
      /^[a-z0-9-]+$/,
      'Only lowercase letters, numbers, and hyphens allowed'
    ),
  clientId: z.number().int().positive('Client is required'),
  providerType: z.enum(['WHATSAPP_WEB_JS']),
  webhookUrl: z.string().url('Must be a valid URL').nullable().optional(),
  providerConfig: z.object({
    sessionName: z.string().min(1).optional(),
    webhookUrl: z.string().url('Must be a valid URL').nullable().optional(),
    headless: z.boolean().optional(),
    qrFormat: z.enum(['data_url', 'base64']).optional(),
    globalApiKey: z.string().optional(),
    clientId: z.string().optional(),
  }).default({}),
})

export type WhatsAppInstanceFormData = z.infer<typeof whatsappInstanceSchema>

// Client AI Config Schema - matches schema.ts clientAiConfigs table
export const clientAiConfigSchema = z.object({
  clientId: z.number().int().positive(),
  modelId: z.string().min(1, 'Model is required'),
  systemPrompt: z
    .string()
    .min(10, 'System prompt must be at least 10 characters')
    .max(4000, 'System prompt must be less than 4000 characters'),
  vectorNamespace: z.string().nullable().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  memoryTtlDays: z.number().int().min(1).max(4).default(4),
})

export type ClientAIConfigFormData = z.infer<typeof clientAiConfigSchema>

// Client Schema - matches schema.ts clients table
export const clientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  tokenLimit: z.number().int().min(0).default(1000),
  isActive: z.boolean().default(true),
})

export type ClientFormData = z.infer<typeof clientSchema>

// Tenant Config Combined Schema
export const tenantConfigSchema = z.object({
  client: clientSchema,
  aiConfig: clientAiConfigSchema.omit({ clientId: true }),
})

export type TenantConfigFormData = z.infer<typeof tenantConfigSchema>
