import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // 1. Get the authenticated user from the session (validates the JWT)
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 2. Use admin client (service_role) to bypass RLS and fetch user record
    const admin = createAdminClient()
    const { data: appUser, error: dbError } = await admin
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .maybeSingle()

    if (dbError) {
      console.error('[api/auth/me] DB error:', dbError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!appUser) {
      // Auto-create user if not found
      const name = authUser.user_metadata?.name || authUser.email || 'Usuário'
      const role = authUser.user_metadata?.role || 'admin'

      const { data: created, error: insertErr } = await admin
        .from('users')
        .insert({
          auth_id: authUser.id,
          name,
          email: authUser.email!,
          role,
        })
        .select()
        .maybeSingle()

      if (insertErr) {
        console.error('[api/auth/me] Insert error:', insertErr.message)
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
      }

      return NextResponse.json(created)
    }

    return NextResponse.json(appUser)
  } catch (err) {
    console.error('[api/auth/me] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
