import { NextRequest, NextResponse } from 'next/server'
import { whatsappInstanceSchema } from '@/lib/validations'
import {
  createWhatsAppInstance,
  listWhatsAppInstances,
} from '@/lib/whatsapp/store'

export async function GET() {
  return NextResponse.json(listWhatsAppInstances())
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = whatsappInstanceSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid instance payload',
        issues: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  try {
    const instance = await createWhatsAppInstance(parsed.data)
    return NextResponse.json(instance, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create instance' },
      { status: 400 }
    )
  }
}
