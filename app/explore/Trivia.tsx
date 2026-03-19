'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = 'intro' | 'question' | 'p2_handoff' | 'reveal' | 'results'

interface TriviaQ {
  type: 'trivia'
  text: string
  options: string[]
  answer: number
  category: string
}
interface TorTQ {
  type: 'tort'
  text: string
  a: string
  b: string
}
type Question = TriviaQ | TorTQ

// ── Question bank ─────────────────────────────────────────────────────────────

const TRIVIA: TriviaQ[] = [
  { type:'trivia', category:'📺 Sitcoms',
    text:"What was Sam Malone's profession before owning Cheers?",
    options:['Football coach','Baseball pitcher','Ice hockey goalie','Basketball player'], answer:1 },
  { type:'trivia', category:'📺 Sitcoms',
    text:"What is the name of the bar in How I Met Your Mother?",
    options:['The Anchor','Paddy\'s Pub','MacLaren\'s Pub','Monk\'s Café'], answer:2 },
  { type:'trivia', category:'📺 Sitcoms',
    text:"In It's Always Sunny, what is the gang's bar called?",
    options:['Paddy\'s Pub','The Dive','Danny\'s Den','South Philly Bar'], answer:0 },
  { type:'trivia', category:'📺 Sitcoms',
    text:"In Friends, what is the name of the coffee shop?",
    options:['The Grind','Java House','Central Perk','Café Moondance'], answer:2 },
  { type:'trivia', category:'📺 Sitcoms',
    text:"In Brooklyn Nine-Nine, who always orders a Miller High Life?",
    options:['Rosa','Charles','Amy','Jake'], answer:3 },
  { type:'trivia', category:'📺 Sitcoms',
    text:"In New Girl, what's the name of the bar below the loft?",
    options:['The Spot','Drink','Nick\'s','The Griffin'], answer:3 },
  { type:'trivia', category:'🍹 Drinks',
    text:"What spirit is the base of a classic Margarita?",
    options:['Vodka','Rum','Tequila','Gin'], answer:2 },
  { type:'trivia', category:'🍹 Drinks',
    text:"A Dark 'n' Stormy is made with dark rum and what mixer?",
    options:['Cola','Tonic water','Ginger beer','Lemonade'], answer:2 },
  { type:'trivia', category:'🍹 Drinks',
    text:"What makes a Guinness stout dark in colour?",
    options:['Food colouring','Coffee extract','Roasted barley','Dark hops'], answer:2 },
  { type:'trivia', category:'🍹 Drinks',
    text:"Which Italian city is most famous for aperitivo culture?",
    options:['Rome','Milan','Florence','Naples'], answer:1 },
  { type:'trivia', category:'🍹 Drinks',
    text:"What does a 'flight' mean on a drinks menu?",
    options:['Happy hour deal','A small tasting selection','A round for the table','A secret menu item'], answer:1 },
  { type:'trivia', category:'🌍 World',
    text:"Which country invented karaoke?",
    options:['South Korea','Philippines','China','Japan'], answer:3 },
  { type:'trivia', category:'🌍 World',
    text:"What does 'Cheers' translate to in German?",
    options:['Prost','Salud','Santé','Skål'], answer:0 },
  { type:'trivia', category:'🎵 Music',
    text:"'Piano Man' — a classic bar song — is by which artist?",
    options:['Elton John','Bruce Springsteen','Billy Joel','Tom Waits'], answer:2 },
  { type:'trivia', category:'🎵 Music',
    text:"What band wrote 'Mr. Brightside', a staple of every pub jukebox?",
    options:['Arctic Monkeys','The Killers','Interpol','Franz Ferdinand'], answer:1 },
]

const TORT: TorTQ[] = [
  { type:'tort', text:'Which are you?',        a:'Night owl 🌙',        b:'Early bird 🌅'       },
  { type:'tort', text:'Drink of choice:',      a:'Coffee ☕',            b:'Tea 🍵'              },
  { type:'tort', text:'Weekend plan:',         a:'Stay in 🛋️',           b:'Go out 🌃'           },
  { type:'tort', text:'Snack preference:',     a:'Sweet 🍰',             b:'Savoury 🧀'          },
  { type:'tort', text:'Pet person:',           a:'Dog 🐶',               b:'Cat 🐱'              },
  { type:'tort', text:'Holiday style:',        a:'Beach 🏖️',             b:'Mountains ⛰️'       },
  { type:'tort', text:'Movie night pick:',     a:'Horror 👻',            b:'Comedy 😂'           },
  { type:'tort', text:'How you communicate:',  a:'Text 💬',              b:'Call 📞'             },
  { type:'tort', text:'Ideal dinner:',         a:'Cook at home 🍳',      b:'Restaurant 🍽️'      },
  { type:'tort', text:'Social setting:',       a:'Big party 🎉',         b:'Cozy dinner for 2 🕯️'},
  { type:'tort', text:'Season vibe:',          a:'Summer ☀️',            b:'Winter ❄️'           },
  { type:'tort', text:'First date energy:',    a:'Coffee & chat ☕',     b:'Drinks & dancing 🍸' },
]

