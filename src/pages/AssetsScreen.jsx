import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => Number(n).toLocaleString('ko-KR', { minimumFractionDigits:0, maximumFractionDigits:2 })

export default function AssetsScreen({ session }) {
  const uid = session.user.id
  const [assets, setAssets] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [showAddPay, setShowAddPay] = useState(false)
  const [editAsset, setEditAsset] = useState(null) // 잔액 수정용
  const [tab, setTab] = useState('assets')

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
    if (!confirm('이 자산을 삭제할까요?')) return
    await supabase.from('assets').delete().eq('id', id)
    load()
  }
  const handleDeletePay = async (id) => {
    if (!confirm('이 결제 수단을 삭제할까요?')) return
    await supabase.from('payment_methods').delete().eq('id', id)
    load()
  }

  return (
    <div style={{ padding:'16px' }} className="fade-in">
      <div className="chip-tabs" style={{ marginBottom:20 }}>
        <button className={`chip-tab ${tab==='assets'?'active':''}`} onClick={()=>setTab('assets')}>자산</button>
        <button className={`chip-tab ${tab==='payments'?'active':''}`} onClick={()=>setTab('payments')}>결제 수단</button>
      </div>

      {/* 자산 탭 */}
      {tab === 'assets' && (
        <>
          {Object.keys(byCurrency).length === 0 ? (
            <div style={{ textAlign:'center', color:'#ccc', padding:40, fontSize:14 }}>자산을 추가해보세요</div>
          ) : (
            Object.entries(byCurrency).map(([code, list]) => {
              const liquid = list.filter(a=>a.asset_type==='liquid')
              const credit = list.filter(a=>a.asset_type==='credit')
              const net = liquid.reduce((s,a)=>s+a.balance,0) - credit.reduce((s,a)=>s+a.balance,0)
              return (
                <div key={code} className="card" style={{ marginBottom:12, overflow:'hidden' }}>
                  <div style={{ padding:'14px 16px', background:'#fafafa', borderBottom:'1px solid #f0f0f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:700, fontSize:15 }}>{code}</span>
                    <span style={{ fontWeight:700, color:'var(--color-income)' }}>{fmt(net)}</span>
                  </div>
                  {list.map((a,i) => (
                    <div key={a.id} style={{ display:'flex', alignItems:'center', padding:'11px 16px', borderBottom:i<list.length-1?'1px solid #f9f9f9':'none', gap:10 }}>
                      <span style={{ fontSize:15, marginRight:4 }}>{a.asset_type==='liquid'?'🏦':'💳'}</span>
                      <span style={{ flex:1, fontSize:14 }}>{a.name}</span>
                      <span style={{ fontSize:14, fontWeight:600, color:a.asset_type==='credit'?'var(--color-expense)':undefined, marginRight:4 }}>
                        {a.asset_type==='credit'?'-':''}{fmt(a.balance)}
                      </span>
                      {/* 잔액 수정 버튼 */}
                      <button onClick={()=>setEditAsset(a)}
                        style={{ background:'none', color:'#ccc', fontSize:13, padding:'4px', display:'flex', alignItems:'center' }}
                        title="잔액 직접 수정">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={()=>handleDeleteAsset(a.id)} style={{ background:'none', color:'#ddd', fontSize:14, padding:'4px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )
            })
          )}
          <button onClick={()=>setShowAddAsset(true)}
            style={{ width:'100%', padding:'13px', background:'#f5f5f5', border:'2px dashed #e0e0e0', borderRadius:12, color:'#bbb', fontSize:14, marginTop:4 }}>
            + 자산 추가
          </button>
        </>
      )}

      {/* 결제수단 탭 */}
      {tab === 'payments' && (
        <>
          {paymentMethods.length === 0 ? (
            <div style={{ textAlign:'center', color:'#ccc', padding:40, fontSize:14 }}>결제 수단을 추가해보세요</div>
          ) : (
            <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
              {paymentMethods.map((p,i) => {
                const linked = assets.find(a=>a.id===p.linked_asset_id)
                return (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', padding:'13px 16px', borderBottom:i<paymentMethods.length-1?'1px solid #f5f5f5':'none' }}>
                    <span style={{ fontSize:16, marginRight:10 }}>💳</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14 }}>{p.name}</div>
                      {linked && <div style={{ fontSize:11, color:'#bbb', marginTop:1 }}>→ {linked.name}</div>}
                    </div>
                    <button onClick={()=>handleDeletePay(p.id)} style={{ background:'none', color:'#ddd', fontSize:14 }}>✕</button>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={()=>setShowAddPay(true)}
            style={{ width:'100%', padding:'13px', background:'#f5f5f5', border:'2px dashed #e0e0e0', borderRadius:12, color:'#bbb', fontSize:14 }}>
            + 결제 수단 추가
          </button>
        </>
      )}

      {showAddAsset && <AddAssetModal uid={uid} currencies={currencies} onClose={()=>setShowAddAsset(false)} onSaved={()=>{setShowAddAsset(false);load()}} />}
      {showAddPay   && <AddPayModal uid={uid} assets={assets} onClose={()=>setShowAddPay(false)} onSaved={()=>{setShowAddPay(false);load()}} />}
      {editAsset    && <EditBalanceModal asset={editAsset} onClose={()=>setEditAsset(null)} onSaved={()=>{setEditAsset(null);load()}} />}
    </div>
  )
}

/* ─── 잔액 직접 수정 모달 ─── */
function EditBalanceModal({ asset, onClose, onSaved }) {
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
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{ maxWidth:360 }}>
        <div className="modal-header">
          <span className="modal-title">{asset.name} 잔액 수정</span>
          <span className="modal-close" onClick={onClose}>✕</span>
        </div>
        <div style={{ fontSize:12, color:'#bbb', marginBottom:16 }}>
          실제 잔액과 다를 때 직접 수정할 수 있어요.<br/>내역 기록에는 영향을 주지 않아요.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="label">현재 잔액 ({asset.currency_code})</label>
            <input className="input-field" type="number" value={balance} onChange={e=>setBalance(e.target.value)} autoFocus />
          </div>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving?'저장 중...':'저장'}</button>
        </div>
      </div>
    </div>
  )
}

function AddAssetModal({ uid, currencies, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(currencies[0]?.code || 'KRW')
  const [assetType, setAssetType] = useState('liquid')
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name || balance==='') { alert('이름과 잔액을 입력해주세요'); return }
    setSaving(true)
    await supabase.from('assets').insert({ user_id:uid, name, currency_code:code, asset_type:assetType, balance:parseFloat(balance)||0 })
    setSaving(false); onSaved()
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-header"><span className="modal-title">새 자산 등록</span><span className="modal-close" onClick={onClose}>✕</span></div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div><label className="label">자산 이름</label><input className="input-field" placeholder="예: ANZ 통장" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div><label className="label">통화</label>
            <select className="input-field" value={code} onChange={e=>setCode(e.target.value)}>
              {currencies.map(c=><option key={c.id} value={c.code}>{c.code}</option>)}
              {!currencies.length && <option value="KRW">KRW</option>}
            </select>
          </div>
          <div><label className="label">종류</label>
            <select className="input-field" value={assetType} onChange={e=>setAssetType(e.target.value)}>
              <option value="liquid">내 자산 (계좌/현금/체크카드)</option>
              <option value="credit">신용카드 (결제 예정액)</option>
            </select>
          </div>
          <div><label className="label">초기 금액</label><input className="input-field" type="number" placeholder="0" value={balance} onChange={e=>setBalance(e.target.value)} /></div>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving?'저장 중...':'등록하기'}</button>
        </div>
      </div>
    </div>
  )
}

function AddPayModal({ uid, assets, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [linkedAssetId, setLinkedAssetId] = useState(assets[0]?.id || null)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name) { alert('이름을 입력해주세요'); return }
    setSaving(true)
    await supabase.from('payment_methods').insert({ user_id:uid, name, linked_asset_id:linkedAssetId||null, is_hidden:false })
    setSaving(false); onSaved()
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-header"><span className="modal-title">결제 수단 추가</span><span className="modal-close" onClick={onClose}>✕</span></div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div><label className="label">이름</label><input className="input-field" placeholder="예: 현대카드" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div><label className="label">연결 자산</label>
            <select className="input-field" value={linkedAssetId||''} onChange={e=>setLinkedAssetId(Number(e.target.value))}>
              {assets.map(a=><option key={a.id} value={a.id}>[{a.currency_code}] {a.name}</option>)}
              {!assets.length && <option value="">자산 없음</option>}
            </select>
          </div>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving?'저장 중...':'추가하기'}</button>
        </div>
      </div>
    </div>
  )
}
