'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import type { EnrichedDC } from '@/lib/data'
import type { Economics } from '@/lib/types'
import { getSB6Status, getSB6Color } from '@/lib/types'

interface Props {
  dataCenters: EnrichedDC[]
  economics: Economics[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-3 text-xs" style={{ minWidth: 160 }}>
      <div className="font-medium mb-2 text-[var(--text-primary)]">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono">{p.value ? `${p.value} MW` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

export function CompareBar({ dataCenters, economics }: Props) {
  const sb6Projects = dataCenters.filter(dc => getSB6Status(dc) === 'mandatory' && dc.btm)

  const chartData = sb6Projects.map(dc => {
    const econ = economics.find(e => e.project_name === dc.project_name)
    const shortName = dc.project_name
      .replace(' (Crusoe/Oracle/OpenAI)', '')
      .replace(' (Vantage/Oracle Stargate)', '')
      .replace('Stargate Abilene ', 'Stargate ')
      .replace('Project Frontier', 'Frontier')
      .replace('PowerHouse DFW Megacampus', 'DFW Mega')
      .replace('Tract Caldwell County', 'Caldwell')
      .replace('Stream San Antonio III', 'Stream SA')

    return {
      name: shortName,
      itLoad: dc.capacity_mw_it || 0,
      solarPotential: dc.btm?.btm_solar_mw_potential || 0,
      bessMW: dc.btm?.bess_mw_paired_1to1 || 0,
      ghi: dc.btm?.ghi_kwh_m2_day || 0,
      savings: econ?.['4cp_annual_savings_usd_m'] || 0,
      status: getSB6Status(dc),
    }
  })

  // Aggregate line
  const totalSolar = chartData.reduce((s, d) => s + d.solarPotential, 0)
  const totalBESS = chartData.reduce((s, d) => s + d.bessMW, 0)
  const totalSavings = chartData.reduce((s, d) => s + d.savings, 0)
  const totalBESSMWh = sb6Projects.reduce((s, dc) => s + (dc.btm?.bess_mwh_4hr || 0), 0)

  return (
    <div
      className="glass mx-4 rounded-xl overflow-hidden"
      style={{ maxHeight: '240px' }}
    >
      {/* Aggregate header */}
      <div className="flex items-center gap-6 px-5 py-3 border-b border-[var(--border)]">
        <div className="text-[10px] font-mono text-[var(--gold)] uppercase tracking-widest">All SB-6 Projects</div>
        <div className="flex items-center gap-5 ml-auto flex-wrap">
          {[
            { label: 'BTM solar', value: `${totalSolar.toLocaleString()} MW`, color: '#fbbf24' },
            { label: 'BESS potential', value: `${(totalBESSMWh / 1000).toFixed(0)} GWh`, color: '#34d399' },
            { label: '4CP savings/yr', value: `$${totalSavings.toFixed(0)}M`, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="text-right">
              <div className="text-[9px] text-[var(--text-muted)]">{s.label}</div>
              <div className="text-sm font-mono font-semibold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-3" style={{ height: '155px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2} barCategoryGap="25%">
            <XAxis
              dataKey="name"
              tick={{ fill: '#8b949e', fontSize: 9, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#8b949e', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 1000 ? `${v/1000}GW` : `${v}MW`}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend
              wrapperStyle={{ fontSize: '9px', color: '#8b949e', paddingTop: '2px' }}
              iconSize={6}
            />
            <Bar dataKey="itLoad" name="IT Load" fill="#484f58" radius={[2,2,0,0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={getSB6Color(d.status as any) + '44'} />
              ))}
            </Bar>
            <Bar dataKey="solarPotential" name="Solar Potential" fill="#fbbf24" radius={[2,2,0,0]} opacity={0.85} />
            <Bar dataKey="bessMW" name="BESS (MW)" fill="#34d399" radius={[2,2,0,0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
