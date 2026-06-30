import type { Metadata } from 'next'
import OrderConfirmationPageClient from './page-client'

interface OrderConfirmationPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: OrderConfirmationPageProps): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Order ${id} confirmed`,
    description: 'Your SPLARO order has been placed successfully.',
  }
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { id } = await params
  return <OrderConfirmationPageClient orderId={id} />
}
