'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type VoiceState =
  | 'idle'         // no location active
  | 'waiting'      // at location, alone
  | 'peer_here'    // someone else is at the same location
  | 'mic_pending'  // browser mic permission dialog open
  | 'connecting'   // WebRTC handshake in progress
  | 'connected'    // audio link established
  | 'error'        // mic denied or connection failed

export interface Peer { token: string; name: string }

const ICE_CFG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Free TURN for NAT traversal (production: replace with your own)
    { urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject', credential: 'openrelayproject' },
  ],
}

export function useVoiceChat(
  channelKey: string | null,   // e.g. "williamsburg-aces_pizza"
  myToken:    string,
  myName:     string,
) {
  const [vs,          setVs]        = useState<VoiceState>('idle')
  const [peers,       setPeers]     = useState<Peer[]>([])
  const [activePeer,  setActive]    = useState<Peer | null>(null)
  const [talking,     setTalking]   = useState(false)
  const [peerTalking, setPeerTalk]  = useState(false)
  const [errMsg,      setErr]       = useState<string | null>(null)

  // Refs — safe to read inside async callbacks without stale closure issues
  const pcRef      = useRef<RTCPeerConnection | null>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const chRef      = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const peersRef   = useRef<Peer[]>([])
  const vsRef      = useRef<VoiceState>('idle')
  const myTkRef    = useRef(myToken)
  const myNameRef  = useRef(myName)

  useEffect(() => { peersRef.current  = peers  }, [peers])
  useEffect(() => { vsRef.current     = vs     }, [vs])
  useEffect(() => { myTkRef.current   = myToken  }, [myToken])
  useEffect(() => { myNameRef.current = myName   }, [myName])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const bcast = useCallback((payload: object) => {
    chRef.current?.send({ type: 'broadcast', event: 'voice', payload })
  }, [])

  const closePC = useCallback(() => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    if (audioRef.current) { audioRef.current.srcObject = null }
    setTalking(false)
    setPeerTalk(false)
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const getMic = async (): Promise<MediaStream | null> => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
        video: false,
      })
      // Start muted — push-to-talk
      s.getAudioTracks().forEach(t => { t.enabled = false })
      streamRef.current = s
      return s
    } catch (e) {
      const name = (e as Error).name
      setErr(name === 'NotAllowedError'
        ? 'Microphone access denied. Allow it in browser settings and try again.'
        : name === 'NotFoundError'
        ? 'No microphone found on this device.'
        : 'Could not access microphone.')
      setVs('error')
      return null
    }
  }

  const buildPC = (stream: MediaStream, peerId: string) => {
    const pc = new RTCPeerConnection(ICE_CFG)
    pcRef.current = pc

    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.onicecandidate = ({ candidate }) => {
      if (candidate)
        bcast({ type: 'ice', from: myTkRef.current, to: peerId, candidate: candidate.toJSON() })
    }

    pc.ontrack = ({ streams }) => {
      if (!audioRef.current) {
        const a = document.createElement('audio')
        a.autoplay = true
        audioRef.current = a
      }
      audioRef.current.srcObject = streams[0]
      audioRef.current.play().catch(() => {})
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected')  { setVs('connected') }
      if (pc.connectionState === 'failed')      { closePC(); setVs(peersRef.current.length ? 'peer_here' : 'waiting') }
      if (pc.connectionState === 'disconnected'){ closePC(); setVs(peersRef.current.length ? 'peer_here' : 'waiting'); setActive(null) }
    }

    return pc
  }

  // ── Channel lifecycle (re-runs when channelKey changes) ────────────────────
  useEffect(() => {
    if (!channelKey || !myToken) { setVs('idle'); return }

    setVs('waiting')
    setErr(null)

    const ch = supabase.channel(`voice:${channelKey}`, {
      config: { presence: { key: myToken } },
    })
    chRef.current = ch

    // ── Presence ──────────────────────────────────────────────────────────
    ch.on('presence', { event: 'sync' }, () => {
      const raw  = ch.presenceState<{ token: string; name: string }>()
      const list = (Object.values(raw) as { token: string; name: string }[][])
        .flat()
        .filter(p => p.token !== myTkRef.current)
        .map(p => ({ token: p.token, name: p.name }))
      setPeers(list)
      const cur = vsRef.current
      if (cur === 'idle' || cur === 'waiting' || cur === 'peer_here')
        setVs(list.length ? 'peer_here' : 'waiting')
    })

    // ── Signaling ─────────────────────────────────────────────────────────
    ch.on('broadcast', { event: 'voice' }, async ({ payload }: { payload: Record<string, unknown> }) => {
      const { type, from, to, offer, answer, candidate } = payload as {
        type: string; from: string; to?: string
        offer?: RTCSessionDescriptionInit
        answer?: RTCSessionDescriptionInit
        candidate?: RTCIceCandidateInit
      }
      if (from === myTkRef.current) return
      if (to && to !== myTkRef.current) return

      // ── Incoming offer ─────────────────────────────────────────────────
      if (type === 'offer' && offer) {
        const caller = peersRef.current.find(p => p.token === from) ?? { token: from, name: 'Someone' }
        setActive(caller)
        setVs('mic_pending')
        const stream = await getMic()
        if (!stream) return
        const pc = buildPC(stream, from)
        setVs('connecting')
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const ans = await pc.createAnswer()
        await pc.setLocalDescription(ans)
        bcast({ type: 'answer', from: myTkRef.current, to: from, answer: pc.localDescription })
      }

      if (type === 'answer' && answer && pcRef.current)
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {})

      if (type === 'ice' && candidate && pcRef.current)
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})

      if (type === 'ptt_on')  setPeerTalk(true)
      if (type === 'ptt_off') setPeerTalk(false)

      if (type === 'hangup') {
        closePC(); stopStream(); setActive(null)
        setVs(peersRef.current.length ? 'peer_here' : 'waiting')
      }
    })

    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED')
        await ch.track({ token: myToken, name: myName })
    })

    return () => {
      ch.unsubscribe()
      chRef.current = null
      closePC()
      stopStream()
      setVs('idle')
      setPeers([])
      setActive(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, myToken])

  // ── Public API ─────────────────────────────────────────────────────────────
  const startCall = useCallback(async (peer: Peer) => {
    setActive(peer)
    setVs('mic_pending')
    setErr(null)
    const stream = await getMic()
    if (!stream) return
    const pc = buildPC(stream, peer.token)
    setVs('connecting')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    bcast({ type: 'offer', from: myToken, to: peer.token, offer: pc.localDescription })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myToken, bcast])

  const hangup = useCallback(() => {
    bcast({ type: 'hangup', from: myToken })
    closePC(); stopStream(); setActive(null)
    setVs(peersRef.current.length ? 'peer_here' : 'waiting')
  }, [bcast, myToken, closePC, stopStream])

  const pttStart = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = true })
    setTalking(true)
    bcast({ type: 'ptt_on', from: myToken })
  }, [bcast, myToken])

  const pttEnd = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = false })
    setTalking(false)
    bcast({ type: 'ptt_off', from: myToken })
  }, [bcast, myToken])

  return { vs, peers, activePeer, talking, peerTalking, errMsg, startCall, hangup, pttStart, pttEnd }
}
