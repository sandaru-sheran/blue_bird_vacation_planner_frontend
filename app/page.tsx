'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthService } from '@/src/services/auth.service'
import { DestinationService } from '@/src/services/destination.service'
import { DiningService } from '@/src/services/dining.service'
import { RouteService } from '@/src/services/route.service'
import { WeatherService, type WeatherResponse } from '@/src/services/weather.service'
import type { DayPlanRouteResponse, Destination as ApiDestination, DiningInsight } from '@/types/backend-api'
import AdminDrawer from './admin/AdminDrawer'

type Destination = {
  id: number
  city: string
  country: string
  description: string
  duration: string
  price: string
  tag: string
  image: string
  bestTime: string
  highlights: string
  gallery: string[]
  latitude: number
  longitude: number
}

type HotelStay = {
  enabled: boolean
  preference: string
  customNote: string
}

type DiningInsightWithCoordinates = DiningInsight & {
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
  coordinates?: { lat: number; lng: number } | [number, number]
}

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap
  fitBounds: (bounds: unknown, options?: { padding: [number, number] }) => void
  invalidateSize: () => LeafletMap
  remove: () => void
}

type LeafletApi = {
  map: (element: HTMLDivElement) => LeafletMap
  tileLayer: (url: string, options: Record<string, string | number>) => { addTo: (map: LeafletMap) => void }
  marker: (coordinates: [number, number], options?: Record<string, unknown>) => { addTo: (map: LeafletMap) => { bindPopup: (content: string) => void } }
  divIcon: (options: Record<string, string | number | number[]>) => unknown
  polyline: (coordinates: [number, number][], options: Record<string, string | number>) => { addTo: (map: LeafletMap) => void }
  latLngBounds: (coordinates: [number, number][]) => unknown
}

declare global {
  interface Window {
    L?: LeafletApi
  }
}

const diningFallbackImage = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80'

const fallbackDiningByDestination: Record<number, DiningInsight[]> = {
  1: [{ id: 1001, restaurantName: 'Dewmini Roti Shop', priceRange: '$', recommendedDishes: 'Kottu roti and fresh lime', destinationId: 1, imageUrls: [diningFallbackImage] }],
  2: [{ id: 1002, restaurantName: 'The Tuna & The Crab', priceRange: '$$', recommendedDishes: 'Seafood and coastal curries', destinationId: 2, imageUrls: [diningFallbackImage] }],
  3: [{ id: 1003, restaurantName: 'Matey Hut', priceRange: '$', recommendedDishes: 'Sri Lankan rice and curry', destinationId: 3, imageUrls: [diningFallbackImage] }],
}

const dummyDestinations: Destination[] = [
  {
    id: 1,
    city: 'Mirissa Beach',
    country: 'Sri Lanka',
    description: 'Golden sands, turquoise water and unforgettable southern sunsets.',
    duration: 'Flexible stay',
    price: 'Explore',
    tag: 'BEACH',
    bestTime: 'April – October',
    highlights: 'Oia sunset · Caldera cruise · Local tavernas',
    image:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80'],
    latitude: 5.9485,
    longitude: 80.4718,
  },
  {
    id: 2,
    city: 'Galle Fort',
    country: 'Sri Lanka',
    description: 'A living colonial landmark filled with ramparts, galleries and cafés.',
    duration: 'Flexible stay',
    price: 'Explore',
    tag: 'HISTORICAL',
    bestTime: 'May – September',
    highlights: 'Ubud temples · Rice terraces · Nusa islands',
    image:
        'https://images.unsplash.com/photo-1586613831500-6f0c8d3f8b7c?auto=format&fit=crop&w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1586613831500-6f0c8d3f8b7c?auto=format&fit=crop&w=900&q=80'],
    latitude: 6.0329,
    longitude: 80.2168,
  },
  {
    id: 3,
    city: 'Ella',
    country: 'Sri Lanka',
    description: 'Misty mountain trails, tea country and spectacular valley views.',
    duration: 'Flexible stay',
    price: 'Explore',
    tag: 'NATURE',
    bestTime: 'June – September',
    highlights: 'Valley hikes · Lake Brienz · Alpine railway',
    image:
        'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=900&q=80'],
    latitude: 6.8667,
    longitude: 81.0466,
  },
]

function toCardDestination(destination: ApiDestination): Destination {
  const [city, ...countryParts] = destination.name.split(',')
  const country = countryParts.join(',').trim() || destination.category
  const image = destination.imageUrls?.[0] || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'
  const diningSummary = destination.diningInsights
      .map((insight) => insight.restaurantName)
      .filter(Boolean)
      .join(' · ')

  return {
    id: destination.id,
    city: city.trim(),
    country,
    description: diningSummary || 'Discover a new place and make it part of your next journey.',
    duration: 'Flexible stay',
    price: 'Explore',
    tag: destination.category,
    image,
    bestTime: `${destination.openingHour} – ${destination.closingHour}`,
    highlights: diningSummary || 'Local sights · Memorable experiences',
    gallery: destination.imageUrls?.length ? destination.imageUrls : [image],
    latitude: destination.latitude,
    longitude: destination.longitude,
  }
}

function getImageCandidates(destination: Destination): string[] {
  return [destination.image, ...destination.gallery].filter((image, index, images) => Boolean(image) && images.indexOf(image) === index)
}

function getUrlDimensions(url: string): { width: number; height: number } | null {
  const query = url.split('?')[1]?.split('#')[0] || ''
  const params = new URLSearchParams(query)
  const width = Number(params.get('w') || params.get('width'))
  const height = Number(params.get('h') || params.get('height'))
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null
}

function getInitialImage(candidates: string[]): string {
  return candidates.find((image) => {
    const dimensions = getUrlDimensions(image)
    return dimensions && dimensions.width >= dimensions.height
  }) || candidates[0] || ''
}

function findHorizontalImage(candidates: string[]): Promise<string | null> {
  return Promise.all(candidates.map((src) => new Promise<{ src: string; horizontal: boolean }>((resolve) => {
    const image = new window.Image()
    image.onload = () => resolve({ src, horizontal: image.naturalWidth >= image.naturalHeight })
    image.onerror = () => resolve({ src, horizontal: false })
    image.src = src
  }))).then((results) => results.find((result) => result.horizontal)?.src || null)
}

function DestinationMainImage({ destination }: { destination: Destination }) {
  const candidates = useMemo(() => getImageCandidates(destination), [destination])
  const [src, setSrc] = useState(() => getInitialImage(candidates))

  useEffect(() => {
    let active = true
    if (candidates.length > 1) {
      findHorizontalImage(candidates).then((horizontalImage) => {
        if (active && horizontalImage) setSrc(horizontalImage)
      })
    }
    return () => {
      active = false
    }
  }, [candidates])

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.naturalHeight > event.currentTarget.naturalWidth && candidates.length > 1) {
      findHorizontalImage(candidates).then((horizontalImage) => {
        if (horizontalImage) setSrc(horizontalImage)
      })
    }
  }

  return <img src={src} alt={`${destination.city}, ${destination.country}`} onLoad={handleLoad} />
}

function getDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateOption(date: Date, index: number): string {
  const readable = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return index === 0 ? `Today (${readable})` : `${date.toLocaleDateString('en-US', { weekday: 'short' })}, ${readable}`
}

function formatSelectedDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return 'Not selected'
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1]} ${day}, ${year}`
}

export type CssWeatherIconType =
    | 'sunny'
    | 'partly-cloudy'
    | 'cloudy'
    | 'rainy'
    | 'thunderstorm'
    | 'snowy'
    | 'windy'
    | 'clear-night'

export function getCssWeatherType(condition: string): CssWeatherIconType {
  const normalized = (condition || '').trim().toLowerCase()
  if (!normalized) return 'sunny'

  if (normalized.includes('thunder') || normalized.includes('lightning') || normalized.includes('storm')) {
    return 'thunderstorm'
  }
  if (normalized.includes('snow') || normalized.includes('blizzard') || normalized.includes('flurries') || normalized.includes('sleet') || normalized.includes('ice') || normalized.includes('hail')) {
    return 'snowy'
  }
  if (normalized.includes('rain') || normalized.includes('drizzle') || normalized.includes('shower')) {
    return 'rainy'
  }
  if (normalized.includes('wind') || normalized.includes('breeze') || normalized.includes('gale')) {
    return 'windy'
  }
  if (normalized.includes('night') || normalized.includes('moon')) {
    return 'clear-night'
  }
  if (
      normalized.includes('partly') ||
      normalized.includes('scattered') ||
      normalized.includes('broken') ||
      normalized.includes('few clouds') ||
      normalized.includes('mainly clear')
  ) {
    return 'partly-cloudy'
  }
  if (normalized.includes('cloud') || normalized.includes('overcast') || normalized.includes('fog') || normalized.includes('mist') || normalized.includes('haze')) {
    return 'cloudy'
  }
  return 'sunny'
}

function WeatherIcon({ condition, size = 96, className = '' }: { condition: string; size?: number; className?: string }) {
  const iconType = getCssWeatherType(condition)
  // Base pure CSS icon artboard is 120x120 matching your CSS .wx-stage
  const scale = size / 120

  return (
      <span
          className={`wx-stage-wrapper ${className}`.trim()}
          style={{ width: size, height: size, display: 'inline-flex', position: 'relative', overflow: 'visible', flexShrink: 0 }}
          role="img"
          aria-label={condition || 'Weather condition'}
      >
      <span
          className="wx-stage"
          style={{ transform: `scale(${scale})`, position: 'absolute', top: 0, left: 0 }}
      >
        {iconType === 'sunny' && (
            <span className="wx-sunny" />
        )}

        {iconType === 'partly-cloudy' && (
            <span className="wx-partly-cloudy">
            <span className="wx-small-sun" />
            <span className="wx-cloud" />
          </span>
        )}

        {iconType === 'cloudy' && (
            <span className="wx-overcast">
            <span className="wx-cloud-back" />
            <span className="wx-cloud" />
          </span>
        )}

        {iconType === 'rainy' && (
            <span className="wx-rainy">
            <span className="wx-cloud wx-dark" />
            <span className="wx-raindrops" />
          </span>
        )}

        {iconType === 'thunderstorm' && (
            <span className="wx-thunderstorm">
            <span className="wx-cloud wx-dark" />
            <span className="wx-bolt" />
            <span className="wx-raindrops" />
          </span>
        )}

        {iconType === 'snowy' && (
            <span className="wx-snowy">
            <span className="wx-cloud" />
            <span className="wx-flakes" />
          </span>
        )}

        {iconType === 'windy' && (
            <span className="wx-windy">
            <span className="wx-cloud" />
            <span className="wx-wind-lines" />
          </span>
        )}

        {iconType === 'clear-night' && (
            <span className="wx-night">
            <span className="wx-moon" />
            <span className="wx-stars" />
          </span>
        )}
      </span>
    </span>
  )
}

function haversineDistance(latitudeOne: number, longitudeOne: number, latitudeTwo: number, longitudeTwo: number): number {
  const earthRadius = 6371000
  const toRadians = (value: number) => value * Math.PI / 180
  const latitudeDelta = toRadians(latitudeTwo - latitudeOne)
  const longitudeDelta = toRadians(longitudeTwo - longitudeOne)
  const a = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(toRadians(latitudeOne)) * Math.cos(toRadians(latitudeTwo)) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 👇 ADD THIS FUNCTION RIGHT HERE 👇
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0, lat = 0, lng = 0

  while (index < encoded.length) {
    let b: number, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lng += dlng

    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="M6 6l12 12M18 6 6 18"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function useTransparentBirdImage() {
  const [transparentBirdUrl, setTransparentBirdUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.src = '/bluebird-art.jpg'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) return

      context.drawImage(image, 0, 0)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let index = 0; index < imageData.data.length; index += 4) {
        const red = imageData.data[index]
        const green = imageData.data[index + 1]
        const blue = imageData.data[index + 2]
        const blueDominance = blue - Math.max(red, green)
        const neutralRange = Math.max(red, green, blue) - Math.min(red, green, blue)

        if (neutralRange < 18 || blueDominance < 8) {
          imageData.data[index + 3] = 0
        } else {
          imageData.data[index + 3] = Math.min(255, Math.round((blueDominance - 8) * 18))
        }
      }

      context.putImageData(imageData, 0, 0)
      if (!cancelled) setTransparentBirdUrl(canvas.toDataURL('image/png'))
    }

    return () => {
      cancelled = true
      image.onload = null
    }
  }, [])

  return transparentBirdUrl
}

function BirdLogo() {
  return (
      <div className="brand-mark" aria-label="Bluebird logo">
        <svg viewBox="0 0 44 44" role="img" aria-label="Bluebird">
          <path d="M8 26c7-.4 8.6-4.7 10-9.8 3 3.5 6.5 5.3 10.8 4.8 3.2-.3 5.4-2 7.7-4.8-.2 7-3.2 12.6-9.2 16.2-5.6 3.4-12 3.5-18.8 1.4 3.3-1 5.5-2.4 7.2-4.4-3.1.2-5.6-1-7.7-3.4Z" fill="currentColor"/>
          <path d="M29 20c.5-4 2.3-6.7 5.5-8.2-.6 2.2-.5 4 .6 5.5" fill="currentColor"/>
        </svg>
      </div>
  )
}

export default function App() {
  const transparentBirdUrl = useTransparentBirdImage()
  const [destinations, setDestinations] = useState<Destination[]>(dummyDestinations)
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedDate, setSelectedDate] = useState<string>(() =>
      typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''
  )
  const [weather, setWeather] = useState<Record<number, WeatherResponse>>({})
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [routeResult, setRouteResult] = useState<DayPlanRouteResponse | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [isDiningModalOpen, setIsDiningModalOpen] = useState(false)
  const [diningInsights, setDiningInsights] = useState<DiningInsight[]>([])
  const [isDiningLoading, setIsDiningLoading] = useState(false)
  const [diningError, setDiningError] = useState<string | null>(null)
  const [activeDiningDestination, setActiveDiningDestination] = useState('')
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isAdminSidebarExpanded, setIsAdminSidebarExpanded] = useState(false)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [bufferMinutes, setBufferMinutes] = useState<Record<number, number>>({})
  const [nearbyDining, setNearbyDining] = useState<Record<number, DiningInsight[]>>({})
  const [selectedDining, setSelectedDining] = useState<Record<number, number>>({})
  const [diningGallery, setDiningGallery] = useState<{ restaurantName: string; images: string[]; index: number } | null>(null)
  const [hotelStays, setHotelStays] = useState<Record<number, HotelStay>>({})
  const fetchedDiningIdsRef = useRef<Set<string | number>>(new Set())
  const galleryDragRef = useRef<{ gallery: HTMLDivElement | null; startX: number; startScrollLeft: number; dragged: boolean }>({
    gallery: null,
    startX: 0,
    startScrollLeft: 0,
    dragged: false,
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedDate((current) => current || getDateString(new Date())), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    DestinationService.getAll(selectedCategory === 'ALL' ? undefined : selectedCategory)
        .then((data) => {
          if (data.length > 0) {
            setDestinations(data.map(toCardDestination))
          }
        })
        .catch(() => undefined)
  }, [selectedCategory])

  useEffect(() => {
    let cancelled = false
    Promise.all(destinations.map(async (destination) => {
      try {
        return [destination.id, await WeatherService.getWeather(destination.latitude, destination.longitude, selectedDate)] as const
      } catch {
        return [destination.id, { condition: 'Clear', temperatureCelsius: 28, humidity: 75 }] as const
      }
    })).then((results) => {
      if (!cancelled) setWeather(Object.fromEntries(results))
    })
    return () => { cancelled = true }
  }, [destinations, selectedDate])

  const filtered = useMemo(
      () => destinations.filter((item) => (selectedCategory === 'ALL' || item.tag === selectedCategory)
          && `${item.city} ${item.country}`.toLowerCase().includes(search.toLowerCase())),
      [destinations, search, selectedCategory],
  )

  const categories = useMemo(
      () => ['ALL', 'BEACH', 'HISTORICAL', 'NATURE', 'CULTURAL', 'ADVENTURE', ...destinations.map((item) => item.tag)]
          .filter((category, index, all) => all.indexOf(category) === index),
      [destinations],
  )

  const [dateOptions, setDateOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const today = new Date()
    const timer = window.setTimeout(() => setDateOptions(Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() + index)
      return { value: getDateString(date), label: formatDateOption(date, index) }
    })), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const toggle = (id: number) =>
      setSelectedDestinationIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const handleGalleryPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const gallery = event.currentTarget
    galleryDragRef.current = {
      gallery,
      startX: event.clientX,
      startScrollLeft: gallery.scrollLeft,
      dragged: false,
    }
    gallery.setPointerCapture(event.pointerId)
  }

  const handleGalleryPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = galleryDragRef.current
    if (drag.gallery !== event.currentTarget || !galleryDragRef.current.gallery) return
    const distance = event.clientX - drag.startX
    if (Math.abs(distance) > 3) {
      drag.dragged = true
      event.currentTarget.classList.add('dragging')
    }
    if (drag.dragged) {
      event.currentTarget.scrollLeft = drag.startScrollLeft - distance
      event.preventDefault()
    }
  }

  const handleGalleryPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = galleryDragRef.current
    if (drag.gallery === event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    event.currentTarget.classList.remove('dragging')
    window.setTimeout(() => {
      galleryDragRef.current = { gallery: null, startX: 0, startScrollLeft: 0, dragged: false }
    }, 0)
  }

  const selectedDestinations = selectedDestinationIds
      .map((id) => destinations.find((destination) => destination.id === id))
      .filter((destination): destination is Destination => destination !== undefined)

  const selectedPlaceIds = selectedDestinationIds.join(',')
  useEffect(() => {
    if (step !== 2) return
    let cancelled = false
    const placeIds = selectedPlaceIds.split(',').filter(Boolean).map(Number)

    Promise.all(placeIds.map(async (placeId) => {
      if (fetchedDiningIdsRef.current.has(placeId) || nearbyDining[placeId]) return null
      fetchedDiningIdsRef.current.add(placeId)
      try {
        const results = await DiningService.getNearby(placeId)
        return [placeId, results.length > 0 ? results : fallbackDiningByDestination[placeId] ?? []] as const
      } catch {
        return [placeId, fallbackDiningByDestination[placeId] ?? []] as const
      }
    })).then((results) => {
      if (!cancelled) {
        const fetchedResults = results.filter((result): result is readonly [number, DiningInsight[]] => result !== null)
        if (fetchedResults.length > 0) {
          setNearbyDining((current) => ({ ...current, ...Object.fromEntries(fetchedResults) }))
        }
      }
    })

    return () => { cancelled = true }
  }, [selectedPlaceIds, step])

  const createFallbackRoute = (selected: Destination[], averageBufferSeconds: number): DayPlanRouteResponse => {
    const segmentDetails = selected.slice(0, -1).map((from, index) => {
      const to = selected[index + 1]
      const distance = haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude)
      const duration = Math.max(900, Math.round(distance / 11.1))
      return {
        distance,
        duration,
        instruction: `Travel from ${from.city} to ${to.city} via the coastal and hill-country roads.`,
      }
    })
    const travelSeconds = segmentDetails.reduce((total, segment) => total + segment.duration, 0)
    return {
      finalOptimizedTimeSeconds: travelSeconds + averageBufferSeconds * selected.length,
      totalDistanceMeters: segmentDetails.reduce((total, segment) => total + segment.distance, 0),
      overviewPolyline: '',
      optimizedWaypointOrder: selected.map((_, index) => index),
      segmentDetails,
      rawJsonResponse: '',
    }
  }

  const handlePlanTrip = async () => {
    if (selectedDestinationIds.length < 2) {
      setRouteError('Select at least 2 places to plan')
      return
    }

    setIsLoadingRoute(true)
    setRouteError(null)

    const averageBufferSeconds = Math.round(
        selectedDestinationIds.reduce((total, id) => total + (bufferMinutes[id] ?? 15) * 60, 0) / selectedDestinationIds.length,
    )

    try {
      const data = await RouteService.calculateRoute(
          selectedDestinationIds,
          averageBufferSeconds,
      )
      setRouteResult(data)
      setStep(3)
    } catch {
      setRouteResult(createFallbackRoute(selectedDestinations, averageBufferSeconds))
      setStep(3)
    } finally {
      setIsLoadingRoute(false)
    }
  }

  const handleCloseDining = () => {
    setIsDiningModalOpen(false)
    setDiningInsights([])
    setDiningError(null)
  }

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoginLoading(true)
    setLoginError(null)

    try {
      await AuthService.login({ username, password })
      setIsLoginModalOpen(false)
      setUsername('')
      setPassword('')
      setIsAdminAuthenticated(true)
      setIsAdminSidebarExpanded(true)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to log in. Please try again.')
    } finally {
      setIsLoginLoading(false)
    }
  }

  return (
      <div className="app-shell">
        <aside className="sidebar" style={{ visibility: isAdminSidebarExpanded ? 'hidden' : 'visible' }}>
          <div className="brand"><BirdLogo /><span>bluebird</span></div>
          <nav>
            <p className="nav-label">Workspace</p>
            <button className={`nav-item ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}><Icon name="pin" />1. Select Places</button>
            <button className={`nav-item ${step === 2 ? 'active' : ''}`} disabled={selectedDestinationIds.length < 2} onClick={() => setStep(2)}><Icon name="grid" />2. Stays &amp; Dining</button>
            <button className={`nav-item ${step === 3 ? 'active' : ''}`} disabled={!routeResult} onClick={() => setStep(3)}><Icon name="calendar" />3. Route &amp; Itinerary</button>
          </nav>
          <div className="sidebar-actions">
            {step === 1 && (
                <>
                  <button
                      className="primary-button btn-primary sidebar-primary-button"
                      onClick={() => setStep(2)}
                      disabled={selectedDestinationIds.length < 2}
                      title={selectedDestinationIds.length < 2 ? 'Select at least 2 places to plan' : undefined}
                  >
                    Next: Stays &amp; Dining →
                  </button>
                  {selectedDestinationIds.length < 2 && <small className="sidebar-action-message">Select at least 2 places to continue</small>}
                </>
            )}
            {step === 2 && (
                <>
                  <button className="primary-button btn-primary sidebar-primary-button" onClick={handlePlanTrip} disabled={isLoadingRoute}>
                    {isLoadingRoute ? 'Calculating route...' : 'Calculate Route →'}
                  </button>
                  <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="sidebar-back-link"
                  >
                    ← Back to Places
                  </button>
                  {routeError && <small className="sidebar-action-message" role="alert">{routeError}</small>}
                </>
            )}
            {step === 3 && (
                <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="sidebar-back-link"
                >
                  ← Back to Stays &amp; Dining
                </button>
            )}
          </div>
          <div className="sidebar-bottom">
            <button className="admin-access-link" onClick={() => {
              if (isAdminSidebarExpanded) return
              if (isAdminAuthenticated) setIsAdminSidebarExpanded(true)
              else { setIsLoginModalOpen(true); setLoginError(null) }
            }}>
              {isAdminAuthenticated ? 'Expand Admin' : 'Admin Access'}
            </button>
          </div>
        </aside>

        <main>
          <div
              className="bg-bird-watermark"
              aria-hidden="true"
              style={{
                position: 'fixed',
                right: '5%',
                top: '50%',
                transform: 'translateY(-50%) rotate(-8deg)',
                width: '1400px',
                height: '1400px',
                opacity: 0.12,
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
          >
            {transparentBirdUrl && (
                <img
                    src={transparentBirdUrl}
                    alt=""
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 30px 60px rgba(37, 142, 201, 0.18))',
                    }}
                />
            )}
          </div>
          <header className="workspace-topbar">
            <div className="workspace-topbar-actions">
              <button
                  type="button"
                  className="topbar-icon-btn"
                  aria-label="Notifications"
                  title="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
              {step === 1 && (
                  <button
                      type="button"
                      className="primary-button topbar-plan-btn"
                      onClick={() => selectedDestinationIds.length >= 2 && setStep(2)}
                      disabled={selectedDestinationIds.length < 2}
                      title={selectedDestinationIds.length < 2 ? 'Select at least 2 places to plan a trip' : 'Continue to Stays & Dining'}
                  >
                    <Icon name="plus" size={16} /> Plan a trip
                  </button>
              )}
            </div>
          </header>
          {step === 1 ? <div className="content">
            <section className="intro">
              <p className="eyebrow">YOUR TRAVEL BOARD</p>
              <h1>Bluebird Vacation Planner</h1>
              <p>Choose from our thoughtfully planned destinations and start shaping your next story.</p>
            </section>

            <section className="stats">
              <div><span>Places Available</span><strong>{destinations.length}</strong></div>
              <div><span>Places Selected</span><strong>{selectedDestinationIds.length}</strong></div>
              <div><span>Planned Visit Date</span><select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>{dateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            </section>

            <div className="section-heading">
              <div><h2>Explore destinations</h2><p>Handpicked trips, ready when you are.</p></div>
              <div className="explore-filters">
                <label className="search"><Icon name="search" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search places" /></label>
                <select className="category-filter" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label="Filter by category">{categories.map((category) => <option key={category} value={category}>{category === 'ALL' ? 'All categories' : category}</option>)}</select>
              </div>
            </div>

            <div className="destination-list">
              {filtered.map((destination) => {
                const isSelected = selectedDestinationIds.includes(destination.id)
                const destinationWeather = weather[destination.id]
                return (
                    <article
                        key={destination.id}
                        className={`destination-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggle(destination.id)}
                    >
                      <DestinationMainImage destination={destination} />
                      <div className="card-copy">
                        <div className="card-topline"><span className="tag">{destination.tag}</span><span className="duration">{destination.duration}</span></div>
                        <h3>{destination.city}</h3>
                        <p className="country"><Icon name="pin" size={15} />{destination.country}</p>
                        <p className="description">{destination.description}</p>
                        <div className="extra-copy">
                          <span><b>Best time</b>{destination.bestTime}</span>
                          <span><b>Don&apos;t miss</b>{destination.highlights}</span>
                        </div>
                      </div>
                      <div className="hover-details">
                        <div
                            className="mini-gallery"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={handleGalleryPointerDown}
                            onPointerMove={handleGalleryPointerMove}
                            onPointerUp={handleGalleryPointerUp}
                            onPointerCancel={handleGalleryPointerUp}
                        >
                          {destination.gallery.map((image, index) => (
                              <img key={image} src={image} alt={`${destination.city} travel view ${index + 1}`} />
                          ))}
                        </div>
                      </div>
                      {/* DETAILS FIRST (LEFT), PURE CSS ICON SECOND (RIGHT) */}
                      {/* DETAILS FIRST (LEFT), PURE CSS ICON SECOND (RIGHT) */}
                      <div className="card-weather" aria-label={`Weather: ${destinationWeather?.condition ?? 'Loading'}`}>
                        <div className="card-weather-text">
                          <small className="weather-condition-meta">
                            {destinationWeather?.condition ?? 'Loading'}
                          </small>
                          <strong className="weather-temp-value">
                            {destinationWeather ? `${Math.round(destinationWeather.temperatureCelsius)}°` : '—'}
                          </strong>
                        </div>
                        <WeatherIcon condition={destinationWeather?.condition ?? 'Clear'} size={72} />
                      </div>
                      <div className="card-add-strip" aria-hidden="true">
                    <span className="card-add-circle">
                      <Icon name="check" size={14} />
                    </span>
                        <span className="card-add-label">{isSelected ? 'ADDED' : 'ADD'}</span>
                      </div>
                    </article>
                )
              })}
            </div>
            {filtered.length === 0 && <div className="empty-state">No destinations match “{search}”.</div>}
          </div> : step === 2 ? (
              <StaysDiningView
                  selectedDestinations={selectedDestinations}
                  bufferMinutes={bufferMinutes}
                  setBufferMinutes={setBufferMinutes}
                  nearbyDining={nearbyDining}
                  selectedDining={selectedDining}
                  setSelectedDining={setSelectedDining}
                  onOpenDiningGallery={(item) => setDiningGallery({
                    restaurantName: item.restaurantName,
                    images: item.imageUrls?.length ? item.imageUrls : [diningFallbackImage],
                    index: 0,
                  })}
                  hotelStays={hotelStays}
                  setHotelStays={setHotelStays}
                  onBack={() => setStep(1)}
              />
          ) : (
              <ItineraryView
                  onBack={() => setStep(2)}
                  routeResult={routeResult}
                  selectedDestinations={selectedDestinations}
                  selectedDate={selectedDate}
                  weather={weather}
                  bufferMinutes={bufferMinutes}
                  selectedDining={selectedDining}
                  nearbyDining={nearbyDining}
                  hotelStays={hotelStays}
              />
          )}
        </main>
        {isDiningModalOpen && (
            <div className="modal-backdrop" role="presentation" onClick={handleCloseDining}>
              <div className="modal dining-modal" role="dialog" aria-modal="true" aria-labelledby="dining-modal-title" onClick={(event) => event.stopPropagation()}>
                <button className="modal-close" onClick={handleCloseDining} aria-label="Close nearby dining">
                  <Icon name="close" />
                </button>
                <p className="eyebrow">TASTE OF THE ISLAND</p>
                <h2 id="dining-modal-title">Nearby dining in {activeDiningDestination}</h2>
                <p className="modal-subtitle">Good food makes a good journey better.</p>
                {isDiningLoading && <div className="dining-status">Finding the best nearby places...</div>}
                {diningError && <div className="dining-status dining-error" role="alert">{diningError}</div>}
                {!isDiningLoading && !diningError && diningInsights.length === 0 && (
                    <div className="dining-status">No nearby dining recommendations found.</div>
                )}
                {!isDiningLoading && !diningError && diningInsights.map((item) => (
                    <div className="dining-item" key={item.id}>
                      <span className="food-icon">⌁</span>
                      <div>
                        <strong>{item.restaurantName}</strong>
                        <span>{item.priceRange} · {item.recommendedDishes}</span>
                      </div>
                    </div>
                ))}
              </div>
            </div>
        )}
        {diningGallery && (
            <div className="gallery-backdrop" role="presentation" onClick={() => setDiningGallery(null)}>
              <div className="gallery-spread" role="dialog" aria-modal="true" aria-labelledby="dining-gallery-title" onClick={(event) => event.stopPropagation()}>
                <h2 id="dining-gallery-title">{diningGallery.restaurantName}</h2>
                <button className="gallery-close" onClick={() => setDiningGallery(null)} aria-label="Close restaurant gallery">×</button>
                {diningGallery.images.length > 1 && (
                    <>
                      <button className="gallery-arrow gallery-prev" onClick={() => setDiningGallery((current) => current && ({ ...current, index: (current.index - 1 + current.images.length) % current.images.length }))} aria-label="Previous restaurant image">‹</button>
                      <button className="gallery-arrow gallery-next" onClick={() => setDiningGallery((current) => current && ({ ...current, index: (current.index + 1) % current.images.length }))} aria-label="Next restaurant image">›</button>
                    </>
                )}
                <div className="gallery-stage">
                  {diningGallery.images.map((image, index) => {
                    const total = diningGallery.images.length
                    let diff = index - diningGallery.index
                    if (diff > Math.floor(total / 2)) diff -= total
                    if (diff < -Math.floor(total / 2)) diff += total

                    const absDiff = Math.abs(diff)
                    const isCenter = diff === 0
                    const position = isCenter ? 'center' : diff > 0 ? 'right' : 'left'
                    return <button
                        type="button"
                        className={`gallery-spread-image ${position}`}
                        style={{ zIndex: isCenter ? 30 : 20 - absDiff }}
                        key={`${image}-${index}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!isCenter) {
                            setDiningGallery((current) => current && ({ ...current, index }))
                          }
                        }}
                    >
                      <img
                          src={image}
                          alt={`${diningGallery.restaurantName} view ${index + 1}`}
                          draggable={false}
                      />
                      <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: '#070d17',
                            opacity: isCenter ? 0 : absDiff === 1 ? 0.42 : 0.65,
                            transition: 'opacity 0.36s ease',
                            pointerEvents: 'none',
                          }}
                      />
                    </button>
                  })}
                </div>
              </div>
            </div>
        )}
        {isAdminSidebarExpanded && <AdminDrawer onCollapse={() => setIsAdminSidebarExpanded(false)} onLogout={async () => {
          await AuthService.logout()
          setIsAdminAuthenticated(false)
          setIsAdminSidebarExpanded(false)
        }} />}
        {isLoginModalOpen && (
            <div className="modal-backdrop" role="presentation" onClick={() => setIsLoginModalOpen(false)}>
              <div className="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title" onClick={(event) => event.stopPropagation()}>
                <button className="modal-close" onClick={() => setIsLoginModalOpen(false)} aria-label="Close admin login">
                  <Icon name="close" />
                </button>
                <p className="eyebrow">ADMINISTRATION</p>
                <h2 id="login-modal-title">Admin Access</h2>
                <p className="modal-subtitle">Sign in to manage destinations and dining insights.</p>
                <form className="login-form" onSubmit={handleLogin}>
                  <label>
                    Username
                    <input
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                        required
                    />
                  </label>
                  <label>
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                    />
                  </label>
                  {loginError && <p className="login-error" role="alert">{loginError}</p>}
                  <button className="primary-button login-submit" type="submit" disabled={isLoginLoading}>
                    {isLoginLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>
              </div>
            </div>
        )}
      </div>
  )
}

