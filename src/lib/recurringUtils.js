import { supabase } from './supabase'

/**
 * 앱 시작 시 호출 - 오늘 자동 추가해야 할 반복내역을 체크하고 추가
 */
export async function processRecurringRecords(uid) {
  const today = new Date()
  const pad = n => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
  const dayOfWeek = today.getDay()   // 0=일, 1=월 ... 6=토
  const dayOfMonth = today.getDate()

  const { data: recurring } = await supabase
    .from('recurring_records')
    .select('*')
    .eq('user_id', uid)
    .eq('is_active', true)

  if (!recurring?.length) return

  for (const r of recurring) {
    // 이미 오늘 추가했으면 스킵
    if (r.last_added_date === todayStr) continue

    let shouldAdd = false

    if (r.frequency === 'daily') {
      shouldAdd = true
    } else if (r.frequency === 'weekdays') {
      // 주중 (월~금)
      shouldAdd = dayOfWeek >= 1 && dayOfWeek <= 5
    } else if (r.frequency === 'weekly') {
      // 매주 특정 요일
      shouldAdd = dayOfWeek === r.day_of_week
    } else if (r.frequency === 'monthly') {
      // 매월 특정 일
      shouldAdd = dayOfMonth === r.day_of_month
    }

    if (shouldAdd) {
      // 내역 추가
      await supabase.from('records').insert({
        user_id: uid,
        type: r.type,
        amount: r.amount,
        date: todayStr,
        category: r.category,
        currency_code: r.currency_code,
        asset_id: r.asset_id,
        payment_method_id: r.payment_method_id,
        memo: r.memo ? `[반복] ${r.memo}` : '[반복]',
      })

      // 자산 잔액 업데이트
      if (r.asset_id) {
        const { data: asset } = await supabase.from('assets').select('balance').eq('id', r.asset_id).single()
        if (asset) {
          const newBal = r.type === 'income' ? asset.balance + r.amount : asset.balance - r.amount
          await supabase.from('assets').update({ balance: newBal }).eq('id', r.asset_id)
        }
      }

      // 마지막 추가 날짜 업데이트 (중복 방지)
      await supabase.from('recurring_records').update({ last_added_date: todayStr }).eq('id', r.id)
    }
  }
}
