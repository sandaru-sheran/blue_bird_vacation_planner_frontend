export const POSTIMAGES_LIMITS = {
  MAX_FILE_SIZE_BYTES: 32 * 1024 * 1024, // 32 MB
  MAX_FILE_SIZE_MB: 32,
  MAX_WIDTH: 10000,
  MAX_HEIGHT: 10000,
  MAX_BATCH: 1000,
}

export interface ImageValidationResult {
  valid: boolean
  error?: string
}

export function validateImageResolution(file: File): Promise<ImageValidationResult> {
  return new Promise((resolve) => {
    // If not an image or SVG, we can allow or check
    if (!file.type.startsWith('image/')) {
      resolve({ valid: false, error: `File "${file.name}" is not an image.` })
      return
    }

    if (file.size > POSTIMAGES_LIMITS.MAX_FILE_SIZE_BYTES) {
      resolve({
        valid: false,
        error: `File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 32 MB limit.`,
      })
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      if (img.naturalWidth > POSTIMAGES_LIMITS.MAX_WIDTH || img.naturalHeight > POSTIMAGES_LIMITS.MAX_HEIGHT) {
        resolve({
          valid: false,
          error: `Image "${file.name}" resolution (${img.naturalWidth}×${img.naturalHeight}) exceeds maximum allowed (10,000 × 10,000 pixels).`,
        })
      } else {
        resolve({ valid: true })
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ valid: false, error: `Failed to load image "${file.name}" for resolution validation.` })
    }

    img.src = objectUrl
  })
}

export async function uploadToPostimages(files: File[]): Promise<string[]> {
  if (files.length === 0) return []

  if (files.length > POSTIMAGES_LIMITS.MAX_BATCH) {
    throw new Error(`Cannot upload more than ${POSTIMAGES_LIMITS.MAX_BATCH} images at a single time.`)
  }

  // Validate each file
  for (const file of files) {
    const val = await validateImageResolution(file)
    if (!val.valid) {
      throw new Error(val.error ?? 'Invalid image file.')
    }
  }

  const formData = new FormData()
  files.forEach((file) => {
    formData.append('file', file)
  })

  const response = await fetch('/api/upload/postimages', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}))
    throw new Error(errorJson.error || `Upload failed with status ${response.status}`)
  }

  const result = await response.json()
  return result.urls as string[]
}
