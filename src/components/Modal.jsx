import { useEffect } from 'react'

export default function Modal({ title, onClose, children, maxWidth = 480 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    // 모달 열릴 때 body 스크롤 막기
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
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px 16px',
        overflowY: 'auto',
        animation: 'fadeIn 0.2s ease',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth,
          // 높이를 화면에 맞게 자동 조절, 넘치면 내부 스크롤
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
          // 화면 중앙 정렬을 위해 margin auto
          margin: 'auto',
        }}>
        {/* 헤더 - 고정 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
          borderRadius: '20px 20px 0 0',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#f5f5f5', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#999',
            }}>
            ✕
          </button>
        </div>

        {/* 내용 - 스크롤 가능 */}
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
