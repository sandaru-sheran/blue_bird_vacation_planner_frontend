import { NextRequest, NextResponse } from 'next/server'

// Postimages constraints
const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32 MB
const MAX_BATCH_COUNT = 1000

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('adminToken')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const entries = formData.getAll('file')
    const files = entries.filter((entry): entry is File => entry instanceof File)

    if (files.length !== entries.length || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > MAX_BATCH_COUNT) {
      return NextResponse.json({ error: `Batch upload limit exceeded. Maximum ${MAX_BATCH_COUNT} images allowed at a single time.` }, { status: 400 })
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        return NextResponse.json(
          { error: `File "${file.name}" is not a supported image type.` },
          { status: 415 },
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File "${file.name}" exceeds the 32 MB size limit.` }, { status: 400 })
      }

      // Try uploading to Postimages
      // Postimages free upload endpoint or API
      const postimagesFormData = new FormData()
      postimagesFormData.append('file', file)
      postimagesFormData.append('mode', 'json')
      postimagesFormData.append('expire', '0') // No expiration
      postimagesFormData.append('adult', 'no')
      if (process.env.POSTIMAGES_API_KEY) {
        postimagesFormData.append('token', process.env.POSTIMAGES_API_KEY)
      }

      try {
        const uploadRes = await fetch('https://postimages.org/json/rr', {
          method: 'POST',
          body: postimagesFormData,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
        })

        if (uploadRes.ok) {
          const data = await uploadRes.json()
          // postimages json response usually contains url or direct link
          const directUrl = data.url || data.direct_url || data.link || data.secure_url
          if (directUrl) {
            uploadedUrls.push(directUrl)
            continue
          }
        }
      } catch (err) {
        console.warn('Direct postimages rr endpoint failed, trying postimage api endpoint:', err)
      }

      // Secondary attempt with api.postimage.org if available or fallback
      try {
        const postimageApiFormData = new FormData()
        postimageApiFormData.append('file', file)
        if (process.env.POSTIMAGES_API_KEY) {
          postimageApiFormData.append('api_key', process.env.POSTIMAGES_API_KEY)
        }

        const apiRes = await fetch('https://api.postimage.org/1/upload', {
          method: 'POST',
          body: postimageApiFormData,
        })

        if (apiRes.ok) {
          const apiData = await apiRes.json()
          const directUrl = apiData.url || apiData.link || apiData.hotlink
          if (directUrl) {
            uploadedUrls.push(directUrl)
            continue
          }
        }
      } catch (err) {
        console.warn('api.postimage.org upload failed:', err)
      }

      return NextResponse.json(
        { error: `Unable to upload file "${file.name}".` },
        { status: 502 },
      )
    }

    return NextResponse.json({ urls: uploadedUrls })
  } catch (error) {
    console.error('Postimages upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
