import { apiClient } from '@/src/lib/apiClient'

export type WeatherResponse = {
  condition: string
  temperatureCelsius: number
  humidity: number
  rawJsonResponse?: string
}

export const WeatherService = {
  getWeather(lat: number, lon: number, travelDate: string): Promise<WeatherResponse> {
    const query = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      travelDate,
    })

    return apiClient.request<WeatherResponse>(`/api/weather?${query.toString()}`)
  },
}
