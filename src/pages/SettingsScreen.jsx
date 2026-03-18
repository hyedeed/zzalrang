import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function SettingsScreen({ session }) {
  const uid = session.user.id
  const [tab, setTab] = useState('category')
  const [categories, setCategories] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [assets, setAssets] = useState([])
  const [budgets, setBudgets] = useState([])
  const [recurring, setRecurring] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    const [{ data: cats }, { data: curr }, { data: ast }, { data: bud }, { data: rec }, { data: pays }] = await Promise.all([
      supabase.from('category_items').select('*').eq('user_id', uid),
      supabase.from('currencies').select('*').eq('user_id', uid),
      supabase.from('assets').select('*').eq('user_id', uid),
      supabase.from('budgets').select('*').eq('user_id', uid),
      supabase.from('recurring_records').select('*').eq('user_id', uid),
      supabase.from('payment_methods').select('*').eq('user_id', uid),
    ])
    setCategories(cats || [])
    setCurrencies(curr || [])
    setAssets(ast || [])
    setBudgets(bud || [])
    setRecurring(rec || [])
    setPaymentMethods(pays || [])
  }, [uid])

  useEffect(() => { load() }, [load])

  // CSV 내보내기
  const exportCSV = async () => {
    const { data: records } = await supabase.from('records').select('*').eq('user_id', uid).order('date', { ascending: false })
    if (!records?.length) { alert('내역이 없어요!'); return }
    const header = '날짜,분류,카테고리,금액,통화,메모'
    const rows = records.map(r => `${r.date},${r.type==='income'?'수입':r.type==='expense'?'지출':'이체'},${r.category},${r.amount},${r.currency_code},"${r.memo||''}"`)
    const csv = '\uFEFF' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `짤랑짤랑_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // CSV 가져오기
  const importCSV = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)

    try {
      const text = await file.text()
      // BOM 제거
      const cleaned = text.startsWith('\uFEFF') ? text.slice(1) : text
      const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)

      if (lines.length < 2) { setImportResult({ error: '내역이 없는 파일이에요.' }); return }

      // 헤더 파싱
      const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      // 지원 컬럼 매핑 (짤랑짤랑 내보내기 형식 + 일반 형식)
      const findCol = (names) => names.reduce((found, n) => found !== -1 ? found : header.findIndex(h => h.includes(n)), -1)
      const dateIdx   = findCol(['날짜', 'date', 'Date'])
      const typeIdx   = findCol(['분류', 'type', '수입지출'])
      const catIdx    = findCol(['카테고리', 'category'])
      const amtIdx    = findCol(['금액', 'amount', '금액(원)'])
      const currIdx   = findCol(['통화', 'currency', 'Currency'])
      const memoIdx   = findCol(['메모', 'memo', 'note'])

      if (dateIdx === -1 || amtIdx === -1) {
        setImportResult({ error: '날짜, 금액 컬럼을 찾을 수 없어요.\n컬럼명을 확인해주세요.' })
        return
      }

      let added = 0, skipped = 0, errors = 0
      const toInsert = []

      for (let i = 1; i < lines.length; i++) {
        try {
          // 쉼표 안에 따옴표 처리
          const cols = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || lines[i].split(',').map(c=>c.trim())

          const dateRaw = cols[dateIdx] || ''
          const typeRaw = cols[typeIdx] || '지출'
          const cat     = cols[catIdx]  || '기타'
          const amtRaw  = cols[amtIdx]  || '0'
          const curr    = currIdx !== -1 ? (cols[currIdx] || 'KRW') : 'KRW'
          const memo    = memoIdx !== -1 ? (cols[memoIdx] || '') : ''

          // 날짜 파싱 (yyyy-mm-dd, yyyy/mm/dd, yyyy.mm.dd 지원)
          const dateStr = dateRaw.replace(/[./]/g, '-').slice(0, 10)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { errors++; continue }

          // 금액 파싱 (쉼표, 원화 기호 제거)
          const amount = parseFloat(amtRaw.replace(/[,₩$\s]/g, ''))
          if (isNaN(amount) || amount <= 0) { errors++; continue }

          // 분류 파싱
          let type = 'expense'
          if (typeRaw.includes('수입') || typeRaw.toLowerCase().includes('income')) type = 'income'
          else if (typeRaw.includes('이체') || typeRaw.toLowerCase().includes('transfer')) type = 'transfer'

          toInsert.push({
            user_id: uid, type, amount, date: dateStr,
            category: type === 'transfer' ? '이체' : cat,
            currency_code: curr, asset_id: null, memo: memo || null
          })
        } catch { errors++ }
      }

      // 중복 체크 후 삽입
      if (toInsert.length > 0) {
        const { data: existing } = await supabase.from('records').select('date,amount,category,type').eq('user_id', uid)
        const existingSet = new Set((existing||[]).map(r=>`${r.date}_${r.amount}_${r.category}_${r.type}`))

        const newRecords = toInsert.filter(r => {
          const key = `${r.date}_${r.amount}_${r.category}_${r.type}`
          if (existingSet.has(key)) { skipped++; return false }
          return true
        })

        if (newRecords.length > 0) {
          await supabase.from('records').insert(newRecords)
          added = newRecords.length
        }
      }

      setImportResult({ added, skipped, errors })
    } catch (err) {
      setImportResult({ error: `파일 읽기 실패: ${err.message}` })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const TABS = [
    { id:'category',  label:'카테고리' },
    { id:'currency',  label:'통화' },
    { id:'budget',    label:'예산' },
    { id:'recurring', label:'반복내역' },
  ]

  return (
    <div style={{ padding:'16px' }} className="fade-in">
      <div style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>설정</div>

      <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:20, paddingBottom:4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'8px 14px', borderRadius:20, fontSize:13, whiteSpace:'nowrap', flexShrink:0, transition:'all 0.15s',
              background: tab===t.id ? '#424242' : '#f5f5f5',
              color: tab===t.id ? '#fff' : '#666',
              fontWeight: tab===t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'category'  && <CategoryManager uid={uid} categories={categories} onChanged={load} />}
      {tab === 'currency'  && <CurrencyManager uid={uid} currencies={currencies} onChanged={load} />}
      {tab === 'budget'    && <BudgetManager uid={uid} budgets={budgets} categories={categories} currencies={currencies} onChanged={load} />}
      {tab === 'recurring' && <RecurringManager uid={uid} recurring={recurring} categories={categories} currencies={currencies} assets={assets} paymentMethods={paymentMethods} onChanged={load} />}

      {/* 하단 */}
      <div style={{ marginTop:32, display:'flex', flexDirection:'column', gap:10 }}>

        {/* CSV 내보내기 */}
        <button onClick={exportCSV}
          style={{ display:'flex', alignItems:'center', gap:12, padding:'15px 16px', background:'#f5f5f5', borderRadius:12, width:'100%', textAlign:'left' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#424242" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:'#424242' }}>CSV 내보내기</div>
            <div style={{ fontSize:12, color:'#bbb' }}>전체 내역을 엑셀로 저장</div>
          </div>
        </button>

        {/* CSV 가져오기 */}
        <div style={{ background:'#f5f5f5', borderRadius:12, overflow:'hidden' }}>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={importCSV} style={{ display:'none' }} />
          <button onClick={()=>fileInputRef.current?.click()} disabled={importing}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'15px 16px', background:'none', width:'100%', textAlign:'left', cursor:'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#424242" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:'#424242' }}>
                {importing ? 'CSV 불러오는 중...' : 'CSV 가져오기'}
              </div>
              <div style={{ fontSize:12, color:'#bbb' }}>기존 가계부 파일을 불러와요</div>
            </div>
          </button>

          {/* 결과 표시 */}
          {importResult && (
            <div style={{ padding:'12px 16px', borderTop:'1px solid #ebebeb' }}>
              {importResult.error ? (
                <div style={{ fontSize:13, color:'var(--color-expense)' }}>❌ {importResult.error}</div>
              ) : (
                <div style={{ fontSize:13, color:'#424242' }}>
                  ✅ <strong>{importResult.added}건</strong> 추가됨
                  {importResult.skipped > 0 && <span style={{ color:'#bbb' }}> · {importResult.skipped}건 중복 건너뜀</span>}
                  {importResult.errors > 0 && <span style={{ color:'#E15F5F' }}> · {importResult.errors}건 오류</span>}
                </div>
              )}
            </div>
          )}

          {/* 형식 안내 */}
          <div style={{ padding:'10px 16px 14px', borderTop: importResult ? '1px solid #ebebeb' : 'none' }}>
            <div style={{ fontSize:11, color:'#bbb', lineHeight:1.6 }}>
              지원 형식: 날짜, 분류(수입/지출), 카테고리, 금액, 통화, 메모<br/>
              날짜 형식: 2024-01-01 / 2024.01.01 / 2024/01/01<br/>
              중복 내역은 자동으로 건너뛰어요
            </div>
          </div>
        </div>

        <div style={{ padding:'15px 16px', background:'#f5f5f5', borderRadius:12 }}>
          <div style={{ fontSize:12, color:'#bbb', marginBottom:4 }}>로그인 계정</div>
          <div style={{ fontSize:14, color:'#424242' }}>{session.user.email}</div>
        </div>
        <button onClick={() => supabase.auth.signOut()}
          style={{ padding:'15px 16px', background:'#fff', border:'1px solid #f0f0f0', borderRadius:12, width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E15F5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span style={{ fontSize:14, fontWeight:500, color:'#E15F5F' }}>로그아웃</span>
        </button>
      </div>
    </div>
  )
}

/* ─── 카테고리 관리 ─── */
function CategoryManager({ uid, categories, onChanged }) {
  const [typeTab, setTypeTab] = useState('expense')
  const [newName, setNewName] = useState('')
  const filtered = categories.filter(c => c.type === typeTab)
  const toggleHide = async (c) => { await supabase.from('category_items').update({ is_hidden:!c.is_hidden }).eq('id', c.id); onChanged() }
  const add = async () => {
    if (!newName.trim()) return
    await supabase.from('category_items').insert({ user_id:uid, type:typeTab, name:newName.trim(), is_hidden:false })
    setNewName(''); onChanged()
  }
  const del = async (id) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('category_items').delete().eq('id', id); onChanged()
  }
  return (
    <div>
      <div className="chip-tabs" style={{ marginBottom:16 }}>
        <button className={`chip-tab ${typeTab==='expense'?'active':''}`} style={{ color:typeTab==='expense'?'var(--color-expense)':undefined }} onClick={()=>setTypeTab('expense')}>지출</button>
        <button className={`chip-tab ${typeTab==='income'?'active':''}`} style={{ color:typeTab==='income'?'var(--color-income)':undefined }} onClick={()=>setTypeTab('income')}>수입</button>
      </div>
      <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
        {filtered.length===0 && <div style={{ padding:'16px', color:'#ccc', fontSize:14 }}>카테고리 없음</div>}
        {filtered.map((c,i) => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', padding:'13px 16px', borderBottom:i<filtered.length-1?'1px solid #f5f5f5':'none', gap:12 }}>
            <span style={{ flex:1, fontSize:14, color:c.is_hidden?'#bbb':'#424242' }}>{c.name}</span>
            {c.is_hidden && <span style={{ fontSize:11, color:'#bbb', background:'#f5f5f5', borderRadius:4, padding:'2px 6px' }}>숨김</span>}
            <div onClick={()=>toggleHide(c)} style={{ width:44, height:24, borderRadius:12, background:c.is_hidden?'#e0e0e0':'#424242', position:'relative', cursor:'pointer', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:2, left:c.is_hidden?2:20, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
            </div>
            <button onClick={()=>del(c.id)} style={{ background:'none', color:'#ddd', fontSize:14, padding:'4px' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input className="input-field" placeholder="새 카테고리 이름" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} style={{ flex:1 }} />
        <button onClick={add} style={{ background:'#424242', color:'#fff', borderRadius:10, padding:'0 18px', fontSize:14 }}>추가</button>
      </div>
    </div>
  )
}

/* ─── 결제수단 관리 ─── */
function PaymentManager({ uid, paymentMethods, assets, onChanged }) {
  const [newName, setNewName] = useState('')
  const [linkedAssetId, setLinkedAssetId] = useState(assets[0]?.id || '')
  const toggleHide = async (p) => { await supabase.from('payment_methods').update({ is_hidden:!p.is_hidden }).eq('id', p.id); onChanged() }
  const add = async () => {
    if (!newName.trim()) return
    await supabase.from('payment_methods').insert({ user_id:uid, name:newName.trim(), linked_asset_id:linkedAssetId||null, is_hidden:false })
    setNewName(''); onChanged()
  }
  const del = async (id) => { if (!confirm('삭제할까요?')) return; await supabase.from('payment_methods').delete().eq('id', id); onChanged() }
  return (
    <div>
      <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
        {paymentMethods.length===0 && <div style={{ padding:'16px', color:'#ccc', fontSize:14 }}>결제 수단 없음</div>}
        {paymentMethods.map((p,i) => {
          const linked = assets.find(a=>a.id===p.linked_asset_id)
          return (
            <div key={p.id} style={{ display:'flex', alignItems:'center', padding:'13px 16px', borderBottom:i<paymentMethods.length-1?'1px solid #f5f5f5':'none', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, color:p.is_hidden?'#bbb':'#424242' }}>💳 {p.name}</div>
                {linked && <div style={{ fontSize:11, color:'#bbb', marginTop:1 }}>→ {linked.name} ({linked.currency_code})</div>}
              </div>
              {p.is_hidden && <span style={{ fontSize:11, color:'#bbb', background:'#f5f5f5', borderRadius:4, padding:'2px 6px' }}>숨김</span>}
              <div onClick={()=>toggleHide(p)} style={{ width:44, height:24, borderRadius:12, background:p.is_hidden?'#e0e0e0':'#424242', position:'relative', cursor:'pointer', transition:'background 0.2s', flexShrink:0 }}>
                <div style={{ position:'absolute', top:2, left:p.is_hidden?2:20, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
              </div>
              <button onClick={()=>del(p.id)} style={{ background:'none', color:'#ddd', fontSize:14, padding:'4px' }}>✕</button>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <input className="input-field" placeholder="결제수단 이름" value={newName} onChange={e=>setNewName(e.target.value)} />
        <div style={{ display:'flex', gap:8 }}>
          <select className="input-field" value={linkedAssetId} onChange={e=>setLinkedAssetId(Number(e.target.value))} style={{ flex:1 }}>
            <option value="">연결 자산 선택</option>
            {assets.map(a=><option key={a.id} value={a.id}>[{a.currency_code}] {a.name}</option>)}
          </select>
          <button onClick={add} style={{ background:'#424242', color:'#fff', borderRadius:10, padding:'0 18px', fontSize:14 }}>추가</button>
        </div>
      </div>
    </div>
  )
}

/* ─── 통화 관리 ─── */
function CurrencyManager({ uid, currencies, onChanged }) {
  const [code, setCode] = useState('')
  const presets = ['KRW','NZD','USD','JPY','AUD','EUR','GBP','SGD']
  const add = async (c) => {
    const val = (c||code).toUpperCase().trim()
    if (!val) return
    if (currencies.find(cur=>cur.code===val)) { alert('이미 있는 통화예요!'); return }
    await supabase.from('currencies').insert({ user_id:uid, code:val })
    setCode(''); onChanged()
  }
  const del = async (id) => { if (!confirm('삭제할까요?')) return; await supabase.from('currencies').delete().eq('id', id); onChanged() }
  return (
    <div>
      <div className="card" style={{ overflow:'hidden', marginBottom:16 }}>
        {currencies.length===0 && <div style={{ padding:'16px', color:'#ccc', fontSize:14 }}>통화 없음</div>}
        {currencies.map((c,i) => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', padding:'13px 16px', borderBottom:i<currencies.length-1?'1px solid #f5f5f5':'none' }}>
            <span style={{ flex:1, fontSize:15, fontWeight:600 }}>{c.code}</span>
            <button onClick={()=>del(c.id)} style={{ background:'none', color:'#ddd', fontSize:14, padding:'4px' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
        {presets.filter(p=>!currencies.find(c=>c.code===p)).map(p=>(
          <button key={p} onClick={()=>add(p)} style={{ padding:'8px 14px', borderRadius:20, background:'#f5f5f5', fontSize:13, color:'#424242' }}>+ {p}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input className="input-field" placeholder="직접 입력 (예: HKD)" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&add()} style={{ flex:1 }} />
        <button onClick={()=>add()} style={{ background:'#424242', color:'#fff', borderRadius:10, padding:'0 18px', fontSize:14 }}>추가</button>
      </div>
    </div>
  )
}

/* ─── 예산 관리 ─── */
function BudgetManager({ uid, budgets, categories, currencies, onChanged }) {
  const [newCat, setNewCat] = useState(categories[0]?.name || '')
  const [newAmt, setNewAmt] = useState('')
  const [newCurr, setNewCurr] = useState(currencies[0]?.code || 'KRW')

  const add = async () => {
    if (!newCat || !newAmt) return
    await supabase.from('budgets').insert({ user_id:uid, category:newCat, amount:parseFloat(newAmt), currency_code:newCurr })
    setNewAmt(''); onChanged()
  }
  const del = async (id) => { await supabase.from('budgets').delete().eq('id', id); onChanged() }

  const expCats = [...new Set(categories.filter(c=>c.type==='expense').map(c=>c.name))]

  return (
    <div>
      <div style={{ fontSize:12, color:'#bbb', marginBottom:12 }}>카테고리별 월 예산을 설정하면 초과 시 통계에서 경고해줘요.</div>
      <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
        {budgets.length===0 && <div style={{ padding:'16px', color:'#ccc', fontSize:14 }}>설정된 예산 없음</div>}
        {budgets.map((b,i) => (
          <div key={b.id} style={{ display:'flex', alignItems:'center', padding:'13px 16px', borderBottom:i<budgets.length-1?'1px solid #f5f5f5':'none', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14 }}>{b.category}</div>
              <div style={{ fontSize:12, color:'#bbb' }}>{Number(b.amount).toLocaleString()} {b.currency_code}</div>
            </div>
            <button onClick={()=>del(b.id)} style={{ background:'none', color:'#ddd', fontSize:14, padding:'4px' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', gap:8 }}>
          <select className="input-field" value={newCat} onChange={e=>setNewCat(e.target.value)} style={{ flex:1 }}>
            {expCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input-field" value={newCurr} onChange={e=>setNewCurr(e.target.value)} style={{ width:80 }}>
            {currencies.map(c=><option key={c.id} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input className="input-field" type="number" placeholder="예산 금액" value={newAmt} onChange={e=>setNewAmt(e.target.value)} style={{ flex:1 }} />
          <button onClick={add} style={{ background:'#424242', color:'#fff', borderRadius:10, padding:'0 18px', fontSize:14 }}>추가</button>
        </div>
      </div>
    </div>
  )
}

/* ─── 반복 내역 관리 ─── */
function RecurringManager({ uid, recurring, categories, currencies, assets, paymentMethods, onChanged }) {
  const [showAdd, setShowAdd] = useState(false)
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(currencies[0]?.code || 'KRW')
  const [category, setCategory] = useState('')
  const [frequency, setFrequency] = useState('monthly') // daily / weekdays / weekly / monthly
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [dayOfWeek, setDayOfWeek] = useState('6') // 토요일 기본
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || null)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const FREQ_OPTIONS = [
    { id:'daily',    label:'매일' },
    { id:'weekdays', label:'주중 (월~금)' },
    { id:'weekly',   label:'매주' },
    { id:'monthly',  label:'매월' },
  ]
  const DOW_LABELS = ['일','월','화','수','목','금','토']

  const freqLabel = (r) => {
    if (r.frequency === 'daily') return '매일'
    if (r.frequency === 'weekdays') return '매주 월~금'
    if (r.frequency === 'weekly') return `매주 ${DOW_LABELS[r.day_of_week]}요일`
    if (r.frequency === 'monthly') return `매월 ${r.day_of_month}일`
    return ''
  }

  const expCats = categories.filter(c=>c.type==='expense'&&!c.is_hidden)
  const incCats = categories.filter(c=>c.type==='income'&&!c.is_hidden)
  const currentCats = type==='income' ? incCats : expCats

  const add = async () => {
    if (!amount || !category) { alert('금액과 카테고리를 입력해주세요'); return }
    setSaving(true)
    const pm = paymentMethods.find(p=>p.id===paymentMethodId)
    await supabase.from('recurring_records').insert({
      user_id:uid, type, amount:parseFloat(amount), category, currency_code:currency,
      asset_id: pm?.linked_asset_id || null,
      payment_method_id: paymentMethodId || null,
      memo:memo||null,
      frequency,
      day_of_month: parseInt(dayOfMonth)||1,
      day_of_week: parseInt(dayOfWeek)||6,
      is_active:true
    })
    setSaving(false); setShowAdd(false); setAmount(''); setMemo(''); onChanged()
  }

  const toggleActive = async (r) => { await supabase.from('recurring_records').update({ is_active:!r.is_active }).eq('id', r.id); onChanged() }
  const del = async (id) => { if (!confirm('삭제할까요?')) return; await supabase.from('recurring_records').delete().eq('id', id); onChanged() }

  const runNow = async (r) => {
    const today = new Date()
    const pad = n => String(n).padStart(2,'0')
    const date = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
    await supabase.from('records').insert({
      user_id:uid, type:r.type, amount:r.amount, date, category:r.category,
      currency_code:r.currency_code, asset_id:r.asset_id, payment_method_id:r.payment_method_id,
      memo: r.memo ? `[반복] ${r.memo}` : '[반복]'
    })
    alert('오늘 날짜로 내역이 추가됐어요!')
  }

  const typeColor = { expense:'var(--color-expense)', income:'var(--color-income)' }

  return (
    <div>
      <div style={{ fontSize:12, color:'#bbb', marginBottom:12 }}>반복 내역은 앱 실행 시 자동으로 추가돼요. 수동으로 바로 추가하려면 "지금 추가" 버튼을 누르세요.</div>
      <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
        {recurring.length===0 && <div style={{ padding:'16px', color:'#ccc', fontSize:14 }}>반복 내역 없음</div>}
        {recurring.map((r,i) => (
          <div key={r.id} style={{ display:'flex', alignItems:'center', padding:'13px 16px', borderBottom:i<recurring.length-1?'1px solid #f5f5f5':'none', gap:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, color:r.is_active?'#424242':'#bbb' }}>{r.category}</div>
              <div style={{ fontSize:12, color:'#bbb', marginTop:1 }}>
                {freqLabel(r)} · {r.type==='expense'?'-':'+'}{Number(r.amount).toLocaleString()} {r.currency_code}
                {r.memo ? ` · ${r.memo}` : ''}
              </div>
            </div>
            <button onClick={()=>runNow(r)}
              style={{ fontSize:11, padding:'5px 10px', background:'#f5f5f5', borderRadius:8, color:'#424242', whiteSpace:'nowrap', flexShrink:0 }}>
              지금 추가
            </button>
            <div onClick={()=>toggleActive(r)} style={{ width:44, height:24, borderRadius:12, background:r.is_active?'#424242':'#e0e0e0', position:'relative', cursor:'pointer', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:2, left:r.is_active?20:2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
            </div>
            <button onClick={()=>del(r.id)} style={{ background:'none', color:'#ddd', fontSize:14, padding:'4px' }}>✕</button>
          </div>
        ))}
      </div>

      {!showAdd ? (
        <button onClick={()=>setShowAdd(true)}
          style={{ width:'100%', padding:'13px', background:'#f5f5f5', border:'2px dashed #e0e0e0', borderRadius:12, color:'#bbb', fontSize:14 }}>
          + 반복 내역 추가
        </button>
      ) : (
        <div className="card" style={{ padding:'16px' }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>새 반복 내역</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="chip-tabs">
              <button className={`chip-tab ${type==='expense'?'active':''}`} style={{ color:type==='expense'?typeColor.expense:undefined }} onClick={()=>setType('expense')}>지출</button>
              <button className={`chip-tab ${type==='income'?'active':''}`} style={{ color:type==='income'?typeColor.income:undefined }} onClick={()=>setType('income')}>수입</button>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <input className="input-field" type="number" placeholder="금액" value={amount} onChange={e=>setAmount(e.target.value)} style={{ flex:2 }} />
              <select className="input-field" value={currency} onChange={e=>setCurrency(e.target.value)} style={{ flex:1 }}>
                {currencies.map(c=><option key={c.id} value={c.code}>{c.code}</option>)}
              </select>
            </div>

            <select className="input-field" value={category} onChange={e=>setCategory(e.target.value)}>
              <option value="">카테고리 선택</option>
              {currentCats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>

            <select className="input-field" value={paymentMethodId||''} onChange={e=>setPaymentMethodId(Number(e.target.value))}>
              <option value="">결제 수단 선택</option>
              {paymentMethods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {/* 반복 주기 */}
            <div>
              <label className="label">반복 주기</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {FREQ_OPTIONS.map(f => (
                  <button key={f.id} onClick={()=>setFrequency(f.id)}
                    style={{ padding:'10px 12px', borderRadius:10, fontSize:13, textAlign:'left', transition:'all 0.15s',
                      background: frequency===f.id ? '#424242' : '#f5f5f5',
                      color: frequency===f.id ? '#fff' : '#666',
                      fontWeight: frequency===f.id ? 600 : 400 }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 매주 - 요일 선택 */}
            {frequency === 'weekly' && (
              <div>
                <label className="label">반복 요일</label>
                <div style={{ display:'flex', gap:6 }}>
                  {DOW_LABELS.map((d,i) => (
                    <button key={i} onClick={()=>setDayOfWeek(String(i))}
                      style={{ flex:1, padding:'8px 0', borderRadius:8, fontSize:13, transition:'all 0.15s',
                        background: dayOfWeek===String(i) ? '#424242' : '#f5f5f5',
                        color: dayOfWeek===String(i) ? '#fff' : i===0?'#E15F5F':i===6?'#1E8CBE':'#666',
                        fontWeight: dayOfWeek===String(i) ? 700 : 400 }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 매월 - 날짜 선택 */}
            {frequency === 'monthly' && (
              <div>
                <label className="label">반복 날짜</label>
                <select className="input-field" value={dayOfMonth} onChange={e=>setDayOfMonth(e.target.value)}>
                  {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}일</option>)}
                </select>
              </div>
            )}

            <input className="input-field" placeholder="메모 (선택)" value={memo} onChange={e=>setMemo(e.target.value)} />

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setShowAdd(false)} style={{ flex:1, padding:'12px', background:'#f5f5f5', borderRadius:10, fontSize:14, color:'#666' }}>취소</button>
              <button onClick={add} disabled={saving} style={{ flex:2, padding:'12px', background:'#424242', color:'#fff', borderRadius:10, fontSize:14 }}>
                {saving?'저장 중...':'저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