function StaysDiningView({
                           selectedDestinations,
                           bufferMinutes,
                           setBufferMinutes,
                           nearbyDining,
                           selectedDining,
                           setSelectedDining,
                           onOpenDiningGallery,
                           hotelStays,
                           setHotelStays,
                           onBack,
                         }: {
  selectedDestinations: Destination[]
  bufferMinutes: Record<number, number>
  setBufferMinutes: React.Dispatch<React.SetStateAction<Record<number, number>>>
  nearbyDining: Record<number, DiningInsight[]>
  setNearbyDining?: React.Dispatch<React.SetStateAction<Record<number, DiningInsight[]>>>
  selectedDining: Record<number, number>
  setSelectedDining: React.Dispatch<React.SetStateAction<Record<number, number>>>
  onOpenDiningGallery: (item: DiningInsight) => void
  hotelStays: Record<number, HotelStay>
  setHotelStays: React.Dispatch<React.SetStateAction<Record<number, HotelStay>>>
  onBack: () => void
}) {
  // Pointer-capture horizontal drag state (matches Step 1 mini-gallery slider)
  const diningDragRef = useRef<{
    slider: HTMLDivElement | null
    startX: number
    startScrollLeft: number
    dragged: boolean
  }>({
    slider: null,
    startX: 0,
    startScrollLeft: 0,
    dragged: false,
  })

  const handleDiningPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const slider = event.currentTarget
    diningDragRef.current = {
      slider,
      startX: event.clientX,
      startScrollLeft: slider.scrollLeft,
      dragged: false,
    }
  }

  const handleDiningPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = diningDragRef.current
    if (drag.slider !== event.currentTarget || event.buttons !== 1) return
    const distance = event.clientX - drag.startX
    if (Math.abs(distance) > 5 && !drag.dragged) {
      drag.dragged = true
      event.currentTarget.classList.add('dragging')
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (drag.dragged) {
      event.currentTarget.scrollLeft = drag.startScrollLeft - distance
      event.preventDefault()
    }
  }

  const handleDiningPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = diningDragRef.current
    if (drag.slider === event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    event.currentTarget.classList.remove('dragging')
    window.setTimeout(() => {
      diningDragRef.current = { slider: null, startX: 0, startScrollLeft: 0, dragged: false }
    }, 50)
  }

  return (
      <div className="content itinerary-content">
        <div className="itinerary-head">
          <div>
            <button className="back-link" onClick={onBack}>← Back to Places</button>
            <p className="eyebrow">STEP 2 · STAYS &amp; DINING</p>
            <h1>Shape each stop</h1>
            <p>Set your exploring time, discover nearby dining, and add an overnight stay.</p>
          </div>
        </div>
        <div className="stay-list">
          {selectedDestinations.map((destination) => {
            const dining = nearbyDining[destination.id]
            const hotel = hotelStays[destination.id] ?? { enabled: false, preference: '', customNote: '' }
            return (
                <section className="stay-card" key={destination.id}>
                  <div className="stay-card-header">
                    <div><span className="tag">{destination.tag}</span><h2>{destination.city}</h2><p>{destination.country} · Open {destination.bestTime}</p></div>
                  </div>
                  <label className="stay-control">
                    <span><strong>Buffer / Exploring Time</strong><small>Time to enjoy this stop beyond travel</small></span>
                    <span className="input-suffix"><input type="number" min="0" step="5" value={bufferMinutes[destination.id] ?? 15} onChange={(event) => setBufferMinutes((current) => ({ ...current, [destination.id]: Math.max(0, Number(event.target.value)) }))} /> min</span>
                  </label>
                  <div className="stay-control dining-control">
                    <div className="dining-label">
                      <strong>Nearby Dining Selection <small>(Optional)</small></strong>
                      <small>Choose a restaurant to visit here (drag horizontally to explore)</small>
                    </div>
                    {!dining ? <div className="dining-loading">Finding nearby dining...</div> : (
                        <div
                            className="dining-slider-row"
                            onPointerDown={handleDiningPointerDown}
                            onPointerMove={handleDiningPointerMove}
                            onPointerUp={handleDiningPointerUp}
                            onPointerCancel={handleDiningPointerUp}
                        >
                          {dining.map((item) => {
                            const isSelected = selectedDining[destination.id] === item.id
                            return (
                                <article
                                    key={item.id}
                                    className={`dining-horizontal-card ${isSelected ? 'selected' : ''}`}
                                >
                                  <button
                                      type="button"
                                      className="dining-slide-image"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        if (diningDragRef.current.dragged) return
                                        onOpenDiningGallery(item)
                                      }}
                                      aria-label={`View ${item.restaurantName} images`}
                                  >
                                    <img src={item.imageUrls?.[0] || diningFallbackImage} alt="" draggable={false} />
                                  </button>
                                  <button
                                      type="button"
                                      className="dining-slide-info"
                                      onClick={() => {
                                        if (diningDragRef.current.dragged) return
                                        setSelectedDining((current) => ({ ...current, [destination.id]: current[destination.id] === item.id ? 0 : item.id }))
                                      }}
                                  >
                                    <div className="dining-card-topline">
                                      <span className="tag">{item.priceRange}</span>
                                      <span className="dining-nearby-label">Click photo to preview · Click card to select</span>
                                    </div>
                                    <strong className="dining-card-title">{item.restaurantName}</strong>
                                    <div className="dining-card-dishes">
                                      <b>RECOMMENDED DISHES</b>
                                      <small>{item.recommendedDishes}</small>
                                    </div>
                                  </button>
                                </article>
                            )
                          })}
                        </div>
                    )}
                  </div>
                  <div className="stay-control">
                    <label className="hotel-toggle"><input type="checkbox" checked={hotel.enabled} onChange={(event) => setHotelStays((current) => ({ ...current, [destination.id]: { ...hotel, enabled: event.target.checked } }))} /><strong>Add overnight hotel stay</strong></label>
                    {hotel.enabled && <select value={hotel.preference} onChange={(event) => setHotelStays((current) => ({ ...current, [destination.id]: { ...hotel, preference: event.target.value } }))}><option value="">Choose a hotel preference</option><option>Boutique Coastal Stay</option><option>Heritage Villa</option><option>Hill Country Eco Lodge</option><option>Custom preference</option></select>}
                    {hotel.enabled && hotel.preference === 'Custom preference' && <input type="text" value={hotel.customNote} placeholder="Add a hotel note" onChange={(event) => setHotelStays((current) => ({ ...current, [destination.id]: { ...hotel, customNote: event.target.value } }))} />}
                  </div>
                </section>
            )
          })}
        </div>
      </div>
  )
}

