'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/')
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(() => {
      router.replace('/')
    })
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="opacity-60 text-sm">Signing you in…</p>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="opacity-60 text-sm">Signing you in…</p>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
