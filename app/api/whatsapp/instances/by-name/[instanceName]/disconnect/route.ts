import { NextRequest, NextResponse } from 'next/server'
import { disconnectWhatsAppInstance } from '@/lib/whatsapp/store'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ instanceName: string }> }
) {
  const { instanceName } = await context.params
  const instance = await disconnectWhatsAppInstance(instanceName)

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, instance })
}
