'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthService } from '@/src/services/auth.service'
import { DestinationService } from '@/src/services/destination.service'
import { DiningService } from '@/src/services/dining.service'
import { uploadToPostimages } from '@/src/services/postimages.service'
import type { Destination, DestinationRequest, DiningInsight } from '@/types/backend-api'

type DestinationForm = DestinationRequest
type DiningForm = Omit<DiningInsight, 'id'>
type AdminTab = 'destinations' | 'dining' | 'settings'

const emptyDestination: DestinationForm = { name: '', category: '', latitude: 0, longitude: 0, openingHour: '', closingHour: '', imageUrls: [] }
const emptyDining: DiningForm = { restaurantName: '', priceRange: '', recommendedDishes: '', destinationId: 0, imageUrls: [] }
const fallbackImage = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'

function toImages(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function Icon({ name }: { name: 'pin' | 'grid' | 'calendar' | 'logout' | 'plus' | 'check' | 'sun' | 'upload' | 'trash' | 'image' }) {
  const paths = {
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  } as const
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function BirdLogo() {
  return <span className="admin-drawer-bird" aria-hidden="true"><svg viewBox="0 0 44 44"><path d="M8 26c7-.4 8.6-4.7 10-9.8 3 3.5 6.5 5.3 10.8 4.8 3.2-.3 5.4-2 7.7-4.8-.2 7-3.2 12.6-9.2 16.2-5.6 3.4-12 3.5-18.8 1.4 3.3-1 5.5-2.4 7.2-4.4-3.1.2-5.6-1-7.7-3.4Z" fill="currentColor" /></svg></span>
}

type GalleryDrag = {
  gallery: HTMLDivElement | null
  startX: number
  startScrollLeft: number
  dragged: boolean
}

function DestinationPreview({
  destination,
  selected = false,
  onToggle,
  onGalleryPointerDown,
  onGalleryPointerMove,
  onGalleryPointerUp,
}: {
  destination: Destination
  selected?: boolean
  onToggle?: () => void
  onGalleryPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void
  onGalleryPointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void
  onGalleryPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  const images = destination.imageUrls?.length ? destination.imageUrls : [fallbackImage]
  const mainImage = images[0]
  return (
    <article className={`destination-card admin-preview-card ${selected ? 'selected' : ''}`} onClick={onToggle}>
      <img src={mainImage} alt={destination.name} />
      <div className="card-copy">
        <div className="card-topline">
          <span className="tag">{destination.category || 'DESTINATION'}</span>
          <span className="duration">Flexible stay</span>
        </div>
        <h3>{destination.name}</h3>
        <p className="country"><Icon name="pin" />{destination.category || 'Sri Lanka'}</p>
        <div className="extra-copy">
          <span><b>Best time</b>{destination.openingHour ? `${destination.openingHour} – ${destination.closingHour}` : '08:30:00 – 19:00:00'}</span>
          <span><b>Don&apos;t miss</b>{destination.diningInsights?.[0]?.recommendedDishes || 'Local sights and memorable experiences'}</span>
        </div>
      </div>
      <div className="card-weather" aria-label="Weather: Mainly clear">
        <Icon name="sun" />
        <div className="card-weather-text">
          <strong>19°</strong>
          <small>Mainly clear</small>
        </div>
      </div>
      <div className="card-add-strip" aria-hidden="true">
        <span className="card-add-circle">
          <Icon name="check" />
        </span>
        <span className="card-add-label">{selected ? 'ADDED' : 'ADD'}</span>
      </div>
      <div className="hover-details">
        <div
          className="mini-gallery"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={onGalleryPointerDown}
          onPointerMove={onGalleryPointerMove}
          onPointerUp={onGalleryPointerUp}
          onPointerCancel={onGalleryPointerUp}
        >
          {images.slice(0, 6).map((image, index) => (
            <img key={`${image}-${index}`} src={image} alt="" />
          ))}
        </div>
      </div>
    </article>
  )
}

function DiningPreview({
  item,
  selected,
  onSelect,
  onOpenGallery,
}: {
  item: DiningInsight
  selected: boolean
  onSelect: () => void
  onOpenGallery: () => void
}) {
  const image = item.imageUrls?.[0] || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80'

  return (
    <article className={`dining-horizontal-card admin-dining-preview-card ${selected ? 'selected' : ''}`}>
      <button type="button" className="dining-slide-image" onClick={(event) => { event.stopPropagation(); onOpenGallery() }} aria-label={`View ${item.restaurantName} images`}>
        <img src={image} alt="" draggable={false} />
      </button>
      <button type="button" className="dining-slide-info admin-dining-preview-copy" onClick={onSelect}>
        <div className="dining-card-topline">
          <span className="tag">{item.priceRange || 'DINING'}</span>
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
}

export default function AdminDrawer({ onCollapse, onLogout }: { onCollapse: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>('destinations')
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [diningByDestination, setDiningByDestination] = useState<Record<number, DiningInsight[]>>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [destinationForm, setDestinationForm] = useState<DestinationForm>(emptyDestination)
  const [diningForm, setDiningForm] = useState<DiningForm>(emptyDining)
  const [editingDestinationId, setEditingDestinationId] = useState<number | null>(null)
  const [editingDiningId, setEditingDiningId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [draggingImages, setDraggingImages] = useState(false)
  const [previewSelected, setPreviewSelected] = useState(false)
  const [previewDiningId, setPreviewDiningId] = useState<number | null>(null)
  const [diningGallery, setDiningGallery] = useState<{ restaurantName: string; images: string[]; index: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const diningFileInputRef = useRef<HTMLInputElement>(null)
  const galleryDragRef = useRef<GalleryDrag>({ gallery: null, startX: 0, startScrollLeft: 0, dragged: false })
  const diningPreviewSliderRef = useRef<HTMLDivElement | null>(null)
  const diningPreviewDragRef = useRef({ startX: 0, startScrollLeft: 0, dragged: false })

  const handleGalleryPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const gallery = event.currentTarget
    galleryDragRef.current = { gallery, startX: event.clientX, startScrollLeft: gallery.scrollLeft, dragged: false }
    gallery.setPointerCapture(event.pointerId)
  }
  const handleGalleryPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = galleryDragRef.current
    if (drag.gallery !== event.currentTarget) return
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

  const handleDiningSliderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const slider = event.currentTarget
    diningPreviewSliderRef.current = slider
    diningPreviewDragRef.current = {
      startX: event.clientX,
      startScrollLeft: slider.scrollLeft,
      dragged: false,
    }
  }

  const handleDiningSliderMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const slider = event.currentTarget
    if (diningPreviewSliderRef.current !== slider || event.buttons !== 1) return
    const distance = event.clientX - diningPreviewDragRef.current.startX
    if (Math.abs(distance) > 4) {
      diningPreviewDragRef.current.dragged = true
    }
    if (diningPreviewDragRef.current.dragged) {
      slider.scrollLeft = diningPreviewDragRef.current.startScrollLeft - distance
    }
  }

  const handleDiningSliderMouseUp = () => {
    diningPreviewSliderRef.current = null
    window.setTimeout(() => {
      diningPreviewDragRef.current.dragged = false
    }, 0)
  }

  const uploadImages = async (files: File[], target: 'destination' | 'dining') => {
    if (files.length === 0) return

    setUploading(true)
    setUploadError(null)

    try {
      const urls = await uploadToPostimages(files)
      if (target === 'destination') {
        setDestinationForm((current) => ({ ...current, imageUrls: [...(current.imageUrls ?? []), ...urls] }))
      } else {
        setDiningForm((current) => ({ ...current, imageUrls: [...(current.imageUrls ?? []), ...urls] }))
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Image upload to Postimages failed.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await uploadImages(event.target.files ? Array.from(event.target.files) : [], 'destination')
  }

  const handleImageDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDraggingImages(false)
    await uploadImages(Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/')), 'destination')
  }

  const handleDiningImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await uploadImages(event.target.files ? Array.from(event.target.files) : [], 'dining')
  }

  const handleDiningImageDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDraggingImages(false)
    await uploadImages(Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/')), 'dining')
  }

  const removeDestinationImage = (indexToRemove: number) => {
    setDestinationForm((current) => ({
      ...current,
      imageUrls: (current.imageUrls ?? []).filter((_, idx) => idx !== indexToRemove),
    }))
  }

  const removeDiningImage = (indexToRemove: number) => {
    setDiningForm((current) => ({
      ...current,
      imageUrls: (current.imageUrls ?? []).filter((_, idx) => idx !== indexToRemove),
    }))
  }

  const load = async () => {
    try {
      const data = await DestinationService.getAll()
      setDestinations(data)
      setSelectedId((current) => current ?? data[0]?.id ?? null)
      const entries = await Promise.all(data.map(async (destination) => [destination.id, await DiningService.getNearby(destination.id)] as const))
      setDiningByDestination(Object.fromEntries(entries))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const selected = useMemo(() => destinations.find((destination) => destination.id === selectedId) ?? destinations[0], [destinations, selectedId])

  const previewDestination = useMemo(() => {
    if (editingDestinationId !== null) {
      const active = destinations.find((d) => d.id === editingDestinationId) ?? selected
      return {
        id: editingDestinationId,
        name: destinationForm.name || active?.name || 'Destination Preview',
        category: destinationForm.category || active?.category || '',
        latitude: destinationForm.latitude || active?.latitude || 0,
        longitude: destinationForm.longitude || active?.longitude || 0,
        openingHour: destinationForm.openingHour || active?.openingHour || '',
        closingHour: destinationForm.closingHour || active?.closingHour || '',
        imageUrls: destinationForm.imageUrls && destinationForm.imageUrls.length > 0 ? destinationForm.imageUrls : (active?.imageUrls ?? []),
        diningInsights: active?.id ? (diningByDestination[active.id] ?? active.diningInsights ?? []) : [],
      }
    }
    if (destinationForm.name || destinationForm.category || (destinationForm.imageUrls && destinationForm.imageUrls.length > 0)) {
      return {
        id: 0,
        name: destinationForm.name || 'New Destination',
        category: destinationForm.category || 'Category',
        latitude: destinationForm.latitude || 0,
        longitude: destinationForm.longitude || 0,
        openingHour: destinationForm.openingHour || '08:30:00',
        closingHour: destinationForm.closingHour || '19:00:00',
        imageUrls: destinationForm.imageUrls ?? [],
        diningInsights: [],
      }
    }
    return selected ? { ...selected, diningInsights: diningByDestination[selected.id] ?? selected.diningInsights ?? [] } : null
  }, [editingDestinationId, destinationForm, selected, destinations, diningByDestination])

  const saveDestination = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      const saved = editingDestinationId === null ? await DestinationService.create(destinationForm) : await DestinationService.update(editingDestinationId, destinationForm)
      setDestinations((current) => editingDestinationId === null ? [...current, saved] : current.map((item) => item.id === saved.id ? saved : item))
      setSelectedId(saved.id); setDestinationForm(emptyDestination); setEditingDestinationId(null)
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save destination.') } finally { setSaving(false) }
  }

  const removeDestination = async (id: number) => {
    if (!window.confirm('Delete this destination and its associated recommendations?')) return
    try { await DestinationService.delete(id); setDestinations((current) => current.filter((item) => item.id !== id)); setSelectedId(null) }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete destination.') }
  }

  const removeDining = async (item: DiningInsight) => {
    if (!window.confirm(`Delete ${item.restaurantName}?`)) return
    setError(null)
    try {
      await DiningService.delete(item.id)
      setDiningByDestination((current) => ({
        ...current,
        [item.destinationId]: (current[item.destinationId] ?? []).filter((entry) => entry.id !== item.id),
      }))
      if (editingDiningId === item.id) {
        setEditingDiningId(null)
        setDiningForm({ ...emptyDining, destinationId: item.destinationId })
      }
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete dining insight.') }
  }

  const saveDining = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      const saved = editingDiningId === null ? await DiningService.create(diningForm) : await DiningService.update(editingDiningId, diningForm)
      setDiningByDestination((current) => ({ ...current, [saved.destinationId]: editingDiningId === null ? [...(current[saved.destinationId] ?? []), saved] : (current[saved.destinationId] ?? []).map((item) => item.id === saved.id ? saved : item) }))
      setDiningForm({ ...emptyDining, destinationId: saved.destinationId }); setEditingDiningId(null)
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save dining insight.') } finally { setSaving(false) }
  }

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPasswordMessage(null)
    if (newPassword !== confirmPassword) { setPasswordMessage('New password and confirmation do not match.'); return }
    try { const response = await AuthService.updatePassword({ newPassword }); setNewPassword(''); setConfirmPassword(''); setPasswordMessage(response.message ?? 'Admin password updated successfully.') }
    catch (passwordError) { setPasswordMessage(passwordError instanceof Error ? passwordError.message : 'Unable to update admin password.') }
  }

  return (
    <div className="admin-drawer-layer">
      <div className="admin-drawer-backdrop" onClick={onCollapse} aria-hidden="true" />
      <button className="admin-collapse-handle" onClick={onCollapse} aria-label="Collapse Admin Sidebar">
        Collapse Sidebar ⌃
      </button>
      <aside className="admin-drawer" aria-label="Admin dashboard">
        <div className="admin-drawer-watermark" aria-hidden="true" />
        <header className="admin-drawer-header">
          <h1>Admin</h1>
          <nav className="admin-drawer-tabs">
            <button type="button" className={tab === 'destinations' ? 'active' : ''} onClick={() => setTab('destinations')}>
              <Icon name="pin" />Manage Destinations
            </button>
            <button type="button" className={tab === 'dining' ? 'active' : ''} onClick={() => setTab('dining')}>
              <Icon name="grid" />Manage Dining Insights
            </button>
            <button type="button" className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
              <Icon name="calendar" />Account Settings
            </button>
          </nav>
          <div className="admin-drawer-actions">
            <button type="button" className="admin-drawer-logout" onClick={onLogout}>
              <Icon name="logout" />Log Out
            </button>
            <div className="admin-drawer-brand">
              <BirdLogo />
              <strong>bluebird</strong>
            </div>
          </div>
        </header>

        {error && <div className="admin-drawer-error" role="alert">{error}</div>}

        {tab === 'settings' && (
          <form className="admin-settings-panel" onSubmit={updatePassword}>
            <h2>Update Admin Password</h2>
            <p>Choose a new password for the admin account.</p>
            <label>
              New password
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </label>
            <label>
              Confirm new password
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </label>
            <button type="submit" className="admin-drawer-primary">Update password</button>
            {passwordMessage && <small>{passwordMessage}</small>}
          </form>
        )}

        {tab === 'destinations' && (
          <div className="admin-destinations-layout">
            <section className="admin-drawer-card admin-drawer-preview-top">
              <h2>Card Preview ({previewDestination?.name || 'Selected Destination'})</h2>
              {previewDestination ? (
                <DestinationPreview
                  destination={previewDestination}
                  selected={previewSelected}
                  onToggle={() => setPreviewSelected((current) => !current)}
                  onGalleryPointerDown={handleGalleryPointerDown}
                  onGalleryPointerMove={handleGalleryPointerMove}
                  onGalleryPointerUp={handleGalleryPointerUp}
                />
              ) : (
                <p>Select a destination to preview it.</p>
              )}
            </section>

            <div className="admin-drawer-grid">
              <section className="admin-drawer-card admin-drawer-list">
                <div className="admin-drawer-card-head">
                  <div>
                    <h2>Manage Destinations</h2>
                    <p>Add, edit, and organize destinations shown to travelers.</p>
                  </div>
                  <button
                    type="button"
                    className="admin-drawer-primary"
                    onClick={() => {
                      setEditingDestinationId(null)
                      setDestinationForm(emptyDestination)
                    }}
                  >
                    <Icon name="plus" />New destination
                  </button>
                </div>

                <div className="admin-destination-scroll">
                  {loading ? (
                    <p>Loading destinations...</p>
                  ) : (
                    destinations.map((destination) => (
                      <button
                        type="button"
                        className={`admin-destination-row ${selected?.id === destination.id ? 'selected' : ''}`}
                        key={destination.id}
                        onClick={() => setSelectedId(destination.id)}
                      >
                        <img src={destination.imageUrls?.[0] || fallbackImage} alt="" />
                        <span>
                          <strong>{destination.name}</strong>
                          <small>{destination.category} · {destination.latitude.toFixed(0)}, {destination.longitude.toFixed(0)} · {destination.openingHour}–{destination.closingHour}</small>
                        </span>
                        <em onClick={(event) => {
                          event.stopPropagation()
                          setEditingDestinationId(destination.id)
                          setSelectedId(destination.id)
                          setDestinationForm({
                            name: destination.name,
                            category: destination.category,
                            latitude: destination.latitude,
                            longitude: destination.longitude,
                            openingHour: destination.openingHour,
                            closingHour: destination.closingHour,
                            imageUrls: destination.imageUrls ?? [],
                          })
                        }}>Edit</em>
                        <em onClick={(event) => {
                          event.stopPropagation()
                          void removeDestination(destination.id)
                        }}>Delete</em>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="admin-drawer-card admin-drawer-form-card">
                <div className="admin-drawer-card-head">
                  <div>
                    <h2>{editingDestinationId ? 'Edit Destination' : 'Create New Destination'}</h2>
                    <p>{editingDestinationId ? 'Update destination details and save changes.' : 'Add a new destination to the planner.'}</p>
                  </div>
                </div>
                <form className="admin-drawer-form" onSubmit={saveDestination}>
                  <input value={destinationForm.name} onChange={(event) => setDestinationForm({ ...destinationForm, name: event.target.value })} placeholder="Destination name" required />
                  <input value={destinationForm.category} onChange={(event) => setDestinationForm({ ...destinationForm, category: event.target.value })} placeholder="Category (e.g. HERITAGE, NATURE)" required />
                  <div>
                    <input type="number" step="any" value={destinationForm.latitude || ''} onChange={(event) => setDestinationForm({ ...destinationForm, latitude: Number(event.target.value) })} placeholder="Latitude" required />
                    <input type="number" step="any" value={destinationForm.longitude || ''} onChange={(event) => setDestinationForm({ ...destinationForm, longitude: Number(event.target.value) })} placeholder="Longitude" required />
                  </div>
                  <div>
                    <input value={destinationForm.openingHour} onChange={(event) => setDestinationForm({ ...destinationForm, openingHour: event.target.value })} placeholder="Opening hour (08:30:00)" required />
                    <input value={destinationForm.closingHour} onChange={(event) => setDestinationForm({ ...destinationForm, closingHour: event.target.value })} placeholder="Closing hour (19:00:00)" required />
                  </div>

                  <div className="admin-drawer-image-section">
                    <div
                      className={`admin-drawer-upload-zone ${destinationForm.imageUrls && destinationForm.imageUrls.length > 0 ? 'has-previews' : ''} ${draggingImages ? 'dragging' : ''}`}
                      onDragEnter={(event) => {
                        event.preventDefault()
                        setDraggingImages(true)
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={(event) => {
                        if (event.currentTarget === event.target) setDraggingImages(false)
                      }}
                      onDrop={(event) => void handleImageDrop(event)}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="destination-image-file-input"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                        disabled={uploading}
                      />
                      {destinationForm.imageUrls && destinationForm.imageUrls.length > 0 && (
                        <div className="admin-drawer-preview-grid">
                          {destinationForm.imageUrls.map((url, idx) => (
                            <div key={`${url}-${idx}`} className="admin-drawer-preview-item">
                              <img src={url} alt={`Destination preview ${idx + 1}`} />
                              <button
                                type="button"
                                className="admin-drawer-preview-remove"
                                onClick={() => removeDestinationImage(idx)}
                                title="Remove image"
                                aria-label="Remove image"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {(!destinationForm.imageUrls || destinationForm.imageUrls.length === 0) && (
                        <button
                          type="button"
                          className="admin-drawer-add-image"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Icon name="plus" />
                          {uploading ? 'Uploading...' : 'Add images'}
                        </button>
                      )}
                    </div>

                    {uploadError && (
                      <div className="admin-drawer-field-error" role="alert">
                        {uploadError}
                      </div>
                    )}

                    <input
                      value={destinationForm.imageUrls?.join(', ') ?? ''}
                      onChange={(event) => setDestinationForm({ ...destinationForm, imageUrls: toImages(event.target.value) })}
                      placeholder="Or enter Image URLs, comma separated"
                    />
                  </div>

                  <button type="submit" className="admin-drawer-primary" disabled={saving || uploading}>
                    {saving ? 'Saving...' : 'Save destination'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}

        {tab === 'dining' && (
          <div className="admin-destinations-layout">
            <section className="admin-drawer-card admin-drawer-preview-top">
              <div className="admin-drawer-card-head">
                <div>
                  <h2>Card Preview ({selected?.name || 'Selected Destination'})</h2>
                  <p>Preview the same horizontally draggable dining cards used in Step 2.</p>
                </div>
                <select
                  className="admin-dining-destination-filter"
                  value={selected?.id ?? 0}
                  onChange={(event) => {
                    setSelectedId(Number(event.target.value))
                  }}
                  aria-label="Filter dining preview by destination"
                >
                  <option value={0} disabled>Select destination</option>
                  {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
                </select>
              </div>
              {selected && (diningByDestination[selected.id] ?? []).length > 0 ? (
                <div
                  className="admin-dining-preview-slider"
                  onMouseDown={handleDiningSliderMouseDown}
                  onMouseMove={handleDiningSliderMouseMove}
                  onMouseUp={handleDiningSliderMouseUp}
                  onMouseLeave={handleDiningSliderMouseUp}
                >
                  {(diningByDestination[selected.id] ?? []).map((item) => (
                    <DiningPreview
                      key={item.id}
                      item={item}
                      selected={previewDiningId === item.id}
                      onSelect={() => {
                        if (!diningPreviewDragRef.current.dragged) {
                          setPreviewDiningId((current) => current === item.id ? null : item.id)
                        }
                      }}
                      onOpenGallery={() => {
                        if (!diningPreviewDragRef.current.dragged) {
                          setDiningGallery({
                            restaurantName: item.restaurantName,
                            images: item.imageUrls?.length ? item.imageUrls : ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80'],
                            index: 0,
                          })
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p>Select a destination with dining recommendations to preview it.</p>
              )}
            </section>

            <div className="admin-drawer-grid">
              <section className="admin-drawer-card admin-drawer-list">
                <div className="admin-drawer-card-head">
                  <div>
                    <h2>Manage Dining Insights</h2>
                    <p>Curate nearby dining recommendations for each destination.</p>
                  </div>
                  <button
                    type="button"
                    className="admin-drawer-primary"
                    onClick={() => {
                      const destinationId = selected?.id ?? destinations[0]?.id ?? 0
                      setSelectedId(destinationId)
                      setDiningForm({ ...emptyDining, destinationId })
                      setEditingDiningId(null)
                    }}
                  >
                    <Icon name="plus" />New insight
                  </button>
                </div>

                <div className="admin-destination-scroll">
                  {destinations.map((destination) => (
                    <div className="admin-dining-group" key={destination.id}>
                      <h3>{destination.name}</h3>
                      {(diningByDestination[destination.id] ?? []).map((item) => (
                        <div className="admin-dining-row" key={item.id}>
                          <img src={item.imageUrls?.[0] || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=180&q=80'} alt="" />
                          <span>
                            <strong>{item.restaurantName}</strong>
                            <small>{item.priceRange} · {item.recommendedDishes}</small>
                          </span>
                          <em onClick={() => {
                            setSelectedId(destination.id)
                            setEditingDiningId(item.id)
                            setDiningForm({ ...item, imageUrls: item.imageUrls ?? [] })
                          }}>Edit</em>
                          <em onClick={() => void removeDining(item)}>Delete</em>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>

              <section className="admin-drawer-card admin-drawer-form-card">
                <div className="admin-drawer-card-head">
                  <div>
                    <h2>{editingDiningId ? 'Edit Dining Insight' : 'Create New Dining Insight'}</h2>
                    <p>{editingDiningId ? 'Update dining details and save changes.' : 'Add a nearby dining recommendation to the planner.'}</p>
                  </div>
                </div>
                <form className="admin-drawer-form" onSubmit={saveDining}>
                  <select value={diningForm.destinationId} onChange={(event) => {
                    const destinationId = Number(event.target.value)
                    setDiningForm({ ...diningForm, destinationId })
                    setSelectedId(destinationId)
                  }} required>
                    <option value={0} disabled>Select destination</option>
                    {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
                  </select>
                  <input value={diningForm.restaurantName} onChange={(event) => setDiningForm({ ...diningForm, restaurantName: event.target.value })} placeholder="Restaurant name" required />
                  <input value={diningForm.priceRange} onChange={(event) => setDiningForm({ ...diningForm, priceRange: event.target.value })} placeholder="Price range ($, $$, $$$)" required />
                  <textarea value={diningForm.recommendedDishes} onChange={(event) => setDiningForm({ ...diningForm, recommendedDishes: event.target.value })} placeholder="Recommended dishes" required />
                  <div className="admin-drawer-image-section">
                    <div
                      className={`admin-drawer-upload-zone ${diningForm.imageUrls && diningForm.imageUrls.length > 0 ? 'has-previews' : ''} ${draggingImages ? 'dragging' : ''}`}
                      onDragEnter={(event) => {
                        event.preventDefault()
                        setDraggingImages(true)
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={(event) => {
                        if (event.currentTarget === event.target) setDraggingImages(false)
                      }}
                      onDrop={(event) => void handleDiningImageDrop(event)}
                    >
                      <input
                        ref={diningFileInputRef}
                        type="file"
                        id="dining-image-file-input"
                        multiple
                        accept="image/*"
                        onChange={handleDiningImageUpload}
                        style={{ display: 'none' }}
                        disabled={uploading}
                      />
                      {diningForm.imageUrls && diningForm.imageUrls.length > 0 && (
                        <div className="admin-drawer-preview-grid">
                          {diningForm.imageUrls.map((url, idx) => (
                            <div key={`${url}-${idx}`} className="admin-drawer-preview-item">
                              <img src={url} alt={`Dining preview ${idx + 1}`} />
                              <button
                                type="button"
                                className="admin-drawer-preview-remove"
                                onClick={() => removeDiningImage(idx)}
                                title="Remove image"
                                aria-label="Remove image"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {(!diningForm.imageUrls || diningForm.imageUrls.length === 0) && (
                        <button
                          type="button"
                          className="admin-drawer-add-image"
                          onClick={() => diningFileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Icon name="plus" />
                          {uploading ? 'Uploading...' : 'Add images'}
                        </button>
                      )}
                    </div>
                    {uploadError && <div className="admin-drawer-field-error" role="alert">{uploadError}</div>}
                    <input
                      value={diningForm.imageUrls?.join(', ') ?? ''}
                      onChange={(event) => setDiningForm({ ...diningForm, imageUrls: toImages(event.target.value) })}
                      placeholder="Or enter Image URLs, comma separated"
                    />
                  </div>
                  <button type="submit" className="admin-drawer-primary" disabled={saving || destinations.length === 0}>
                    {saving ? 'Saving...' : editingDiningId ? 'Save changes' : 'Save insight'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
        {diningGallery && (
          <div className="gallery-backdrop" role="presentation" onClick={() => setDiningGallery(null)}>
            <div className="gallery-spread" role="dialog" aria-modal="true" aria-labelledby="admin-dining-gallery-title" onClick={(event) => event.stopPropagation()}>
              <h2 id="admin-dining-gallery-title">{diningGallery.restaurantName}</h2>
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
                  return (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      className={`gallery-spread-image ${position}`}
                      style={{ zIndex: isCenter ? 30 : 20 - absDiff }}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!isCenter) {
                          setDiningGallery((current) => current && ({ ...current, index }))
                        }
                      }}
                      aria-label={`View image ${index + 1}`}
                    >
                      <img src={image} alt={`${diningGallery.restaurantName} view ${index + 1}`} draggable={false} />
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
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
