'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTodaysPuzzleIndex } from '@/lib/puzzles'
import { useAuth } from '@/lib/useAuth'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function getOrCreateToken() {
  let token = localStorage.getItem('soulmate_token')
  if (!token) {
    token = makeUUID()
    localStorage.setItem('soulmate_token', token)
  }
  return token
}

export default function Home() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState<'create' | 'join' | 'quick' | 'explore' | null>(null)
  const [error, setError] = useState('')
  const { user, loading: authLoading, signIn, signOut } = useAuth()
  const [showSignIn, setShowSignIn] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authSent, setAuthSent] = useState(false)
  const [authLoading2, setAuthLoading2] = useState(false)

  const handleSignIn = async () => {
    if (!authEmail.trim()) return
    setAuthLoading2(true)
    await signIn(authEmail.trim())
    setAuthLoading2(false)
    setAuthSent(true)
  }

  const handleCreate = async () => {
    setLoading('create')
    setError('')
    const token = getOrCreateToken()
    const code = generateCode()
    const puzzleIndex = getTodaysPuzzleIndex()

    const { error: err } = await supabase.from('rooms').insert({
      code,
      player_a: token,
      puzzle_index: puzzleIndex,
      answers: {},
      status: 'waiting',
    })

    if (err) {
      setError('Something went wrong. Try again.')
      setLoading(null)
      return
    }

    router.push(`/game/${code}`)
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setLoading('join')
    setError('')

    const code = joinCode.trim().toUpperCase()
    const { data, error: err } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()

    if (err || !data) {
      setError('Room not found. Check the code and try again.')
      setLoading(null)
      return
    }

    router.push(`/game/${code}`)
  }

  const handleDemo = () => {
    router.push('/game/demo')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Auth banner */}
        {!authLoading && (
          <div>
            {user ? (
              <div
                className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <span className="text-sm opacity-70">👤 {user.email}</span>
                <button
                  onClick={() => signOut()}
                  className="text-xs px-3 py-1 rounded-lg font-medium"
                  style={{ background: 'var(--border)', color: 'var(--foreground)' }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div>
                {!showSignIn ? (
                  <button
                    onClick={() => setShowSignIn(true)}
                    className="w-full text-sm py-2 rounded-xl text-center opacity-60 hover:opacity-80 transition-opacity"
                    style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)' }}
                  >
                    🔐 Sign in for cross-device sync
                  </button>
                ) : authSent ? (
                  <div
                    className="px-4 py-3 rounded-xl text-center text-sm"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    ✉️ Check your email!
                  </div>
                ) : (
                  <div
                    className="flex flex-col gap-2 px-4 py-3 rounded-xl"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-xs opacity-60">Enter your email to get a magic link</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                        className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                        style={{
                          background: 'var(--background)',
                          border: '1px solid var(--border)',
                          color: 'var(--foreground)',
                        }}
                      />
                      <button
                        onClick={handleSignIn}
                        disabled={authLoading2 || !authEmail.trim()}
                        className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: 'var(--purple)' }}
                      >
                        {authLoading2 ? '…' : 'Send'}
                      </button>
                    </div>
                    <button
                      onClick={() => setShowSignIn(false)}
                      className="text-xs opacity-40 hover:opacity-60 text-left"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-3">🏡</div>
          <h1 className="text-3xl font-bold tracking-tight">Soulmate</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--rose-dark)' }}>
            A place your relationship lives.
          </p>
        </div>

        {/* Create Game */}
        <div
          className="rounded-2xl p-6 flex flex-col gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <h2 className="font-semibold text-base">Start today&apos;s game</h2>
          <p className="text-sm opacity-60">Create a room and share the code with your partner.</p>
          <button
            onClick={handleCreate}
            disabled={loading !== null}
            className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--purple)' }}
          >
            {loading === 'create' ? 'Creating…' : 'Create Game'}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs opacity-40">or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Join Game */}
        <div
          className="rounded-2xl p-6 flex flex-col gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <h2 className="font-semibold text-base">Join a game</h2>
          <p className="text-sm opacity-60">Enter the code your partner shared with you.</p>
          <input
            type="text"
            placeholder="XXXXXX"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={6}
            className="w-full px-4 py-3 rounded-xl text-center text-lg font-mono tracking-widest outline-none"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <button
            onClick={handleJoin}
            disabled={loading !== null || !joinCode.trim()}
            className="w-full py-3 rounded-xl font-semibold transition-opacity disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--rose)', color: 'var(--foreground)' }}
          >
            {loading === 'join' ? 'Joining…' : 'Join Game'}
          </button>
        </div>

        {/* Demo Mode */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleDemo}
            disabled={loading !== null}
            className="w-full py-3 rounded-xl font-semibold transition-opacity disabled:opacity-50 cursor-pointer"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              opacity: loading !== null ? undefined : 0.7,
            }}
          >
            🧪 Demo Mode
          </button>
          <p className="text-center text-xs opacity-40">No account needed — runs locally</p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs opacity-40">explore</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Explore */}
        <button
          onClick={() => { setLoading('explore'); router.push('/explore') }}
          disabled={loading !== null}
          className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer"
          style={{ background: '#1a2a4a' }}
        >
          {loading === 'explore' ? 'Loading…' : '✨ Explore Williamsburg'}
        </button>

        {error && (
          <p className="text-center text-sm" style={{ color: 'var(--rose-dark)' }}>
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
