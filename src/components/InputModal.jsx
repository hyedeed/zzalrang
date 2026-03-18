import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const LAST_CURRENCY_KEY = 'zzalrang_last_currency'
const LAST_PAYMENT_KEY  = 'zzalrang_last_payment'

export default function InputModal({ session, record, assets, paymentMethods, currencies, categories, initialDate, onClose, onSaved }) {
  const uid = session.user.id

  // 마지막 입력값 불러오기
  const lastCurrency = localStorage.getItem(LAST_CURRENCY_KEY) || currencies[0]?.code || 'KRW'
  const lastPaymentId = parseInt(localStorage.getItem(LAST_PAYMENT_KEY)) || paymentMethods[0]?.id || null

  const [type, setType] = useState(record?.type || 'expense')
  const [amount, setAmount] = useState(record?.amount?.toString() || '')
  const [currency, setCurrency] = useState(record?.currency_code || lastCurrency)
  const [category, setCategory] = useState(record?.category || '')
  const [date, setDate] = useState(record?.date || initialDate || new Date().toISOString().split('T')[0])
  const [memo, setMemo] = useState(record?.memo || '')
  const [paymentMethodId, setPaymentMethodId] = useState(record?.payment_method_id || lastPaymentId)
  const [fromAssetId, setFromAssetId] = useState(record?.asset_id || assets[0]?.id || null)
  const [toAssetId, setToAssetId] = useState(record?.to_asset_id || assets[1]?.id || null)
  const [saving, setSaving] = useState(false)

  const expenseCats = categories.filter(c => c.type === 'expense')
  const incomeCats  = categories.filter(c => c.type === 'income')
  const currentCats = type === 'income' ? incomeCats : expenseCats

  // 통화에 맞는 결제수단만 필터링
  // 결제수단 → 연결된 자산 → 그 자산의 currency_code 가 현재 통화와 일치하는 것만
  const filteredPayments = paymentMethods.filter(p => {
    if (!p.linked_asset_id) return true // 자산 미연결이면 다 보임
    const linkedAsset = assets.find(a => a.id === p.linked_asset_id)
    return !linkedAsset || linkedAsset.currency_code === currency
  })

  // 통화 바뀌면 → 그 통화의 첫 번째 결제수단으로 자동 변경
  useEffect(() => {
    if (record) return // 수정 모드면 건드리지 않음
    const matched = filteredPayments[0]
    if (matched) setPaymentMethodId(matched.id)
  }, [currency])

  useEffect(() => {
    if (!record) setCategory(currentCats[0]?.name || '')
  }, [type])

  const dismissKeyboard = () => {
    if (document.activeElement) document.activeElement.blur()
  }

  const handleSave = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { alert('금액을 확인해주세요!'); return }
    setSaving(true)
    try {
      let assetId = null
      if (type === 'transfer') {
        assetId = fromAssetId
      } else {
        const pm = paymentMethods.find(p => p.id === paymentMethodId)
        assetId = pm?.linked_asset_id || null
      }
      const payload = {
        user_id: uid, type, amount: amt, date,
        category: type === 'transfer' ? '이체' : category,
        currency_code: currency,
        asset_id: assetId,
        to_asset_id: type === 'transfer' ? toAssetId : null,
        payment_method_id: type !== 'transfer' ? paymentMethodId : null,
        memo: memo || null,
      }
      if (record) {
        await supabase.from('records').update(payload).eq('id', record.id)
      } else {
        await supabase.from('records').insert(payload)
        // 자산 잔액 업데이트
        if (assetId) {
          const { data: fa } = await supabase.from('assets').select('balance').eq('id', assetId).single()
          if (fa) {
            let nb = fa.balance
            if (type === 'expense') nb -= amt
            else if (type === 'income') nb += amt
            else if (type === 'transfer') nb -= amt
            await supabase.from('assets').update({ balance: nb }).eq('id', assetId)
          }
          if (type === 'transfer' && toAssetId) {
            const { data: ta } = await supabase.from('assets').select('balance').eq('id', toAssetId).single()
            if (ta) await supabase.from('assets').update({ balance: ta.balance + amt }).eq('id', toAssetId)
          }
        }
      }

      // 마지막 입력값 저장 (통화, 결제수단)
      localStorage.setItem(LAST_CURRENCY_KEY, currency)
      if (paymentMethodId) localStorage.setItem(LAST_PAYMENT_KEY, String(paymentMethodId))

      onSaved()
    } finally { setSaving(false) }
  }

  const typeColor = { expense: 'var(--color-expense)', income: 'var(--color-income)', transfer: 'var(--color-transfer)' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}
      style={{ alignItems: 'flex-end', padding: 0 }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        width: '100%',
        maxWidth: 480,
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{record ? '내역 수정' : '내역 입력'}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={dismissKeyboard}
              style={{ background: '#f5f5f5', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="12" rx="2"/><path d="M6 14l6 4 6-4"/>
              </svg>
            </button>
            <span className="modal-close" onClick={onClose}>✕</span>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
          <div className="chip-tabs" style={{ marginBottom: 20 }}>
            {['expense', 'income', 'transfer'].map(t => (
              <button key={t} className={`chip-tab ${type === t ? 'active' : ''}`}
                style={{ color: type === t ? typeColor[t] : undefined }}
                onClick={() => setType(t)}>
                {t === 'expense' ? '지출' : t === 'income' ? '수입' : '이체'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 금액 + 통화 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 2 }}>
                <label className="label">금액</label>
                <input className="input-field" type="number" placeholder="0" value={amount}
                  onChange={e => setAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">통화</label>
                <select className="input-field" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                  {!currencies.length && <option value="KRW">KRW</option>}
                </select>
              </div>
            </div>

            {/* 결제수단 / 자산 */}
            {type !== 'transfer' ? (
              <div>
                <label className="label">결제 수단</label>
                <select className="input-field" value={paymentMethodId || ''} onChange={e => setPaymentMethodId(Number(e.target.value))}>
                  {filteredPayments.map(p => {
                    const linked = assets.find(a => a.id === p.linked_asset_id)
                    return <option key={p.id} value={p.id}>{p.name}{linked ? ` (${linked.name})` : ''}</option>
                  })}
                  {!filteredPayments.length && <option value="">결제 수단 없음 (설정에서 추가)</option>}
                </select>
                {/* 통화별 힌트 */}
                {filteredPayments.length > 0 && (
                  <div style={{ fontSize:11, color:'#bbb', marginTop:4 }}>
                    {currency} 통화 자산에 연결된 결제수단만 표시돼요
                  </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className="label">보내는 자산</label>
                  <select className="input-field" value={fromAssetId || ''} onChange={e => setFromAssetId(Number(e.target.value))}>
                    {assets.map(a => <option key={a.id} value={a.id}>[{a.currency_code}] {a.name}</option>)}
                  </select>
                </div>
                <div style={{ textAlign: 'center', color: '#ccc', fontSize: 18 }}>↓</div>
                <div>
                  <label className="label">받는 자산</label>
                  <select className="input-field" value={toAssetId || ''} onChange={e => setToAssetId(Number(e.target.value))}>
                    {assets.map(a => <option key={a.id} value={a.id}>[{a.currency_code}] {a.name}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* 카테고리 */}
            {type !== 'transfer' && (
              <div>
                <label className="label">카테고리</label>
                <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
                  {currentCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  {!currentCats.length && <option value="기타">기타</option>}
                </select>
              </div>
            )}

            {/* 날짜 */}
            <div>
              <label className="label">날짜</label>
              <input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>

            {/* 메모 */}
            <div>
              <label className="label">메모 (선택)</label>
              <input className="input-field" type="text" placeholder="메모를 입력하세요" value={memo} onChange={e => setMemo(e.target.value)} />
            </div>
          </div>
        </div>

        {/* 저장 버튼 하단 고정 */}
        <div style={{ padding: '12px 20px 24px', flexShrink: 0 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
