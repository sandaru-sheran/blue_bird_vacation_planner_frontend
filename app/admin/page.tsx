'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthService } from '@/src/services/auth.service'
import { DestinationService } from '@/src/services/destination.service'
import { DiningService } from '@/src/services/dining.service'
import type { Destination, DestinationRequest, DiningInsight } from '@/types/backend-api'

type DestinationForm = DestinationRequest
type DiningForm = Omit<DiningInsight, 'id'>

const emptyDestination: DestinationForm = {
  name: '',
  category: '',
  latitude: 0,
  longitude: 0,
  openingHour: '',
  closingHour: '',
  imageUrls: [],
}

const emptyDining: DiningForm = {
  restaurantName: '',
  priceRange: '',
  recommendedDishes: '',
  destinationId: 0,
  imageUrls: [],
}

function toImages(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export default function AdminPage() {
  const router = useRouter()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [diningByDestination, setDiningByDestination] = useState<Record<number, DiningInsight[]>>({})
  const [destinationForm, setDestinationForm] = useState<DestinationForm>(emptyDestination)
  const [diningForm, setDiningForm] = useState<DiningForm>(emptyDining)
  const [editingDestinationId, setEditingDestinationId] = useState<number | null>(null)
  const [editingDiningId, setEditingDiningId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  const loadDestinations = async () => {
    setLoading(true)
    try {
      const data = await DestinationService.getAll()
      setDestinations(data)
      await Promise.all(data.map(async (destination) => {
        const insights = await DiningService.getNearby(destination.id)
        setDiningByDestination((current) => ({ ...current, [destination.id]: insights }))
      }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDestinations()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const handleLogout = async () => {
    setError(null)
    try {
      await AuthService.logout()
      router.push('/')
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to log out.')
    }
  }

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      const response = await AuthService.updatePassword({ newPassword })
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(response.message ?? 'Admin password updated successfully.')
    } catch (updateError) {
      setPasswordError(updateError instanceof Error ? updateError.message : 'Unable to update admin password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const saveDestination = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const saved = editingDestinationId === null
        ? await DestinationService.create(destinationForm)
        : await DestinationService.update(editingDestinationId, destinationForm)
      setDestinations((current) => editingDestinationId === null
        ? [...current, saved]
        : current.map((item) => item.id === saved.id ? saved : item))
      setDestinationForm(emptyDestination)
      setEditingDestinationId(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save destination.')
    } finally {
      setSaving(false)
    }
  }

  const removeDestination = async (id: number) => {
    if (!window.confirm('Delete this destination and its associated recommendations?')) return
    setError(null)
    try {
      await DestinationService.delete(id)
      setDestinations((current) => current.filter((item) => item.id !== id))
      setDiningByDestination((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete destination.')
    }
  }

  const saveDining = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const saved = editingDiningId === null
        ? await DiningService.create(diningForm)
        : await DiningService.update(editingDiningId, diningForm)
      setDiningByDestination((current) => ({
        ...current,
        [saved.destinationId]: editingDiningId === null
          ? [...(current[saved.destinationId] ?? []), saved]
          : (current[saved.destinationId] ?? []).map((item) => item.id === saved.id ? saved : item),
      }))
      setDiningForm({ ...emptyDining, destinationId: diningForm.destinationId })
      setEditingDiningId(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save dining insight.')
    } finally {
      setSaving(false)
    }
  }

  const removeDining = async (item: DiningInsight) => {
    setError(null)
    try {
      await DiningService.delete(item.id)
      setDiningByDestination((current) => ({
        ...current,
        [item.destinationId]: (current[item.destinationId] ?? []).filter((entry) => entry.id !== item.id),
      }))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete dining insight.')
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">BLUEBIRD ADMIN</p>
          <h1>Blue Bird Admin Dashboard</h1>
        </div>
        <button className="admin-logout" onClick={handleLogout}>Log Out</button>
      </header>
      {error && <div className="admin-error" role="alert">{error}</div>}
      <section className="admin-password-card">
        <div>
          <p className="eyebrow">ACCOUNT SETTINGS</p>
          <h2>Update Admin Password</h2>
          <p>Choose a new password for the admin account.</p>
        </div>
        <form className="admin-password-form" onSubmit={updatePassword}>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={passwordSaving}>
            {passwordSaving ? 'Updating...' : 'Update password'}
          </button>
        </form>
        {passwordError && <div className="admin-error admin-password-status" role="alert">{passwordError}</div>}
        {passwordSuccess && <div className="admin-success admin-password-status" role="status">{passwordSuccess}</div>}
      </section>
      <div className="admin-sections">
        <section className="admin-section">
          <div className="admin-section-heading">
            <div><h2>Manage Destinations</h2><p>Add, edit, and organize destinations shown to travelers.</p></div>
            <button className="primary-button" onClick={() => { setEditingDestinationId(null); setDestinationForm(emptyDestination) }}>New destination</button>
          </div>
          <form className="admin-form" onSubmit={saveDestination}>
            <input value={destinationForm.name} onChange={(event) => setDestinationForm({ ...destinationForm, name: event.target.value })} placeholder="Name (e.g. Paris, France)" required />
            <input value={destinationForm.category} onChange={(event) => setDestinationForm({ ...destinationForm, category: event.target.value })} placeholder="Category" required />
            <div className="admin-form-grid">
              <input type="number" step="any" value={destinationForm.latitude} onChange={(event) => setDestinationForm({ ...destinationForm, latitude: Number(event.target.value) })} placeholder="Latitude" required />
              <input type="number" step="any" value={destinationForm.longitude} onChange={(event) => setDestinationForm({ ...destinationForm, longitude: Number(event.target.value) })} placeholder="Longitude" required />
              <input value={destinationForm.openingHour} onChange={(event) => setDestinationForm({ ...destinationForm, openingHour: event.target.value })} placeholder="Opening hour" required />
              <input value={destinationForm.closingHour} onChange={(event) => setDestinationForm({ ...destinationForm, closingHour: event.target.value })} placeholder="Closing hour" required />
            </div>
            <input value={destinationForm.imageUrls?.join(', ') ?? ''} onChange={(event) => setDestinationForm({ ...destinationForm, imageUrls: toImages(event.target.value) })} placeholder="Image URLs, comma separated" />
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : editingDestinationId === null ? 'Create destination' : 'Save changes'}</button>
          </form>
          {loading ? <p className="admin-muted">Loading destinations...</p> : destinations.map((destination) => (
            <article className="admin-record" key={destination.id}>
              <div><strong>{destination.name}</strong><span>{destination.category} · {destination.openingHour}–{destination.closingHour}</span></div>
              <div className="admin-record-actions">
                <button onClick={() => {
                  setEditingDestinationId(destination.id)
                  setDestinationForm({
                    name: destination.name,
                    category: destination.category,
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                    openingHour: destination.openingHour,
                    closingHour: destination.closingHour,
                    imageUrls: destination.imageUrls ?? [],
                  })
                }}>Edit</button>
                <button onClick={() => void removeDestination(destination.id)}>Delete</button>
              </div>
            </article>
          ))}
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div><h2>Manage Dining Insights</h2><p>Curate nearby dining recommendations for each destination.</p></div>
            <button className="primary-button" onClick={() => { setEditingDiningId(null); setDiningForm({ ...emptyDining, destinationId: destinations[0]?.id ?? 0 }) }}>New insight</button>
          </div>
          <form className="admin-form" onSubmit={saveDining}>
            <select value={diningForm.destinationId} onChange={(event) => setDiningForm({ ...diningForm, destinationId: Number(event.target.value) })} required>
              <option value={0} disabled>Select destination</option>
              {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
            </select>
            <input value={diningForm.restaurantName} onChange={(event) => setDiningForm({ ...diningForm, restaurantName: event.target.value })} placeholder="Restaurant name" required />
            <input value={diningForm.priceRange} onChange={(event) => setDiningForm({ ...diningForm, priceRange: event.target.value })} placeholder="Price range" required />
            <textarea value={diningForm.recommendedDishes} onChange={(event) => setDiningForm({ ...diningForm, recommendedDishes: event.target.value })} placeholder="Recommended dishes" required />
            <input value={diningForm.imageUrls?.join(', ') ?? ''} onChange={(event) => setDiningForm({ ...diningForm, imageUrls: toImages(event.target.value) })} placeholder="Image URLs, comma separated" />
            <button className="primary-button" type="submit" disabled={saving || destinations.length === 0}>{saving ? 'Saving...' : editingDiningId === null ? 'Create insight' : 'Save changes'}</button>
          </form>
          {destinations.map((destination) => (
            <div key={destination.id}>
              <h3 className="admin-subheading">{destination.name}</h3>
              {(diningByDestination[destination.id] ?? []).map((item) => (
                <article className="admin-record" key={item.id}>
                  <div><strong>{item.restaurantName}</strong><span>{item.priceRange} · {item.recommendedDishes}</span></div>
                  <div className="admin-record-actions">
                    <button onClick={() => { setEditingDiningId(item.id); setDiningForm({ ...item, imageUrls: item.imageUrls ?? [] }) }}>Edit</button>
                    <button onClick={() => void removeDining(item)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
