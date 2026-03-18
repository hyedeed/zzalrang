import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const fmt = (n) => Number(n).toLocaleString('ko-KR', { minimumFractionDigits:0, maximumFractionDigits:2 })

export default function AssetsScreen({ session }) {
  const uid = session.user.id
  const [assets, setAssets] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [editAsset, setEditAsset] = useState(null)
  const [expandedAsset, setExpandedAsset] = useState(null)

  const load = useCallback(async () => {
    const [{ data: ast }, { data: curr }, { data: pays }] = await Promise.all([
      supabase.from('assets').select('*').eq('user_id', uid),
      supabase.from('currencies').select('*').eq('user_id', uid),
      supabase.from('payment_methods').select('*').eq('user_id', uid),
    ])
    setAssets(ast || [])
    setCurrencies(curr || [])
    setPaymentMethods(pays || [])
  }, [uid])

  useEffect(() => { load() }, [load])

  const byCurrency = assets.reduce((acc, a) => {
    if (!acc[a.currency_code]) acc[a.currency_code] = []
    acc[a.currency_code].push(a)
    return acc
  }, {})

  const handleDeleteAsset = async (id) => {
    if (!confirm('이 자산을 삭제할까요?\n연결된 결제수단도 함께 삭제돼요.')) return
    await supabase.from('payment_methods').delete().eq('linked_asset_id', id)
    await supabase.from('assets').delete().eq('id', id)
    load()
  }

  const handleDeletePay = async (id) => {
    if (!confirm('이 결제수단을 삭제할까요?')) return
    await supabase.from('payment_methods').delete().eq('id', id)
    load()
  }

  const toggleHidePay = async (p) => {
    await supabase.from('payment_methods').update({ is_hidden: !p.is_hidden }).eq('id', p.id)
    load()
  }

  return (
    <div style={{ padding:'16px' }} className="fade-in">
      <div style={{ fontSize:12, color:'#bbb', marginBottom:12 }}>
        자산을 추가하면 결제수단(카드/현금)을 연결할 수 있어요
      </div>

      {Object.keys(byCurrency).length === 0 ? (
        <div style={{ textAlign:'center', color:'#ccc', padding:40, fontSize:14 }}>자산을 추가해보세요</div>
      ) : (
        Object.entries(byCurrency).map(([code, list]) => {
          const liquid = list.filter(a=>a.asset_type==='liquid')
          const credit = list.filter(a=>a.asset_type==='credit')
          const net = liquid.reduce((s,a)=>s+a.balance,0) - credit.reduce((s,a)=>s+a.balance,0)
          return (
            <div key={code} className="card" style={{ marginBottom:12, overflow:'hidden' }}>
              {/* 통화 헤더 */}
              <div style={{ padding:'14px 16px', background:'#fafafa', borderBottom:'1px solid #f0f0f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:700, fontSize:15 }}>{code}</span>
                <span style={{ fontWeight:700, color:'var(--color-income)' }}>{fmt(net)}</span>
              </div>

              {list.map((a, i) => {
                const linkedPays = paymentMethods.filter(p => p.linked_asset_id === a.id)
                const isExpanded = expandedAsset === a.id

                return (
                  <div key={a.id} style={{ borderBottom: i<list.length-1?'1px solid #f5f5f5':'none' }}>
                    {/* 자산 행 */}
                    <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', gap:10 }}>
                      <span style={{ fontSize:16 }}>{a.asset_type==='liquid'?'🏦':'💳'}</span>
                      {/* 이름 클릭하면 결제수단 펼치기 */}
                      <div style={{ flex:1, cursor:'pointer' }} onClick={()=>setExpandedAsset(isExpanded ? null : a.id)}>
                        <div style={{ fontSize:14, fontWeight:500 }}>{a.name}</div>
                        <div style={{ fontSize:11, color:'#bbb', marginTop:1 }}>
                          결제수단 {linkedPays.length}개 {isExpanded ? '▲' : '▼'}
                        </div>
                      </div>
                      <span style={{ fontSize:14, fontWeight:600, color:a.asset_type==='credit'?'var(--color-expense)':undefined }}>
                        {a.asset_type==='credit'?'-':''}{fmt(a.balance)}
                      </span>
                      {/* 잔액 수정 */}
                      <button onClick={()=>setEditAsset(a)}
                        style={{ background:'none', color:'#ccc', padding:'4px', display:'flex', alignItems:'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={()=>handleDeleteAsset(a.id)} style={{ background:'none', color:'#ddd', fontSize:14, padding:'4px' }}>✕</button>
                    </div>

                    {/* 결제수단 목록 (펼쳤을 때) */}
                    {isExpanded && (
                      <div style={{ background:'#fafafa', padding:'8px 16px 12px 48px' }}>
                        {linkedPays.length === 0 ? (
                          <div style={{ fontSize:12, color:'#ccc', marginBottom:8 }}>연결된 결제수단 없음</div>
                        ) : (
                          linkedPays.map(p => (
                            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                              <span style={{ fontSize:13, color: p.is_hidden?'#bbb':'#424242', flex:1 }}>
                                💳 {p.name}
                              </span>
                              {p.is_hidden && <span style={{ fontSize:10, color:'#bbb', background:'#e8e8e8', borderRadius:4, padding:'1px 5px' }}>숨김</span>}
                              {/* 숨김 토글 */}
                              <div onClick={()=>toggleHidePay(p)}
                                style={{ width:36, height:20, borderRadius:10, background:p.is_hidden?'#e0e0e0':'#424242', position:'relative', cursor:'pointer', flexShrink:0 }}>
                                <div style={{ position:'absolute', top:2, left:p.is_hidden?2:16, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s' }} />
                              </div>
                              <button onClick={()=>handleDeletePay(p.id)} style={{ background:'none', color:'#ddd', fontSize:13, padding:'2px' }}>✕</button>
                            </div>
                          ))
                        )}
                        {/* 결제수단 추가 버튼 */}
                        <AddPaymentInline uid={uid} assetId={a.id} onSaved={load} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })
      )}

      <button onClick={()=>setShowAddAsset(true)}
        style={{ width:'100%', padding:'13px', background:'#f5f5f5', border:'2px dashed #e0e0e0', borderRadius:12, color:'#bbb', fontSize:14 }}>
        + 자산 추가
      </button>

      {showAddAsset && (
        <Modal title="새 자산 등록" onClose={()=>setShowAddAsset(false)}>
          <AddAssetForm uid={uid} currencies={currencies} onClose={()=>setShowAddAsset(false)} onSaved={()=>{setShowAddAsset(false);load()}} />
        </Modal>
      )}
      {editAsset && (
        <Modal title={`${editAsset.name} 잔액 수정`} onClose={()=>setEditAsset(null)} maxWidth={360}>
          <EditBalanceForm asset={editAsset} onClose={()=>setEditAsset(null)} onSaved={()=>{setEditAsset(null);load()}} />
        </Modal>
      )}
    </div>
  )
}

/* 인라인 결제수단 추가 */
function AddPaymentInline({ uid, assetId, onSaved }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('payment_methods').insert({
      user_id: uid, name: name.trim(),
      linked_asset_id: assetId, is_hidden: false
    })
    setName('')
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ display:'flex', gap:6, marginTop:8 }}>
      <input
        className="input-field"
        placeholder="결제수단 이름 (예: 현금, 현대카드)"
        value={name}
        onChange={e=>setName(e.target.value)}
        onKeyDown={e=>e.key==='Enter'&&save()}
        style={{ flex:1, fontSize:13, padding:'8px 12px' }}
      />
      <button onClick={save} disabled={saving}
        style={{ padding:'8px 14px', background:'#424242', color:'#fff', borderRadius:10, fontSize:13, whiteSpace:'nowrap', flexShrink:0 }}>
        {saving?'..':'추가'}
      </button>
    </div>
  )
}

function EditBalanceForm({ asset, onClose, onSaved }) {
  const [balance, setBalance] = useState(asset.balance.toString())
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const val = parseFloat(balance)
    if (isNaN(val)) { alert('올바른 숫자를 입력해주세요'); return }
    setSaving(true)
    await supabase.from('assets').update({ balance: val }).eq('id', asset.id)
    setSaving(false); onSaved()
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ fontSize:12, color:'#bbb' }}>실제 잔액과 다를 때 직접 수정할 수 있어요. 내역 기록에는 영향을 주지 않아요.</div>
      <div>
        <label className="label">잔액 ({asset.currency_code})</label>
        <input className="input-field" type="number" value={balance} onChange={e=>setBalance(e.target.value)} autoFocus />
      </div>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving?'저장 중...':'저장'}</button>
    </div>
  )
}

function AddAssetForm({ uid, currencies, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(currencies[0]?.code || 'KRW')
  const [assetType, setAssetType] = useState('liquid')
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name || balance==='') { alert('이름과 잔액을 입력해주세요'); return }
    setSaving(true)
    await supabase.from('assets').insert({
      user_id:uid, name, currency_code:code,
      asset_type:assetType, balance:parseFloat(balance)||0
    })
    setSaving(false); onSaved()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <label className="label">자산 이름</label>
        <input className="input-field" placeholder="예: 국민은행 통장, 현금 지갑" value={name} onChange={e=>setName(e.target.value)} />
      </div>
      <div>
        <label className="label">통화</label>
        <select className="input-field" value={code} onChange={e=>setCode(e.target.value)}>
          {currencies.map(c=><option key={c.id} value={c.code}>{c.code}</option>)}
          {!currencies.length && <option value="KRW">KRW</option>}
        </select>
      </div>
      <div>
        <label className="label">종류</label>
        <select className="input-field" value={assetType} onChange={e=>setAssetType(e.target.value)}>
          <option value="liquid">내 자산 (계좌/현금/체크카드)</option>
          <option value="credit">신용카드 (결제 예정액)</option>
        </select>
      </div>
      <div>
        <label className="label">초기 금액</label>
        <input className="input-field" type="number" placeholder="0" value={balance} onChange={e=>setBalance(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving?'저장 중...':'등록하기'}</button>
    </div>
  )
}
