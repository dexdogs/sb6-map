'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { EnrichedDC } from '@/lib/data'
import type { PowerPlant, BTMSiting, Economics, Regulatory } from '@/lib/types'
import { TopBar } from './TopBar'
import { TogglePanel } from './TogglePanel'
import { DetailDrawer } from './DetailDrawer'
import { IntroOverlay } from './IntroOverlay'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

export interface LayerState {
  solarHeatmap: boolean
  bessRings: boolean
  solarPotential: boolean
  powerPlants: boolean
  transmission: boolean
}

interface Props {
  dataCenters: EnrichedDC[]
  powerPlants: PowerPlant[]
  btmSiting: BTMSiting[]
  economics: Economics[]
  regulatory: Regulatory[]
  kpis: {
    totalSB6Projects: number
    totalSB6MW: number
    totalBTMSolarMW: number
    totalBESSMWh: number
    avg4CPCharge: number
    googleHaskellIsProof: boolean
  }
}

export function MapApp({ dataCenters, powerPlants, btmSiting, economics, regulatory, kpis }: Props) {
  const [showIntro, setShowIntro] = useState(true)
  const [selectedDC, setSelectedDC] = useState<EnrichedDC | null>(null)
  const [activeView, setActiveView] = useState<'map' | 'case'>('map')
  const [layers, setLayers] = useState<LayerState>({
    solarHeatmap: true,
    bessRings: false,
    solarPotential: false,
    powerPlants: false,
    transmission: false,
  })

  const toggleLayer = useCallback((key: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSelectDC = useCallback((dc: EnrichedDC | null) => {
    setSelectedDC(dc)
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#080b0f' }}>
      {showIntro && (
        <IntroOverlay kpis={kpis} onDismiss={() => setShowIntro(false)} />
      )}

      <TopBar activeView={activeView} onViewChange={setActiveView} kpis={kpis} />

      {activeView === 'map' && (
        <>
          <MapView
            dataCenters={dataCenters}
            powerPlants={powerPlants}
            layers={layers}
            selectedDC={selectedDC}
            onSelectDC={handleSelectDC}
          />

          <div className="absolute left-4 top-[72px] z-20 animate-fade-in">
            <TogglePanel layers={layers} onToggle={toggleLayer} />
          </div>

          {selectedDC && (
            <DetailDrawer
              dc={selectedDC}
              economics={economics}
              regulatory={regulatory}
              onClose={() => setSelectedDC(null)}
            />
          )}
        </>
      )}

      {activeView === 'case' && (
        <div className="absolute inset-0 top-[56px] overflow-y-auto z-10">
          <CaseView
            dataCenters={dataCenters}
            btmSiting={btmSiting}
            economics={economics}
            regulatory={regulatory}
            kpis={kpis}
          />
        </div>
      )}
    </div>
  )
}

function CaseView({ dataCenters, btmSiting, economics, regulatory, kpis }: Omit<Props, 'powerPlants'>) {
  const mandatory = dataCenters.filter(dc =>
    (dc.sb6_applies?.toLowerCase() || '').includes('yes')
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-16">
      <section className="animate-fade-in">
        <div className="text-xs font-mono text-[var(--gold)] tracking-widest mb-3 uppercase">01 — What SB-6 Did</div>
        <h2 className="text-3xl font-semibold mb-6" style={{ lineHeight: 1.2 }}>
          Texas passed a law in June 2025.<br />
          <span className="text-[var(--red)]">Every new data center connecting to ERCOT</span><br />
          now lives under new rules.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Mandatory curtailment', text: 'New loads ≥75MW connecting after Dec 31 2025 must install remote disconnect equipment before energization.' },
            { label: 'Backup gen disclosure', text: 'Must disclose on-site backup generation to ERCOT. If it serves ≥50% of demand, ERCOT can direct its deployment during emergencies.' },
            { label: '4CP cost allocation', text: 'Large loads now bear full interconnection costs. The 4CP methodology review could raise transmission charges further.' },
          ].map(item => (
            <div key={item.label} className="glass-card p-4">
              <div className="text-xs font-mono text-[var(--gold)] mb-2 uppercase tracking-wide">{item.label}</div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-xs font-mono text-[var(--gold)] tracking-widest mb-3 uppercase">02 — Who&apos;s Exposed</div>
        <h2 className="text-2xl font-semibold mb-6">{mandatory.length} named projects. No disclosed BTM strategy for most.</h2>
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]" style={{ background: 'var(--bg-card)' }}>
                {['Project', 'County', 'MW (IT)', 'Energization', 'BTM Strategy'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-mono text-[var(--text-muted)] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mandatory.map((dc) => (
                <tr key={dc.project_name} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    {dc.project_name.replace(' (Crusoe/Oracle/OpenAI)', '').replace(' (Vantage/Oracle Stargate)', '')}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{dc.county}</td>
                  <td className="px-4 py-3 text-[var(--gold)] font-mono">{dc.capacity_mw_it ? `${dc.capacity_mw_it} MW` : 'TBD'}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">{dc.expected_energization_date}</td>
                  <td className="px-4 py-3">
                    {dc.project_name.includes('Google Haskell DC1') ? (
                      <span className="badge-exempt px-2 py-0.5 rounded text-xs font-medium">Solar+BESS collocated ✓</span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs">None disclosed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="text-xs font-mono text-[var(--gold)] tracking-widest mb-3 uppercase">03 — The Resource Is There</div>
        <h2 className="text-2xl font-semibold mb-2">West Texas has better solar than most of Arizona.</h2>
        <p className="text-[var(--text-secondary)] mb-6">NREL NSRDB annual average GHI at exact project coordinates.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {btmSiting.map(b => (
            <div key={b.project_name} className="glass-card p-4">
              <div className="text-xs text-[var(--text-muted)] mb-1 truncate">{b.project_name.split(' (')[0]}</div>
              <div className="text-2xl font-mono font-semibold" style={{ color: b.ghi_kwh_m2_day > 5.7 ? 'var(--gold)' : 'var(--text-primary)' }}>
                {b.ghi_kwh_m2_day}
              </div>
              <div className="text-xs text-[var(--text-muted)]">kWh/m²/day GHI</div>
              <div className="text-xs text-[var(--green)] mt-2">{b.btm_solar_mw_potential} MW potential</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-xs font-mono text-[var(--gold)] tracking-widest mb-3 uppercase">04 — The Economics Work</div>
        <h2 className="text-2xl font-semibold mb-6">4CP charges alone make the BESS case.</h2>
        <div className="space-y-3">
          {economics.map(e => (
            <div key={e.project_name} className="glass-card p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium mb-1">{e.project_name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{e.county} County</div>
                </div>
                <div className="flex gap-6 text-right flex-wrap">
                  <div>
                    <div className="text-xs text-[var(--text-muted)] mb-0.5">4CP annual charge</div>
                    <div className="font-mono text-[var(--red)]">${((e['4cp_annual_transmission_charge_usd'] || 0) / 1e6).toFixed(1)}M/yr</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted)] mb-0.5">BESS capex</div>
                    <div className="font-mono text-[var(--blue)]">${(e.bess_capex_usd_m || 0).toFixed(0)}M</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted)] mb-0.5">4CP savings/yr</div>
                    <div className="font-mono text-[var(--green)]">${(e['4cp_annual_savings_usd_m'] || 0).toFixed(1)}M/yr</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-xs font-mono text-[var(--gold)] tracking-widest mb-3 uppercase">05 — Google Already Did It</div>
        <div className="glass-card p-6 border-[var(--gold)] border">
          <div className="flex items-start gap-4">
            <div className="text-4xl">⚡</div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Google Haskell County DC1</h3>
              <p className="text-[var(--text-secondary)] mb-3 leading-relaxed">
                One of Google&apos;s two new Haskell County data centers is explicitly co-located with
                an Intersect Power solar and battery storage plant — creating the first industrial
                park of its kind in Texas. Announced November 14, 2025.
              </p>
              <div className="mt-4 flex gap-3 flex-wrap">
                <span className="badge-exempt px-3 py-1 rounded-full text-xs font-medium">SB-6 compliant by design</span>
                <span className="glass px-3 py-1 rounded-full text-xs">GHI: 5.72 kWh/m²/day</span>
                <span className="glass px-3 py-1 rounded-full text-xs">$40B Texas investment</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-4 text-center">
          This is not theoretical. It is under construction.
        </p>
      </section>

      <footer className="text-center text-xs text-[var(--text-muted)] pb-8">
        <div className="mb-2">Sources: ERCOT Large Load Q&A Dec 2025 · EIA Form 860 Final 2024 · NREL NSRDB PSM v3.0 · NREL TP-6A40-93281 · TX SB-6 (PURA §39.170) · Google/Oracle/Crusoe press releases</div>
        <div>Built by dexdogs · Demo #9</div>
      </footer>
    </div>
  )
}
