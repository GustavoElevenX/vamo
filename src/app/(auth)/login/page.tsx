'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, Trophy, Target, ArrowRight, Zap, Shield } from 'lucide-react'

function VamoLogo({ className }: { className?: string }) {
  return <img src="/logo.png" alt="Logo" className={className} />
}

const features = [
  {
    icon: Target,
    label: 'Diagnóstico inteligente',
    desc: 'Identifique gargalos e perdas em R$',
  },
  {
    icon: Trophy,
    label: 'Gamificação real',
    desc: 'XP, missões e rankings que motivam',
  },
  {
    icon: TrendingUp,
    label: 'ROI comprovado',
    desc: 'Média de 4.2× de retorno em 90 dias',
  },
  {
    icon: Zap,
    label: 'VAMO IA integrada',
    desc: 'Insights e missões geradas por VAMO IA',
  },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (res.ok) {
        const appUser = await res.json()
        if (appUser && !appUser.error) {
          try { localStorage.setItem('vamo_cached_user', JSON.stringify(appUser)) } catch { /* ignore */ }
        }
      }
    } catch { /* non-critical */ }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-dvh flex">

      {/* ── Left — Branding Panel ── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12 vamo-hero-dark">
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#fff 0px,#fff 1px,transparent 1px,transparent 48px),repeating-linear-gradient(90deg,#fff 0px,#fff 1px,transparent 1px,transparent 48px)',
          }}
        />
        {/* Radial green glow */}
        <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full bg-primary opacity-[0.06] blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <VamoLogo className="h-9 object-contain" />
        </div>

        {/* Copy */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-5">
            <h1 className="text-[3.25rem] font-black text-white leading-[1.05] tracking-tight">
              Performance<br />
              que você<br />
              <span className="text-primary">consegue ver.</span>
            </h1>
            <p className="text-white/50 text-[17px] leading-relaxed max-w-sm">
              Engaje sua equipe comercial, acelere resultados e transforme cada meta em conquista.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-2xl bg-white/4 border border-primary/15 p-4 backdrop-blur-sm hover:bg-white/6 hover:border-primary/25 transition-all duration-200 group"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[13px] font-bold text-white leading-tight">{label}</p>
                <p className="text-[12px] text-white/45 mt-1 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2">
          <Shield className="h-3 w-3 text-white/20" />
          <p className="text-white/25 text-xs">© 2025 VAMO. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* ── Right — Form Panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#0d0d0d]">
        <div className="w-full max-w-[380px] space-y-8 animate-fade-in-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <VamoLogo className="h-9 object-contain" />
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-white">Bem-vindo de volta</h2>
            <p className="text-sm text-white/40">Entre com sua conta para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-semibold text-white/70">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/60 focus:ring-primary/15 transition-colors rounded-xl"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-semibold text-white/70">
                  Senha
                </Label>
                <Link
                  href="/esqueci-senha"
                  className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/60 focus:ring-primary/15 transition-colors rounded-xl"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-3.5 py-2.5">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 vamo-gradient text-[#0A0A0A] font-bold text-sm rounded-xl shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all duration-150 border-0"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Entrar na plataforma
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-white/30">
            Não tem conta?{' '}
            <Link href="/registro" className="text-primary font-bold hover:text-primary/80 transition-colors">
              Fale com a VAMO
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
