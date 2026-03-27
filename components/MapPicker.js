'use client'
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useState } from 'react'

const customerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Ícono personalizado para el Local (Color Oro/Naranja)
const storeIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function ChangeView({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 16);
    }
  }, [coords, map]);
  return null;
}

export default function MapPicker({ setLocation, forcedCoords, restaurantCoords }) {
  const catamarcaCenter = [-28.4746029, -65.7761164] 
  const [position, setPosition] = useState(catamarcaCenter)

  useEffect(() => {
    if (forcedCoords) {
      setPosition(forcedCoords)
      setLocation(forcedCoords)
    }
  }, [forcedCoords, setLocation])

  return (
    <div className="h-48 w-full rounded-xl overflow-hidden border-2 border-orange-200 z-0 relative">
      <MapContainer 
        center={restaurantCoords || catamarcaCenter} 
        zoom={14} 
        style={{ height: '100%', width: '100%' }}
        dragging={true} // Permitimos arrastrar para ver ambos puntos si el usuario quiere
        touchZoom={true}
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <ChangeView coords={forcedCoords} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap'
        />
        
        {/* Marcador del Local */}
        {restaurantCoords && (
          <Marker position={[restaurantCoords.lat, restaurantCoords.lng]} icon={storeIcon}>
            <Popup autoOpen><b>Gustó</b><br/>Nuestro Local</Popup>
          </Marker>
        )}

        {/* Marcador del Cliente */}
        {forcedCoords && <Marker position={position} icon={customerIcon} />}
      </MapContainer>
    </div>
  )
}