function ItineraryView({
                         onBack,
                         routeResult,
                         selectedDestinations,
                         selectedDate,
                         weather,
                         bufferMinutes,
                         selectedDining,
                         nearbyDining,
                         hotelStays,
                       }: {
  onBack: () => void
  routeResult: DayPlanRouteResponse | null
  selectedDestinations: Destination[]
  selectedDate: string
  weather: Record<number, WeatherResponse>
  bufferMinutes: Record<number, number>
  selectedDining: Record<number, number>
  nearbyDining: Record<number, DiningInsight[]>
  hotelStays: Record<number, HotelStay>
}) {
  const orderedDestinations = useMemo(() => {
    const order = routeResult?.optimizedWaypointOrder
    if (!order || order.length === 0) return selectedDestinations

    // Case 1: Backend returned all 5 items as 0-based indices (0 to N-1)
    if (
        order.length === selectedDestinations.length &&
        order.every((idx) => idx >= 0 && idx < selectedDestinations.length)
    ) {
      return order.map((idx) => selectedDestinations[idx])
    }

    // Case 2: Backend returned Destination Database IDs instead of array indices
    const byId = order
        .map((id) => selectedDestinations.find((d) => d.id === id))
        .filter((d): d is Destination => d !== undefined)
    if (byId.length === selectedDestinations.length) {
      return byId
    }

    // Case 3: Backend only returned intermediate waypoints (e.g., 3 waypoints for 5 stops)
    if (order.length === selectedDestinations.length - 2 && selectedDestinations.length > 2) {
      const start = selectedDestinations[0]
      const end = selectedDestinations[selectedDestinations.length - 1]
      const middle = order
          .map((idx) => selectedDestinations[idx] ?? selectedDestinations[idx + 1])
          .filter((d): d is Destination => d !== undefined && d.id !== start.id && d.id !== end.id)

      if (middle.length === selectedDestinations.length - 2) {
        return [start, ...middle, end]
      }
    }

    function decodePolyline(encoded: string): [number, number][] {
      const points: [number, number][] = []
      let index = 0, lat = 0, lng = 0

      while (index < encoded.length) {
        let b: number, shift = 0, result = 0
        do {
          b = encoded.charCodeAt(index++) - 63
          result |= (b & 0x1f) << shift
          shift += 5
        } while (b >= 0x20)
        const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
        lat += dlat

        shift = 0
        result = 0
        do {
          b = encoded.charCodeAt(index++) - 63
          result |= (b & 0x1f) << shift
          shift += 5
        } while (b >= 0x20)
        const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
        lng += dlng

        points.push([lat / 1e5, lng / 1e5])
      }
      return points
    }

    // Fallback: Never silently drop locations—append any missing ones at the end
    const mapped = order
        .map((idx) => selectedDestinations[idx] ?? selectedDestinations.find((d) => d.id === idx))
        .filter((d): d is Destination => d !== undefined)
    const missing = selectedDestinations.filter((d) => !mapped.some((m) => m.id === d.id))
    return [...mapped, ...missing]
  }, [routeResult, selectedDestinations])

  const formatTravelTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours} hrs ${minutes} mins` : `${minutes} mins`
  }

  const diningName = useCallback((destination: Destination) => {
    const diningId = selectedDining[destination.id]
    return nearbyDining[destination.id]?.find((item) => item.id === diningId)?.restaurantName
  }, [nearbyDining, selectedDining])

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)

  const getDiningCoordinates = useCallback((item: DiningInsight, destination: Destination): [number, number] => {
    const dining = item as DiningInsightWithCoordinates
    if (typeof dining.lat === 'number' && typeof dining.lng === 'number') return [dining.lat, dining.lng]
    if (typeof dining.latitude === 'number' && typeof dining.longitude === 'number') return [dining.latitude, dining.longitude]
    if (Array.isArray(dining.coordinates) && dining.coordinates.length === 2) return dining.coordinates
    if (dining.coordinates && !Array.isArray(dining.coordinates) && typeof dining.coordinates.lat === 'number' && typeof dining.coordinates.lng === 'number') {
      return [dining.coordinates.lat, dining.coordinates.lng]
    }
    return [destination.latitude + 0.008, destination.longitude + 0.008]
  }, [])

  useEffect(() => {
    if (!routeResult || !mapContainerRef.current) return
    let cancelled = false

    const loadLeaflet = async () => {
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.dataset.leafletCss = 'true'
        document.head.appendChild(link)
      }
      if (!window.L) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-leaflet-js]') as HTMLScriptElement | null
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true })
            existing.addEventListener('error', () => reject(new Error('Leaflet failed to load')), { once: true })
            return
          }
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.async = true
          script.dataset.leafletJs = 'true'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Leaflet failed to load'))
          document.body.appendChild(script)
        })
      }
      if (cancelled || !mapContainerRef.current || !window.L) return

      const L = window.L
      const coordinates = orderedDestinations.map((destination) => [destination.latitude, destination.longitude] as [number, number])
      if (!coordinates.length) return
      const map = L.map(mapContainerRef.current).setView(coordinates[0], 7)
      mapInstanceRef.current = map
      window.setTimeout(() => map.invalidateSize(), 150)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      orderedDestinations.forEach((destination, index) => {
        const weatherInfo = weather[destination.id]
        const dining = diningName(destination)
        const hotel = hotelStays[destination.id]
        const details = [
          `<strong>${index + 1}. ${destination.city}</strong>`,
          weatherInfo ? `${weatherInfo.condition}, ${Math.round(weatherInfo.temperatureCelsius)}°C` : 'Weather unavailable',
          dining ? `Dining: ${dining}` : '',
          hotel?.enabled ? `Hotel: ${hotel.preference || hotel.customNote || 'Overnight stay'}` : '',
        ].filter(Boolean).join('<br />')
        const icon = L.divIcon({
          className: 'custom-map-pin',
          iconSize: [0, 0],
          iconAnchor: [16, 16],
          html: `<div style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transform:translate(-16px,-16px);pointer-events:auto;">
  <span style="width:32px;height:32px;min-width:32px;min-height:32px;border-radius:50%;background:#0284c7;color:#ffffff;font-family:'Manrope',sans-serif;font-weight:800;font-size:13px;line-height:1;display:inline-flex;align-items:center;justify-content:center;text-align:center;border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.38);padding:0;margin:0;">
    ${index + 1}
  </span>
  <span style="background:rgba(255,255,255,0.96);color:#0f172a;font-family:'Manrope',sans-serif;font-size:12.5px;font-weight:700;line-height:1.2;padding:5px 11px;border-radius:999px;box-shadow:0 4px 12px rgba(15,23,42,0.22);border:1.5px solid #0284c7;">
    ${destination.city}
  </span>
