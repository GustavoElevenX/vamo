import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureSellerSetup } from '@/lib/services/seller-setup.service'

export async function POST(request: Request) {
  try {
    // Verify the requesting user is a manager or admin
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Use admin client to bypass RLS infinite recursion on users table
    const adminClient = createAdminClient()
    const { data: requestingUser } = await adminClient
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', authUser.id)
      .maybeSingle()

    if (!requestingUser || !['manager', 'admin'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Apenas gestores podem cadastrar vendedores' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Formato de email inválido. Use um email válido (ex: nome@empresa.com)' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }

    // Check if email already exists in this org
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('organization_id', requestingUser.organization_id)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: 'Este email já está cadastrado na sua equipe' }, { status: 409 })
    }

    // Create auth user with admin client (bypasses email confirmation)
    const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm, no need for email verification
    })

    if (authError || !newAuthUser.user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError?.message || 'Erro ao criar usuário' },
        { status: 400 }
      )
    }

    // Ensure users row has organization_id set + user_xp record exists
    const setup = await ensureSellerSetup(
      adminClient,
      newAuthUser.user.id,
      requestingUser.organization_id,
      name,
      email
    )

    if (!setup) {
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id)
      return NextResponse.json({ error: 'Erro ao configurar usuário no banco' }, { status: 500 })
    }

    return NextResponse.json({
      user: { id: setup.id, name, email, role: 'seller', active: true }
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    console.error('Invite error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
