import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface SpatialMapProps {
  center?: [number, number];
  zoom?: number;
  wards?: Array<{ id: number; name: string; boundary: any; centerLatitude: number; centerLongitude: number }>;
  gpsTrail?: Array<{ lat: number; lon: number }>;
  geofences?: Array<{ id: number; latitude: number; longitude: number; radius: number; name: string }>;
  height?: string;
}

/**
 * Leaflet.js Map Component for SWM PRO
 * Displays wards, GPS trails, geofences, and drainage lines
 */

export default function SpatialMap({
  center = [28.6139, 77.209],
  zoom = 13,
  wards = [],
  gpsTrail = [],
  geofences = [],
  height = "500px",
}: SpatialMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const circlesRef = useRef<L.Circle[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    if (!map.current) {
      map.current = L.map(mapContainer.current).setView(center, zoom);

      // Add tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.current);
    }

    // Clear previous markers and layers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    circlesRef.current.forEach((circle) => circle.remove());
    circlesRef.current = [];

    // Add wards as polygons
    wards.forEach((ward) => {
      if (ward.boundary && ward.boundary.coordinates) {
        const coordinates: L.LatLngTuple[] = ward.boundary.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]]);

        const polygon = L.polygon(coordinates, {
          color: "#0284C7",
          weight: 2,
          opacity: 0.7,
          fillOpacity: 0.2,
        }).addTo(map.current!);

        // Add popup
        polygon.bindPopup(`<strong>${ward.name}</strong><br/>Ward ID: ${ward.id}`);

        // Add center marker
        const centerMarker = L.circleMarker([ward.centerLatitude, ward.centerLongitude], {
          radius: 6,
          fillColor: "#0284C7",
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map.current!);

        centerMarker.bindPopup(`<strong>${ward.name}</strong><br/>Center Point`);
        markersRef.current.push(centerMarker as L.Layer);
      }
    });

    // Add GPS trail as polyline
    if (gpsTrail.length > 1) {
      const trailCoordinates: L.LatLngTuple[] = gpsTrail.map((point) => [point.lat, point.lon]);
      polylineRef.current = L.polyline(trailCoordinates, {
        color: "#10B981",
        weight: 3,
        opacity: 0.8,
        dashArray: "5, 5",
      }).addTo(map.current!);

      // Add start and end markers
      const startMarker = L.circleMarker([gpsTrail[0].lat, gpsTrail[0].lon] as L.LatLngTuple, {
        radius: 8,
        fillColor: "#10B981",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map.current!);

      startMarker.bindPopup("Start Point");
      markersRef.current.push(startMarker as L.Layer);

      const endMarker = L.circleMarker([gpsTrail[gpsTrail.length - 1].lat, gpsTrail[gpsTrail.length - 1].lon] as L.LatLngTuple, {
        radius: 8,
        fillColor: "#EF4444",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map.current!);

      endMarker.bindPopup("End Point");
      markersRef.current.push(endMarker as L.Layer);
    }

    // Add geofences as circles
    geofences.forEach((geofence) => {
      const circle = L.circle([parseFloat(geofence.latitude.toString()), parseFloat(geofence.longitude.toString())] as L.LatLngTuple, {
        radius: geofence.radius,
        color: "#F59E0B",
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0.1,
      }).addTo(map.current!);

      circle.bindPopup(`<strong>${geofence.name}</strong><br/>Radius: ${geofence.radius}m`);
      circlesRef.current.push(circle);

      // Add depot marker
      const depotMarker = L.marker([parseFloat(geofence.latitude.toString()), parseFloat(geofence.longitude.toString())] as L.LatLngTuple, {
        icon: L.icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(map.current!);

      depotMarker.bindPopup(`<strong>${geofence.name}</strong><br/>Depot`);
      markersRef.current.push(depotMarker as L.Layer);
    });

    // Fit bounds if we have content
    if (map.current && (wards.length > 0 || gpsTrail.length > 0 || geofences.length > 0)) {
      const layers: L.Layer[] = [
        ...markersRef.current,
        ...circlesRef.current,
      ];
      if (polylineRef.current) {
        layers.push(polylineRef.current);
      }
      if (layers.length > 0) {
        const group = new L.FeatureGroup(layers);
        map.current.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [center, zoom, wards, gpsTrail, geofences]);

  return <div ref={mapContainer} style={{ width: "100%", height, borderRadius: "20px", border: "1px solid #E5E7EB" }} />;
}
