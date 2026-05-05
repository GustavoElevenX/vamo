import { NextRequest, NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'VA'
}

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth

  const [postsResult, likesResult, badgesResult, missionsResult] = await Promise.all([
    adminClient
      .from('feed_posts')
      .select('*')
      .eq('organization_id', appUser.organization_id)
      .order('created_at', { ascending: false })
      .limit(30),
    adminClient
      .from('feed_likes')
      .select('post_id')
      .eq('user_id', appUser.id),
    adminClient
      .from('user_badges')
      .select('id, earned_at, users!inner(name), badges!inner(name, organization_id, xp_reward)')
      .eq('badges.organization_id', appUser.organization_id)
      .order('earned_at', { ascending: false })
      .limit(15),
    adminClient
      .from('ai_missions')
      .select('id, title, completed_at, xp_reward, users!inner(name)')
      .eq('organization_id', appUser.organization_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(15),
  ])

  if (postsResult.error) return NextResponse.json({ error: postsResult.error.message }, { status: 500 })

  const liked = new Set((likesResult.data ?? []).map((item: any) => item.post_id))
  const userIds = Array.from(new Set((postsResult.data ?? []).flatMap((post: any) => [post.author_id, post.target_user_id].filter(Boolean))))
  const { data: postUsers } = userIds.length
    ? await adminClient.from('users').select('id, name').in('id', userIds)
    : { data: [] as any[] }
  const userNameById = new Map((postUsers ?? []).map((item: any) => [item.id, item.name]))
  const events: any[] = []

  for (const post of postsResult.data ?? []) {
    const authorName = userNameById.get(post.author_id) ?? 'VAMO'
    const targetName = post.target_user_id ? userNameById.get(post.target_user_id) : null
    events.push({
      id: post.id,
      kind: 'post',
      type: post.type,
      user_name: authorName,
      user_initials: initials(authorName),
      description: targetName ? `reconheceu ${targetName}: "${post.content}"` : post.content,
      timestamp: post.created_at,
      xp: 0,
      likes_count: post.likes_count ?? 0,
      liked: liked.has(post.id),
    })
  }

  for (const badge of badgesResult.data ?? []) {
    const name = (badge as any).users?.name ?? 'Usuario'
    events.push({
      id: `badge-${(badge as any).id}`,
      kind: 'system',
      type: 'achievement',
      user_name: name,
      user_initials: initials(name),
      description: `conquistou o badge "${(badge as any).badges?.name}"`,
      timestamp: (badge as any).earned_at,
      xp: Number((badge as any).badges?.xp_reward ?? 0),
      likes_count: 0,
      liked: false,
    })
  }

  for (const mission of missionsResult.data ?? []) {
    const name = (mission as any).users?.name ?? 'Usuario'
    events.push({
      id: `mission-${(mission as any).id}`,
      kind: 'system',
      type: 'achievement',
      user_name: name,
      user_initials: initials(name),
      description: `concluiu a missao "${(mission as any).title}"`,
      timestamp: (mission as any).completed_at,
      xp: Number((mission as any).xp_reward ?? 0),
      likes_count: 0,
      liked: false,
    })
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ events: events.slice(0, 40) })
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth
  const input = await req.json()
  const content = String(input.content ?? '').trim()
  const type = ['recognition', 'celebration', 'milestone', 'achievement'].includes(input.type)
    ? input.type
    : 'recognition'

  if (!content) return NextResponse.json({ error: 'Conteudo obrigatorio' }, { status: 400 })

  const targetUserId = input.targetUserId ? String(input.targetUserId) : null
  if (type === 'recognition' && targetUserId && !['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem reconhecer outro usuario' }, { status: 403 })
  }

  const { data, error } = await adminClient
    .from('feed_posts')
    .insert({
      organization_id: appUser.organization_id,
      type,
      author_id: appUser.id,
      target_user_id: targetUserId,
      content,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminClient.from('system_logs').insert({
    organization_id: appUser.organization_id,
    level: 'info',
    source: 'feed',
    message: 'Novo post publicado no feed',
    metadata: { post_id: data.id, type, author_id: appUser.id, target_user_id: targetUserId },
  })

  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth
  const input = await req.json()
  const postId = String(input.postId ?? '')
  if (!postId) return NextResponse.json({ error: 'postId obrigatorio' }, { status: 400 })

  const { data: existing } = await adminClient
    .from('feed_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', appUser.id)
    .maybeSingle()

  if (existing) {
    await adminClient.from('feed_likes').delete().eq('id', existing.id)
  } else {
    await adminClient.from('feed_likes').insert({ post_id: postId, user_id: appUser.id })
  }

  const { count } = await adminClient
    .from('feed_likes')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)

  await adminClient
    .from('feed_posts')
    .update({ likes_count: count ?? 0 })
    .eq('id', postId)
    .eq('organization_id', appUser.organization_id)

  return NextResponse.json({ liked: !existing, likes_count: count ?? 0 })
}
