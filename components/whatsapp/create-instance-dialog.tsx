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
import { useCreateWhatsAppInstance } from '@/hooks/use-whatsapp'
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

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WhatsAppInstanceFormData>({
    resolver: zodResolver(whatsappInstanceSchema),
    defaultValues: {
      instanceName: '',
      clientId: 0,
      webhookUrl: null,
    },
  })

  const instanceName = watch('instanceName')

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create WhatsApp Instance</DialogTitle>
          <DialogDescription>
            Set up a new Evolution API instance for a client.
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
