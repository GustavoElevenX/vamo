'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Medal, Gift, Swords } from 'lucide-react'
import { BADGE_RARITIES } from '@/lib/constants'
import type { Badge as BadgeType, RewardCatalog, Challenge, BadgeRarity } from '@/types'

export default function ConfigGamificacaoPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [badges, setBadges] = useState<BadgeType[]>([])
  const [rewards, setRewards] = useState<RewardCatalog[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  // Badge form
  const [badgeDialog, setBadgeDialog] = useState(false)
  const [badgeName, setBadgeName] = useState('')
  const [badgeDesc, setBadgeDesc] = useState('')
  const [badgeRarity, setBadgeRarity] = useState<string>('common')
  const [badgeXp, setBadgeXp] = useState('50')

  // Reward form
  const [rewardDialog, setRewardDialog] = useState(false)
  const [rewardName, setRewardName] = useState('')
  const [rewardDesc, setRewardDesc] = useState('')
  const [rewardCost, setRewardCost] = useState('100')
  const [rewardQty, setRewardQty] = useState('')

  // Challenge form
  const [challengeDialog, setChallengeDialog] = useState(false)
  const [challengeTitle, setChallengeTitle] = useState('')
  const [challengeDesc, setChallengeDesc] = useState('')
  const [challengeXp, setChallengeXp] = useState('200')
  const [challengeStart, setChallengeStart] = useState('')
  const [challengeEnd, setChallengeEnd] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [user])

  const fetchAll = async () => {
    if (!user) return
    const [{ data: b }, { data: r }, { data: c }] = await Promise.all([
      supabase.from('badges').select('*').eq('organization_id', user.organization_id).order('name'),
      supabase.from('rewards_catalog').select('*').eq('organization_id', user.organization_id).order('cost_xp'),
      supabase.from('challenges').select('*').eq('organization_id', user.organization_id).order('created_at', { ascending: false }),
    ])
    setBadges(b ?? [])
    setRewards(r ?? [])
    setChallenges(c ?? [])
    setLoading(false)
  }

  if (!user) return null

  const handleSaveBadge = async () => {
    if (!user || saving) return
    setSaving(true)
    await supabase.from('badges').insert({
      organization_id: user.organization_id,
      name: badgeName,
      description: badgeDesc,
      rarity: badgeRarity,
      xp_reward: parseInt(badgeXp),
      category: 'custom',
      criteria: {},
      active: true,
    })
    setSaving(false)
    setBadgeDialog(false)
    setBadgeName('')
    setBadgeDesc('')
    fetchAll()
  }

  const handleSaveReward = async () => {
    if (!user || saving) return
    setSaving(true)
    await supabase.from('rewards_catalog').insert({
      organization_id: user.organization_id,
      name: rewardName,
      description: rewardDesc,
      cost_xp: parseInt(rewardCost),
      quantity: rewardQty ? parseInt(rewardQty) : null,
      active: true,
    })
    setSaving(false)
    setRewardDialog(false)
    setRewardName('')
    setRewardDesc('')
    fetchAll()
  }

  const handleSaveChallenge = async () => {
    if (!user || saving) return
    setSaving(true)
    await supabase.from('challenges').insert({
      organization_id: user.organization_id,
      title: challengeTitle,
      description: challengeDesc,
      type: 'individual',
      criteria: {},
      xp_reward: parseInt(challengeXp),
      bonus_reward: 0,
      start_date: challengeStart,
      end_date: challengeEnd,
      active: true,
    })
    setSaving(false)
    setChallengeDialog(false)
    setChallengeTitle('')
    setChallengeDesc('')
    fetchAll()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configurar Gamificação</h2>
        <p className="text-muted-foreground">Badges, recompensas e desafios</p>
      </div>

      <Tabs defaultValue="badges">
        <TabsList>
          <TabsTrigger value="badges"><Medal className="mr-2 h-4 w-4" />Badges</TabsTrigger>
          <TabsTrigger value="rewards"><Gift className="mr-2 h-4 w-4" />Recompensas</TabsTrigger>
          <TabsTrigger value="challenges"><Swords className="mr-2 h-4 w-4" />Desafios</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={badgeDialog} onOpenChange={setBadgeDialog}>
              <DialogTrigger render={<Button />}>
                <Plus className="mr-2 h-4 w-4" />Novo Badge
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Badge</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={badgeName} onChange={(e) => setBadgeName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={badgeDesc} onChange={(e) => setBadgeDesc(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Raridade</Label>
                    <Select value={badgeRarity} onValueChange={(v) => v && setBadgeRarity(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(BADGE_RARITIES).map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>XP de Recompensa</Label>
                    <Input type="number" value={badgeXp} onChange={(e) => setBadgeXp(e.target.value)} />
                  </div>
                  <Button onClick={handleSaveBadge} disabled={!badgeName || saving} className="w-full">
                    {saving ? 'Salvando...' : 'Criar Badge'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Raridade</TableHead>
                    <TableHead>XP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {badges.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" style={{ borderColor: BADGE_RARITIES[b.rarity as BadgeRarity]?.color }}>
                          {BADGE_RARITIES[b.rarity as BadgeRarity]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>+{b.xp_reward}</TableCell>
                      <TableCell><Badge variant={b.active ? 'default' : 'secondary'}>{b.active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={rewardDialog} onOpenChange={setRewardDialog}>
              <DialogTrigger render={<Button />}>
                <Plus className="mr-2 h-4 w-4" />Nova Recompensa
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Recompensa</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={rewardName} onChange={(e) => setRewardName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={rewardDesc} onChange={(e) => setRewardDesc(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo em XP</Label>
                    <Input type="number" value={rewardCost} onChange={(e) => setRewardCost(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade (vazio = ilimitado)</Label>
                    <Input type="number" value={rewardQty} onChange={(e) => setRewardQty(e.target.value)} />
                  </div>
                  <Button onClick={handleSaveReward} disabled={!rewardName || saving} className="w-full">
                    {saving ? 'Salvando...' : 'Criar Recompensa'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Custo XP</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.cost_xp}</TableCell>
                      <TableCell>{r.quantity ?? '∞'}</TableCell>
                      <TableCell><Badge variant={r.active ? 'default' : 'secondary'}>{r.active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="challenges" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={challengeDialog} onOpenChange={setChallengeDialog}>
              <DialogTrigger render={<Button />}>
                <Plus className="mr-2 h-4 w-4" />Novo Desafio
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Desafio</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={challengeTitle} onChange={(e) => setChallengeTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={challengeDesc} onChange={(e) => setChallengeDesc(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>XP de Recompensa</Label>
                    <Input type="number" value={challengeXp} onChange={(e) => setChallengeXp(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input type="date" value={challengeStart} onChange={(e) => setChallengeStart(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input type="date" value={challengeEnd} onChange={(e) => setChallengeEnd(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleSaveChallenge} disabled={!challengeTitle || !challengeStart || !challengeEnd || saving} className="w-full">
                    {saving ? 'Salvando...' : 'Criar Desafio'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>XP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {challenges.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(c.start_date).toLocaleDateString('pt-BR')} - {new Date(c.end_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>+{c.xp_reward}</TableCell>
                      <TableCell><Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
