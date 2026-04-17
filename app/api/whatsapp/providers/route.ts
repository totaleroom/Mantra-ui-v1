import { NextResponse } from 'next/server'
import { whatsappProviders } from '@/lib/whatsapp/providers'

export async function GET() {
  return NextResponse.json(whatsappProviders)
}
