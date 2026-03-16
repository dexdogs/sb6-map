'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { EnrichedDC } from '@/lib/data'
import type { PowerPlant, BTMSiting, Economics, Regulatory } from '@/lib/types'
import { TopBar } from './TopBar'
import { TogglePanel } from './TogglePanel'
import { DetailDrawer } from './DetailDrawer'
import { CompareBar } from './CompareBar'
import { IntroOverlay } from './IntroOverlay'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

export interface LayerState {
  bessRings: boolean
  solarPotential: boolean
  powerPlants: boolean
  transmission: boolean
  solarHeatmap: boolean
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
    bessRings: false,
    solarPotential: false,
    powerPlants: false,
    transmission: false,
    solarHeatmap: true,
  })

  const toggleLayer = useCallback((key: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSelectDC = useCallback((dc: EnrichedDC | null) => {
    setSelectedDC(dc)
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#080b0f' }}>
      {/* Intro overlay */}
      {showIntro && (
        <IntroOverlay
          kpis={kpis}
          onDismiss={() => setShowIntro(false)}
        />
      )}

      {/* Top navigation bar */}
      <TopBar
        activeView={activeView}
        onViewChange={setActiveView}
        kpis={kpis}
      />

      {/* Map view */}
      {activeView === 'map' && (
        <>
          <MapView
            dataCenters={dataCenters}
            powerPlants={powerPlants}
            layers={layers}
            selectedDC={selectedDC}
            onSelectDC={handleSelectDC}
          />

          {/* Left toggle panel */}
          <div className="absolute left-4 top-[72px] z-20 animate-fade-in">
            <TogglePanel layers={layers} onToggle={toggleLayer} />
          </div>
          ))}
        </div>
      </section>

      {/* Section 4 */}
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

      {/* Section 5 */}
      <section>
        <div className="text-xs font-mono text-[var(--gold)] tracking-widest mb-3 uppercase">05 — Google Already Did It</div>
        <div className="glass-card p-6 border-[var(--gold)] border">
          <div className="flex items-start gap-4">
            <div className="text-4xl">⚡</div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Google Haskell County DC1</h3>
              <p className="text-[var(--text-secondary)] mb-3 leading-relaxed">
                One of Google's two new Haskell County data centers is explicitly co-located with
                an Intersect Power solar and battery storage plant — creating the first industrial
                park of its kind in Texas. Announced November 14, 2025.
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--gold)' }}>
                "Designed to reduce the need for new infrastructure and ease demands on the Texas power grid."
                <span className="text-[var(--text-muted)] font-normal"> — Google, Nov 2025</span>
              </p>
              <div className="mt-4 flex gap-3 flex-wrap">
                <span className="badge-exempt px-3 py-1 rounded-full text-xs font-medium">SB-6 compliant by design</span>
                <span className="glass px-3 py-1 rounded-full text-xs">GHI: 5.72 kWh/m²/day</span>
                <span className="glass px-3 py-1 rounded-full text-xs">No §39.169 review required</span>
                <span className="glass px-3 py-1 rounded-full text-xs">$40B Texas investment</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-4 text-center">
          This is not theoretical. It is under construction.
        </p>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-[var(--text-muted)] pb-8">
        <div className="mb-2">Sources: ERCOT Large Load Q&A Dec 2025 · EIA Form 860 Final 2024 · NREL NSRDB PSM v3.0 · NREL TP-6A40-93281 · TX SB-6 (PURA §39.170) · Google/Oracle/Crusoe press releases</div>
        <div>Built by dexdogs · Demo #9</div>
      </footer>
    </div>
  )
}
