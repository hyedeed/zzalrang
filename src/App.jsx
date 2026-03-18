import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import { processRecurringRecords } from './lib/recurringUtils'
import AuthPage from './pages/AuthPage'
import MainLayout from './pages/MainLayout'

export const AppContext = createContext(null)

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      // 로그인 상태면 반복내역 자동 처리
      if (session?.user?.id) {
        processRecurringRecords(session.user.id).catch(console.error)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user?.id) {
        processRecurringRecords(session.user.id).catch(console.error)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <img src="/icon.png" alt="짤랑짤랑" style={{ width:64, height:64, objectFit:'contain' }} />
      <div style={{ color:'#999', fontSize:14 }}>짤랑짤랑 불러오는 중...</div>
    </div>
  )

  return session ? <MainLayout session={session} /> : <AuthPage />
}
