import rawData from '@/data/dataset.json'
import type { DataCenter, PowerPlant, BTMSiting, Economics, Regulatory } from './types'

const d = rawData as Record<string, Record<string, unknown>[]>

export const dataCenters: DataCenter[] = (d['1_TX_DataCenters'] || []) as DataCenter[]
export const powerPlants: PowerPlant[] = (d['2_TX_PowerInfrastructure'] || []) as PowerPlant[]
export const btmSiting: BTMSiting[] = (d['3_TX_BTM_Siting'] || []) as BTMSiting[]
export const economics: Economics[] = (d['4_SB6_Economics'] || []) as Economics[]
export const regulatory: Regulatory[] = (d['5_SB6_Regulatory'] || []) as Regulatory[]

// Enriched: join DC with BTM and Economics by project_name
export interface EnrichedDC extends DataCenter {
  btm?: BTMSiting
  econ?: Economics
}

export const enrichedDCs: EnrichedDC[] = dataCenters.map(dc => ({
  ...dc,
  btm: btmSiting.find(b => b.project_name === dc.project_name),
  econ: economics.find(e => e.project_name === dc.project_name),
}))

// KPI aggregates for top bar
export const kpis = {
  totalSB6Projects: dataCenters.filter(dc => {
    const s = dc.sb6_applies?.toLowerCase() || ''
    return s.includes('yes') || s.includes('mandatory')
  }).length,
  totalSB6MW: dataCenters
    .filter(dc => (dc.sb6_applies?.toLowerCase() || '').includes('yes'))
    .reduce((sum, dc) => sum + (dc.capacity_mw_it || 0), 0),
  totalBTMSolarMW: btmSiting.reduce((sum, b) => sum + (b.btm_solar_mw_potential || 0), 0),
  totalBESSMWh: btmSiting.reduce((sum, b) => sum + (b.bess_mwh_4hr || 0), 0),
  avg4CPCharge: 42500, // $/MW/yr — CPower benchmark
  googleHaskellIsProof: true,
}
