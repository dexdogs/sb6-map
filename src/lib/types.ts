// Types derived from TX_DataCenter_SB6_BESS_Dataset.xlsx

export interface DataCenter {
  project_name: string
  developer: string
  county: string
  state: string
  city_nearest: string
  lat: number
  lon: number
  capacity_mw_it: number | null
  capacity_mw_total: number | null
  site_acres: number | null
  status: string
  phase: string
  expected_energization_date: string
  utility_tsp: string
  ercot_interconnection_status: string
  sb6_applies: string
  sb6_curtailment_obligation: string
  sb6_backup_gen_disclosure: string
  bridge_power_type: string
  source_url: string
  notes: string
}

export interface PowerPlant {
  eia_plant_code: number | null
  plant_name: string
  operator: string
  county: string
  state: string
  lat: number | null
  lon: number | null
  primary_fuel: 'NUC' | 'COL' | 'NG' | 'SUN' | 'BAT' | 'SUB' | string
  nameplate_capacity_mw: number | null
  summer_capacity_mw: number | null
  year_online: number | null
  operational_status: 'OP' | 'P' | string
  planned_retirement_year: string | null
  transmission_voltage_kv: number | null
  relevance_to_dc_cluster: string
  source: string
}

export interface BTMSiting {
  project_name: string
  county: string
  state: string
  site_lat: number
  site_lon: number
  ghi_kwh_m2_day: number
  dni_kwh_m2_day: number
  solar_capacity_factor_pct: number
  site_acres_reported: number | null
  btm_solar_mw_potential: number
  nearest_transmission_kv: number
  nearest_substation_name: string
  nearest_substation_dist_miles: number
  existing_solar_within_20mi_mw: number | null
  bess_mw_paired_1to1: number
  bess_mwh_4hr: number
  covers_pct_of_dc_it_load: number
  sb6_bess_compliance_value: string
  permitting_pathway: string
  estimated_deploy_months: string
  notes: string
}

export interface Economics {
  project_name: string
  county: string
  mw_it_load: number
  sb6_applies: string
  curtailment_risk_without_bess: string
  '4cp_annual_transmission_charge_usd': number
  bess_mw_for_compliance: number
  bess_mwh_4hr: number
  bess_capex_usd_m: number
  solar_mw_btm: number
  solar_capex_usd_m: number
  total_btm_capex_usd_m: number
  '4cp_annual_savings_usd_m': number
  payback_years_4cp_alone: number
  gas_bridge_alternative_mw: number
  gas_bridge_capex_usd_m: number
  btm_vs_gas_capex_delta_usd_m: number
  sb6_compliance_pathway: string
  notes_economics: string
}

export interface Regulatory {
  provision: string
  pura_section: string
  applies_to: string
  effective_date: string
  mw_threshold: string
  requirement: string
  bess_impact: string
  current_status: string
  source: string
}

// SB-6 status classification
export type SB6Status = 'mandatory' | 'exempt' | 'check' | 'reference'

export function getSB6Status(dc: DataCenter): SB6Status {
  const s = dc.sb6_applies?.toLowerCase() || ''
  if (s.includes('no —') || s.includes('exempt') || s.includes('n/a')) return 'exempt'
  if (s.includes('yes —') || s.includes('mandatory')) return 'mandatory'
  if (s.includes('check')) return 'check'
  return 'reference'
}

export function getSB6Color(status: SB6Status): string {
  switch (status) {
    case 'mandatory': return '#ff4444'
    case 'exempt': return '#22c55e'
    case 'check': return '#f59e0b'
    case 'reference': return '#6b7280'
  }
}

export function getFuelColor(fuel: string): string {
  switch (fuel) {
    case 'NUC': return '#60a5fa'
    case 'COL': return '#9ca3af'
    case 'NG': return '#fb923c'
    case 'SUN': return '#fbbf24'
    case 'BAT': return '#34d399'
    default: return '#8b949e'
  }
}

export function getFuelLabel(fuel: string): string {
  switch (fuel) {
    case 'NUC': return 'Nuclear'
    case 'COL': return 'Coal'
    case 'NG': return 'Natural Gas'
    case 'SUN': return 'Solar'
    case 'BAT': return 'Battery/BESS'
    case 'SUB': return 'Substation'
    default: return fuel
  }
}

export function formatMW(mw: number | null): string {
  if (!mw) return '—'
  if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`
  return `${mw} MW`
}

export function formatUSD(m: number | null): string {
  if (!m) return '—'
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`
  return `$${m.toFixed(0)}M`
}
