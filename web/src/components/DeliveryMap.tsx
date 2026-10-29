import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { env } from '../lib/env'

export type Area = { name: string; lat: number; lng: number; side?: 'l' | 'r' }
export type CityView = { center: [number, number]; zoom: number; areas: Area[] }

const pinSvg = (active: boolean) =>
  `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg"><path d="M17 42C6 28 3 21 3 15a14 14 0 0 1 28 0c0 6-3 13-14 27Z" fill="${active ? '#7a1f45' : '#e8731a'}" stroke="#2a211c" stroke-width="2.2" stroke-linejoin="round"/><circle cx="17" cy="15" r="5.2" fill="#fbf5ea" stroke="#2a211c" stroke-width="1.8"/></svg>`

const icon = (name: string, active: boolean, side?: 'l' | 'r') =>
  L.divIcon({
    className: 'pg-pin',
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    html: `${pinSvg(active)}<span class="pg-pin-label${active ? ' is-active' : ''}${side ? ` side-${side}` : ''}">${name}</span>`,
  })

/**
 * Static delivery map. Raster tiles only (no WebGL), no zoom/fade/marker animations,
 * wheel-zoom off so it never hijacks page scroll. Tiles default to OpenStreetMap's public
 * server (no key, light use only). For production traffic set VITE_MAP_TILES_URL (and
 * VITE_MAP_ATTRIBUTION) to a keyed provider such as MapTiler, Stadia Maps or Geoapify.
 */
export function DeliveryMap({ view, active, cityKey }: { view: CityView; active: string | null; cityKey: string }) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<Map<string, L.Marker>>(new Map())
  const layer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!host.current || map.current) return
    const m = L.map(host.current, {
      zoomControl: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, dragging: false, boxZoom: false, keyboard: false,
      zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, attributionControl: true,
    }).setView(view.center, view.zoom)
    L.tileLayer(env.mapTilesUrl, { maxZoom: 19, attribution: env.mapAttribution }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // swap city
  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    markers.current.clear()
    m.setView(view.center, view.zoom, { animate: false })
    view.areas.forEach((a) => {
      L.circle([a.lat, a.lng], { radius: 1700, color: '#e8731a', weight: 1, opacity: 0.5, fillColor: '#e8731a', fillOpacity: 0.1, interactive: false }).addTo(g)
      const mk = L.marker([a.lat, a.lng], { icon: icon(a.name, false, a.side), keyboard: false, interactive: false }).addTo(g)
      markers.current.set(a.name, mk)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey])

  // highlight
  useEffect(() => {
    markers.current.forEach((mk, name) => {
      const side = view.areas.find((a) => a.name === name)?.side
      mk.setIcon(icon(name, name === active, side))
      mk.setZIndexOffset(name === active ? 1000 : 0)
    })
  }, [active, cityKey])

  return <div ref={host} className="pg-map h-[420px] w-full sm:h-[520px]" role="img" aria-label="Map of delivery neighbourhoods" />
}
