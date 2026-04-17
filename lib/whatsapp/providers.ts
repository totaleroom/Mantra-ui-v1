import type {
  WhatsAppProviderDefinition,
  WhatsAppProviderType,
} from '@/lib/types'

export const whatsappProviders: WhatsAppProviderDefinition[] = [
  {
    type: 'WHATSAPP_WEB_JS',
    name: 'WhatsApp Web JS',
    description: 'Lightweight multi-device provider with local QR onboarding.',
    defaultConfig: {
      headless: true,
      qrFormat: 'data_url',
    },
    configFields: [
      {
        key: 'sessionName',
        label: 'Session Name',
        type: 'text',
        required: true,
        placeholder: 'Same as instance name',
      },
      {
        key: 'webhookUrl',
        label: 'Provider Webhook URL',
        type: 'url',
        placeholder: 'https://your-api.com/webhook',
      },
      {
        key: 'qrFormat',
        label: 'QR Output Format',
        type: 'select',
        required: true,
        options: [
          { label: 'Data URL', value: 'data_url' },
          { label: 'Raw Base64', value: 'base64' },
        ],
      },
      {
        key: 'globalApiKey',
        label: 'Global Credential Alias',
        type: 'password',
        placeholder: 'Optional shared credential reference',
      },
      {
        key: 'clientId',
        label: 'Provider Client ID',
        type: 'text',
        placeholder: 'Optional provider-side identifier',
      },
    ],
  },
]

export function getWhatsAppProviderDefinition(type: WhatsAppProviderType) {
  return whatsappProviders.find((provider) => provider.type === type) ?? whatsappProviders[0]
}
