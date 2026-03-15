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

const GHI_POINTS = [
  { lat: 34.9674, lon: -101.3563, ghi: 6.10 },
  { lat: 35.2220, lon: -101.8313, ghi: 6.00 },
  { lat: 32.9449, lon: -99.7652,  ghi: 5.80 },
  { lat: 33.1573, lon: -99.7337,  ghi: 5.72 },
  { lat: 32.4267, lon: -99.7338,  ghi: 5.70 },
  { lat: 31.7619, lon: -106.485,  ghi: 5.60 },
  { lat: 29.8849, lon: -97.6703,  ghi: 5.30 },
  { lat: 29.3756, lon: -98.5432,  ghi: 5.20 },
  { lat: 32.7459, lon: -97.0641,  ghi: 5.10 },
  { lat: 32.7767, lon: -97.2936,  ghi: 5.10 },
]

function safeRemove(map: mapboxgl.Map, ...ids: string[]) {
  ids.forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id) } catch {}
    try { if (map.getSource(id)) map.removeSource(id) } catch {}
  })
}

export default function MapView({ dataCenters, powerPlants, layers, selectedDC, onSelectDC }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const plantMarkersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Texas-only DCs with valid coords
  const txDCs = dataCenters.filter(dc => dc.state !== 'WA' && dc.lat && dc.lon)

  // ── INIT ─────────────────────────────────────────────────────
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
      // ── GHI heatmap ──
      map.addSource('ghi', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: GHI_POINTS.map(p => ({
            type: 'Feature',
            properties: { weight: (p.ghi - 4.8) / 1.4 },
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          })),
        },
      })
      map.addLayer({
        id: 'ghi-heat',
        type: 'heatmap',
        source: 'ghi',
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.2, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 9, 2.5],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.3, 'rgba(100,60,10,0.2)',
            0.6, 'rgba(200,125,15,0.4)',
            0.85,'rgba(230,150,10,0.58)',
            1.0, 'rgba(240,165,0,0.70)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 55, 7, 90, 10, 140],
          'heatmap-opacity': 0.80,
        },
      })

      // ── DC markers as GL circles (geographically pinned) ──
      const dcFeatures: GeoJSON.Feature[] = txDCs.map(dc => {
        const status = getSB6Status(dc)
        return {
          type: 'Feature',
          properties: {
            id: dc.project_name,
            status,
            color: getSB6Color(status),
            mw: dc.capacity_mw_it ?? 100,
            county: dc.county,
            name: dc.project_name.replace(/\s*\(.*?\)\s*/g, ' ').trim(),
            isProof: dc.project_name.includes('Google Haskell DC1') ? 1 : 0,
          },
          geometry: { type: 'Point', coordinates: [dc.lon!, dc.lat!] },
        }
      })

      map.addSource('dc-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: dcFeatures },
      })

      // Outer ring
      map.addLayer({
        id: 'dc-ring',
        type: 'circle',
        source: 'dc-points',
        paint: {
          'circle-radius': 11,
          'circle-color': 'transparent',
          'circle-stroke-width': 1.8,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.9,
          'circle-pitch-alignment': 'map',
          'circle-translate': [0, 0],
        },
      })

      // Inner filled dot
      map.addLayer({
        id: 'dc-dot',
        type: 'circle',
        source: 'dc-points',
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.95,
          'circle-pitch-alignment': 'map',
        },
      })

      // Selected highlight ring
      map.addLayer({
        id: 'dc-selected',
        type: 'circle',
        source: 'dc-points',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': 15,
          'circle-color': 'transparent',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9,
          'circle-pitch-alignment': 'map',
        },
      })

      // Click on DC dot
      map.on('click', 'dc-ring', (e) => {
        if (!e.features?.length) return
        const props = e.features[0].properties!
        const dc = dataCenters.find(d => d.project_name === props.id)
        if (dc) {
          onSelectDC(dc)
          map.flyTo({ center: e.lngLat, zoom: Math.max(map.getZoom(), 7.5), duration: 600 })
        }
      })
      map.on('click', 'dc-dot', (e) => {
        if (!e.features?.length) return
        const props = e.features[0].properties!
        const dc = dataCenters.find(d => d.project_name === props.id)
        if (dc) {
          onSelectDC(dc)
          map.flyTo({ center: e.lngLat, zoom: Math.max(map.getZoom(), 7.5), duration: 600 })
        }
      })

      // Hover popup
      map.on('mouseenter', 'dc-ring', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        if (!e.features?.length) return
        const props = e.features[0].properties!
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 14, anchor: 'bottom' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-size:11px;line-height:1.5;">
              <div style="font-weight:600;margin-bottom:2px;">${props.name}</div>
              <div style="color:#8b949e;">${props.county} Co. · ${props.mw} MW IT</div>
              <div style="color:${props.color};margin-top:3px;font-size:10px;">
                ${props.status === 'mandatory' ? '⚠ SB-6 Mandatory' : props.status === 'exempt' ? '✓ Exempt' : '? Verify territory'}
              </div>
            </div>
          `)
          .addTo(map)
      })
      map.on('mouseleave', 'dc-ring', () => {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
        popupRef.current = null
      })

      // Blank click deselect
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['dc-ring', 'dc-dot'] })
        if (!features.length) {
          onSelectDC(null)
          popupRef.current?.remove()
          popupRef.current = null
        }
      })

      setMapLoaded(true)
    })

    return () => {
      plantMarkersRef.current.forEach(m => m.remove())
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line

  // ── SELECTED HIGHLIGHT ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    if (map.getLayer('dc-selected')) {
      map.setFilter('dc-selected', ['==', ['get', 'id'], selectedDC?.project_name ?? ''])
    }
  }, [selectedDC, mapLoaded])

  // ── GHI VISIBILITY ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    if (map.getLayer('ghi-heat')) {
      map.setLayoutProperty('ghi-heat', 'visibility', layers.solarHeatmap ? 'visible' : 'none')
    }
  }, [layers.solarHeatmap, mapLoaded])

  // ── POWER PLANTS ─────────────────────────────────────────────
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
      const sz = Math.max(6, Math.min(16, (p.nameplate_capacity_mw ?? 200) / 100))

      const el = document.createElement('div')
      el.style.cssText = `
        width:${sz}px;height:${sz}px;
        border-radius:${p.primary_fuel === 'SUN' ? '2px' : '50%'};
        background:${color}22;
        border:${planned ? `1px dashed ${color}` : `1.5px solid ${color}`};
        cursor:pointer; flex-shrink:0;
      `
      el.addEventListener('mouseenter', () => {
        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 8, anchor: 'bottom' })
          .setLngLat([p.lon!, p.lat!])
          .setHTML(`
            <div style="font-size:11px;line-height:1.5;">
              <div style="font-weight:600;">${p.plant_name}</div>
              <div style="color:#8b949e;">${getFuelLabel(p.primary_fuel)} · ${formatMW(p.nameplate_capacity_mw)}</div>
              <div style="color:#8b949e;">${p.county} Co.</div>
              ${planned ? `<div style="color:#f59e0b;">Planned ${p.year_online ?? ''}</div>` : ''}
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

  // ── BESS RINGS ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'bess-rings')
    if (!layers.bessRings) return

    const features: GeoJSON.Feature[] = txDCs
      .filter(dc => dc.btm && getSB6Status(dc) === 'mandatory')
      .map(dc => {
        const savings = dc.econ?.['4cp_annual_savings_usd_m'] ?? 0
        return {
          type: 'Feature' as const,
          properties: { color: savings > 5 ? '#22c55e' : savings > 2 ? '#f59e0b' : '#8b949e' },
          geometry: { type: 'Point' as const, coordinates: [dc.lon!, dc.lat!] },
        }
      })

    map.addSource('bess-rings', { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.addLayer({
      id: 'bess-rings', type: 'circle', source: 'bess-rings',
      paint: {
        'circle-radius': 20,
        'circle-color': 'transparent',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-opacity': 0.7,
        'circle-pitch-alignment': 'map',
      },
    }, 'dc-ring')
  }, [layers.bessRings, mapLoaded]) // eslint-disable-line

  // ── BTM SOLAR POTENTIAL ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'solar-potential')
    if (!layers.solarPotential) return

    const features: GeoJSON.Feature[] = txDCs
      .filter(dc => dc.btm)
      .map(dc => ({
        type: 'Feature' as const,
        properties: { mw: dc.btm?.btm_solar_mw_potential ?? 0 },
        geometry: { type: 'Point' as const, coordinates: [dc.lon!, dc.lat!] },
      }))

    map.addSource('solar-potential', { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.addLayer({
      id: 'solar-potential', type: 'circle', source: 'solar-potential',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 22],
        'circle-color': '#fbbf24',
        'circle-opacity': 0.18,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fbbf24',
        'circle-stroke-opacity': 0.5,
        'circle-pitch-alignment': 'map',
      },
    }, 'dc-ring')
  }, [layers.solarPotential, mapLoaded]) // eslint-disable-line

  // ── GOOGLE PROOF ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'google-proof')
    popupRef.current?.remove()
    if (!layers.googleProof) return

    const gdc = txDCs.find(dc => dc.project_name.includes('Google Haskell DC1'))
    if (!gdc?.lat || !gdc?.lon) return

    map.addSource('google-proof', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [gdc.lon, gdc.lat] } }],
      },
    })
    map.addLayer({
      id: 'google-proof', type: 'circle', source: 'google-proof',
      paint: {
        'circle-radius': 24,
        'circle-color': '#22c55e',
        'circle-opacity': 0.1,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#22c55e',
        'circle-stroke-opacity': 0.9,
        'circle-pitch-alignment': 'map',
      },
    }, 'dc-ring')

    map.flyTo({ center: [gdc.lon, gdc.lat], zoom: 8.5, duration: 1200 })
    popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, offset: 28, anchor: 'bottom' })
      .setLngLat([gdc.lon, gdc.lat])
      .setHTML(`
        <div style="font-size:11px;line-height:1.6;">
          <div style="color:#22c55e;font-weight:700;margin-bottom:3px;">★ Google Haskell DC1</div>
          <div>Solar + BESS collocated</div>
          <div style="color:#8b949e;">Intersect Power / TPG Rise Climate</div>
          <div style="color:#22c55e;margin-top:4px;font-size:10px;">SB-6 compliant by design ✓</div>
        </div>
      `)
      .addTo(map)
  }, [layers.googleProof, mapLoaded]) // eslint-disable-line

  // ── SB-6 EXPOSURE ARCS ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'sb6-arcs')
    if (!layers.sb6Arcs) return

    const offsets: Record<string, [number, number]> = {
      Taylor: [-0.04,-0.03], Shackelford: [-0.05,-0.04], Haskell: [-0.04,0.03],
      Armstrong: [0.06,0.03], Dallas: [0.05,-0.04], Tarrant: [0.05,-0.04],
      Caldwell: [0.07,0.03], Bexar: [0.05,0.03],
    }

    const features: GeoJSON.Feature[] = txDCs
      .filter(dc => getSB6Status(dc) === 'mandatory')
      .map(dc => {
        const off = offsets[dc.county] ?? [0.05, -0.03]
        const d = (dc.btm?.nearest_substation_dist_miles ?? 2) / 2
        return {
          type: 'Feature' as const,
          properties: { mw: dc.capacity_mw_it ?? 100 },
          geometry: { type: 'LineString' as const, coordinates: [[dc.lon!, dc.lat!], [dc.lon! + off[0]*d, dc.lat! + off[1]*d]] },
        }
      })

    map.addSource('sb6-arcs', { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.addLayer({
      id: 'sb6-arcs', type: 'line', source: 'sb6-arcs',
      paint: { 'line-color': '#ff4444', 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [4,3] },
    }, 'dc-ring')
  }, [layers.sb6Arcs, mapLoaded]) // eslint-disable-line

  // ── SUBSTATION DOTS ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    safeRemove(map, 'transmission')
    if (!layers.transmission) return

    const features: GeoJSON.Feature[] = txDCs
      .filter(dc => dc.btm?.nearest_substation_name)
      .map(dc => ({
        type: 'Feature' as const,
        properties: { kv: dc.btm?.nearest_transmission_kv ?? 345 },
        geometry: { type: 'Point' as const, coordinates: [dc.lon! + 0.12, dc.lat! - 0.07] },
      }))

    map.addSource('transmission', { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.addLayer({
      id: 'transmission', type: 'circle', source: 'transmission',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'kv'], 138, 4, 500, 9],
        'circle-color': '#a78bfa', 'circle-opacity': 0.7,
        'circle-stroke-width': 1, 'circle-stroke-color': '#a78bfa',
        'circle-pitch-alignment': 'map',
      },
    }, 'dc-ring')
  }, [layers.transmission, mapLoaded]) // eslint-disable-line

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ position:'absolute', top:'56px', left:0, right:0, bottom:0, width:'100%', height:'calc(100vh - 56px)' }}>
      <style>{`
        @keyframes sb6-ping {
          0%   { transform:scale(1);   opacity:0.65; }
          70%  { transform:scale(2.2); opacity:0;    }
          100% { transform:scale(2.2); opacity:0;    }
        }
        .mapboxgl-popup-content {
          background:rgba(13,17,23,0.96)!important; border:1px solid rgba(48,54,61,0.9)!important;
          border-radius:8px!important; padding:10px 14px!important; color:#e6edf3!important;
          font-family:'Space Grotesk',sans-serif!important; backdrop-filter:blur(12px);
          box-shadow:0 4px 20px rgba(0,0,0,0.55)!important;
        }
        .mapboxgl-popup-tip { display:none!important; }
        .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { display:none!important; }
        .mapboxgl-popup-close-button { color:#8b949e!important; font-size:14px!important; padding:4px 8px!important; }
      `}</style>
      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>
          <div className="glass-card p-6 text-center max-w-sm">
            <div className="text-[var(--amber)] text-2xl mb-3">⚠</div>
            <h3 className="font-semibold mb-2">Mapbox token required</h3>
            <p className="text-sm text-[var(--text-secondary)]">Add <code className="font-mono text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code className="font-mono text-xs">.env.local</code></p>
          </div>
        </div>
      )}
    </div>
  )
}
