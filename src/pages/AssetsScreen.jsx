import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => Number(n).toLocaleString('ko-KR', { minimumFractionDigits:0, maximumFractionDigits:2 })

export default function AssetsScreen({ session }) {
  const uid = session.user.id
  const [assets, setAssets] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [editAsset, setEditAsset] = useState(null)

  const load = useCallback(async () => {
    const [{ data: ast }, { data: curr }] = await Promise.all([
      supabase.from('assets').select('*').eq('user_id', uid),
      supabase.from('currencies').select('*').eq('user_id', uid),
    ])
    setAssets(ast || [])
    setCurrencies(curr || [])
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

  return (
    <div style={{ padding:'16px' }} className="fade-in">
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
                  <button onClick={()=>setEditAsset(a)}
                    style={{ background:'none', color:'#ccc', padding:'4px', display:'flex', alignItems:'center' }}>
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
        style={{ width:'100%', padding:'13px', background:'#f5f5f5', border:'2px dashed #e0e0e0', borderRadius:12, color:'#bbb', fontSize:14 }}>
        + 자산 추가
      </button>

      {showAddAsset && <AddAssetModal uid={uid} currencies={currencies} onClose={()=>setShowAddAsset(false)} onSaved={()=>{setShowAddAsset(false);load()}} />}
      {editAsset    && <EditBalanceModal asset={editAsset} onClose={()=>setEditAsset(null)} onSaved={()=>{setEditAsset(null);load()}} />}
    </div>
  )
}

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
        <div style={{ fontSize:12, color:'#bbb', marginBottom:16 }}>실제 잔액과 다를 때 직접 수정할 수 있어요. 내역 기록에는 영향을 주지 않아요.</div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="label">잔액 ({asset.currency_code})</label>
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
          <div><label className="label">자산 이름</label><input className="input-field" placeholder="예: ANZ 통장, 현금 지갑" value={name} onChange={e=>setName(e.target.value)} /></div>
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
