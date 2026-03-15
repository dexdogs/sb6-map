'use client'

interface Props {
  kpis: {
    totalSB6Projects: number
    totalSB6MW: number
    totalBTMSolarMW: number
    totalBESSMWh: number
  }
  onDismiss: () => void
}

export function IntroOverlay({ kpis, onDismiss }: Props) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(8, 11, 15, 0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div className="max-w-xl w-full px-6 text-center animate-fade-in">
        {/* Tag */}
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full text-xs font-mono tracking-widest uppercase"
          style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.3)', color: 'var(--gold)' }}>
          Demo #9 · dexdogs
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold mb-3 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          The SB-6 Map
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-[var(--text-secondary)] mb-8 leading-relaxed">
          Texas passed a law in 2025. Every new AI data center connecting to ERCOT
          above 75 MW must now accept emergency shutoff — or deploy on-site power.
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { label: 'Projects under SB-6', value: kpis.totalSB6Projects.toString(), color: 'var(--red)' },
            { label: 'MW exposed', value: `~${(kpis.totalSB6MW / 1000).toFixed(1)} GW`, color: 'var(--amber)' },
            { label: 'BTM solar potential', value: `${kpis.totalBTMSolarMW.toLocaleString()} MW`, color: 'var(--gold)' },
            { label: 'Paired BESS potential', value: `${(kpis.totalBESSMWh / 1000).toFixed(0)} GWh`, color: 'var(--green)' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 text-left">
              <div className="text-2xl font-mono font-semibold mb-1" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onDismiss}
          className="px-8 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--gold)', color: '#080b0f' }}
        >
          Explore the Map →
        </button>

        <p className="text-xs text-[var(--text-muted)] mt-4">
          Data: ERCOT · EIA-860 · NREL NSRDB · TX SB-6 · Press releases
        </p>
      </div>
    </div>
  )
}
