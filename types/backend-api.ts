// Backend API Types

export interface Destination {
  id: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  openingHour: string;
  closingHour: string;
  diningInsights: DiningInsight[];
  imageUrls?: string[];
}

export type DestinationRequest = Omit<Destination, 'id' | 'diningInsights'>;

export interface RouteSegmentDetail {
  distance: number;
  duration: number;
  instruction: string;
}

export interface DayPlanRouteResponse {
  finalOptimizedTimeSeconds: number;
  totalDistanceMeters: number;
  overviewPolyline: string;
  optimizedWaypointOrder: number[];
  segmentDetails: RouteSegmentDetail[];
  rawJsonResponse: string;
}

export interface DiningInsight {
  id: number;
  restaurantName: string;
  priceRange: string;
  recommendedDishes: string;
  destinationId: number;
  imageUrls?: string[];
}
