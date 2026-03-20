'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Zap, TrendingUp, Trophy, Target, ArrowRight } from 'lucide-react'

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
    router.refresh()
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden motiva-gradient flex-col justify-between p-12">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-white/20 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-white/10 translate-x-1/4 translate-y-1/4" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-white/10 -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Zap className="h-5 w-5 text-white fill-white" />
            </div>
            <span className="text-2xl font-extrabold text-white tracking-tight">MOTIVA</span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
              Performance<br />
              que você<br />
              <span className="text-white/70">consegue ver.</span>
            </h1>
            <p className="text-white/80 text-lg leading-relaxed max-w-sm">
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
              <div key={label} className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-4">
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-white/65 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/50 text-xs">© 2025 MOTIVA. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-background">
        <div className="w-full max-w-[380px] space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-9 w-9 rounded-xl motiva-gradient flex items-center justify-center">
              <Zap className="h-5 w-5 text-white fill-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">MOTIVA</span>
          </div>

          {/* Header */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground">Entre com sua conta para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-white dark:bg-card border-border/70 focus:border-primary"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <Link href="/esqueci-senha" className="text-xs text-primary hover:underline font-medium">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-white dark:bg-card border-border/70 focus:border-primary"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2.5">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 motiva-gradient text-white font-semibold text-sm shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity border-0"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link href="/registro" className="text-primary font-semibold hover:underline">
              Fale com a MOTIVA
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