function makeRound(): Question[] {
  const tv = [...TRIVIA].sort(() => Math.random()-.5).slice(0,5)
  const tt = [...TORT].sort(()  => Math.random()-.5).slice(0,5)
  // interleave
  const out: Question[] = []
  for (let i=0;i<5;i++) { out.push(tv[i]); out.push(tt[i]) }
  return out
}

// ── Ghost pixel data ──────────────────────────────────────────────────────────

const GBODY = [
  [0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],[1,1,0,0,1,0,0,1,1],[1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],[1,0,1,0,1,0,1,0,1],
]
const GEYES = new Set(['4-2','4-3','4-5','4-6'])
const GPX   = 3

function Soul({ name, color, darkMode, msg, flip=false }: {
  name:string; color:string; darkMode:boolean; msg:string|null; flip?:boolean
}) {
  const [t, setT] = useState(Math.random()*6)
  const raf = useRef<number>(0)
  useEffect(() => {
    let time = t
    const step = () => { time+=0.032; setT(time); raf.current=requestAnimationFrame(step) }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  const bob=Math.sin(t)*5
  const rx =Math.sin(t*.65)*11
  const ry =Math.cos(t*.45)*16
  const sc =1+Math.sin(t*.9)*.04
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:64,minHeight:78}}>
      <div style={{height:24,display:'flex',alignItems:'center',justifyContent:'center',width:'100%'}}>
        {msg&&<div style={{
          background:darkMode?'#241c36':'#fff',
          color:darkMode?'#f0e0ff':'#1a0a2a',
          borderRadius:8,padding:'3px 7px',fontSize:8,whiteSpace:'nowrap',lineHeight:1.4,
          boxShadow:'0 2px 10px rgba(0,0,0,0.4)',border:`1px solid ${color}55`,
          maxWidth:110,textAlign:'center',
        }}>{msg}</div>}
      </div>
      <div style={{
        transform:`perspective(160px) rotateX(${rx}deg) rotateY(${flip?-ry:ry}deg) translateY(${bob}px) scale(${sc})`,
        filter:`drop-shadow(0 6px 14px ${color}99) drop-shadow(0 0 8px ${color}44)`,
        willChange:'transform',
      }}>
        <svg width={9*GPX} height={8*GPX} style={{imageRendering:'pixelated',display:'block'}}>
          {GBODY.map((row,gy)=>row.map((cell,gx)=>{
            if(!cell)return null
            const k=`${gy}-${gx}`
            const eye=GEYES.has(k), shi=gy===2&&(gx===3||gx===4)
            return <rect key={k} x={gx*GPX} y={gy*GPX} width={GPX} height={GPX}
              fill={eye?(darkMode?'#1a0826':'#0d001a'):shi?'rgba(255,255,255,0.45)':color}/>
          }))}
        </svg>
      </div>
      <div style={{marginTop:3,fontSize:8,fontWeight:700,color,letterSpacing:'0.06em',
        textShadow:'0 1px 4px rgba(0,0,0,0.9)'}}>{name}</div>
    </div>
  )
}

// ── Bar backdrop ──────────────────────────────────────────────────────────────

const LIGHT_COLORS = ['#ffdd88','#ff9944','#ff6644','#ffeeaa','#88ddff','#cc88ff','#ff88aa','#aaffcc']
const BOTTLES = [
  {h:42,w:7,c:'#8a1a1a',neck:6},{h:50,w:8,c:'#2a5a2a',neck:7},
  {h:38,w:6,c:'#4a3a8a',neck:5},{h:46,w:7,c:'#8a6a1a',neck:6},
  {h:54,w:9,c:'#1a4a5a',neck:7},{h:40,w:7,c:'#6a2a4a',neck:6},
  {h:44,w:7,c:'#3a5a1a',neck:5},{h:48,w:8,c:'#8a3a1a',neck:7},
  {h:36,w:6,c:'#2a2a6a',neck:5},{h:52,w:8,c:'#5a1a1a',neck:7},
  {h:42,w:7,c:'#1a5a3a',neck:6},{h:45,w:7,c:'#6a5a1a',neck:5},
]

