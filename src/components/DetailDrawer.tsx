'use client'

import { useState } from 'react'
import type { EnrichedDC } from '@/lib/data'
import type { Economics, Regulatory } from '@/lib/types'
import { getSB6Status, getSB6Color, formatMW, formatUSD } from '@/lib/types'

interface Props {
  dc: EnrichedDC
  economics: Economics[]
  regulatory: Regulatory[]
  onClose: () => void
}

type Tab = 'project' | 'solar' | 'economics' | 'sb6'

export function DetailDrawer({ dc, economics, regulatory, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('project')

  const status = getSB6Status(dc)
  const color = getSB6Color(status)
  const econ = dc.econ
  const btm = dc.btm
  const isGoogle = dc.project_name.includes('Google Haskell DC1')
  const isMandatory = status === 'mandatory'

  const badgeClass = status === 'mandatory' ? 'badge-mandatory' : status === 'exempt' ? 'badge-exempt' : 'badge-check'

  return (
    <div
      className="absolute right-0 top-[56px] bottom-0 z-30 flex flex-col animate-slide-in"
      style={{ width: '420px', background: 'rgba(8,11,15,0.96)', borderLeft: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex-1 min-w-0">
          <div className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide mb-2 ${badgeClass}`}>
            {status === 'mandatory' ? 'SB-6 Mandatory' : status === 'exempt' ? 'Exempt' : 'Verify Territory'}
          </div>
          <h2 className="text-base font-semibold leading-tight pr-4" style={{ fontFamily: 'var(--font-display)' }}>
            {dc.project_name.replace(' (Crusoe/Oracle/OpenAI)', '').replace(' (Vantage/Oracle Stargate)', '')}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{dc.developer}</p>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none mt-0.5 flex-shrink-0"
        >×</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] px-2">
        {([
          { id: 'project', label: 'Project' },
          { id: 'solar', label: 'Solar+BESS' },
          { id: 'economics', label: 'Economics' },
          { id: 'sb6', label: 'SB-6 Detail' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2.5 text-xs font-medium transition-colors ${
              tab === t.id ? 'text-[var(--gold)] tab-active' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'project' && <ProjectTab dc={dc} color={color} status={status} />}
        {tab === 'solar' && <SolarTab dc={dc} btm={btm} isGoogle={isGoogle} />}
        {tab === 'economics' && <EconomicsTab dc={dc} econ={econ} />}
        {tab === 'sb6' && <SB6Tab dc={dc} regulatory={regulatory} isMandatory={isMandatory} />}
      </div>
    </div>
  )
}

function ProjectTab({ dc, color, status }: { dc: EnrichedDC; color: string; status: string }) {
  return (
    <div className="p-5 space-y-4">
      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'IT Load', value: formatMW(dc.capacity_mw_it) },
          { label: 'Total Load', value: formatMW(dc.capacity_mw_total) },
          { label: 'Site', value: dc.site_acres ? `${dc.site_acres.toLocaleString()} acres` : '—' },
          { label: 'County', value: `${dc.county}, TX` },
          { label: 'Utility/TSP', value: dc.utility_tsp || '—' },
          { label: 'Status', value: dc.status || '—' },
        ].map(item => (
          <div key={item.label} className="glass-card p-3">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{item.label}</div>
            <div className="text-sm font-medium">{item.value}</div>
          </div>
        ))}
      </div>

      {/* SB-6 summary card */}
      <div className="rounded-lg p-4" style={{ background: `${color}11`, border: `1px solid ${color}44` }}>
        <div className="text-xs font-mono uppercase tracking-wide mb-2" style={{ color }}>SB-6 Status</div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{dc.sb6_curtailment_obligation}</p>
        {dc.expected_energization_date && (
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            Energization: <span className="text-[var(--text-primary)]">{dc.expected_energization_date}</span>
          </div>
        )}
      </div>

      {/* Bridge power */}
      {dc.bridge_power_type && (
        <div className="glass-card p-4">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">Current bridge power</div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{dc.bridge_power_type}</p>
        </div>
      )}

      {/* Source */}
      {dc.source_url && dc.source_url !== 'undefined' && (
        <a href={dc.source_url} target="_blank" rel="noopener noreferrer"
          className="block text-xs text-[var(--blue)] hover:underline truncate">
          ↗ Source
        </a>
      )}
    </div>
  )
}

function SolarTab({ dc, btm, isGoogle }: { dc: EnrichedDC; btm: any; isGoogle: boolean }) {
  if (!btm) return (
    <div className="p-5 text-center text-[var(--text-muted)] text-sm pt-12">
      No BTM siting data for this project.
    </div>
  )

  const coveragePct = btm.covers_pct_of_dc_it_load || 0
  const coverageW = Math.min(100, Math.round(coveragePct * 100))

  return (
    <div className="p-5 space-y-4">
      {/* Google proof banner */}
      {isGoogle && (
        <div className="rounded-lg p-3 border border-[var(--green)]" style={{ background: 'rgba(34,197,94,0.08)' }}>
          <div className="text-xs font-semibold text-[var(--green)] mb-1">★ The proof case</div>
          <p className="text-xs text-[var(--text-secondary)]">
            This project is explicitly co-located with an Intersect Power solar+BESS plant.
            It is the model this demo argues for — already under construction.
          </p>
        </div>
      )}

      {/* Solar resource */}
      <div>
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-3">The Resource</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card p-3 text-center">
            <div className="text-xl font-mono font-semibold text-[var(--gold)]">{btm.ghi_kwh_m2_day}</div>
            <div className="text-[9px] text-[var(--text-muted)] mt-0.5">GHI kWh/m²/day</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-xl font-mono font-semibold text-[var(--gold)]">{btm.dni_kwh_m2_day}</div>
            <div className="text-[9px] text-[var(--text-muted)] mt-0.5">DNI kWh/m²/day</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-xl font-mono font-semibold text-[var(--text-primary)]">
              {Math.round(btm.solar_capacity_factor_pct * 100)}%
            </div>
            <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Capacity factor</div>
          </div>
        </div>
      </div>

      {/* Coverage bar */}
      <div>
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-3">The Potential</div>
        <div className="space-y-2.5">
          {[
            { label: 'BTM Solar potential', value: `${btm.btm_solar_mw_potential} MW`, pct: coverageW, color: '#fbbf24' },
            { label: 'BESS paired (1:1)', value: `${btm.bess_mw_paired_1to1} MW`, pct: coverageW, color: '#34d399' },
            { label: 'BESS capacity (4hr)', value: `${btm.bess_mwh_4hr?.toLocaleString()} MWh`, pct: Math.min(100, coverageW), color: '#60a5fa' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">{item.label}</span>
                <span className="font-mono font-medium" style={{ color: item.color }}>{item.value}</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-card)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, background: item.color }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-[var(--text-muted)]">
          Covers <span className="text-[var(--text-primary)] font-medium">{Math.round(coveragePct * 100)}%</span> of IT load
          {coveragePct > 1 && <span className="text-[var(--green)]"> — resource exceeds load</span>}
        </div>
      </div>

      {/* Speed comparison */}
      <div>
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-3">The Path</div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 glass-card p-3">
            <div className="w-2 h-2 rounded-full bg-[var(--green)] flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium">Solar + BESS (BTM)</div>
              <div className="text-[10px] text-[var(--text-muted)]">{btm.estimated_deploy_months}</div>
            </div>
            <div className="text-xs font-mono text-[var(--green)]">✓ Fast</div>
          </div>
          <div className="flex items-center gap-3 glass-card p-3" style={{ opacity: 0.6 }}>
            <div className="w-2 h-2 rounded-full bg-[var(--red)] flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium">Gas turbines (bridge)</div>
              <div className="text-[10px] text-[var(--text-muted)]">18-24 months procurement alone</div>
            </div>
            <div className="text-xs font-mono text-[var(--red)]">Slower</div>
          </div>
        </div>
      </div>

      {/* Nearest substation */}
      {btm.nearest_substation_name && (
        <div className="glass-card p-3">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Nearest substation</div>
          <div className="text-xs font-medium">{btm.nearest_substation_name}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{btm.nearest_substation_dist_miles} miles · {btm.nearest_transmission_kv}kV</div>
        </div>
      )}
    </div>
  )
}

function EconomicsTab({ dc, econ }: { dc: EnrichedDC; econ: any }) {
  if (!econ) return (
    <div className="p-5 text-center text-[var(--text-muted)] text-sm pt-12">
      Economics data not available for this project.
    </div>
  )

  const isGoogle = dc.project_name.includes('Google Haskell DC1')

  return (
    <div className="p-5 space-y-4">
      {/* 4CP charge */}
      <div className="rounded-lg p-4" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)' }}>
        <div className="text-[10px] text-[var(--red)] uppercase tracking-wide mb-1">4CP annual transmission charge</div>
        <div className="text-2xl font-mono font-semibold text-[var(--red)]">
          ${((econ['4cp_annual_transmission_charge_usd'] || 0) / 1e6).toFixed(1)}M/yr
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          Without BESS: {econ.curtailment_risk_without_bess?.split('.')[0]}
        </div>
      </div>

      {/* Comparison table */}
      <div>
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-3">BTM Solar+BESS vs Gas Bridge</div>
        <div className="space-y-2">
          {[
            { label: 'BESS sizing', with: `${econ.bess_mw_for_compliance} MW / ${econ.bess_mwh_4hr} MWh`, without: 'Not deployed' },
            { label: 'BESS capex', with: formatUSD(econ.bess_capex_usd_m), without: '—' },
            { label: 'Solar BTM', with: `${econ.solar_mw_btm} MW`, without: '—' },
            { label: 'Solar capex', with: formatUSD(econ.solar_capex_usd_m), without: '—' },
            { label: 'Total BTM capex', with: formatUSD(econ.total_btm_capex_usd_m), without: '—' },
            { label: 'Gas bridge', with: 'Not needed', without: formatUSD(econ.gas_bridge_capex_usd_m) || '—' },
          ].map(row => (
            <div key={row.label} className="grid grid-cols-3 gap-1 items-center">
              <div className="text-[10px] text-[var(--text-muted)]">{row.label}</div>
              <div className="glass-card px-2 py-1.5 text-center">
                <div className="text-[10px] text-[var(--green)] font-medium">{row.with}</div>
              </div>
              <div className="glass-card px-2 py-1.5 text-center opacity-50">
                <div className="text-[10px] text-[var(--red)]">{row.without}</div>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-1 items-center pt-1 border-t border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-muted)]">4CP savings/yr</div>
            <div className="glass-card px-2 py-1.5 text-center" style={{ border: '1px solid rgba(34,197,94,0.4)' }}>
              <div className="text-[10px] text-[var(--green)] font-semibold">${(econ['4cp_annual_savings_usd_m'] || 0).toFixed(1)}M/yr</div>
            </div>
            <div className="glass-card px-2 py-1.5 text-center opacity-40">
              <div className="text-[10px] text-[var(--red)]">$0</div>
            </div>
          </div>
        </div>
      </div>

      {/* SB-6 compliance pathway */}
      {econ.sb6_compliance_pathway && (
        <div className="glass-card p-3">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Compliance pathway</div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{econ.sb6_compliance_pathway}</p>
        </div>
      )}

      {isGoogle && (
        <div className="rounded-lg p-3 border border-[var(--green)]" style={{ background: 'rgba(34,197,94,0.06)' }}>
          <p className="text-xs text-[var(--green)] font-medium">★ This project has already chosen solar+BESS colocation. It is the benchmark.</p>
        </div>
      )}
    </div>
  )
}

function SB6Tab({ dc, regulatory, isMandatory }: { dc: EnrichedDC; regulatory: Regulatory[]; isMandatory: boolean }) {
  const checklist = [
    { label: 'Interconnection study fee ≥$100,000', required: isMandatory },
    { label: 'Site control documentation', required: isMandatory },
    { label: 'Backup generation disclosure (if ≥50% of demand)', required: isMandatory },
    { label: 'Remote disconnect (kill switch) before energization', required: isMandatory },
    { label: '4CP transmission cost allocation', required: true },
    { label: 'Duplicate TX interconnection disclosure', required: isMandatory },
  ]

  const mandatoryRegs = regulatory.filter(r =>
    r.provision.includes('Mandatory') || r.provision.includes('Interconnection Standards')
  ).slice(0, 3)

  return (
    <div className="p-5 space-y-4">
      {/* Status */}
      <div className="rounded-lg p-4" style={{
        background: isMandatory ? 'rgba(255,68,68,0.08)' : 'rgba(34,197,94,0.08)',
        border: `1px solid ${isMandatory ? 'rgba(255,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`
      }}>
        <div className="text-xs font-semibold mb-1" style={{ color: isMandatory ? 'var(--red)' : 'var(--green)' }}>
          {isMandatory ? 'SB-6 Mandatory' : 'Exempt from SB-6 curtailment'}
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{dc.sb6_curtailment_obligation}</p>
      </div>

      {/* Checklist */}
      <div>
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-3">Obligations checklist</div>
        <div className="space-y-1.5">
          {checklist.map(item => (
            <div key={item.label} className="flex items-start gap-2.5 py-1">
              <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-[9px] ${
                item.required
                  ? 'bg-[var(--red)] bg-opacity-20 border border-[var(--red)] border-opacity-50 text-[var(--red)]'
                  : 'bg-[var(--text-muted)] bg-opacity-10 border border-[var(--text-muted)] border-opacity-30 text-[var(--text-muted)]'
              }`}>
                {item.required ? '!' : '—'}
              </div>
              <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key regulations */}
      <div>
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-3">Key provisions</div>
        <div className="space-y-2">
          {mandatoryRegs.map(r => (
            <div key={r.provision} className="glass-card p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-xs font-medium leading-tight">{r.provision}</div>
                <span className="text-[9px] font-mono text-[var(--gold)] flex-shrink-0">{r.pura_section}</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                {r.bess_impact?.slice(0, 140)}…
              </p>
              <div className="mt-1.5 text-[9px]" style={{
                color: r.current_status.includes('ACTIVE') || r.current_status.includes('EFFECTIVE') ? 'var(--green)' : 'var(--amber)'
              }}>
                {r.current_status?.split('—')[0]?.trim()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-[var(--text-muted)] text-center pb-1">
        Source: TX SB-6 (PURA §39.170) · PUCT Projects 58317/58481/58482
      </div>
    </div>
  )
}
