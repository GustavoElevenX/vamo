import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Ensures a seller's users and user_xp rows are correctly set up in the DB.
 *
 * The Supabase trigger `handle_new_user` creates a `users` row on auth.users INSERT,
 * but WITHOUT organization_id. This function guarantees:
 * 1. The `users` row has organization_id, name, role, active set correctly
 * 2. A `user_xp` row exists with the correct organization_id
 *
 * Call this after `adminClient.auth.admin.createUser()` or `updateUserById()`.
 */
export async function ensureSellerSetup(
  adminClient: SupabaseClient,
  authUserId: string,
  orgId: string,
  name: string,
  email: string
): Promise<{ id: string } | null> {
  // Step 1: Try to update the existing row (created by trigger, org_id may be null)
  const { data: updated } = await adminClient
    .from('users')
    .update({ organization_id: orgId, name, email, role: 'seller', active: true })
    .eq('auth_id', authUserId)
    .select('id')
    .maybeSingle()

  let userId: string | null = updated?.id ?? null

  // Step 2: If no row existed yet (trigger hasn't fired or failed), insert directly
  if (!userId) {
    const { data: inserted } = await adminClient
      .from('users')
      .insert({ auth_id: authUserId, organization_id: orgId, name, email, role: 'seller', active: true })
      .select('id')
      .maybeSingle()
    userId = inserted?.id ?? null
  }

  if (!userId) return null

  // Step 3: Ensure user_xp record exists (upsert using composite PK)
  await adminClient
    .from('user_xp')
    .upsert(
      {
        user_id: userId,
        organization_id: orgId,
        total_xp: 0,
        current_level: 1,
        current_streak: 0,
        longest_streak: 0,
      },
      { onConflict: 'user_id,organization_id' }
    )

  return { id: userId }
}
