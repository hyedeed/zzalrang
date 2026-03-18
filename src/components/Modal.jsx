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
        position: 'fixed', top:0, left:0, right:0, bottom:0,
        background: 'rgba(0,0,0,0.5)',
        // 핵심: 오버레이 자체가 스크롤되고, flex-start로 위에서부터 배치
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '60px 16px 40px', // 위 60px 여백으로 절대 안 잘림
        WebkitOverflowScrolling: 'touch',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth,
          // 높이 제한 없음 - 오버레이가 스크롤됨
          flexShrink: 0,
          animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}>

        {/* 헤더 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid #f0f0f0',
          borderRadius: '20px 20px 0 0',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#424242' }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#f5f5f5', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: '#999', flexShrink: 0,
            }}>
            ✕
          </button>
        </div>

        {/* 내용 - 높이 제한 없이 전부 표시 */}
        <div style={{ padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
