import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import InputModal from '../components/InputModal'

const fmt = (n) => Number(n).toLocaleString('ko-KR')
const WEEKDAYS = ['일','월','화','수','목','금','토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export default function HomeScreen({ session }) {
  const uid = session.user.id
  const [records, setRecords] = useState([])
  const [assets, setAssets] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInput, setShowInput] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [initialDate, setInitialDate] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedCurrency, setSelectedCurrency] = useState('전체')
  const clickTimers = useRef({})

  const load = useCallback(async () => {
    setLoading(true)
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth() + 1
    const from = `${y}-${String(m).padStart(2,'0')}-01`
    const to   = `${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`
    const [{ data: recs }, { data: ast }, { data: pays }, { data: curr }, { data: cats }] = await Promise.all([
      supabase.from('records').select('*').eq('user_id', uid).gte('date', from).lte('date', to).order('date', { ascending: false }),
      supabase.from('assets').select('*').eq('user_id', uid),
      supabase.from('payment_methods').select('*').eq('user_id', uid).eq('is_hidden', false),
      supabase.from('currencies').select('*').eq('user_id', uid),
      supabase.from('category_items').select('*').eq('user_id', uid).eq('is_hidden', false),
    ])
    setRecords(recs || [])
    setAssets(ast || [])
    setPaymentMethods(pays || [])
    setCurrencies(curr || [])
    setCategories(cats || [])
    setLoading(false)
  }, [uid, currentMonth])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('이 내역을 삭제할까요?')) return
    await supabase.from('records').delete().eq('id', id)
    load()
  }

  const handleDateClick = (dateStr) => {
    if (clickTimers.current[dateStr]) {
      clearTimeout(clickTimers.current[dateStr])
      delete clickTimers.current[dateStr]
      setInitialDate(dateStr); setEditRecord(null); setShowInput(true)
    } else {
      clickTimers.current[dateStr] = setTimeout(() => {
        delete clickTimers.current[dateStr]
        setSelectedDate(prev => prev === dateStr ? null : dateStr)
      }, 280)
    }
  }

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // 통화 필터 적용된 레코드
  const filteredRecords = selectedCurrency === '전체'
    ? records
    : records.filter(r => r.currency_code === selectedCurrency)

  const recordsByDate = filteredRecords.reduce((acc, r) => {
    if (!acc[r.date]) acc[r.date] = { income:0, expense:0 }
    if (r.type === 'income') acc[r.date].income += r.amount
    if (r.type === 'expense') acc[r.date].expense += r.amount
    return acc
  }, {})

  const toDateStr = (d) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const today = new Date().toISOString().split('T')[0]
  const displayRecords = selectedDate ? filteredRecords.filter(r => r.date === selectedDate) : filteredRecords

  const typeColor = { income:'var(--color-income)', expense:'var(--color-expense)', transfer:'var(--color-transfer)' }
  const typeSign  = { income:'+', expense:'-', transfer:'↔' }

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, padding:'16px 20px 8px' }}>
        <button onClick={()=>setCurrentMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}
          style={{ background:'none', fontSize:22, color:'#bbb', lineHeight:1, padding:'0 4px' }}>‹</button>
        <span style={{ fontWeight:700, fontSize:17 }}>{year}년 {MONTHS[month]}</span>
        <button onClick={()=>setCurrentMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}
          style={{ background:'none', fontSize:22, color:'#bbb', lineHeight:1, padding:'0 4px' }}>›</button>
      </div>

      {/* 수입/지출 요약 + 통화 드롭다운 */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'4px 20px 14px' }}>
        {/* 왼쪽: 수입 */}
        <div>
          <div style={{ fontSize:12, color:'#bbb', marginBottom:2 }}>수입</div>
          {(selectedCurrency === '전체' ? currencies : currencies.filter(c=>c.code===selectedCurrency)).map(c => {
            const inc = filteredRecords.filter(r=>r.type==='income'&&r.currency_code===c.code).reduce((s,r)=>s+r.amount,0)
            if (selectedCurrency === '전체' && inc === 0) return null
            return <div key={c.code} style={{ fontSize:14, fontWeight:600, color:'var(--color-income)' }}>{fmt(inc)}</div>
          })}
          {/* 전체 모드에서 아무 수입 없을 때 */}
          {filteredRecords.filter(r=>r.type==='income').length === 0 && (
            <div style={{ fontSize:14, fontWeight:600, color:'var(--color-income)' }}>0</div>
          )}
        </div>

        {/* 오른쪽: 통화 선택 + 지출 */}
        <div style={{ textAlign:'right' }}>
          {/* 통화 드롭다운 */}
          <div style={{ position:'relative', display:'inline-block', marginBottom:4 }}>
            <select
              value={selectedCurrency}
              onChange={e => setSelectedCurrency(e.target.value)}
              style={{
                appearance:'none', background:'none', border:'none',
                fontSize:14, fontWeight:600, color:'#424242',
                cursor:'pointer', paddingRight:18, textAlign:'right',
              }}>
              <option value="전체">전체</option>
              {currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
            </select>
            <span style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'#bbb', pointerEvents:'none' }}>▼</span>
          </div>

          {/* 지출 */}
          <div style={{ fontSize:11, color:'#bbb', marginBottom:2 }}>지출</div>
          {(selectedCurrency === '전체' ? currencies : currencies.filter(c=>c.code===selectedCurrency)).map(c => {
            const exp = filteredRecords.filter(r=>r.type==='expense'&&r.currency_code===c.code).reduce((s,r)=>s+r.amount,0)
            if (selectedCurrency === '전체' && exp === 0) return null
            return <div key={c.code} style={{ fontSize:14, fontWeight:600, color:'var(--color-expense)' }}>-{fmt(exp)} {c.code}</div>
          })}
          {filteredRecords.filter(r=>r.type==='expense').length === 0 && (
            <div style={{ fontSize:14, fontWeight:600, color:'var(--color-expense)' }}>0</div>
          )}
        </div>
      </div>

      {/* 캘린더 */}
      <div style={{ padding:'0 12px 8px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
          {WEEKDAYS.map((d,i) => (
            <div key={d} style={{ textAlign:'center', fontSize:11, color:i===0?'#E15F5F':i===6?'#1E8CBE':'#bbb', padding:'4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
          {Array(firstDay).fill(null).map((_,i) => <div key={'e'+i} />)}
          {Array(daysInMonth).fill(null).map((_,i) => {
            const d = i + 1
            const dateStr = toDateStr(d)
            const dayData = recordsByDate[dateStr]
            const isSelected = selectedDate === dateStr
            const isToday = dateStr === today
            const dow = (firstDay + i) % 7
            return (
              <div key={d} onClick={() => handleDateClick(dateStr)}
                title="더블클릭하면 내역 추가"
                style={{ borderRadius:10, padding:'5px 2px 6px', cursor:'pointer', minHeight:54, userSelect:'none',
                  background: isSelected ? '#424242' : isToday ? '#f5f5f5' : 'transparent', transition:'background 0.15s' }}>
                <div style={{ textAlign:'center', fontSize:13, fontWeight:isToday?700:400,
                  color: isSelected?'#fff': dow===0?'#E15F5F':dow===6?'#1E8CBE':'#424242', marginBottom:2 }}>{d}</div>
                {dayData?.income > 0 && <div style={{ fontSize:9, textAlign:'center', color:isSelected?'#aef':'var(--color-income)', overflow:'hidden' }}>+{fmt(dayData.income)}</div>}
                {dayData?.expense > 0 && <div style={{ fontSize:9, textAlign:'center', color:isSelected?'#fcc':'var(--color-expense)', overflow:'hidden' }}>-{fmt(dayData.expense)}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ height:1, background:'#f0f0f0', margin:'0 16px' }} />

      {/* 내역 리스트 */}
      <div style={{ padding:'12px 16px' }}>
        {selectedDate && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:14, fontWeight:600 }}>{parseInt(selectedDate.split('-')[2])}일 내역</span>
            <button onClick={()=>setSelectedDate(null)} style={{ fontSize:12, color:'#bbb', background:'none' }}>전체 보기</button>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign:'center', color:'#ccc', padding:32 }}>불러오는 중...</div>
        ) : displayRecords.length === 0 ? (
          <div style={{ textAlign:'center', color:'#ccc', padding:40, fontSize:14 }}>내역이 없어요</div>
        ) : (
          <div className="card" style={{ overflow:'hidden' }}>
            {displayRecords.map((r, i) => (
              <div key={r.id}
                style={{ display:'flex', alignItems:'center', padding:'13px 16px', borderBottom:i<displayRecords.length-1?'1px solid #f5f5f5':'none', gap:12, cursor:'pointer' }}
                onClick={() => { setEditRecord(r); setInitialDate(null); setShowInput(true) }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:typeColor[r.type], flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:500 }}>{r.category}</div>
                  <div style={{ fontSize:11, color:'#bbb', marginTop:1 }}>{r.date.slice(5).replace('-','.')}{r.memo ? ` · ${r.memo}` : ''}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:typeColor[r.type] }}>
                    {typeSign[r.type]}{fmt(r.amount)} <span style={{ fontSize:10, fontWeight:400 }}>{r.currency_code}</span>
                  </div>
                </div>
                <button onClick={(e)=>handleDelete(r.id,e)} style={{ background:'none', color:'#ddd', fontSize:14, padding:'4px', flexShrink:0 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInput && (
        <InputModal session={session} record={editRecord} assets={assets} paymentMethods={paymentMethods}
          currencies={currencies} categories={categories} initialDate={initialDate}
          onClose={() => { setShowInput(false); setEditRecord(null); setInitialDate(null) }}
          onSaved={() => { setShowInput(false); setEditRecord(null); setInitialDate(null); load() }} />
      )}
    </div>
  )
}
