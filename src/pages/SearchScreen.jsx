import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const fmt = (n) => Number(n).toLocaleString('ko-KR')

function getDateRange(preset) {
  const today = new Date()
  const pad = (n) => String(n).padStart(2,'0')
  const fmtD = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const todayStr = fmtD(today)
  if (preset === 'week') { const f = new Date(today); f.setDate(today.getDate()-7); return { from:fmtD(f), to:todayStr } }
  if (preset === 'month') { const f = new Date(today); f.setMonth(today.getMonth()-1); return { from:fmtD(f), to:todayStr } }
  if (preset === 'thismonth') { return { from:`${today.getFullYear()}-${pad(today.getMonth()+1)}-01`, to:todayStr } }
  return { from:'', to:'' }
}

// 텍스트에서 키워드 하이라이트
function Highlight({ text, keyword }) {
  if (!keyword || !text) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background:'#fff3b0', borderRadius:2, padding:'0 1px' }}>{text.slice(idx, idx+keyword.length)}</mark>
      {text.slice(idx+keyword.length)}
    </span>
  )
}

export default function SearchScreen({ session }) {
  const uid = session.user.id
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(new Date())
  const [records, setRecords] = useState([])
  const [categories, setCategories] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('category_items').select('*').eq('user_id', uid).then(({ data }) => setCategories(data || []))
    supabase.from('currencies').select('*').eq('user_id', uid).then(({ data }) => setCurrencies(data || []))
  }, [uid])

  const applyPreset = (preset) => {
    setDatePreset(preset)
    if (preset === 'thismonth') { setShowMonthPicker(true); return }
    if (preset !== 'custom') { const r = getDateRange(preset); setDateFrom(r.from); setDateTo(r.to) }
  }

  const applyMonthPicker = () => {
    const y = pickerMonth.getFullYear(), m = pickerMonth.getMonth()+1
    const pad = n => String(n).padStart(2,'0')
    setDateFrom(`${y}-${pad(m)}-01`)
    setDateTo(`${y}-${pad(m)}-${new Date(y,m,0).getDate()}`)
    setShowMonthPicker(false)
  }

  const search = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('records').select('*').eq('user_id', uid).order('date', { ascending:false })
    if (typeFilter !== 'all') query = query.eq('type', typeFilter)
    if (categoryFilter) query = query.eq('category', categoryFilter)
    if (currencyFilter) query = query.eq('currency_code', currencyFilter)
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)
    const { data } = await query
    let result = data || []

    // 키워드 검색: 메모 + 카테고리 + 금액
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      result = result.filter(r =>
        (r.memo || '').toLowerCase().includes(kw) ||
        r.category.toLowerCase().includes(kw) ||
        r.amount.toString().includes(kw) ||
        r.currency_code.toLowerCase().includes(kw) ||
        r.date.includes(kw)
      )
    }
    setRecords(result)
    setLoading(false)
  }, [uid, keyword, typeFilter, categoryFilter, currencyFilter, dateFrom, dateTo])

  useEffect(() => { search() }, [search])

  const reset = () => {
    setKeyword(''); setTypeFilter('all'); setCategoryFilter('')
    setCurrencyFilter(''); setDatePreset(''); setDateFrom(''); setDateTo('')
  }

  const typeColor = { income:'var(--color-income)', expense:'var(--color-expense)', transfer:'var(--color-transfer)' }
  const typeSign  = { income:'+', expense:'-', transfer:'↔' }
  const typeLabel = { income:'수입', expense:'지출', transfer:'이체' }

  const PRESETS = [
    { id:'week',      label:'일주일' },
    { id:'month',     label:'한달' },
    { id:'thismonth', label:'월 선택' },
    { id:'custom',    label:'직접 지정' },
  ]

  // 검색 결과 합계
  const totalIncome  = records.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0)
  const totalExpense = records.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0)

  return (
    <div style={{ padding:'16px' }} className="fade-in">
      {/* 검색창 */}
      <div style={{ position:'relative', marginBottom:14 }}>
        <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#bbb' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
        </span>
        <input className="input-field" placeholder="메모, 카테고리, 금액, 날짜 검색..."
          value={keyword} onChange={e=>setKeyword(e.target.value)}
          style={{ paddingLeft:42, paddingRight:keyword?40:16 }} />
        {keyword && <button onClick={()=>setKeyword('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', color:'#bbb', fontSize:18 }}>✕</button>}
      </div>

      {/* 타입 탭 */}
      <div className="chip-tabs" style={{ marginBottom:12 }}>
        {[['all','전체'],['expense','지출'],['income','수입'],['transfer','이체']].map(([v,l]) => (
          <button key={v} className={`chip-tab ${typeFilter===v?'active':''}`}
            style={{ color: typeFilter===v && v!=='all' ? typeColor[v] : undefined }}
            onClick={()=>setTypeFilter(v)}>{l}</button>
        ))}
      </div>

      {/* 기간 프리셋 */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.id} onClick={()=>applyPreset(p.id)}
            style={{ padding:'7px 13px', borderRadius:20, fontSize:13, transition:'all 0.15s',
              background: datePreset===p.id ? '#424242' : '#f5f5f5',
              color: datePreset===p.id ? '#fff' : '#666',
              fontWeight: datePreset===p.id ? 600 : 400 }}>
            {p.label}
          </button>
        ))}
        {(dateFrom || dateTo || keyword || categoryFilter || currencyFilter || typeFilter !== 'all') && (
          <button onClick={reset} style={{ padding:'7px 12px', borderRadius:20, fontSize:12, background:'#fff0f0', color:'#E15F5F' }}>
            전체 초기화
          </button>
        )}
      </div>

      {/* 직접 지정 날짜 */}
      {datePreset === 'custom' && (
        <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
          <input className="input-field" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ flex:1, fontSize:13, padding:'9px 12px' }} />
          <span style={{ color:'#bbb', fontSize:12 }}>~</span>
          <input className="input-field" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ flex:1, fontSize:13, padding:'9px 12px' }} />
        </div>
      )}

      {/* 월 선택 팝업 */}
      {showMonthPicker && (
        <Modal title="월 선택" onClose={()=>setShowMonthPicker(false)} maxWidth={320}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <button onClick={()=>setPickerMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={{ background:'none', fontSize:20, color:'#bbb' }}>‹</button>
            <span style={{ fontWeight:700 }}>{pickerMonth.getFullYear()}년 {pickerMonth.getMonth()+1}월</span>
            <button onClick={()=>setPickerMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={{ background:'none', fontSize:20, color:'#bbb' }}>›</button>
          </div>
          <button className="btn-primary" onClick={applyMonthPicker}>이 달 선택</button>
        </Modal>
      )}

      {/* 카테고리/통화 필터 */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <select className="input-field" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}
          style={{ flex:1, padding:'9px 28px 9px 12px', fontSize:13 }}>
          <option value="">전체 카테고리</option>
          {[...new Set(categories.map(c=>c.name))].map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <select className="input-field" value={currencyFilter} onChange={e=>setCurrencyFilter(e.target.value)}
          style={{ flex:1, padding:'9px 28px 9px 12px', fontSize:13 }}>
          <option value="">전체 통화</option>
          {currencies.map(c=><option key={c.id} value={c.code}>{c.code}</option>)}
        </select>
      </div>

      {/* 날짜 표시 */}
      {(dateFrom || dateTo) && (
        <div style={{ fontSize:12, color:'#999', marginBottom:8 }}>{dateFrom} ~ {dateTo}</div>
      )}

      {/* 결과 요약 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:12, color:'#bbb' }}>{loading ? '검색 중...' : `${records.length}건`}</span>
        {records.length > 0 && typeFilter === 'all' && (
          <div style={{ fontSize:12, display:'flex', gap:10 }}>
            {totalIncome > 0 && <span style={{ color:'var(--color-income)' }}>+{fmt(totalIncome)}</span>}
            {totalExpense > 0 && <span style={{ color:'var(--color-expense)' }}>-{fmt(totalExpense)}</span>}
          </div>
        )}
      </div>

      {/* 결과 목록 */}
      {records.length === 0 && !loading ? (
        <div style={{ textAlign:'center', color:'#ccc', padding:48, fontSize:14 }}>
          {keyword ? `"${keyword}" 검색 결과가 없어요` : '검색 결과가 없어요'}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          {records.map((r, i) => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', padding:'13px 16px', borderBottom:i<records.length-1?'1px solid #f5f5f5':'none', gap:12 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:typeColor[r.type], flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500 }}>
                  <Highlight text={r.category} keyword={keyword} />
                </div>
                <div style={{ fontSize:11, color:'#bbb', marginTop:1 }}>
                  {r.date}
                  {r.memo && <> · <Highlight text={r.memo} keyword={keyword} /></>}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:typeColor[r.type] }}>
                  {typeSign[r.type]}<Highlight text={fmt(r.amount)} keyword={keyword} />
                  {' '}<span style={{ fontSize:10, fontWeight:400, color:'#bbb' }}>{r.currency_code}</span>
                </div>
                <div style={{ fontSize:10, color:'#ccc' }}>{typeLabel[r.type]}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
