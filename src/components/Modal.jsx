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
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        WebkitOverflowScrolling: 'touch',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth,
          display: 'flex',
          flexDirection: 'column',
          // 모바일에서 주소창 포함한 실제 높이의 85%로 제한
          maxHeight: '85dvh',
          // dvh 미지원 브라우저 fallback
          maxHeight: 'min(85dvh, calc(100vh - 80px))',
          overflow: 'hidden',
          animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}>

        {/* 헤더 - 고정 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
          background: '#fff',
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

        {/* 내용 - 스크롤 가능 */}
        <div style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '20px',
          flex: 1,
          WebkitOverflowScrolling: 'touch',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}
