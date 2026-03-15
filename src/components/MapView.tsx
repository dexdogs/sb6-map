'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
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

// GHI range for choropleth — counties with known data centers
const GHI_COUNTY_MAP: Record<string, number> = {
  'Taylor': 5.70, 'Shackelford': 5.80, 'Haskell': 5.72,
  'Armstrong': 6.10, 'Dallas': 5.10, 'Tarrant': 5.10,
  'Caldwell': 5.30, 'Bexar': 5.20, 'El Paso': 5.60,
  'Potter': 6.00, 'Ellis': 5.15, 'Somervell': 5.10,
  'Matagorda': 4.90,
}

function ghiToOpacity(ghi: number): number {
  const min = 4.8, max = 6.2
  return 0.1 + ((ghi - min) / (max - min)) * 0.45
}

function ghiToColor(ghi: number): string {
  // low = cool grey → high = warm amber/gold
  if (ghi >= 6.0) return '#f0a500'
  if (ghi >= 5.7) return '#d4851a'
  if (ghi >= 5.4) return '#a0651a'
  return '#6b4f2a'
}

export default function MapView({ dataCenters, powerPlants, layers, selectedDC, onSelectDC }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const plantMarkersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      console.warn('No Mapbox token — set NEXT_PUBLIC_MAPBOX_TOKEN')
      return
    }

    mapboxgl.accessToken = token

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-99.5, 31.5],
      zoom: 5.8,
      minZoom: 4,
      maxZoom: 14,
      attributionControl: false,
      logoPosition: 'bottom-right',
    })

    map.current.on('load', () => {
      setMapLoaded(true)

      // Add county GHI heatmap layer (GeoJSON circles per county centroid)
      if (map.current) {
        const ghiFeatures = Object.entries(GHI_COUNTY_MAP).map(([county, ghi]) => {
          const dc = dataCenters.find(d => d.county === county)
          const coords = dc ? [dc.lon, dc.lat] : null
          if (!coords) return null
          return {
            type: 'Feature' as const,
            properties: { county, ghi, color: ghiToColor(ghi), opacity: ghiToOpacity(ghi) },
            geometry: { type: 'Point' as const, coordinates: coords }
          }
        }).filter(Boolean)

        map.current.addSource('ghi-heatmap', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: ghiFeatures as GeoJSON.Feature[] }
        })

        map.current.addLayer({
          id: 'ghi-circles',
          type: 'circle',
          source: 'ghi-heatmap',
          paint: {
            'circle-radius': 60,
            'circle-color': ['get', 'color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-blur': 1.2,
          }
        })
      }
    })

    map.current.on('click', (e) => {
      // Check if clicking empty area
      const features = map.current?.queryRenderedFeatures(e.point, {
        layers: ['dc-markers-layer']
      })
      if (!features?.length) {
        onSelectDC(null)
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
      }
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      plantMarkersRef.current.forEach(m => m.remove())
      if (popupRef.current) popupRef.current.remove()
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Render DC markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Clear existing
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    dataCenters.forEach(dc => {
      if (!dc.lat || !dc.lon) return

      const status = getSB6Status(dc)
      const color = getSB6Color(status)
      const size = Math.max(14, Math.min(40, (dc.capacity_mw_it || 100) / 40))
      const isSelected = selectedDC?.project_name === dc.project_name
      const isMandatory = status === 'mandatory'
      const isProof = dc.project_name.includes('Google Haskell DC1')

      const el = document.createElement('div')
      el.className = 'dc-marker'
      el.style.cssText = `
        width: ${size * 2}px;
        height: ${size * 2}px;
        border-radius: 50%;
        background: ${color}22;
        border: 2px solid ${color};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        position: relative;
      `
      if (isSelected) {
        el.style.border = `2.5px solid white`
        el.style.boxShadow = `0 0 0 3px ${color}55`
      }

      // Inner dot
      const inner = document.createElement('div')
      inner.style.cssText = `
        width: ${size * 0.6}px;
        height: ${size * 0.6}px;
        border-radius: 50%;
        background: ${color};
      `
      el.appendChild(inner)

      // Pulse ring for mandatory
      if (isMandatory && !isSelected) {
        const ring = document.createElement('div')
        ring.style.cssText = `
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px solid ${color};
          animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;
          opacity: 0.4;
        `
        el.appendChild(ring)
      }

      // Gold star for Google proof
      if (isProof) {
        const star = document.createElement('div')
        star.innerHTML = '★'
        star.style.cssText = `
          position: absolute;
          top: -8px;
          right: -4px;
          color: #f0a500;
          font-size: 10px;
          line-height: 1;
        `
        el.appendChild(star)
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectDC(dc)
        map.current?.flyTo({ center: [dc.lon, dc.lat], zoom: Math.max(map.current.getZoom(), 8), duration: 600 })
      })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([dc.lon, dc.lat])
        .addTo(map.current!)

      markersRef.current.push(marker)
    })

  }, [dataCenters, mapLoaded, selectedDC, onSelectDC])

  // Power plant markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    plantMarkersRef.current.forEach(m => m.remove())
    plantMarkersRef.current = []

    if (!layers.powerPlants) return

    const grouped: Record<string, PowerPlant[]> = {}
    powerPlants.forEach(p => {
      if (!p.lat || !p.lon) return
      const key = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(p)
    })

    Object.values(grouped).forEach(plants => {
      const p = plants[0]
      if (!p.lat || !p.lon) return

      const color = getFuelColor(p.primary_fuel)
      const isPlanned = p.operational_status === 'P'
      const size = Math.max(8, Math.min(24, (p.nameplate_capacity_mw || 100) / 80))

      const el = document.createElement('div')
      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        border-radius: ${p.primary_fuel === 'SUN' ? '3px' : '50%'};
        background: ${color}33;
        border: ${isPlanned ? `1.5px dashed ${color}` : `1.5px solid ${color}`};
        cursor: pointer;
        transition: all 0.15s;
      `

      el.addEventListener('mouseenter', () => {
        if (!map.current || !p.lat || !p.lon) return
        const popup = new mapboxgl.Popup({ closeButton: false, offset: 10 })
          .setLngLat([p.lon, p.lat])
          .setHTML(`
            <div style="font-size:11px;line-height:1.5;">
              <div style="font-weight:600;margin-bottom:2px;">${p.plant_name}</div>
              <div style="color:#8b949e;">${getFuelLabel(p.primary_fuel)} · ${p.operator}</div>
              <div style="color:#8b949e;">${formatMW(p.nameplate_capacity_mw)} · ${p.county} County</div>
              ${isPlanned ? `<div style="color:#f59e0b;margin-top:2px;">⬡ Planned ${p.year_online || ''}</div>` : ''}
              ${p.planned_retirement_year ? `<div style="color:#ff4444;margin-top:2px;">Retiring: ${p.planned_retirement_year}</div>` : ''}
            </div>
          `)
          .addTo(map.current)
        popupRef.current = popup
      })

      el.addEventListener('mouseleave', () => {
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
      })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.lon, p.lat])
        .addTo(map.current!)

      plantMarkersRef.current.push(marker)
    })

  }, [layers.powerPlants, powerPlants, mapLoaded])

  // GHI heatmap visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const viz = layers.solarHeatmap ? 'visible' : 'none'
    if (map.current.getLayer('ghi-circles')) {
      map.current.setLayoutProperty('ghi-circles', 'visibility', viz)
    }
  }, [layers.solarHeatmap, mapLoaded])

  // BESS rings layer
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const layerId = 'bess-rings'
    const sourceId = 'bess-rings-source'

    if (map.current.getLayer(layerId)) map.current.removeLayer(layerId)
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)

    if (!layers.bessRings) return

    const features = dataCenters
      .filter(dc => dc.btm && dc.lat && dc.lon && getSB6Status(dc) === 'mandatory')
      .map(dc => {
        const savings = dc.econ?.['4cp_annual_savings_usd_m'] || 0
        const color = savings > 5 ? '#22c55e' : savings > 2 ? '#f59e0b' : '#8b949e'
        return {
          type: 'Feature' as const,
          properties: {
            color,
            bess_mw: dc.btm?.bess_mw_paired_1to1 || 0,
            savings_m: savings,
            name: dc.project_name,
          },
          geometry: { type: 'Point' as const, coordinates: [dc.lon, dc.lat] }
        }
      })

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features }
    })

    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 45,
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.12,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-opacity': 0.6,
      }
    })

  }, [layers.bessRings, dataCenters, mapLoaded])

  // Solar potential layer
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const layerId = 'solar-potential'
    const sourceId = 'solar-potential-source'

    if (map.current.getLayer(layerId)) map.current.removeLayer(layerId)
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)

    if (!layers.solarPotential) return

    const features = dataCenters
      .filter(dc => dc.btm && dc.lat && dc.lon)
      .map(dc => {
        const mw = dc.btm?.btm_solar_mw_potential || 0
        const cf = dc.btm?.solar_capacity_factor_pct || 0.25
        return {
          type: 'Feature' as const,
          properties: { mw, opacity: 0.15 + cf * 0.6 },
          geometry: { type: 'Point' as const, coordinates: [dc.lon, dc.lat] }
        }
      })

    map.current.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'mw'], 0, 20, 1200, 80],
        'circle-color': '#fbbf24',
        'circle-opacity': ['get', 'opacity'],
        'circle-blur': 0.8,
      }
    })

  }, [layers.solarPotential, dataCenters, mapLoaded])

  // Google proof highlight
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const layerId = 'google-proof'
    const sourceId = 'google-proof-source'

    if (map.current.getLayer(layerId)) map.current.removeLayer(layerId)
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)

    if (!layers.googleProof) return

    const googleDC = dataCenters.find(dc => dc.project_name.includes('Google Haskell DC1'))
    if (!googleDC?.lat || !googleDC?.lon) return

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [googleDC.lon, googleDC.lat] }
        }]
      }
    })

    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 55,
        'circle-color': '#22c55e',
        'circle-opacity': 0.15,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#22c55e',
        'circle-stroke-opacity': 0.8,
      }
    })

    // Fly to Haskell
    map.current.flyTo({ center: [googleDC.lon, googleDC.lat], zoom: 8, duration: 1200 })

    // Add popup
    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, offset: 20 })
      .setLngLat([googleDC.lon, googleDC.lat])
      .setHTML(`
        <div style="font-size:11px;">
          <div style="color:#22c55e;font-weight:600;margin-bottom:4px;">★ Google Haskell DC1</div>
          <div>Solar + BESS collocated</div>
          <div style="color:#8b949e;">Intersect Power / TPG Rise Climate</div>
          <div style="color:#22c55e;margin-top:4px;">SB-6 compliant by design ✓</div>
        </div>
      `)
      .addTo(map.current!)

    popupRef.current = popup

  }, [layers.googleProof, dataCenters, mapLoaded])

  // SB-6 arcs (lines to nearest substation)
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const layerId = 'sb6-arcs'
    const sourceId = 'sb6-arcs-source'

    if (map.current.getLayer(layerId)) map.current.removeLayer(layerId)
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)

    if (!layers.sb6Arcs) return

    // Simple straight lines DC → offset representing substation direction
    const features = dataCenters
      .filter(dc => getSB6Status(dc) === 'mandatory' && dc.lat && dc.lon && dc.btm)
      .map(dc => {
        const distMi = dc.btm?.nearest_substation_dist_miles || 2
        // Approximate offset: substations are generally to the south/east of DFW projects
        const offsetLat = dc.county === 'Dallas' || dc.county === 'Tarrant' ? -0.05 : 0.02
        const offsetLon = dc.county === 'Taylor' ? -0.02 : 0.03
        return {
          type: 'Feature' as const,
          properties: {
            name: dc.project_name,
            mw: dc.capacity_mw_it || 100,
            dist: distMi,
            sub: dc.btm?.nearest_substation_name || ''
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [dc.lon, dc.lat],
              [dc.lon + offsetLon * distMi, dc.lat + offsetLat * distMi]
            ]
          }
        }
      })

    map.current.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#ff4444',
        'line-width': ['interpolate', ['linear'], ['get', 'mw'], 100, 1, 1400, 4],
        'line-opacity': 0.7,
        'line-dasharray': [3, 2],
      }
    })

  }, [layers.sb6Arcs, dataCenters, mapLoaded])

  // Transmission substation dots
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const layerId = 'transmission-dots'
    const sourceId = 'transmission-source'

    if (map.current.getLayer(layerId)) map.current.removeLayer(layerId)
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)

    if (!layers.transmission) return

    const features = dataCenters
      .filter(dc => dc.btm?.nearest_substation_name && dc.lat && dc.lon)
      .map(dc => {
        const kv = dc.btm?.nearest_transmission_kv || 345
        return {
          type: 'Feature' as const,
          properties: { kv, name: dc.btm?.nearest_substation_name, cap: dc.btm?.nearest_substation_dist_miles },
          geometry: { type: 'Point' as const, coordinates: [dc.lon + 0.08, dc.lat - 0.04] }
        }
      })

    map.current.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } })
    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'kv'], 138, 6, 500, 14],
        'circle-color': '#a78bfa',
        'circle-opacity': 0.7,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#a78bfa',
      }
    })

  }, [layers.transmission, dataCenters, mapLoaded])

  return (
    <div className="absolute inset-0 top-[56px]" ref={mapContainer}>
      {/* Pulse ring keyframe injected */}
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.6; }
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="glass-card p-6 text-center max-w-sm">
            <div className="text-[var(--amber)] text-2xl mb-3">⚠</div>
            <h3 className="font-semibold mb-2">Mapbox token required</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Add <code className="font-mono text-xs bg-[var(--bg-card)] px-1 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code className="font-mono text-xs">.env.local</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
