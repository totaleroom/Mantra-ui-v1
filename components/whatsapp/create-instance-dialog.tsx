'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { whatsappInstanceSchema, type WhatsAppInstanceFormData } from '@/lib/validations'
import { useCreateWhatsAppInstance, useWhatsAppProviders } from '@/hooks/use-whatsapp'
import { useTenants } from '@/hooks/use-tenant'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface CreateInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateInstanceDialog({
  open,
  onOpenChange,
}: CreateInstanceDialogProps) {
  const createInstance = useCreateWhatsAppInstance()
  const { data: clients, isLoading: isLoadingClients } = useTenants()
  const { data: providers = [] } = useWhatsAppProviders()

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WhatsAppInstanceFormData>({
    resolver: zodResolver(whatsappInstanceSchema),
    defaultValues: {
      instanceName: '',
      clientId: 0,
      providerType: 'WHATSAPP_WEB_JS',
      webhookUrl: null,
      providerConfig: {
        sessionName: '',
        webhookUrl: null,
        headless: true,
        qrFormat: 'data_url',
        globalApiKey: '',
        clientId: '',
      },
    },
  })

  const instanceName = watch('instanceName')
  const providerType = watch('providerType')
  const selectedProvider =
    providers.find((provider) => provider.type === providerType) ?? providers[0]

  // Transform instance name to lowercase with hyphens
  const formattedName = instanceName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const onSubmit = async (data: WhatsAppInstanceFormData) => {
    try {
      await createInstance.mutateAsync({
        ...data,
        instanceName: data.instanceName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, ''),
        providerConfig: {
          ...data.providerConfig,
          sessionName:
            data.providerConfig.sessionName ||
            data.instanceName
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, ''),
          webhookUrl: data.providerConfig.webhookUrl || data.webhookUrl || null,
        },
      })
      toast.success('WhatsApp instance created successfully')
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to create WhatsApp instance')
      console.error('Create instance error:', error)
    }
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  useEffect(() => {
    if (!selectedProvider) return

    setValue('providerType', selectedProvider.type)
    setValue('providerConfig', {
      ...selectedProvider.defaultConfig,
      ...getValues('providerConfig'),
    })
  }, [selectedProvider, getValues, setValue])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create WhatsApp Instance</DialogTitle>
          <DialogDescription>
            Set up a provider-backed WhatsApp instance for a client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Controller
              name="clientId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? field.value.toString() : ''}
                  onValueChange={(value) => field.onChange(parseInt(value, 10))}
                  disabled={isLoadingClients}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.clientId && (
              <p className="text-xs text-error">{errors.clientId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instanceName">Instance Name</Label>
            <Input
              id="instanceName"
              placeholder="e.g., acme-support"
              {...register('instanceName')}
              className="bg-secondary border-border"
            />
            <p className="text-xs text-muted-foreground">
              Will be converted to lowercase with hyphens. Min 3 characters.
            </p>
            {errors.instanceName && (
              <p className="text-xs text-error">{errors.instanceName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>WhatsApp Provider</Label>
            <Controller
              name="providerType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.type} value={provider.type}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {selectedProvider && (
              <p className="text-xs text-muted-foreground">{selectedProvider.description}</p>
            )}
            {errors.providerType && (
              <p className="text-xs text-error">{errors.providerType.message}</p>
            )}
          </div>

          {formattedName.length >= 3 && (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Preview</p>
              <p className="font-mono text-sm">{formattedName}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
            <Input
              id="webhookUrl"
              placeholder="https://your-api.com/webhook"
              {...register('webhookUrl')}
              className="bg-secondary border-border"
            />
            {errors.webhookUrl && (
              <p className="text-xs text-error">{errors.webhookUrl.message}</p>
            )}
          </div>

          {selectedProvider?.configFields.map((field) => {
            if (field.type === 'select') {
              return (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Controller
                    name={`providerConfig.${field.key}`}
                    control={control}
                    render={({ field: controllerField }) => (
                      <Select
                        value={String(controllerField.value ?? '')}
                        onValueChange={controllerField.onChange}
                      >
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )
            }

            return (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={String(field.key)}>{field.label}</Label>
                <Input
                  id={String(field.key)}
                  type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
                  placeholder={field.placeholder}
                  {...register(`providerConfig.${field.key}`)}
                  className="bg-secondary border-border"
                />
              </div>
            )
          })}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createInstance.isPending}
              className="bg-primary text-primary-foreground"
            >
              {(isSubmitting || createInstance.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create Instance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
