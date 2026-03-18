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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth,
          /* svh = 주소창 제외한 실제 보이는 높이 */
          maxHeight: 'min(80svh, 80vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}>
        {/* 헤더 - 고정 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#f5f5f5', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, color: '#999',
          }}>✕</button>
        </div>
        {/* 내용 - 내부 스크롤 */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
