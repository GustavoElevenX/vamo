'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, Trophy, Target, ArrowRight, Zap } from 'lucide-react'

function VamoLogo({ className }: { className?: string }) {
  return (
    <img src="/logo.png" alt="Logo" className={className} />
  )
}

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

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12 vamo-hero-dark">
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)'
        }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="h-auto w-auto flex items-center justify-center">
              <VamoLogo className="h-9 object-contain" />
            </div>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
              Performance<br />
              que você<br />
              <span className="text-primary">consegue ver.</span>
            </h1>
            <p className="text-white/55 text-lg leading-relaxed max-w-sm">
              Engaje sua equipe comercial, acelere resultados e transforme cada meta em conquista.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Target, label: 'Diagnóstico inteligente', desc: 'Identifique gargalos e perdas em R$' },
              { icon: Trophy, label: 'Gamificação real', desc: 'XP, missões e rankings que motivam' },
              { icon: TrendingUp, label: 'ROI comprovado', desc: 'Média de 4.2× de retorno em 90 dias' },
              { icon: Zap, label: 'IA integrada', desc: 'Insights e missões geradas por IA' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-2xl bg-white/5 border border-primary/20 p-4 backdrop-blur-sm">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-white/50 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">© 2025 VAMO. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#111111]">
        <div className="w-full max-w-[380px] space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-auto w-auto flex items-center justify-center">
              <VamoLogo className="h-9 object-contain" />
            </div>
          </div>

          {/* Header */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-white">Bem-vindo de volta</h2>
            <p className="text-sm text-white/50">Entre com sua conta para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white/80">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-white/80">Senha</Label>
                <Link href="/esqueci-senha" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/25 px-3 py-2.5">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 vamo-gradient text-[#0A0A0A] font-semibold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity border-0"
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

          <p className="text-center text-sm text-white/40">
            Não tem conta?{' '}
            <Link href="/registro" className="text-primary font-semibold hover:text-primary/80 transition-colors">
              Fale com a VAMO
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