function BarBackdrop() {
  const [on, setOn] = useState<boolean[]>(LIGHT_COLORS.map(()=>true).concat(LIGHT_COLORS.map(()=>true)))
  useEffect(()=>{
    const id=setInterval(()=>{
      setOn(prev=>prev.map(v=>Math.random()<.07?!v:v))
    },700)
    return()=>clearInterval(id)
  },[])

  return (
    <div style={{
      position:'absolute',inset:0,overflow:'hidden',
      background:'linear-gradient(180deg,#120800 0%,#1e0e04 40%,#2a1408 70%,#1a0c06 100%)',
    }}>
      {/* Ambient floor glow */}
      <div style={{
        position:'absolute',bottom:0,left:'10%',right:'10%',height:120,
        background:'radial-gradient(ellipse at 50% 100%, rgba(180,80,10,0.18) 0%, transparent 70%)',
        pointerEvents:'none',
      }}/>

      {/* Back wall wood paneling lines */}
      {[0,1,2,3,4,5].map(i=>(
        <div key={i} style={{
          position:'absolute',top:0,bottom:0,
          left:`${i*18}%`,width:1,
          background:'rgba(255,160,60,0.04)',
        }}/>
      ))}

      {/* Bottle shelf — back row */}
      <div style={{
        position:'absolute',top:52,left:0,right:0,
        display:'flex',justifyContent:'center',alignItems:'flex-end',gap:4,
        paddingBottom:0,
      }}>
        {/* Shelf plank */}
        <div style={{
          position:'absolute',bottom:-4,left:16,right:16,height:5,
          background:'linear-gradient(180deg,#6a3a10 0%,#3a1a04 100%)',
          borderRadius:2,boxShadow:'0 2px 8px rgba(0,0,0,0.5)',
        }}/>
        {BOTTLES.map((b,i)=>(
          <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',position:'relative'}}>
            {/* Neck */}
            <div style={{width:b.neck/2,height:b.neck,background:`${b.c}cc`,borderRadius:'2px 2px 0 0'}}/>
            {/* Body */}
            <div style={{
              width:b.w,height:b.h,
              background:`linear-gradient(135deg,${b.c}ff 0%,${b.c}88 50%,${b.c}cc 100%)`,
              borderRadius:'2px 2px 1px 1px',
              boxShadow:`inset 1px 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.5)`,
            }}/>
          </div>
        ))}
      </div>

      {/* String lights */}
      <div style={{
        position:'absolute',top:14,left:0,right:0,
        display:'flex',justifyContent:'space-around',paddingInline:8,
        alignItems:'center',
      }}>
        {/* Wire */}
        <div style={{position:'absolute',top:6,left:0,right:0,height:1,background:'rgba(80,40,10,0.6)'}}/>
        {on.map((lit,i)=>{
          const c=LIGHT_COLORS[i%LIGHT_COLORS.length]
          return (
            <div key={i} style={{
              width:7,height:10,position:'relative',display:'flex',flexDirection:'column',alignItems:'center',
            }}>
              {/* Socket */}
              <div style={{width:2,height:3,background:'#553322'}}/>
              {/* Bulb */}
              <div style={{
                width:7,height:7,borderRadius:'50% 50% 40% 40%',
                background: lit?c:'#2a1a0a',
                boxShadow: lit?`0 0 6px ${c}, 0 0 12px ${c}88`:'none',
                transition:'all 0.3s',
              }}/>
            </div>
          )
        })}
      </div>

      {/* Bar counter bottom */}
      <div style={{
        position:'absolute',bottom:0,left:0,right:0,height:22,
        background:'linear-gradient(180deg,#3a1e08 0%,#2a1404 100%)',
        borderTop:'2px solid #5a2e0c',
        boxShadow:'inset 0 1px 0 rgba(255,160,60,0.12)',
      }}>
        {/* Counter shine */}
        <div style={{
          position:'absolute',top:0,left:'5%',right:'5%',height:1,
          background:'rgba(255,180,80,0.2)',
        }}/>
      </div>

      {/* Side beer tap left */}
      <div style={{position:'absolute',bottom:22,left:18,display:'flex',flexDirection:'column',alignItems:'center',gap:0}}>
        <div style={{width:5,height:22,background:'linear-gradient(180deg,#888 0%,#444 100%)',borderRadius:3}}/>
        <div style={{width:12,height:5,background:'#555',borderRadius:2}}/>
      </div>

      {/* Side beer tap right */}
      <div style={{position:'absolute',bottom:22,right:18,display:'flex',flexDirection:'column',alignItems:'center',gap:0}}>
        <div style={{width:5,height:22,background:'linear-gradient(180deg,#888 0%,#444 100%)',borderRadius:3}}/>
        <div style={{width:12,height:5,background:'#555',borderRadius:2}}/>
      </div>
    </div>
  )
}

