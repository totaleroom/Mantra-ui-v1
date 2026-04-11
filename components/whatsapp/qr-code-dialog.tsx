'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, CheckCircle, Smartphone } from 'lucide-react'
import type { WhatsAppInstance } from '@/lib/types'

interface QRCodeDialogProps {
  instance: WhatsAppInstance | null
  onClose: () => void
  onConnect: (id: number) => void
}

export function QRCodeDialog({ instance, onClose, onConnect }: QRCodeDialogProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [countdown, setCountdown] = useState(60)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!instance) return

    // Simulate QR code loading
    setIsLoading(true)
    setIsConnected(false)
    const loadTimer = setTimeout(() => setIsLoading(false), 1500)

    // Countdown timer
    setCountdown(60)
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearTimeout(loadTimer)
      clearInterval(countdownInterval)
    }
  }, [instance])

  const handleSimulateConnect = () => {
    setIsConnected(true)
    setTimeout(() => {
      if (instance) {
        onConnect(instance.id)
      }
    }, 1500)
  }

  if (!instance) return null

  return (
    <Dialog open={!!instance} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Scan QR Code</DialogTitle>
          <DialogDescription>
            Open WhatsApp on your phone and scan this QR code to connect{' '}
            <span className="font-medium text-foreground">{instance.instanceName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {isConnected ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-medium text-success">Connected!</p>
              <p className="text-sm text-muted-foreground">
                Instance is now active
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Generating QR code...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* Simulated QR Code */}
              <div className="relative w-48 h-48 bg-white rounded-lg p-3 mb-4">
                <div className="w-full h-full grid grid-cols-8 gap-0.5">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div
                      key={i}
                      className={`aspect-square ${
                        Math.random() > 0.5 ? 'bg-black' : 'bg-white'
                      }`}
                    />
                  ))}
                </div>
                {/* WhatsApp Logo Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-8 h-8 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <Badge variant="outline" className="mb-4 bg-secondary">
                QR expires in {countdown}s
              </Badge>

              {/* Instructions */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Smartphone className="w-4 h-4" />
                  Open WhatsApp on your phone
                </div>
                <p className="text-xs text-muted-foreground">
                  Go to Settings → Linked Devices → Link a Device
                </p>
              </div>

              {/* Demo Connect Button */}
              <Button
                onClick={handleSimulateConnect}
                className="mt-6 bg-[#25D366] text-white hover:bg-[#25D366]/90"
              >
                Simulate Connection
              </Button>
            </div>
          )}
        </div>

        {countdown === 0 && !isConnected && (
          <div className="flex justify-center pb-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsLoading(true)
                setTimeout(() => {
                  setIsLoading(false)
                  setCountdown(60)
                }, 1500)
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh QR Code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
