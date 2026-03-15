'use client'

interface Props {
  activeView: 'map' | 'case'
  onViewChange: (v: 'map' | 'case') => void
  kpis: {
    totalSB6Projects: number
    totalSB6MW: number
    totalBTMSolarMW: number
    totalBESSMWh: number
    avg4CPCharge: number
  }
}

export function TopBar({ activeView, onViewChange, kpis }: Props) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14"
      style={{ background: 'rgba(8,11,15,0.95)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}
    >
      {/* Left: wordmark + nav */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse-slow" style={{ background: 'var(--red)' }} />
          <span className="font-semibold text-sm tracking-tight">The SB-6 Map</span>
          <span className="text-xs text-[var(--text-muted)] font-mono ml-1">Texas</span>
        </div>

        <nav className="flex items-center gap-1">
          {(['map', 'case'] as const).map(v => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`relative px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeView === v
                  ? 'text-[var(--gold)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              } ${activeView === v ? 'tab-active' : ''}`}
            >
              {v === 'map' ? '⬡ Map' : '⟐ The Case'}
            </button>
          ))}
        </nav>
      </div>

      {/* Right: KPI chips */}
      <div className="hidden md:flex items-center gap-3">
        <Chip label="Under SB-6" value={`${kpis.totalSB6Projects} projects`} color="var(--red)" />
        <Chip label="BTM solar potential" value={`${kpis.totalBTMSolarMW.toLocaleString()} MW`} color="var(--gold)" />
        <Chip label="4CP charge" value="$42.5K/MW/yr" color="var(--amber)" />
        <Chip label="Google Haskell" value="Already built ✓" color="var(--green)" />
      </div>
    </div>
  )
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-mono font-medium" style={{ color }}>{value}</span>
    </div>
  )
}
