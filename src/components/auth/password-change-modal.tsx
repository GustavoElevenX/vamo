'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserResponse } from '@supabase/supabase-js'
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export function PasswordChangeModal() {
  const [show, setShow] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Check if current user needs to change password (set by AI when creating the seller)
    const supabase = createClient()
    supabase.auth.getUser().then((res: UserResponse) => {
      if (res.data?.user?.user_metadata?.needs_password_change === true) {
        setShow(true)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { needs_password_change: false },
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => setShow(false), 2000)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <ShieldCheck className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="font-semibold text-foreground">Senha alterada com sucesso!</p>
            <p className="text-sm text-muted-foreground">Bem-vindo à plataforma VAMO.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col items-center gap-2 mb-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Crie sua senha</h2>
              <p className="text-sm text-muted-foreground">
                Este é seu primeiro acesso. Defina uma senha pessoal para continuar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nova senha */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Nova senha</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Confirmar senha</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Força da senha */}
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength(password) >= i
                            ? i <= 1 ? 'bg-red-500' : i <= 2 ? 'bg-amber-500' : i <= 3 ? 'bg-blue-500' : 'bg-emerald-500'
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {['', 'Fraca', 'Regular', 'Boa', 'Forte'][passwordStrength(password)]}
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : 'Definir senha e entrar'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function passwordStrength(pwd: string): number {
  let score = 0
  if (pwd.length >= 6) score++
  if (pwd.length >= 10) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++
  return score
}
