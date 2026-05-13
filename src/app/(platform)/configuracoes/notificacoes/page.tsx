'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Bell, Mail, MessageSquare, Save } from 'lucide-react'

type Prefs = {
  email_enabled: boolean
  whatsapp_enabled: boolean
  whatsapp_number: string
  notify_deal_stuck: boolean
  notify_daily_digest: boolean
  notify_deal_closed: boolean
  notify_ranking_change: boolean
  digest_hour_utc: number
}

const defaults: Prefs = {
  email_enabled: true,
  whatsapp_enabled: false,
  whatsapp_number: '',
  notify_deal_stuck: true,
  notify_daily_digest: true,
  notify_deal_closed: true,
  notify_ranking_change: false,
  digest_hour_utc: 10,
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(defaults)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then((res) => res.json())
      .then((body) => {
        if (body.preferences) setPrefs({ ...defaults, ...body.preferences, whatsapp_number: body.preferences.whatsapp_number || '' })
      })
      .catch(() => {})
  }, [])

  function patch(next: Partial<Prefs>) {
    setPrefs((current) => ({ ...current, ...next }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaving(false)
    setSaved(res.ok)
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Notificacoes</h1>
        <p className="text-sm text-muted-foreground">Configure como a VAMO avisa sobre rotina comercial e oportunidades em risco.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Canal preferido</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => patch({ email_enabled: true, whatsapp_enabled: false })}
            className={`rounded-lg border p-4 text-left ${prefs.email_enabled && !prefs.whatsapp_enabled ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <Mail className="mb-2 h-5 w-5" />
            <span className="font-medium">E-mail</span>
          </button>
          <button
            type="button"
            onClick={() => patch({ email_enabled: false, whatsapp_enabled: true })}
            className={`rounded-lg border p-4 text-left ${prefs.whatsapp_enabled && !prefs.email_enabled ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <MessageSquare className="mb-2 h-5 w-5" />
            <span className="font-medium">WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => patch({ email_enabled: false, whatsapp_enabled: false })}
            className={`rounded-lg border p-4 text-left ${!prefs.email_enabled && !prefs.whatsapp_enabled ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <Bell className="mb-2 h-5 w-5" />
            <span className="font-medium">Nenhum</span>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>WhatsApp</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="whatsapp">Número com DDI</Label>
          <Input id="whatsapp" value={prefs.whatsapp_number} onChange={(e) => patch({ whatsapp_number: e.target.value })} placeholder="+5511999999999" />
          <p className="text-xs text-muted-foreground">O envio depende da configuração do provedor WhatsApp no ambiente.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tipos de aviso</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            ['notify_daily_digest', 'Digest diario'],
            ['notify_deal_stuck', 'oportunidades parados'],
            ['notify_deal_closed', 'Fechamento realizado'],
            ['notify_ranking_change', 'Mudanca no ranking'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <span className="text-sm font-medium">{label}</span>
              <input
                type="checkbox"
                checked={!!prefs[key as keyof Prefs]}
                onChange={(event) => patch({ [key]: event.target.checked } as Partial<Prefs>)}
                className="h-4 w-4 accent-primary"
              />
            </label>
          ))}
          <div className="space-y-2">
            <Label htmlFor="digest-hour">Horario do digest</Label>
            <select
              id="digest-hour"
              value={prefs.digest_hour_utc}
              onChange={(event) => patch({ digest_hour_utc: Number(event.target.value) })}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value={10}>7h Brasilia</option>
              <option value={11}>8h Brasilia</option>
              <option value={12}>9h Brasilia</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar preferencias'}</Button>
        {saved && <Badge variant="secondary">Preferencias salvas</Badge>}
      </div>
    </div>
  )
}
