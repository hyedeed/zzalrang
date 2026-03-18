import { useState } from 'react'
import { supabase } from '../lib/supabase'
import HomeScreen from './HomeScreen'
import StatsScreen from './StatsScreen'
import AssetsScreen from './AssetsScreen'
import SearchScreen from './SearchScreen'
import SettingsScreen from './SettingsScreen'

const IconAsset = () => (
  <img src="/coin.png" alt="자산" style={{ width:24, height:24, objectFit:'contain' }} />
)
const IconStats = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/>
  </svg>
)
const IconHome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/>
  </svg>
)
const IconSearch = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
  </svg>
)
const IconSettings = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
)

const NAV = [
  { id: 'assets',   Icon: IconAsset },
  { id: 'stats',    Icon: IconStats },
  { id: 'home',     Icon: IconHome },
  { id: 'search',   Icon: IconSearch },
  { id: 'settings', Icon: IconSettings },
]

export default function MainLayout({ session }) {
  const [tab, setTab] = useState('home')

  return (
    <div style={{ maxWidth:480, margin:'0 auto', minHeight:'100vh', background:'#fff', display:'flex', flexDirection:'column' }}>
      <main style={{ flex:1, overflow:'auto', paddingBottom:60, paddingTop:8 }}>
        {tab === 'home'     && <HomeScreen session={session} />}
        {tab === 'stats'    && <StatsScreen session={session} />}
        {tab === 'assets'   && <AssetsScreen session={session} />}
        {tab === 'search'   && <SearchScreen session={session} />}
        {tab === 'settings' && <SettingsScreen session={session} />}
      </main>

      <nav style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:'#fff', borderTop:'1px solid #f0f0f0', display:'flex', zIndex:100, padding:'6px 0 8px' }}>
        {NAV.map(({ id, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex:1, background:'none', display:'flex', alignItems:'center', justifyContent:'center', color: tab===id ? '#000' : '#ccc', transition:'color 0.2s', padding:'6px 0' }}>
            <Icon />
          </button>
        ))}
      </nav>
    </div>
  )
}
