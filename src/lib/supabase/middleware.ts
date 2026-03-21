import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() is needed to refresh session cookies server-side.
  // We wrap it with a timeout so it doesn't block forever on free tier.
  // If it times out, we let the request through — client-side auth handles it.
  let user = null
  let error = null as Error | null

  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 3000)),
    ])

    if (result === 'timeout') {
      // Let request through on timeout — client auth context will handle redirect
      return supabaseResponse
    }

    user = result.data.user
    error = result.error
  } catch {
    return supabaseResponse
  }

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/registro', '/auth/callback']
  const semiPublicRoutes = ['/onboarding']
  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )
  const isSemiPublic = semiPublicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // If getUser() returned an error (network issue, timeout, etc.),
  // DON'T redirect — let the request through and let client handle auth.
  if (error) {
    return supabaseResponse
  }

  if (!user && !isPublicRoute && !isSemiPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user && isSemiPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isPublicRoute && request.nextUrl.pathname !== '/auth/callback') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
