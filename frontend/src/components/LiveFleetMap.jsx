import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { io } from 'socket.io-client';

const API_BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://taxipayeth.onrender.com';

// Custom Marker Icon for Drivers
const carIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3204/3204121.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});


export default function LiveFleetMap() {
  const [driverLocations, setDriverLocations] = useState({});
  const [zones, setZones] = useState([]);

  useEffect(() => {
    // Fetch zones on mount
    const token = localStorage.getItem('taxipay_token');
    fetch(`${API_BASE_URL}/api/admin/zones`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.zones) setZones(data.zones);
      })
      .catch(err => console.error('Failed to load zones', err));

    // Socket.io for live updates
    const socket = io(API_BASE_URL, {
      auth: { token }
    });

    socket.on('driver_location_changed', (data) => {
      setDriverLocations(prev => ({
        ...prev,
        [data.driverId]: data
      }));
    });

    return () => socket.disconnect();
  }, []);

  return (
<div style={{ height: '500px', width: '100%', minHeight: '500px', position: 'relative', zIndex: 10 }}>      <MapContainer 
        center={[9.03, 38.74]} // Default to Addis Ababa
        zoom={13} 
        style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
      >
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          attribution='&copy; Google Maps'
        />
        
        {/* Render Dynamic Zones */}
        {zones.filter(z => z.isActive).map(zone => {
          if (zone.area?.type === 'Polygon') {
            // Leaflet expects [lat, lng], but GeoJSON is [lng, lat]
            const positions = zone.area.coordinates[0].map(coord => [coord[1], coord[0]]);
            return (
              <Polygon 
                key={zone._id} 
                positions={positions} 
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2 }}
              >
                <Popup>{zone.name} - {zone.description}</Popup>
              </Polygon>
            );
          }
          return null;
        })}

        {/* Render Live Drivers */}
        {Object.values(driverLocations).map(driver => (
          <Marker 
            key={driver.driverId} 
            position={[driver.location.lat, driver.location.lng]}
            icon={carIcon}
          >
            <Popup>
              <strong>Driver ID:</strong> {driver.driverId}<br/>
              <strong>Updated:</strong> {new Date(driver.timestamp).toLocaleTimeString()}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
