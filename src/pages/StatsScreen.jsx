import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const fmt = (n) => Number(n).toLocaleString('ko-KR')
const COLORS = ['#FFC7C7','#8785A2','#B5C0D0','#FFE2E2','#CCD3CA','#A8D8EA','#F7D794','#C7CEEA','#FFDAC1','#E2F0CB']
const MONTHS_SHORT = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export default function StatsScreen({ session }) {
  const uid = session.user.id
  const [chartTab, setChartTab] = useState('pie') // 'pie' | 'bar'
  const [records, setRecords] = useState([])
  const [allRecords, setAllRecords] = useState([]) // for bar chart
  const [currencies, setCurrencies] = useState([])
  const [budgets, setBudgets] = useState([])
  const [selectedCurrency, setSelectedCurrency] = useState(null)
  const [typeMode, setTypeMode] = useState('expense')
  const [viewMode, setViewMode] = useState('monthly')
  const [focusedDate, setFocusedDate] = useState(new Date())
  const [activeIndex, setActiveIndex] = useState(null)

  useEffect(() => {
    supabase.from('currencies').select('*').eq('user_id', uid).then(({ data }) => {
      setCurrencies(data || [])
      if (data?.length) setSelectedCurrency(data[0].code)
    })
    supabase.from('budgets').select('*').eq('user_id', uid).then(({ data }) => setBudgets(data || []))
  }, [uid])

  // 파이차트용 데이터
  useEffect(() => {
    if (!selectedCurrency) return
    const y = focusedDate.getFullYear(), m = focusedDate.getMonth() + 1
    let from, to
    if (viewMode === 'monthly') {
      from = `${y}-${String(m).padStart(2,'0')}-01`
      to   = `${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`
    } else {
      from = `${y}-01-01`; to = `${y}-12-31`
    }
    supabase.from('records').select('*').eq('user_id', uid)
      .eq('currency_code', selectedCurrency).eq('type', typeMode)
      .gte('date', from).lte('date', to)
      .then(({ data }) => setRecords(data || []))
  }, [uid, selectedCurrency, typeMode, viewMode, focusedDate])

  // 바차트용 최근 6개월 데이터
  useEffect(() => {
    if (!selectedCurrency) return
    const today = new Date()
    const from = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-01`
    supabase.from('records').select('*').eq('user_id', uid)
      .eq('currency_code', selectedCurrency)
      .gte('date', fromStr)
      .then(({ data }) => setAllRecords(data || []))
  }, [uid, selectedCurrency])

  // 바차트 데이터 가공 (최근 6개월)
  const barData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const y = d.getFullYear(), m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2,'0')}`
    const monthRecs = allRecords.filter(r => r.date.startsWith(key))
    return {
      name: MONTHS_SHORT[m - 1],
      수입: monthRecs.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0),
      지출: monthRecs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0),
    }
  })

  const totals = records.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + r.amount
    return acc
  }, {})
  const total = Object.values(totals).reduce((s,v)=>s+v, 0)
  const chartData = Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value }))

  const periodLabel = viewMode === 'monthly'
    ? `${focusedDate.getFullYear()}년 ${MONTHS_SHORT[focusedDate.getMonth()]}`
    : `${focusedDate.getFullYear()}년`

  const prevPeriod = () => setFocusedDate(d => viewMode === 'monthly' ? new Date(d.getFullYear(), d.getMonth()-1, 1) : new Date(d.getFullYear()-1, 0, 1))
  const nextPeriod = () => setFocusedDate(d => viewMode === 'monthly' ? new Date(d.getFullYear(), d.getMonth()+1, 1) : new Date(d.getFullYear()+1, 0, 1))

  // 예산 초과 체크
  const budgetWarnings = budgets.filter(b => {
    if (b.currency_code !== selectedCurrency) return false
    const spent = totals[b.category] || 0
    return spent > b.amount
  })

  return (
    <div style={{ padding:'16px' }} className="fade-in">
      {/* 차트 타입 탭 */}
      <div className="chip-tabs" style={{ marginBottom:16 }}>
        <button className={`chip-tab ${chartTab==='pie'?'active':''}`} onClick={()=>setChartTab('pie')}>카테고리</button>
        <button className={`chip-tab ${chartTab==='bar'?'active':''}`} onClick={()=>setChartTab('bar')}>월 추이</button>
      </div>

      {/* 통화 선택 */}
      {selectedCurrency && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
          <select className="input-field" style={{ width:'auto', padding:'6px 28px 6px 10px', fontSize:13 }}
            value={selectedCurrency} onChange={e=>setSelectedCurrency(e.target.value)}>
            {currencies.map(c=><option key={c.id} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      )}

      {/* 파이 차트 뷰 */}
      {chartTab === 'pie' && (
        <>
          <div className="chip-tabs" style={{ marginBottom:12 }}>
            <button className={`chip-tab ${typeMode==='expense'?'active':''}`}
              style={{ color: typeMode==='expense' ? 'var(--color-expense)' : undefined }}
              onClick={()=>setTypeMode('expense')}>지출</button>
            <button className={`chip-tab ${typeMode==='income'?'active':''}`}
              style={{ color: typeMode==='income' ? 'var(--color-income)' : undefined }}
              onClick={()=>setTypeMode('income')}>수입</button>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <select className="input-field" style={{ width:'auto', padding:'6px 28px 6px 10px', fontSize:13 }}
              value={viewMode} onChange={e=>setViewMode(e.target.value)}>
              <option value="monthly">월별</option>
              <option value="yearly">연별</option>
            </select>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={prevPeriod} style={{ background:'none', fontSize:20, color:'#bbb' }}>‹</button>
              <span style={{ fontWeight:700, fontSize:15 }}>{periodLabel}</span>
              <button onClick={nextPeriod} style={{ background:'none', fontSize:20, color:'#bbb' }}>›</button>
            </div>
          </div>

          {total === 0 ? (
            <div style={{ textAlign:'center', color:'#ccc', padding:60, fontSize:14 }}>이 기간에 내역이 없어요</div>
          ) : (
            <>
              <div className="card" style={{ padding:'20px 16px', marginBottom:12, position:'relative' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      dataKey="value" paddingAngle={2}
                      onMouseEnter={(_,i)=>setActiveIndex(i)} onMouseLeave={()=>setActiveIndex(null)}>
                      {chartData.map((_,i) => (
                        <Cell key={i} fill={COLORS[i%COLORS.length]} opacity={activeIndex===null||activeIndex===i?1:0.5} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v)=>`${fmt(v)} ${selectedCurrency}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
                  <div style={{ fontSize:11, color:'#bbb' }}>총 {typeMode==='expense'?'지출':'수입'}</div>
                  <div style={{ fontSize:15, fontWeight:700 }}>{fmt(total)}</div>
                </div>
              </div>

              <div className="card" style={{ overflow:'hidden' }}>
                {chartData.map((item, i) => {
                  const budget = budgets.find(b => b.category === item.name && b.currency_code === selectedCurrency)
                  const isOver = budget && item.value > budget.amount
                  return (
                    <div key={item.name} style={{ padding:'12px 16px', borderBottom:i<chartData.length-1?'1px solid #f5f5f5':'none' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: budget ? 6 : 0 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:COLORS[i%COLORS.length], flexShrink:0 }} />
                        <span style={{ flex:1, fontSize:14 }}>{item.name}</span>
                        <span style={{ fontSize:12, color:'#bbb' }}>{((item.value/total)*100).toFixed(1)}%</span>
                        <span style={{ fontSize:14, fontWeight:600, color: isOver ? '#E15F5F' : undefined }}>{fmt(item.value)}</span>
                      </div>
                      {budget && (
                        <div style={{ marginLeft:20 }}>
                          <div style={{ height:4, background:'#f0f0f0', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${Math.min((item.value/budget.amount)*100,100)}%`,
                              background: isOver ? '#E15F5F' : '#424242', borderRadius:2, transition:'width 0.5s' }} />
                          </div>
                          <div style={{ fontSize:11, color: isOver?'#E15F5F':'#bbb', marginTop:2 }}>
                            예산 {fmt(budget.amount)} {isOver ? '⚠ 초과!' : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* 바 차트 뷰 */}
      {chartTab === 'bar' && (
        <div className="card" style={{ padding:'20px 8px' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#424242', marginBottom:16, paddingLeft:8 }}>최근 6개월 수입/지출</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:'#bbb' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'#bbb' }} axisLine={false} tickLine={false} tickFormatter={v=>v>=10000?`${(v/10000).toFixed(0)}만`:fmt(v)} width={40} />
              <Tooltip formatter={(v,n)=>[`${fmt(v)} ${selectedCurrency}`, n]} />
              <Bar dataKey="수입" fill="#1E8CBE" radius={[4,4,0,0]} opacity={0.85} />
              <Bar dataKey="지출" fill="#E15F5F" radius={[4,4,0,0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', justifyContent:'center', gap:20, marginTop:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#bbb' }}>
              <div style={{ width:10, height:10, borderRadius:2, background:'#1E8CBE' }} /> 수입
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#bbb' }}>
              <div style={{ width:10, height:10, borderRadius:2, background:'#E15F5F' }} /> 지출
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