</div>`,
        })
        L.marker([destination.latitude, destination.longitude], { icon }).addTo(map).bindPopup(details)

        const selectedDiningItem = nearbyDining[destination.id]?.find((item) => item.id === selectedDining[destination.id])
        if (selectedDiningItem) {
          const diningCoordinates = getDiningCoordinates(selectedDiningItem, destination)
          const diningIcon = L.divIcon({
            className: 'custom-map-pin',
            iconSize: [0, 0],
            iconAnchor: [16, 16],
            html: `<div style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transform:translate(-16px,-16px);pointer-events:auto;">
  <span style="width:32px;height:32px;min-width:32px;min-height:32px;border-radius:50%;background:#f97316;color:#ffffff;font-family:'Manrope',sans-serif;font-weight:800;font-size:13px;line-height:1;display:inline-flex;align-items:center;justify-content:center;text-align:center;border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.38);padding:0;margin:0;">
    🍴
  </span>
  <span style="background:rgba(255,255,255,0.96);color:#0f172a;font-family:'Manrope',sans-serif;font-size:12.5px;font-weight:700;line-height:1.2;padding:5px 11px;border-radius:999px;box-shadow:0 4px 12px rgba(15,23,42,0.22);border:1.5px solid #f97316;">
    ${selectedDiningItem.restaurantName}
  </span>
