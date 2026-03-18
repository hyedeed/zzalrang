/**
 * 공통 모달 컴포넌트
 * - 바깥 어두운 배경 클릭하면 닫힘
 * - 상단 오른쪽 X 버튼으로 닫힘
 * - ESC 키로 닫힘
 */
import { useEffect } from 'react'

export default function Modal({ title, onClose, children, maxWidth = 480 }) {
  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
        animation: 'fadeIn 0.2s ease',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0
        }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#f5f5f5', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#999', transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e0e0e0'}
            onMouseLeave={e => e.currentTarget.style.background = '#f5f5f5'}>
            ✕
          </button>
        </div>

        {/* 내용 - 스크롤 가능 */}
        <div style={{ overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
