'use client'

import type { LayerState } from './MapApp'

interface Props {
  layers: LayerState
  onToggle: (key: keyof LayerState) => void
}

const OPPORTUNITY_LAYERS: { key: keyof LayerState; label: string; desc: string; color: string; icon: string }[] = [
  { key: 'solarHeatmap',  label: 'Solar Resource',      desc: 'GHI by county — NREL NSRDB',              color: '#f0a500', icon: '☀' },
  { key: 'bessRings',     label: 'BESS Compliance Rings', desc: '4CP savings + SB-6 curtailment buffer',  color: '#34d399', icon: '🔋' },
  { key: 'solarPotential',label: 'BTM Solar Potential',  desc: 'MW buildable on owned land',             color: '#fbbf24', icon: '⚡' },
  { key: 'googleProof',   label: 'Google Haskell Proof', desc: 'Solar+BESS collocated — already built',  color: '#22c55e', icon: '✓' },
]

const CONTEXT_LAYERS: { key: keyof LayerState; label: string; desc: string; color: string; icon: string }[] = [
  { key: 'powerPlants',  label: 'Power Plants',         desc: 'EIA-860 — nuclear, gas, coal, solar',    color: '#60a5fa', icon: '⚛' },
  { key: 'sb6Arcs',      label: 'SB-6 Exposure Arcs',  desc: 'Grid constraint per project',             color: '#ff4444', icon: '⤳' },
  { key: 'transmission', label: 'Substation Access',    desc: '345kV nodes + distance to project',      color: '#a78bfa', icon: '⊕' },
]

export function TogglePanel({ layers, onToggle }: Props) {
  return (
    <div className="glass rounded-xl overflow-hidden w-52" style={{ fontFamily: 'var(--font-display)' }}>
      <div className="px-3 py-2.5 border-b border-[var(--border)]">
        <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Layers</span>
      </div>

      {/* Opportunity group */}
      <div className="px-3 py-2">
        <div className="text-[9px] font-mono text-[var(--gold)] uppercase tracking-widest mb-2">The Opportunity</div>
        <div className="space-y-1">
          {OPPORTUNITY_LAYERS.map(l => (
            <ToggleRow
              key={l.key}
              {...l}
              active={layers[l.key]}
              onToggle={() => onToggle(l.key)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* Context group */}
      <div className="px-3 py-2">
        <div className="text-[9px] font-mono text-[var(--gold)] uppercase tracking-widest mb-2">The Context</div>
        <div className="space-y-1">
          {CONTEXT_LAYERS.map(l => (
            <ToggleRow
              key={l.key}
              {...l}
              active={layers[l.key]}
              onToggle={() => onToggle(l.key)}
            />
          ))}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-[var(--border)]">
        <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
          Click any marker to open project details.
        </p>
      </div>
    </div>
  )
}

function ToggleRow({ icon, label, desc, color, active, onToggle }: {
  icon: string; label: string; desc: string; color: string; active: boolean; onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-all hover:bg-[var(--bg-card)] group"
      style={{ opacity: active ? 1 : 0.55 }}
    >
      {/* Toggle pill */}
      <div
        className="relative flex-shrink-0 w-8 h-4 rounded-full transition-all"
        style={{ background: active ? color : 'var(--carbon-700, #21262d)', border: `1px solid ${active ? color : 'var(--border)'}` }}
      >
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm"
          style={{ left: active ? '14px' : '2px' }}
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">{icon}</span>
          <span className="text-xs font-medium text-[var(--text-primary)] truncate">{label}</span>
        </div>
        <div className="text-[9px] text-[var(--text-muted)] truncate">{desc}</div>
      </div>
    </button>
  )
}
