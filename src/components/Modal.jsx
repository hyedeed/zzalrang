import { useEffect } from 'react'

export default function Modal({ title, onClose, children, maxWidth = 480 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        overflowY: 'auto',          // ← 오버레이가 스크롤됨
        WebkitOverflowScrolling: 'touch',
      }}>
      {/* 이 div가 오버레이 전체를 채우면서 모달을 가운데 정렬 */}
      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 16px',     // 위아래 40px 여백 → 절대 안 잘림
          boxSizing: 'border-box',
        }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff',
            borderRadius: 20,
            width: '100%',
            maxWidth,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}>
          {/* 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px', borderBottom: '1px solid #f0f0f0',
            borderRadius: '20px 20px 0 0',
          }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#f5f5f5', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: '#999',
            }}>✕</button>
          </div>
          {/* 내용 - 높이 제한 없이 전부 표시 */}
          <div style={{ padding: '20px' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