// ── Neon sign ─────────────────────────────────────────────────────────────────

function NeonSign({ flicker }: { flicker: boolean }) {
  const [on, setOn] = useState(true)
  useEffect(()=>{
    if(!flicker)return
    const id=setInterval(()=>{
      if(Math.random()<.04) {
        setOn(false)
        setTimeout(()=>setOn(true),80+Math.random()*120)
      }
    },600)
    return()=>clearInterval(id)
  },[flicker])
  return (
    <div style={{
      textAlign:'center',fontSize:16,fontWeight:900,
      letterSpacing:'0.12em',
      color: on?'#ff9922':'#3a1a04',
      textShadow: on
        ? '0 0 4px #fff8,0 0 10px #ff9922,0 0 22px #ff9922,0 0 40px #ff6600'
        : 'none',
      transition:'color 0.05s,text-shadow 0.05s',
      fontFamily:'monospace',
      userSelect:'none',
    }}>
      🍺 TRIVIA NIGHT 🍺
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  locationName:  string
  locationColor: string
  darkMode:      boolean
  onClose:       () => void
}

const YOU_CORRECT  = ['Nailed it! 🎉','Yes!! ✨','That\'s my brain 🧠','Easy 😎','Knew it! 💪']
const YOU_WRONG    = ['Oof 😬','Nooo 😅','I knew that... almost','Brainfreeze 🥶','Next time!']
const YOU_MATCH    = ['Same! 💕','Twins!! 🥰','So compatible 😍','WE MATCH 🎊']
const YOU_NOMATCH  = ['Opposites attract? 😅','Interesting... 🤔','Different vibes lol','We balance each other out!']
const CPU_CORRECT  = ['I knew it. 🤖','Classic. ♟','Predictable.','Processing... correct.']
const CPU_WRONG    = ['Irrelevant. I let you win.','...miscalculation.','Recalibrating 🔄','Error 404 🫥']
const CPU_MATCH    = ['We think alike 🤖💕','Compatible! 🎯','Same wavelength.','Matched!']
const CPU_NOMATCH  = ['Diversity of thought.','Opposites. Interesting.','We complement each other.']

function pick(arr:string[]){return arr[Math.floor(Math.random()*arr.length)]}

export default function Trivia({ locationName, locationColor, darkMode, onClose }: Props) {
  const [mode,       setMode]     = useState<'solo'|'2p'>('solo')
  const [screen,     setScreen]   = useState<Screen>('intro')
  const [questions,  setQs]       = useState<Question[]>([])
  const [qIdx,       setQIdx]     = useState(0)
  const [p1Answer,   setP1]       = useState<number|null>(null)
  const [p2Answer,   setP2]       = useState<number|null>(null)
  const [cpuAnswer,  setCpu]      = useState<number|null>(null)
  const [score,      setScore]    = useState({ you:0, them:0 })
  const [youMsg,     setYouMsg]   = useState<string|null>(null)
  const [themMsg,    setThemMsg]  = useState<string|null>(null)
  const [thinking,   setThinking] = useState(false)

  const flash = useCallback((set:(v:string|null)=>void, msg:string, ms=2800) => {
    set(msg); setTimeout(()=>set(null),ms)
  },[])

  const currentQ = questions[qIdx]

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback(()=>{
    const qs = makeRound()
    setQs(qs); setQIdx(0); setScore({you:0,them:0})
    setP1(null); setP2(null); setCpu(null)
    setScreen('question')
  },[])

  // ── Player 1 answers ─────────────────────────────────────────────────────
  const handleP1 = useCallback((idx:number)=>{
    if(p1Answer!==null||thinking)return
    setP1(idx)

    if(mode==='2p') {
      setTimeout(()=>setScreen('p2_handoff'),400)
    } else {
      // Solo: CPU picks after delay
      setThinking(true)
      flash(setThemMsg,'Calculating... 🤖',1600)
      setTimeout(()=>{
        const q = questions[qIdx]
        let cpuPick:number
        if(q.type==='trivia'){
          // CPU: ~55% chance to get it right
          cpuPick = Math.random()<.55 ? q.answer : (q.answer+1+Math.floor(Math.random()*(q.options.length-1)))%q.options.length
        } else {
          cpuPick = Math.floor(Math.random()*2)
        }
        setCpu(cpuPick)
        setThinking(false)
        setTimeout(()=>revealAnswers(idx, null, cpuPick),200)
      },900+Math.random()*600)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[p1Answer,thinking,mode,questions,qIdx])

  // ── Player 2 answers ─────────────────────────────────────────────────────
  const handleP2 = useCallback((idx:number)=>{
    if(p2Answer!==null)return
    setP2(idx)
    setTimeout(()=>revealAnswers(p1Answer!, idx, null),300)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[p2Answer,p1Answer])

  // ── Reveal logic ─────────────────────────────────────────────────────────
  const revealAnswers = useCallback((a1:number, a2:number|null, cpu:number|null)=>{
    const q = questions[qIdx]
    let youPts=0, themPts=0

    if(q.type==='trivia'){
      if(a1===q.answer) {
        youPts=10; flash(setYouMsg,pick(YOU_CORRECT))
      } else {
        flash(setYouMsg,pick(YOU_WRONG))
      }
      const themAns = a2??cpu??0
      if(themAns===q.answer){
        themPts=10; flash(setThemMsg,pick(CPU_CORRECT))
      } else {
        flash(setThemMsg,pick(CPU_WRONG))
      }
    } else {
      // this-or-that
      const themAns = a2??cpu??0
      if(a1===themAns){
        youPts=15; themPts=15
        flash(setYouMsg,pick(YOU_MATCH))
        flash(setThemMsg,pick(CPU_MATCH))
      } else {
        flash(setYouMsg,pick(YOU_NOMATCH))
        flash(setThemMsg,pick(CPU_NOMATCH))
      }
    }
    setScore(s=>({you:s.you+youPts, them:s.them+themPts}))
    setScreen('reveal')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[questions,qIdx])

  // ── Next question ────────────────────────────────────────────────────────
  const nextQ = useCallback(()=>{
    if(qIdx+1>=questions.length){ setScreen('results'); return }
    setQIdx(i=>i+1)
    setP1(null); setP2(null); setCpu(null)
    setThinking(false)
    setScreen('question')
  },[qIdx,questions.length])

  const reset = useCallback(()=>{
    setScreen('intro'); setP1(null); setP2(null); setCpu(null)
    setScore({you:0,them:0}); setThinking(false)
  },[])

  // ── Colors ───────────────────────────────────────────────────────────────
  const overlay   = 'rgba(10,5,0,0.72)'
  const chalkBg   = 'rgba(18,36,18,0.96)'
  const chalkBdr  = '#2a5a2a'
  const chalkText = '#e8f8e0'
  const dimText   = 'rgba(200,255,180,0.55)'
  const btnBase   = { borderRadius:10, cursor:'pointer', fontWeight:700 as const, fontSize:13,
                      border:'none', transition:'all 0.15s', padding:'10px 0',
                      WebkitTapHighlightColor:'transparent' }
  const answerColors = ['#cc4422','#2255cc','#228844','#bb8800']

  const opponentName = mode==='solo' ? 'CPU' : 'P2'
  const opponentColor = '#5588cc'

  // ── Result emoji ─────────────────────────────────────────────────────────
  const resultLine = () => {
    const diff = score.you - score.them
    if(diff>20)   return { line:'You dominated! 🏆', emoji:'🥇' }
    if(diff>0)    return { line:'You win! Nice one 🎉', emoji:'🥳' }
    if(diff===0)  return { line:'It\'s a tie! 🤝', emoji:'🤝' }
    if(diff>-20)  return { line:'Close one! You lost 😅', emoji:'😬' }
    return { line:'Crushed! Better luck next round.', emoji:'💀' }
  }

  return (
    <div
      style={{position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.88)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:'10px 10px'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose()}}
    >
      <div style={{
        width:'100%',maxWidth:360,borderRadius:20,overflow:'hidden',position:'relative',
        border:`1px solid ${locationColor}33`,
        boxShadow:`0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px ${locationColor}22`,
        maxHeight:'92vh',overflowY:'auto',
      }}>

        {/* ── Bar backdrop ── */}
        <BarBackdrop/>

        {/* ── All content on top ── */}
        <div style={{position:'relative',zIndex:2}}>

          {/* Header */}
          <div style={{
            padding:'36px 14px 8px',  // top padding clears string lights
            display:'flex',alignItems:'flex-end',justifyContent:'space-between',
            background:'transparent',
          }}>
            <NeonSign flicker={screen!=='intro'}/>
            <button onClick={onClose} style={{
              flexShrink:0,marginLeft:8,width:26,height:26,borderRadius:'50%',
              background:'rgba(40,20,10,0.7)',border:'1px solid rgba(255,120,30,0.3)',
              cursor:'pointer',fontSize:12,color:'#e8c090',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>✕</button>
          </div>

          {/* Soul strip */}
          <div style={{
            display:'flex',justifyContent:'space-between',alignItems:'flex-end',
            padding:'4px 16px 0',
            background:overlay,
            borderBottom:'1px solid rgba(100,50,10,0.4)',
          }}>
            <Soul name="You"           color="#8844cc" darkMode={true} msg={youMsg} />
            <div style={{textAlign:'center',paddingBottom:6}}>
              <div style={{fontSize:10,color:'#a07050',fontWeight:700}}>
                {screen==='results' ? '📊 Final' : `Q ${Math.min(qIdx+1,questions.length)} / ${questions.length}`}
              </div>
              <div style={{fontSize:11,color:'#e8c080',marginTop:2,fontWeight:700}}>
                {score.you} – {score.them}
              </div>
            </div>
            <Soul name={opponentName}  color={opponentColor} darkMode={true} msg={themMsg} flip/>
          </div>

          {/* ══ INTRO SCREEN ══ */}
          {screen==='intro' && (
            <div style={{background:overlay,padding:'20px 18px 18px'}}>
              <div style={{
                background:chalkBg,border:`2px solid ${chalkBdr}`,borderRadius:12,
                padding:'18px 16px',marginBottom:14,
                boxShadow:'inset 0 0 40px rgba(0,30,0,0.3)',
              }}>
                <p style={{color:chalkText,fontSize:14,fontWeight:700,marginBottom:6,textAlign:'center'}}>
                  Welcome to Trivia Night!
                </p>
                <p style={{color:dimText,fontSize:11,lineHeight:1.6,textAlign:'center'}}>
                  10 questions — trivia rounds + 'This or That' preference comparisons.{'\n'}
                  See how well you know your partner.
                </p>
                <div style={{marginTop:12,display:'flex',gap:8,justifyContent:'center'}}>
                  <div style={{fontSize:10,color:'#88cc88',background:'rgba(0,80,0,0.3)',
                    borderRadius:8,padding:'4px 10px',border:'1px solid #2a5a2a'}}>
                    ✅ Trivia correct = 10 pts
                  </div>
                  <div style={{fontSize:10,color:'#dd88cc',background:'rgba(80,0,60,0.3)',
                    borderRadius:8,padding:'4px 10px',border:'1px solid #5a2a4a'}}>
                    💕 T-or-T match = 15 pts
                  </div>
                </div>
              </div>

              {/* Mode toggle */}
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                {(['solo','2p'] as const).map(m=>(
                  <button key={m} onClick={()=>setMode(m)} style={{
                    ...btnBase,flex:1,fontSize:11,
                    background: mode===m ? locationColor+'44' : 'rgba(30,15,5,0.8)',
                    border: `1px solid ${mode===m ? locationColor+'88' : 'rgba(100,50,10,0.5)'}`,
                    color: mode===m ? '#f0e0c0' : '#806040',
                  }}>{m==='solo'?'🤖 vs CPU':'👥 2 Players'}</button>
                ))}
              </div>

              <button onClick={startGame} style={{
                ...btnBase,width:'100%',fontSize:14,
                background:`linear-gradient(135deg,${locationColor}cc,${locationColor}88)`,
                color:'#fff',boxShadow:`0 4px 20px ${locationColor}66`,
              }}>🎤 Start Trivia Night</button>
            </div>
          )}

          {/* ══ QUESTION SCREEN ══ */}
          {(screen==='question'||screen==='p2_handoff') && currentQ && (
            <div style={{background:overlay,padding:'14px 16px 18px'}}>
              {screen==='p2_handoff' ? (
                /* Handoff card */
                <div style={{
                  background:'rgba(20,10,5,0.9)',border:'2px solid rgba(180,100,20,0.4)',
                  borderRadius:14,padding:'22px 16px',textAlign:'center',
                }}>
                  <div style={{fontSize:28,marginBottom:8}}>🔄</div>
                  <p style={{color:'#f0d0a0',fontSize:14,fontWeight:700,marginBottom:4}}>Pass to Player 2</p>
                  <p style={{color:'rgba(200,150,80,0.6)',fontSize:11,marginBottom:18}}>
                    Don&apos;t show them your answer!
                  </p>
                  <button onClick={()=>setScreen('question')} style={{
                    ...btnBase,padding:'10px 28px',fontSize:13,
                    background:`linear-gradient(135deg,${locationColor}cc,${locationColor}88)`,
                    color:'#fff',
                  }}>Ready — show question</button>
                </div>
              ) : (
                <>
                  {/* Category badge */}
                  <div style={{textAlign:'center',marginBottom:8}}>
                    <span style={{
                      fontSize:10,fontWeight:700,letterSpacing:'0.06em',
                      background:'rgba(30,60,30,0.7)',color:'#88cc88',
                      borderRadius:20,padding:'3px 10px',border:'1px solid #2a5a2a',
                    }}>
                      {currentQ.type==='trivia' ? (currentQ as TriviaQ).category : '🔄 This or That'}
                    </span>
                  </div>

                  {/* Chalkboard question */}
                  <div style={{
                    background:chalkBg,border:`2px solid ${chalkBdr}`,borderRadius:12,
                    padding:'16px',marginBottom:14,
                    boxShadow:'inset 0 0 40px rgba(0,30,0,0.3), 0 4px 16px rgba(0,0,0,0.5)',
                  }}>
                    {/* Chalk tray decoration */}
                    <div style={{
                      height:3,borderRadius:2,marginBottom:12,
                      background:'linear-gradient(90deg,transparent,rgba(200,255,180,0.12),transparent)',
                    }}/>
                    <p style={{
                      color:chalkText,fontSize:13,fontWeight:600,lineHeight:1.55,textAlign:'center',
                      textShadow:'0 1px 3px rgba(0,0,0,0.5)',
                    }}>
                      {currentQ.text}
                    </p>
                    <div style={{
                      height:3,borderRadius:2,marginTop:12,
                      background:'linear-gradient(90deg,transparent,rgba(200,255,180,0.12),transparent)',
                    }}/>
                  </div>

                  {/* Thinking indicator */}
                  {thinking && <p style={{color:'#a090d0',fontSize:10,textAlign:'center',marginBottom:8}}>
                    CPU is thinking... ⏳
                  </p>}

                  {/* Answer buttons */}
                  {currentQ.type==='trivia' ? (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      {(currentQ as TriviaQ).options.map((opt,i)=>(
                        <button key={i} onClick={()=>!thinking&&handleP1(i)} style={{
                          ...btnBase,
                          padding:'10px 8px',
                          background: p1Answer===i
                            ? answerColors[i]+'dd'
                            : `${answerColors[i]}33`,
                          border:`1px solid ${answerColors[i]}${p1Answer===i?'ee':'66'}`,
                          color: p1Answer===i ? '#fff' : '#d8c8a8',
                          fontSize:11,
                          opacity: thinking&&p1Answer===null ? 0.5 : 1,
                          transform: p1Answer===i ? 'scale(0.97)' : 'scale(1)',
                        }}>{opt}</button>
                      ))}
                    </div>
                  ) : (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                      {[(currentQ as TorTQ).a,(currentQ as TorTQ).b].map((opt,i)=>(
                        <button key={i} onClick={()=>!thinking&&handleP1(i)} style={{
                          ...btnBase,
                          padding:'14px 8px',fontSize:13,
                          background: p1Answer===i
                            ? (i===0?'#8844ccdd':'#cc4488dd')
                            : (i===0?'#8844cc33':'#cc448833'),
                          border:`2px solid ${i===0?'#8844cc':'#cc4488'}${p1Answer===i?'ee':'55'}`,
                          color:'#f0e0ff',
                          opacity: thinking&&p1Answer===null ? 0.5 : 1,
                          transform: p1Answer===i ? 'scale(0.96)' : 'scale(1)',
                        }}>{opt}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ REVEAL SCREEN ══ */}
          {screen==='reveal' && currentQ && (
            <div style={{background:overlay,padding:'14px 16px 18px'}}>
              {/* Chalkboard question echo */}
              <div style={{
                background:chalkBg,border:`2px solid ${chalkBdr}`,borderRadius:12,
                padding:'10px 14px',marginBottom:12,
                boxShadow:'inset 0 0 30px rgba(0,30,0,0.3)',
              }}>
                <p style={{color:dimText,fontSize:10,textAlign:'center'}}>{currentQ.text}</p>
              </div>

              {currentQ.type==='trivia' ? (
                /* Trivia reveal */
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  {(currentQ as TriviaQ).options.map((opt,i)=>{
                    const correct  = i===(currentQ as TriviaQ).answer
                    const youPick  = p1Answer===i
                    const themPick = (mode==='solo' ? cpuAnswer : p2Answer)===i
                    let bg=`rgba(40,20,10,0.6)`, bdr=`rgba(100,50,10,0.4)`, col='#806040'
                    if(correct)    { bg='rgba(20,80,20,0.7)'; bdr='#44aa44'; col='#aaffaa' }
                    if(youPick&&!correct) { bg='rgba(100,20,20,0.7)'; bdr='#cc4444'; col='#ffaaaa' }
                    return (
                      <div key={i} style={{
                        borderRadius:10,padding:'8px',background:bg,
                        border:`1px solid ${bdr}`,fontSize:11,color:col,textAlign:'center',
                        position:'relative',
                      }}>
                        {opt}
                        <div style={{marginTop:4,display:'flex',justifyContent:'center',gap:4,fontSize:10}}>
                          {youPick  && <span>👻 You</span>}
                          {themPick && <span>🤖 {opponentName}</span>}
                          {correct  && <span>✓</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* This-or-T reveal */
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  {[(currentQ as TorTQ).a,(currentQ as TorTQ).b].map((opt,i)=>{
                    const youPick  = p1Answer===i
                    const themPick = (mode==='solo'?cpuAnswer:p2Answer)===i
                    const match    = youPick&&themPick
                    return (
                      <div key={i} style={{
                        borderRadius:10,padding:'12px 8px',textAlign:'center',fontSize:13,
                        background: match ? 'rgba(80,20,80,0.7)' : youPick||themPick ? 'rgba(40,40,80,0.6)' : 'rgba(20,10,5,0.5)',
                        border:`2px solid ${match?'#cc44cc88':youPick||themPick?'#4444cc88':'rgba(60,30,10,0.3)'}`,
                        color: match ? '#f0a0ff' : youPick||themPick ? '#b0b0ff' : '#604030',
                      }}>
                        {opt}
                        <div style={{marginTop:5,fontSize:11,display:'flex',gap:4,justifyContent:'center'}}>
                          {youPick  && <span>👻 You</span>}
                          {themPick && <span>{mode==='solo'?'🤖':'👥'} {opponentName}</span>}
                        </div>
                        {match&&<div style={{fontSize:9,color:'#ffaaff',marginTop:3}}>💕 MATCH!</div>}
                      </div>
                    )
                  })}
                </div>
              )}

              <button onClick={nextQ} style={{
                ...btnBase,width:'100%',fontSize:13,
                background:`linear-gradient(135deg,${locationColor}bb,${locationColor}77)`,
                color:'#fff',padding:'11px 0',
              }}>
                {qIdx+1<questions.length ? `Next question →` : '📊 See results'}
              </button>
            </div>
          )}

          {/* ══ RESULTS SCREEN ══ */}
          {screen==='results' && (()=>{
            const {line,emoji} = resultLine()
            return (
              <div style={{background:overlay,padding:'18px 16px 20px'}}>
                <div style={{
                  background:chalkBg,border:`2px solid ${chalkBdr}`,borderRadius:14,
                  padding:'20px 16px',textAlign:'center',marginBottom:14,
                  boxShadow:'inset 0 0 40px rgba(0,30,0,0.3)',
                }}>
                  <div style={{fontSize:36,marginBottom:8}}>{emoji}</div>
                  <p style={{color:chalkText,fontSize:15,fontWeight:700,marginBottom:4}}>{line}</p>
                  <div style={{display:'flex',justifyContent:'center',gap:20,marginTop:12}}>
                    <div>
                      <div style={{fontSize:24,fontWeight:900,color:'#cc88ff'}}>{score.you}</div>
                      <div style={{fontSize:9,color:dimText}}>You</div>
                    </div>
                    <div style={{fontSize:20,color:dimText,paddingTop:4}}>vs</div>
                    <div>
                      <div style={{fontSize:24,fontWeight:900,color:'#88aaff'}}>{score.them}</div>
                      <div style={{fontSize:9,color:dimText}}>{opponentName}</div>
                    </div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <button onClick={reset} style={{
                    ...btnBase,fontSize:12,padding:'10px 0',
                    background:'rgba(40,20,8,0.8)',border:'1px solid rgba(150,80,20,0.4)',
                    color:'#c08040',
                  }}>↺ Play again</button>
                  <button onClick={onClose} style={{
                    ...btnBase,fontSize:12,padding:'10px 0',
                    background:`linear-gradient(135deg,${locationColor}bb,${locationColor}77)`,
                    color:'#fff',
                  }}>Back to map</button>
                </div>
              </div>
            )
          })()}

          {/* Bottom bar counter clearance */}
          <div style={{height:22,background:'transparent'}}/>
        </div>
      </div>
    </div>
  )
}
