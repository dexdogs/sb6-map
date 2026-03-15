'use client'

import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { EnrichedDC } from '@/lib/data'
import type { PowerPlant } from '@/lib/types'
import { getSB6Status, getSB6Color, getFuelColor, getFuelLabel, formatMW } from '@/lib/types'
import type { LayerState } from './MapApp'

interface Props {
  dataCenters: EnrichedDC[]
  powerPlants: PowerPlant[]
  layers: LayerState
  selectedDC: EnrichedDC | null
  onSelectDC: (dc: EnrichedDC | null) => void
}

// GHI point data — NREL NSRDB PSM v3, one point per county
const GHI_POINTS = [
  { lat: 34.9674, lon: -101.3563, ghi: 6.10 }, // Armstrong
  { lat: 35.2220, lon: -101.8313, ghi: 6.00 }, // Potter
  { lat: 32.9449, lon: -99.7652,  ghi: 5.80 }, // Shackelford
  { lat: 33.1573, lon: -99.7337,  ghi: 5.72 }, // Haskell
  { lat: 32.4267, lon: -99.7338,  ghi: 5.70 }, // Taylor
  { lat: 31.7619, lon: -106.485,  ghi: 5.60 }, // El Paso
  { lat: 29.8849, lon: -97.6703,  ghi: 5.30 }, // Caldwell
  { lat: 29.3756, lon: -98.5432,  ghi: 5.20 }, // Bexar
  { lat: 32.7459, lon: -97.0641,  ghi: 5.10 }, // Tarrant
  { lat: 32.7767, lon: -97.2936,  ghi: 5.10 }, // Dallas
]

// ── helpers ──────────────────────────────────────────────────
function safeRemove(map: mapboxgl.Map, layerId: string, sourceId?: string) {
  try { if (map.getLayer(layerId)) map.removeLayer(layerId) } catch {}
  const sid = sourceId ?? layerId
  try { if (map.getSource(sid)) map.removeSource(sid) } catch {}
}

function addPointSource(map: mapboxgl.Map, id: string, features: GeoJSON.Feature[]) {
  safeRemove(map, id)
  map.addSource(id, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  })
}