</div>`,
          })
          const diningPopup = [
            `<strong>${selectedDiningItem.restaurantName} · ${selectedDiningItem.priceRange}</strong>`,
            `Near Stop ${index + 1}: ${destination.city}`,
            `<strong>Recommended Dishes</strong>: ${selectedDiningItem.recommendedDishes}`,
          ].join('<br />')
          L.marker(diningCoordinates, { icon: diningIcon }).addTo(map).bindPopup(diningPopup)
        }
      })

      let routeCoordinates = coordinates
      if (routeResult.overviewPolyline) {
        const decoded = decodePolyline(routeResult.overviewPolyline)
        if (decoded.length > 0) {
          routeCoordinates = decoded
        }
      } else {
        try {
          const points = orderedDestinations.map((destination) => `${destination.longitude},${destination.latitude}`).join(';')
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${points}?overview=full&geometries=geojson`)
          if (!response.ok) throw new Error('Route geometry unavailable')
          const data = await response.json() as { routes?: { geometry?: { coordinates?: [number, number][] } }[] }
          const geometry = data.routes?.[0]?.geometry?.coordinates
          if (geometry?.length) routeCoordinates = geometry.map(([longitude, latitude]) => [latitude, longitude])
        } catch {
          // Keep the direct stop-to-stop line when the routing service is unavailable.
        }
      }
      L.polyline(routeCoordinates, { color: '#0284c7', weight: 5, opacity: 0.9 }).addTo(map)
      map.fitBounds(L.latLngBounds(coordinates), { padding: [32, 32] })
      window.setTimeout(() => map.invalidateSize(), 150)

      return () => map.remove()
    }

    let cleanup: (() => void) | undefined
    loadLeaflet().then((removeMap) => { cleanup = removeMap }).catch(() => undefined)
    return () => {
      cancelled = true
      mapInstanceRef.current = null
      cleanup?.()
    }
  }, [routeResult, orderedDestinations, weather, diningName, hotelStays, nearbyDining, selectedDining, isMapFullscreen, getDiningCoordinates])

  useEffect(() => {
    if (!isMapFullscreen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMapFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMapFullscreen])

  useEffect(() => {
    if (!mapInstanceRef.current) return
    const resizeTimer = window.setTimeout(() => mapInstanceRef.current?.invalidateSize(), 150)
    return () => window.clearTimeout(resizeTimer)
  }, [isMapFullscreen])

  return (
      <div className="content itinerary-content">
        <div className="itinerary-head">
          <div>
            <button className="back-link" onClick={onBack}>← Back to Explore</button>
            <p className="eyebrow">SMART ITINERARY</p>
            <h1>Your planned route</h1>
            {routeResult ? (
                <p>Planned visit date: {formatSelectedDate(selectedDate)} · {orderedDestinations.length} destinations</p>
            ) : (
                <p>Plan your next journey, one destination at a time.</p>
            )}
          </div>
          {routeResult && (
              <div className="route-score">
                <span>Total travel time</span>
                <strong>{formatTravelTime(routeResult.finalOptimizedTimeSeconds)}</strong>
                <small>{(routeResult.totalDistanceMeters / 1000).toFixed(1)} km total</small>
              </div>
          )}
        </div>
        {!routeResult ? (
            <div className="empty-state">No active itinerary. Please select destinations and click &apos;Plan a trip&apos;.</div>
        ) : (
            <>
              {!isMapFullscreen && (
                  <div className="route-map-card">
                    <div ref={mapContainerRef} className="route-map" aria-label="Interactive route map" />
                  </div>
              )}
              {!isMapFullscreen && (
                  <div className="map-section-header">
                    <div>
                      <h2>Interactive Route Map</h2>
                      <p>Visual overview of your optimized stops and driving path</p>
                    </div>
                    <div className="map-header-actions">
                      <span className="map-legend"><span>🔵 Destination Stop</span><span>🟠 Selected Dining</span></span>
                      <button className="expand-map-button" type="button" onClick={() => setIsMapFullscreen(true)}>⛶ Expand Fullscreen</button>
                    </div>
                  </div>
              )}
              {isMapFullscreen && (
                  <div className="map-fullscreen-backdrop" role="dialog" aria-modal="true" aria-label="Fullscreen interactive route map">
                    <button
                        className="close-fullscreen-x"
                        type="button"
                        onClick={() => setIsMapFullscreen(false)}
                        aria-label="Close Fullscreen Map"
                        title="Close Fullscreen (Esc)"
                    >
                      ✕
                    </button>
                    <div ref={mapContainerRef} className="route-map fullscreen-route-map" />
                  </div>
              )}
              <section className="route-card">
                <div className="route-card-head"><div><h2>Step-by-step route</h2><p>Stops are ordered for the smoothest journey.</p></div><span>Auto-optimized</span></div>
                <div className="route-stops">
                  {orderedDestinations.map((destination, index) => {
                    const dining = diningName(destination)
                    const hotel = hotelStays[destination.id]
                    const segment = routeResult.segmentDetails[index]
                    const next = orderedDestinations[index + 1]
                    return (
                        <div key={destination.id}>
                          <div className="route-stop">
                            <div className="stop-number">{index + 1}</div>
                            <div>
                              <small>Stop {index + 1}</small>
                              <h3>{destination.city}</h3>
                              <p style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {destination.country} · {weather[destination.id] ? (
                                  <><WeatherIcon condition={weather[destination.id].condition} size={24} /> {weather[destination.id].condition}, {Math.round(weather[destination.id].temperatureCelsius)}°C</>
                              ) : 'Weather unavailable'} · {bufferMinutes[destination.id] ?? 15} mins exploring
                              </p>
                              {dining && <span className="travel-time">Dining: {dining}</span>}
                              {hotel?.enabled && <span className="travel-time">Overnight: {hotel.preference === 'Custom preference' ? hotel.customNote || hotel.preference : hotel.preference || 'Preferred hotel stay'}</span>}
                            </div>
                          </div>
                          {segment && next && (
                              <div className="segment-card">
                                <strong>Leg {index + 1}</strong>
                                <span>{destination.city} → {next.city}</span>
                                <span>{(segment.distance / 1000).toFixed(1)} km · {Math.floor(segment.duration / 60)} mins</span>
                                <small>{segment.instruction}</small>
                              </div>
                          )}
                        </div>
                    )
                  })}
                </div>
              </section>
              <div className="trip-summary">
                <div><span>Total travel time</span><strong>{formatTravelTime(routeResult.finalOptimizedTimeSeconds)}</strong></div>
                <div><span>Total distance</span><strong>{(routeResult.totalDistanceMeters / 1000).toFixed(1)} km</strong></div>
                <p>Route calculated from your selected destinations</p>
              </div>
            </>
        )}
      </div>
  )
}