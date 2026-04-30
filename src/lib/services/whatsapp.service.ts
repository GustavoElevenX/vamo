export async function sendWhatsApp(to: string, message: string) {
  if (!process.env.ZAPI_INSTANCE_ID || !process.env.ZAPI_TOKEN) {
    return { skipped: true, reason: 'Z-API not configured' }
  }

  const response = await fetch(
    `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: to, message }),
    }
  )

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Z-API error ${response.status}: ${JSON.stringify(data)}`)
  }
  return data
}
