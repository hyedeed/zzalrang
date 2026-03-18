import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) { setMessage('이메일과 비밀번호를 입력해주세요.'); return }
    setLoading(true); setMessage('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMessage(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 틀렸어요.' : error.message)
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setMessage(error.message)
        else setMessage('✅ 가입 완료! 이메일을 확인해주세요.')
      }
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fafafa', padding:16 }}>
      <div className="card fade-in" style={{ width:'100%', maxWidth:400, padding:'40px 32px' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/icon.png" alt="짤랑짤랑" style={{ width:96, height:96, objectFit:'contain', marginBottom:8 }} />
          <h1 style={{ fontSize:24, fontWeight:700, marginBottom:4 }}>짤랑짤랑</h1>
          <p style={{ color:'#9e9e9e', fontSize:14 }}>기록할수록 쌓여요</p>
        </div>

        {/* Tab */}
        <div className="chip-tabs" style={{ marginBottom:24 }}>
          <button className={`chip-tab ${mode==='login'?'active':''}`} onClick={()=>setMode('login')}>로그인</button>
          <button className={`chip-tab ${mode==='signup'?'active':''}`} onClick={()=>setMode('signup')}>회원가입</button>
        </div>

        {/* Form */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label className="label">이메일</label>
            <input className="input-field" type="email" placeholder="example@email.com"
              value={email} onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSubmit()} />
          </div>
          <div>
            <label className="label">비밀번호</label>
            <input className="input-field" type="password" placeholder="6자 이상"
              value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSubmit()} />
          </div>
          {message && (
            <div style={{ fontSize:13, color: message.startsWith('✅') ? '#4CAF50' : '#E15F5F',
              background: message.startsWith('✅') ? '#f0fff4' : '#fff5f5',
              padding:'10px 14px', borderRadius:8 }}>
              {message}
            </div>
          )}
          <button className="btn-primary" style={{ marginTop:8 }} onClick={handleSubmit} disabled={loading}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </div>
      </div>
    </div>
  )
}