export default function MapView({ dataCenters, powerPlants, layers, selectedDC, onSelectDC }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const plantMarkersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // ── INIT MAP ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-99.5, 31.8],
      zoom: 5.6,
      minZoom: 3.5,
      maxZoom: 14,
      attributionControl: false,
    })
    mapRef.current = map

    map.on('load', () => {
      // ── GHI heatmap — always present, visibility toggled ──
      const ghiFeatures: GeoJSON.Feature[] = GHI_POINTS.map(p => ({
        type: 'Feature',
        properties: { weight: (p.ghi - 4.8) / 1.4 },   // normalise 4.8–6.1 → 0–1
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      }))

      map.addSource('ghi', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: ghiFeatures },
      })

      // Use heatmap layer — geographic blobs, not fixed-pixel circles
      map.addLayer({
        id: 'ghi-heat',
        type: 'heatmap',
        source: 'ghi',
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.2, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 9, 2.5],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(0,0,0,0)',
            0.2, 'rgba(80,45,5,0)',
            0.4, 'rgba(130,75,10,0.25)',
            0.65,'rgba(200,125,15,0.45)',
            0.85,'rgba(230,150,10,0.60)',
            1.0, 'rgba(240,165,0,0.72)',
          ],
          // radius in pixels — scales with zoom so blobs shrink when zoomed in
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 55, 7, 90, 10, 140],
          'heatmap-opacity': 0.80,
        },
      })

      setMapLoaded(true)
    })

    // Deselect on blank click
    map.on('click', () => {
      onSelectDC(null)
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      plantMarkersRef.current.forEach(m => m.remove())
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line

  // ── GHI VISIBILITY ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    if (map.getLayer('ghi-heat')) {
      map.setLayoutProperty('ghi-heat', 'visibility', layers.solarHeatmap ? 'visible' : 'none')
    }
  }, [layers.solarHeatmap, mapLoaded])

  // ── DC MARKERS ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    dataCenters.forEach(dc => {
      if (!dc.lat || !dc.lon) return
      if (dc.state === 'WA') return  // reference-only, off-map

      const status = getSB6Status(dc)
      const color  = getSB6Color(status)
      const mw     = dc.capacity_mw_it ?? 100
      // radius 12–38px, square-root scaled by MW
      const r = Math.max(12, Math.min(38, Math.sqrt(mw) * 1.45))
      const isSelected  = selectedDC?.project_name === dc.project_name
      const isMandatory = status === 'mandatory'
      const isProof     = dc.project_name.includes('Google Haskell DC1')

      const el = document.createElement('div')
      el.style.cssText = `
        width:${r * 2}px; height:${r * 2}px; border-radius:50%;
        background:${color}18; border:2px solid ${color};
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        transition:transform 0.15s; position:relative;
        ${isSelected ? `box-shadow:0 0 0 3px ${color}55;border-color:#fff;` : ''}
      `

      const dot = document.createElement('div')
      dot.style.cssText = `
        width:${r * 0.55}px; height:${r * 0.55}px;
        border-radius:50%; background:${color}; flex-shrink:0;
      `
      el.appendChild(dot)

      if (isMandatory) {
        const ring = document.createElement('div')
        ring.style.cssText = `
          position:absolute; inset:-6px; border-radius:50%;
          border:1.5px solid ${color}; opacity:0;
          animation:sb6-ping 2.4s ease-out infinite;
        `
        el.appendChild(ring)
      }

      if (isProof) {
        const star = document.createElement('span')
        star.textContent = '★'
        star.style.cssText = `
          position:absolute; top:-11px; right:-4px;
          color:#f0a500; font-size:11px; pointer-events:none;
        `
        el.appendChild(star)
      }

      // Hover popup
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.12)'
        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: r + 6 })
          .setLngLat([dc.lon!, dc.lat!])
          .setHTML(`
            <div style="font-size:11px;line-height:1.5;">
              <div style="font-weight:600;margin-bottom:2px;">
                ${dc.project_name.replace(/\s*\(.*?\)\s*/g, ' ').trim()}
              </div>
              <div style="color:#8b949e;">${dc.county} Co. · ${mw} MW IT</div>
              <div style="color:${color};margin-top:3px;font-size:10px;">
                ${status === 'mandatory' ? '⚠ SB-6 Mandatory' : status === 'exempt' ? '✓ Exempt' : '? Verify territory'}
              </div>
            </div>
          `)
          .addTo(map)
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectDC(dc)
        map.flyTo({ center: [dc.lon!, dc.lat!], zoom: Math.max(map.getZoom(), 7.5), duration: 700 })
      })

      markersRef.current.push(
        new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([dc.lon, dc.lat])
          .addTo(map)
      )
    })
  }, [dataCenters, mapLoaded, selectedDC]) // eslint-disable-line

  // ── POWER PLANTS ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    plantMarkersRef.current.forEach(m => m.remove())
    plantMarkersRef.current = []
    if (!layers.powerPlants) return

    const seen = new Set<string>()
    powerPlants.forEach(p => {
      if (!p.lat || !p.lon) return
      const key = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`
      if (seen.has(key)) return
      seen.add(key)

      const color = getFuelColor(p.primary_fuel)
      const planned = p.operational_status === 'P'
      const sz = Math.max(6, Math.min(18, (p.nameplate_capacity_mw ?? 200) / 100))

      const el = document.createElement('div')
      el.style.cssText = `
        width:${sz}px; height:${sz}px;
        border-radius:${p.primary_fuel === 'SUN' ? '2px' : '50%'};
        background:${color}22;
        border:${planned ? `1px dashed ${color}` : `1.5px solid ${color}`};
        cursor:pointer;
      `
      el.addEventListener('mouseenter', () => {
        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 8 })
          .setLngLat([p.lon!, p.lat!])
          .setHTML(`
            <div style="font-size:11px;line-height:1.5;">
              <div style="font-weight:600;">${p.plant_name}</div>
              <div style="color:#8b949e;">${getFuelLabel(p.primary_fuel)} · ${formatMW(p.nameplate_capacity_mw)}</div>
              <div style="color:#8b949e;">${p.county} Co. · ${p.operator}</div>
              ${planned ? `<div style="color:#f59e0b;margin-top:2px;">Planned ${p.year_online ?? ''}</div>` : ''}
              ${p.planned_retirement_year ? `<div style="color:#ff6666;">Retiring: ${p.planned_retirement_year}</div>` : ''}
            </div>
          `)
          .addTo(map)
      })
      el.addEventListener('mouseleave', () => { popupRef.current?.remove(); popupRef.current = null })

      plantMarkersRef.current.push(
        new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([p.lon, p.lat])
          .addTo(map)
      )
    })
  }, [layers.powerPlants, powerPlants, mapLoaded])

  // ── BESS COMPLIANCE RINGS ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'bess-rings')
    if (!layers.bessRings) return

    const features: GeoJSON.Feature[] = dataCenters
      .filter(dc => dc.btm && dc.lat && dc.lon && getSB6Status(dc) === 'mandatory' && dc.state !== 'WA')
      .map(dc => {
        const savings = dc.econ?.['4cp_annual_savings_usd_m'] ?? 0
        const color = savings > 5 ? '#22c55e' : savings > 2 ? '#f59e0b' : '#8b949e'
        return {
          type: 'Feature' as const,
          properties: { color, bess_mw: dc.btm?.bess_mw_paired_1to1 ?? 0 },
          geometry: { type: 'Point' as const, coordinates: [dc.lon!, dc.lat!] },
        }
      })

    addPointSource(map, 'bess-rings', features)
    map.addLayer({
      id: 'bess-rings', type: 'circle', source: 'bess-rings',
      paint: {
        'circle-radius': 34,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.1,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-opacity': 0.65,
        'circle-pitch-alignment': 'map',
      },
    })
  }, [layers.bessRings, dataCenters, mapLoaded])

  // ── BTM SOLAR POTENTIAL ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'solar-potential')
    if (!layers.solarPotential) return

    const features: GeoJSON.Feature[] = dataCenters
      .filter(dc => dc.btm && dc.lat && dc.lon && dc.state !== 'WA')
      .map(dc => ({
        type: 'Feature' as const,
        properties: {
          mw: dc.btm?.btm_solar_mw_potential ?? 0,
          cf: dc.btm?.solar_capacity_factor_pct ?? 0.25,
        },
        geometry: { type: 'Point' as const, coordinates: [dc.lon!, dc.lat!] },
      }))

    addPointSource(map, 'solar-potential', features)
    map.addLayer({
      id: 'solar-potential', type: 'circle', source: 'solar-potential',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'mw'], 0, 14, 1200, 42],
        'circle-color': '#fbbf24',
        'circle-opacity': ['interpolate', ['linear'], ['get', 'cf'], 0.24, 0.12, 0.32, 0.42],
        'circle-blur': 0.7,
        'circle-pitch-alignment': 'map',
      },
    })
  }, [layers.solarPotential, dataCenters, mapLoaded])

  // ── GOOGLE PROOF ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'google-proof')
    popupRef.current?.remove()
    if (!layers.googleProof) return

    const gdc = dataCenters.find(dc => dc.project_name.includes('Google Haskell DC1'))
    if (!gdc?.lat || !gdc?.lon) return

    addPointSource(map, 'google-proof', [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [gdc.lon, gdc.lat] },
    }])
    map.addLayer({
      id: 'google-proof', type: 'circle', source: 'google-proof',
      paint: {
        'circle-radius': 50,
        'circle-color': '#22c55e',
        'circle-opacity': 0.1,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#22c55e',
        'circle-stroke-opacity': 0.9,
        'circle-pitch-alignment': 'map',
      },
    })

    map.flyTo({ center: [gdc.lon, gdc.lat], zoom: 8.5, duration: 1200 })

    popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, offset: 56 })
      .setLngLat([gdc.lon, gdc.lat])
      .setHTML(`
        <div style="font-size:11px;line-height:1.6;">
          <div style="color:#22c55e;font-weight:700;margin-bottom:3px;">★ Google Haskell DC1</div>
          <div>Solar + BESS collocated</div>
          <div style="color:#8b949e;">Intersect Power / TPG Rise Climate</div>
          <div style="color:#22c55e;margin-top:4px;font-size:10px;">SB-6 compliant by design ✓</div>
          <div style="color:#8b949e;font-size:10px;">GHI 5.72 kWh/m²/day</div>
        </div>
      `)
      .addTo(map)
  }, [layers.googleProof, dataCenters, mapLoaded]) // eslint-disable-line

  // ── SB-6 EXPOSURE ARCS ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'sb6-arcs')
    if (!layers.sb6Arcs) return

    const subOffsets: Record<string, [number, number]> = {
      Taylor:      [-0.04, -0.03],
      Shackelford: [-0.05, -0.04],
      Haskell:     [-0.04,  0.03],
      Armstrong:   [ 0.06,  0.03],
      Dallas:      [ 0.05, -0.04],
      Tarrant:     [ 0.05, -0.04],
      Caldwell:    [ 0.07,  0.03],
      Bexar:       [ 0.05,  0.03],
    }

    const features: GeoJSON.Feature[] = dataCenters
      .filter(dc => getSB6Status(dc) === 'mandatory' && dc.lat && dc.lon && dc.state !== 'WA')
      .map(dc => {
        const off = subOffsets[dc.county] ?? [0.05, -0.03]
        const d   = (dc.btm?.nearest_substation_dist_miles ?? 2) / 2
        return {
          type: 'Feature' as const,
          properties: { mw: dc.capacity_mw_it ?? 100 },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [dc.lon!, dc.lat!],
              [dc.lon! + off[0] * d, dc.lat! + off[1] * d],
            ],
          },
        }
      })

    addPointSource(map, 'sb6-arcs', features)
    map.addLayer({
      id: 'sb6-arcs', type: 'line', source: 'sb6-arcs',
      paint: {
        'line-color': '#ff4444',
        'line-width': ['interpolate', ['linear'], ['get', 'mw'], 100, 1.5, 1400, 4],
        'line-opacity': 0.65,
        'line-dasharray': [4, 3],
      },
    })
  }, [layers.sb6Arcs, dataCenters, mapLoaded])

  // ── SUBSTATION DOTS ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'transmission')
    if (!layers.transmission) return

    const features: GeoJSON.Feature[] = dataCenters
      .filter(dc => dc.btm?.nearest_substation_name && dc.lat && dc.lon && dc.state !== 'WA')
      .map(dc => ({
        type: 'Feature' as const,
        properties: {
          kv:   dc.btm?.nearest_transmission_kv ?? 345,
          name: dc.btm?.nearest_substation_name ?? '',
          dist: dc.btm?.nearest_substation_dist_miles ?? 0,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [dc.lon! + 0.12, dc.lat! - 0.07],
        },
      }))

    addPointSource(map, 'transmission', features)
    map.addLayer({
      id: 'transmission', type: 'circle', source: 'transmission',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'kv'], 138, 5, 500, 12],
        'circle-color': '#a78bfa',
        'circle-opacity': 0.75,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#a78bfa',
        'circle-pitch-alignment': 'map',
      },
    })
  }, [layers.transmission, dataCenters, mapLoaded])

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 top-[56px]" ref={containerRef}>
      <style>{`
        @keyframes sb6-ping {
          0%   { transform:scale(1);   opacity:0.65; }
          70%  { transform:scale(2);   opacity:0;    }
          100% { transform:scale(2);   opacity:0;    }
        }
        .mapboxgl-popup-content {
          background: rgba(13,17,23,0.96) !important;
          border: 1px solid rgba(48,54,61,0.9) !important;
          border-radius: 8px !important;
          padding: 10px 14px !important;
          color: #e6edf3 !important;
          font-family: 'Space Grotesk', sans-serif !important;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.55) !important;
        }
        .mapboxgl-popup-tip { display:none !important; }
        .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { display:none !important; }
        .mapboxgl-popup-close-button {
          color:#8b949e !important; font-size:14px !important; padding:4px 8px !important;
        }
      `}</style>

      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="glass-card p-6 text-center max-w-sm">
            <div className="text-[var(--amber)] text-2xl mb-3">⚠</div>
            <h3 className="font-semibold mb-2">Mapbox token required</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Add <code className="font-mono text-xs bg-[var(--bg-card)] px-1 py-0.5 rounded">
                NEXT_PUBLIC_MAPBOX_TOKEN
              </code> to <code className="font-mono text-xs">.env.local</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
