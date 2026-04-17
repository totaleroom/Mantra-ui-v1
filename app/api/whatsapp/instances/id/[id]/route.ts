import { NextRequest, NextResponse } from 'next/server'
import {
  deleteWhatsAppInstance,
  getWhatsAppInstanceById,
  updateWhatsAppInstance,
} from '@/lib/whatsapp/store'

function parseId(id: string) {
  const value = Number(id)
  return Number.isFinite(value) ? value : null
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const parsedId = parseId(id)
  if (parsedId === null) {
    return NextResponse.json({ error: 'Invalid instance id' }, { status: 400 })
  }

  const instance = getWhatsAppInstanceById(parsedId)
  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
  }

  return NextResponse.json(instance)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const parsedId = parseId(id)
  if (parsedId === null) {
    return NextResponse.json({ error: 'Invalid instance id' }, { status: 400 })
  }

  const body = await request.json()
  const instance = updateWhatsAppInstance(parsedId, body)
  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
  }

  return NextResponse.json(instance)
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const parsedId = parseId(id)
  if (parsedId === null) {
    return NextResponse.json({ error: 'Invalid instance id' }, { status: 400 })
  }

  const deleted = deleteWhatsAppInstance(parsedId)
  if (!deleted) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
