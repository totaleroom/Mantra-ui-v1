import { NextRequest, NextResponse } from 'next/server'
import { getWhatsAppInstanceByName } from '@/lib/whatsapp/store'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ instanceName: string }> }
) {
  const { instanceName } = await context.params
  const instance = getWhatsAppInstanceByName(instanceName)

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
  }

  return NextResponse.json({ status: instance.status })
}
