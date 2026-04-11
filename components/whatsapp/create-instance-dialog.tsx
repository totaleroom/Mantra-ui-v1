'use client'

import { useState } from 'react'
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
import type { Client } from '@/lib/types'

interface CreateInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { instanceName: string; clientId: number }) => void
  clients: Client[]
}

export function CreateInstanceDialog({
  open,
  onOpenChange,
  onSubmit,
  clients,
}: CreateInstanceDialogProps) {
  const [instanceName, setInstanceName] = useState('')
  const [clientId, setClientId] = useState('')

  const handleSubmit = () => {
    if (instanceName && clientId) {
      onSubmit({
        instanceName: instanceName.toLowerCase().replace(/\s+/g, '-'),
        clientId: parseInt(clientId, 10),
      })
      setInstanceName('')
      setClientId('')
    }
  }

  const isValid = instanceName.length >= 3 && clientId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create WhatsApp Instance</DialogTitle>
          <DialogDescription>
            Set up a new Evolution API instance for a client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Instance Name</Label>
            <Input
              placeholder="e.g., acme-support"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              className="bg-secondary border-border"
            />
            <p className="text-xs text-muted-foreground">
              Will be converted to lowercase with hyphens. Min 3 characters.
            </p>
          </div>

          {instanceName.length >= 3 && (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Preview</p>
              <p className="font-mono text-sm">
                {instanceName.toLowerCase().replace(/\s+/g, '-')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="bg-primary text-primary-foreground"
          >
            Create Instance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
