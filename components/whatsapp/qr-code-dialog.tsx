'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, CheckCircle, Smartphone, AlertCircle, Loader2 } from 'lucide-react'
import { useQRCodeStream } from '@/hooks/use-whatsapp'
import type { WhatsAppInstance } from '@/lib/types'

interface QRCodeDialogProps {
  instance: WhatsAppInstance | null
  onClose: () => void
}

export function QRCodeDialog({ instance, onClose }: QRCodeDialogProps) {
  const {
    qrCode,
    isConnected,
    isLoading,
    error,
    countdown,
    refresh,
    disconnect,
  } = useQRCodeStream(instance?.instanceName || null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const handleClose = () => {
    disconnect()
    onClose()
  }

  if (!instance) return null

  return (
    <Dialog open={!!instance} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Scan QR Code</DialogTitle>
          <DialogDescription>
            Open WhatsApp on your phone and scan this QR code to connect{' '}
            <span className="font-medium text-foreground">{instance.instanceName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Connected State */}
          {isConnected && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-medium text-success">Connected!</p>
              <p className="text-sm text-muted-foreground">
                Instance is now active
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isConnected && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-error/10 mb-4">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <p className="text-lg font-medium text-error">Connection Error</p>
              <p className="text-sm text-muted-foreground text-center mb-4">
                {error}
              </p>
              <Button onClick={refresh} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !error && !isConnected && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Generating QR code...</p>
            </div>
          )}

          {/* QR Code Display */}
          {qrCode && !isLoading && !error && !isConnected && (
            <div className="flex flex-col items-center">
              {/* QR Code Image - Supports Base64 */}
              <div className="relative w-48 h-48 bg-white rounded-lg p-2 mb-4 overflow-hidden">
                {qrCode.startsWith('data:image') ? (
                  // Base64 QR Code from backend
                  <Image
                    src={qrCode}
                    alt="WhatsApp QR Code"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  // Raw base64 string (wrap it)
                  <Image
                    src={`data:image/png;base64,${qrCode}`}
                    alt="WhatsApp QR Code"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                )}
                {/* WhatsApp Logo Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <Badge
                variant="outline"
                className={`mb-4 bg-secondary ${countdown <= 10 ? 'border-warning text-warning' : ''}`}
              >
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
            </div>
          )}

          {/* Timeout - QR Expired */}
          {countdown === 0 && !isConnected && !error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-warning/10 mb-4">
                <RefreshCw className="w-8 h-8 text-warning" />
              </div>
              <p className="text-lg font-medium text-warning">QR Code Expired</p>
              <p className="text-sm text-muted-foreground mb-4">
                The QR code has timed out
              </p>
              <Button onClick={refresh} className="bg-primary text-primary-foreground">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh QR Code
              </Button>
            </div>
          )}
        </div>

        {/* Refresh button when QR is showing but not expired */}
        {qrCode && countdown > 0 && !isConnected && !error && (
          <div className="flex justify-center pb-4">
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Get New QR Code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
