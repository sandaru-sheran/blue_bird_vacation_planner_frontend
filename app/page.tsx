'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/src/services/auth.service'
import { DestinationService } from '@/src/services/destination.service'
import { DiningService } from '@/src/services/dining.service'
import { RouteService } from '@/src/services/route.service'
import { WeatherService, type WeatherResponse } from '@/src/services/weather.service'
import type { DayPlanRouteResponse, Destination as ApiDestination, DiningInsight } from '@/types/backend-api'

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

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap
  fitBounds: (bounds: unknown, options?: { padding: [number, number] }) => void
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

function weatherIcon(condition: string): string {
  const normalized = condition.toLowerCase()
  if (normalized.includes('rain') || normalized.includes('storm')) return '☂'
  if (normalized.includes('cloud') || normalized.includes('overcast')) return '☁'
  if (normalized.includes('snow')) return '❄'
  return '☀'
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

function BirdLogo() {
  return (
    <div className="brand-mark" aria-label="Bluebird logo">
      <svg viewBox="0 0 44 44" role="img">
        <path d="M8 26c7-.4 8.6-4.7 10-9.8 3 3.5 6.5 5.3 10.8 4.8 3.2-.3 5.4-2 7.7-4.8-.2 7-3.2 12.6-9.2 16.2-5.6 3.4-12 3.5-18.8 1.4 3.3-1 5.5-2.4 7.2-4.4-3.1.2-5.6-1-7.7-3.4Z" fill="currentColor"/>
        <path d="M29 20c.5-4 2.3-6.7 5.5-8.2-.6 2.2-.5 4 .6 5.5" fill="currentColor"/>
      </svg>
    </div>
  )
}

export default function App() {
  const router = useRouter()
  const [destinations, setDestinations] = useState<Destination[]>(dummyDestinations)
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedDate, setSelectedDate] = useState('')
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
  const [bufferMinutes, setBufferMinutes] = useState<Record<number, number>>({})
  const [nearbyDining, setNearbyDining] = useState<Record<number, DiningInsight[]>>({})
  const [selectedDining, setSelectedDining] = useState<Record<number, number>>({})
  const [hotelStays, setHotelStays] = useState<Record<number, HotelStay>>({})

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

  const selectedDestinations = selectedDestinationIds
    .map((id) => destinations.find((destination) => destination.id === id))
    .filter((destination): destination is Destination => destination !== undefined)

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

  const handleOpenDining = async (destinationId: number, cityName: string) => {
    setIsDiningModalOpen(true)
    setActiveDiningDestination(cityName)
    setIsDiningLoading(true)
    setDiningError(null)
    setDiningInsights([])

    try {
      const insights = await DiningService.getNearby(destinationId)
      setDiningInsights(insights.length > 0 ? insights : fallbackDiningByDestination[destinationId] ?? [])
    } catch (error) {
      setDiningError(error instanceof Error ? error.message : 'Unable to load nearby dining. Please try again.')
    } finally {
      setIsDiningLoading(false)
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
      router.push('/admin')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to log in. Please try again.')
    } finally {
      setIsLoginLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><BirdLogo /><span>bluebird</span></div>
        <nav>
          <p className="nav-label">Workspace</p>
          <button className={`nav-item ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}><Icon name="pin" />1. Select Places</button>
          <button className={`nav-item ${step === 2 ? 'active' : ''}`} disabled={selectedDestinationIds.length < 2} onClick={() => setStep(2)}><Icon name="grid" />2. Stays &amp; Dining</button>
          <button className={`nav-item ${step === 3 ? 'active' : ''}`} disabled={!routeResult} onClick={() => setStep(3)}><Icon name="calendar" />3. Route &amp; Itinerary</button>
        </nav>
        <div className="sidebar-bottom">
          <button className="admin-access-link" onClick={() => { setIsLoginModalOpen(true); setLoginError(null) }}>
            Admin Access
          </button>
        </div>
      </aside>

      <main>
        <header>
          <button className="mobile-brand" aria-label="Open menu"><BirdLogo /></button>
          <div className="header-actions">
            <button className="icon-button" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>
              <span className="notification-dot" />
            </button>
            <div>
              <button
                className="primary-button"
                onClick={() => setStep(2)}
                disabled={selectedDestinationIds.length < 2}
                title={selectedDestinationIds.length < 2 ? 'Select at least 2 places to plan' : undefined}
              >
                Next: Stays &amp; Dining →
              </button>
              {selectedDestinationIds.length < 2 && <small className="action-message">Select at least 2 places to continue</small>}
              {routeError && <small className="action-message" role="alert">{routeError}</small>}
            </div>
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
              return (
                <article
                  key={destination.id}
                  className={`destination-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggle(destination.id)}
                >
                  <img src={destination.image} alt={`${destination.city}, ${destination.country}`} />
                  <div className="card-copy">
                    <div className="card-topline"><span className="tag">{destination.tag}</span><span className="duration">{destination.duration}</span></div>
                    <h3>{destination.city}</h3>
                    <p className="country"><Icon name="pin" size={15} />{destination.country}</p>
                    <p className="description">{destination.description}</p>
                    <div className="location-actions">
                      <button onClick={(event) => { event.stopPropagation(); handleOpenDining(destination.id, destination.city) }}>
                        <span>⌁</span> Nearby dining
                      </button>
                    </div>
                    <div className="card-footer"><span>From <strong>{destination.price}</strong></span><span className="details">View trip <Icon name="chevron" size={16} /></span></div>
                  </div>
                  <div className="hover-details">
                    <div className="extra-copy">
                      <span><b>Best time</b>{destination.bestTime}</span>
                      <span><b>Don&apos;t miss</b>{destination.highlights}</span>
                    </div>
                    <div className="mini-gallery">
                      {destination.gallery.map((image, index) => (
                        <img key={image} src={image} alt={`${destination.city} travel view ${index + 1}`} />
                      ))}
                    </div>
                  </div>
                  <button className="selection-rail" onClick={(event) => { event.stopPropagation(); toggle(destination.id) }} aria-label={`${isSelected ? 'Remove' : 'Add'} ${destination.city}`} aria-pressed={isSelected}>
                    <span className="check-circle"><Icon name="check" size={16} /></span>
                    <span>{isSelected ? 'Added' : 'Add'}</span>
                  </button>
                  <div className="card-weather" aria-label={`Weather: ${weather[destination.id]?.condition ?? 'Loading'}`}>
                    <span>{weatherIcon(weather[destination.id]?.condition ?? 'Clear')}</span>
                    <strong>{weather[destination.id] ? `${Math.round(weather[destination.id].temperatureCelsius)}°` : '—'}</strong>
                    <small>{weather[destination.id]?.condition ?? 'Loading'}</small>
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
            setNearbyDining={setNearbyDining}
            selectedDining={selectedDining}
            setSelectedDining={setSelectedDining}
            hotelStays={hotelStays}
            setHotelStays={setHotelStays}
            onBack={() => setStep(1)}
            onCalculate={handlePlanTrip}
            isLoading={isLoadingRoute}
            routeError={routeError}
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
  setNearbyDining,
  selectedDining,
  setSelectedDining,
  hotelStays,
  setHotelStays,
  onBack,
  onCalculate,
  isLoading,
  routeError,
}: {
  selectedDestinations: Destination[]
  bufferMinutes: Record<number, number>
  setBufferMinutes: React.Dispatch<React.SetStateAction<Record<number, number>>>
  nearbyDining: Record<number, DiningInsight[]>
  setNearbyDining: React.Dispatch<React.SetStateAction<Record<number, DiningInsight[]>>>
  selectedDining: Record<number, number>
  setSelectedDining: React.Dispatch<React.SetStateAction<Record<number, number>>>
  hotelStays: Record<number, HotelStay>
  setHotelStays: React.Dispatch<React.SetStateAction<Record<number, HotelStay>>>
  onBack: () => void
  onCalculate: () => void
  isLoading: boolean
  routeError: string | null
}) {
  useEffect(() => {
    let cancelled = false
    Promise.all(selectedDestinations.map(async (destination) => {
      try {
        const results = await DiningService.getNearby(destination.id)
        return [destination.id, results.length > 0 ? results : fallbackDiningByDestination[destination.id] ?? []] as const
      } catch {
        return [destination.id, fallbackDiningByDestination[destination.id] ?? []] as const
      }
    })).then((results) => {
      if (!cancelled) {
        setNearbyDining((current) => ({ ...current, ...Object.fromEntries(results) }))
      }
    })
    return () => { cancelled = true }
  }, [selectedDestinations, setNearbyDining])

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
                <span><strong>Nearby Dining Selection <small>(Optional)</small></strong><small>Choose a restaurant to visit here</small></span>
                {!dining ? <div className="dining-loading">Finding nearby dining...</div> : (
                  <div className="dining-options">
                    {dining.map((item) => {
                      const isSelected = selectedDining[destination.id] === item.id
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`restaurant-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedDining((current) => ({ ...current, [destination.id]: current[destination.id] === item.id ? 0 : item.id }))}
                        >
                          <img src={item.imageUrls?.[0] || diningFallbackImage} alt="" />
                          <span className="restaurant-card-body">
                            <strong>{item.restaurantName}</strong>
                            <span className="restaurant-meta"><b>{item.priceRange}</b>{isSelected && <em>Selected ✓</em>}</span>
                            <small>{item.recommendedDishes}</small>
                          </span>
                        </button>
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
      {routeError && <p className="action-message" role="alert">{routeError}</p>}
      <div className="step-actions">
        <button className="back-link" onClick={onBack}>← Back to Places</button>
        <button className="primary-button" onClick={onCalculate} disabled={isLoading}>{isLoading ? 'Calculating route...' : 'Calculate Shortest Route →'}</button>
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
  const orderedDestinations = routeResult?.optimizedWaypointOrder.length
    ? routeResult.optimizedWaypointOrder
      .map((index) => selectedDestinations[index])
      .filter((destination): destination is Destination => destination !== undefined)
    : selectedDestinations

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
        const icon = L.divIcon({ className: 'route-marker', html: String(index + 1), iconSize: 34, iconAnchor: [17, 17] })
        L.marker([destination.latitude, destination.longitude], { icon }).addTo(map).bindPopup(details)
      })

      let routeCoordinates = coordinates
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
      L.polyline(routeCoordinates, { color: '#0284c7', weight: 5, opacity: 0.9 }).addTo(map)
      map.fitBounds(L.latLngBounds(coordinates), { padding: [32, 32] })

      return () => map.remove()
    }

    let cleanup: (() => void) | undefined
    loadLeaflet().then((removeMap) => { cleanup = removeMap }).catch(() => undefined)
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [routeResult, orderedDestinations, weather, diningName, hotelStays])

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
          <div className="trip-tabs"><button className="active">Route overview</button><button>Day by day</button><button>Bookings</button></div>
          <div className="route-map-card">
            <div ref={mapContainerRef} className="route-map" aria-label="Interactive route map" />
          </div>
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
                        <p>{destination.country} · {weather[destination.id] ? `${weatherIcon(weather[destination.id].condition)} ${weather[destination.id].condition}, ${Math.round(weather[destination.id].temperatureCelsius)}°C` : 'Weather unavailable'} · {bufferMinutes[destination.id] ?? 15} mins exploring</p>
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
