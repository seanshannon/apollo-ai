'use client';

import { useEffect, useRef, useState } from 'react';

interface HeatMapProps {
  data: any[];
}

// Limit markers for performance
const MAX_MARKERS = 1000;

function HeatMapInternal({ data }: HeatMapProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false); // New state to track when map is fully initialized
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [L, setL] = useState<any>(null);
  const initializingRef = useRef(false); // Guard against concurrent initialization

  useEffect(() => {
    // Only load on client side
    if (typeof window === 'undefined') return;

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    // Import Leaflet dynamically with timeout
    const loadLeaflet = async () => {
      try {
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.error('Map loading timeout - taking too long');
          }
        }, 10000); // 10 second timeout

        // Import CSS first
        const existingLeafletLink = document.querySelector('link[href*="leaflet.css"]');
        if (!existingLeafletLink) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
          
          // Wait for CSS to load
          await new Promise((resolve) => {
            link.onload = resolve;
            link.onerror = resolve; // Continue even if CSS fails
            setTimeout(resolve, 2000); // Max 2s wait for CSS
          });
        }

        // Add MarkerCluster CSS inline (avoids CSP issues)
        const existingClusterStyles = document.getElementById('leaflet-markercluster-styles');
        if (!existingClusterStyles) {
          const clusterStyles = document.createElement('style');
          clusterStyles.id = 'leaflet-markercluster-styles';
          clusterStyles.innerHTML = `
            /* MarkerCluster.css */
            .leaflet-cluster-anim .leaflet-marker-icon, .leaflet-cluster-anim .leaflet-marker-shadow {
              transition: transform 0.3s ease-out, opacity 0.3s ease-in;
            }
            
            .leaflet-cluster-spider-leg {
              stroke: #00ff00;
              stroke-width: 2;
              stroke-opacity: 0.5;
            }
            
            .marker-cluster-small,
            .marker-cluster-medium,
            .marker-cluster-large {
              background-clip: padding-box;
              border-radius: 20px;
            }
            
            .marker-cluster-small div,
            .marker-cluster-medium div,
            .marker-cluster-large div {
              width: 30px;
              height: 30px;
              margin-left: 5px;
              margin-top: 5px;
              text-align: center;
              border-radius: 15px;
              font: 12px "Helvetica Neue", Arial, Helvetica, sans-serif;
            }
            
            .marker-cluster {
              background-clip: padding-box;
              border-radius: 20px;
            }
            
            .marker-cluster div {
              width: 30px;
              height: 30px;
              margin-left: 5px;
              margin-top: 5px;
              text-align: center;
              border-radius: 15px;
              font: 12px "Helvetica Neue", Arial, Helvetica, sans-serif;
            }
            
            .marker-cluster span {
              line-height: 30px;
            }
          `;
          document.head.appendChild(clusterStyles);
        }

        if (!isMounted) return;

        // Import Leaflet
        const leaflet = await import('leaflet');
        // Import marker cluster - this extends L with markerClusterGroup
        await import('leaflet.markercluster');
        
        if (!isMounted) return;
        
        clearTimeout(timeoutId);
        setL(leaflet.default);
        setMapLoaded(true);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
        clearTimeout(timeoutId);
      }
    };

    loadLeaflet();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!L || !mapLoaded || !mapContainerRef.current) return;

    // CRITICAL: Prevent concurrent initialization
    if (initializingRef.current) {
      console.log('Map initialization already in progress, skipping...');
      return;
    }

    // CRITICAL: Check if map already exists and clean it first
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (error) {
        console.warn('Error removing existing map:', error);
      }
      mapRef.current = null;
    }

    // Clear any existing Leaflet containers
    if (mapContainerRef.current) {
      mapContainerRef.current.innerHTML = '';
    }

    // Set initializing flag
    initializingRef.current = true;

    let initTimeout: NodeJS.Timeout;
    let frameId: number;

    try {
      // Add custom styles first
      const existingStyle = document.getElementById('leaflet-custom-styles');
      if (!existingStyle) {
        const style = document.createElement('style');
        style.id = 'leaflet-custom-styles';
        style.innerHTML = `
          /* Map container styling */
          .leaflet-container {
            background: #0a0a0a !important;
            width: 100% !important;
            height: 100% !important;
          }
          
          /* Custom marker animation */
          @keyframes markerPulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.15);
              opacity: 0.9;
            }
          }
          
          .custom-marker {
            animation: markerPulse 2s ease-in-out infinite;
            z-index: 1000 !important;
            pointer-events: all !important;
            cursor: pointer !important;
          }
          
          .custom-marker:hover {
            z-index: 10000 !important;
            animation-play-state: paused;
            transform: scale(1.3);
          }
          
          /* Ensure marker divs are clickable */
          .custom-marker > div {
            pointer-events: all !important;
            cursor: pointer !important;
          }
          
          /* Popup styling */
          .leaflet-popup-content-wrapper {
            background: rgba(0, 20, 0, 0.95);
            color: #00ff00;
            border: 1px solid #00ff00;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
            backdrop-filter: blur(10px);
          }
          
          .leaflet-popup-tip {
            background: rgba(0, 20, 0, 0.95);
            border-left: 1px solid #00ff00;
            border-bottom: 1px solid #00ff00;
          }
          
          .leaflet-popup-content {
            color: #00ff00;
            margin: 10px;
            font-family: 'Inter', sans-serif;
          }
          
          /* Cluster styling */
          .marker-cluster-small,
          .marker-cluster-medium,
          .marker-cluster-large {
            background-color: rgba(0, 255, 0, 0.2) !important;
            border: 2px solid #00ff00 !important;
          }
          
          .marker-cluster-small div,
          .marker-cluster-medium div,
          .marker-cluster-large div {
            background-color: rgba(0, 255, 0, 0.6) !important;
            color: #000000 !important;
            font-weight: bold !important;
          }
          
          /* Zoom controls */
          .leaflet-control-zoom a {
            background-color: rgba(0, 20, 0, 0.9) !important;
            color: #00ff00 !important;
            border: 1px solid #00ff00 !important;
          }
          
          .leaflet-control-zoom a:hover {
            background-color: rgba(0, 255, 0, 0.2) !important;
          }
          
          /* Attribution */
          .leaflet-control-attribution {
            background-color: rgba(0, 20, 0, 0.8) !important;
            color: #00ff00 !important;
            border: 1px solid #00ff00 !important;
            border-radius: 4px !important;
          }
          
          .leaflet-control-attribution a {
            color: #00ff00 !important;
          }
        `;
        document.head.appendChild(style);
      }

      // Use requestAnimationFrame to ensure the browser has painted
      frameId = requestAnimationFrame(() => {
        initTimeout = setTimeout(() => {
          if (!mapContainerRef.current) return;

          const container = mapContainerRef.current;
          
          // Verify container has dimensions
          const rect = container.getBoundingClientRect();
          
          if (rect.width === 0 || rect.height === 0) {
            console.warn('Map container has no size yet, dimensions:', rect);
            return;
          }

          console.log('Initializing map with container dimensions:', rect.width, 'x', rect.height);

          // Create map with proper styling  
          const map = L.map(container, {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            maxZoom: 18,
            worldCopyJump: true,
            zoomControl: true,
            preferCanvas: true,
            attributionControl: true,
          });

          // Add OpenStreetMap tiles with proper tile server
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            subdomains: ['a', 'b', 'c'],
            maxZoom: 19,
            tileSize: 256,
            zoomOffset: 0,
            crossOrigin: true,
          }).addTo(map);

          // CRITICAL: Force size recalculation after tile layer is added
          // This ensures tiles load with correct dimensions
          requestAnimationFrame(() => {
            if (map) {
              map.invalidateSize({ pan: false });
              
              // Do it again after a brief delay to catch any layout shifts
              setTimeout(() => {
                if (map) {
                  map.invalidateSize({ pan: false });
                }
              }, 100);
            }
          });

          mapRef.current = map;
          // Reset initializing flag and set map ready after successful initialization
          initializingRef.current = false;
          setMapReady(true); // CRITICAL: Signal that map is ready for markers
          console.log('[HeatMap] Map initialization complete, ready for markers');
        }, 100);
      });

    } catch (error) {
      console.error('Failed to initialize map:', error);
      initializingRef.current = false; // Reset flag on error
    }

    // Cleanup
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (initTimeout) clearTimeout(initTimeout);
      
      // Cleanup map properly
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (error) {
          console.warn('Error removing map:', error);
        }
        mapRef.current = null;
      }
      
      // Clear the container
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = '';
      }
      
      // Reset flags and ready state
      initializingRef.current = false;
      setMapReady(false);
    };
  }, [L, mapLoaded]);

  // Update markers when data changes
  useEffect(() => {
    console.log('[HeatMap] Markers effect triggered', { 
      hasL: !!L,
      mapReady,
      hasMap: !!mapRef.current, 
      dataLength: data.length,
      firstDataPoint: data[0]
    });
    
    // CRITICAL: Wait for map to be fully initialized before adding markers
    if (!L || !mapReady || !mapRef.current || data.length === 0) {
      console.log('[HeatMap] Markers effect skipped:', {
        reason: !L ? 'No Leaflet' : !mapReady ? 'Map not ready' : !mapRef.current ? 'No map' : 'No data'
      });
      return;
    }

    console.log('[HeatMap] Creating markers for', data.length, 'data points');

    // Clear existing markers layer
    if (markersLayerRef.current) {
      mapRef.current.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }

    // Create marker cluster group
    const markers = (L as any).markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 80,
    });

    // Limit data to MAX_MARKERS for performance
    const limitedData = data.slice(0, MAX_MARKERS);
    let validMarkerCount = 0;
    
    limitedData.forEach((point) => {
      const lat = point.latitude || point.lat;
      const lon = point.longitude || point.lon || point.lng;

      if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
        try {
          // Create custom icon with glowing green effect and CRITICAL pointer-events
          const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
              width: 20px;
              height: 20px;
              background: radial-gradient(circle, #00ff00 0%, #00dd00 50%, rgba(0, 255, 0, 0.4) 100%);
              border-radius: 50%;
              box-shadow: 
                0 0 20px rgba(0, 255, 0, 0.9),
                0 0 40px rgba(0, 255, 0, 0.6),
                inset 0 0 10px rgba(0, 255, 0, 0.8);
              cursor: pointer;
              pointer-events: all;
              border: 2px solid #00ff00;
            "></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10],
          });

          const marker = L.marker([lat, lon], { 
            icon: customIcon,
            riseOnHover: true, // CRITICAL: Ensures marker rises above others on hover
          });

          // Create popup content with better formatting and all relevant customer data
          let popupContent = '<div style="font-size: 14px; line-height: 1.8; min-width: 250px;">';
          
          // Build a formatted name if we have firstName/lastName
          const firstName = point.firstName || point.firstname || point.first_name;
          const lastName = point.lastName || point.lastname || point.last_name;
          const fullName = firstName && lastName ? `${firstName} ${lastName}` : null;
          
          if (fullName) {
            popupContent += `<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #00ff00;"><strong style="color: #00ff00; font-size: 16px;">${fullName}</strong></div>`;
          }
          
          // Display other fields in a organized way
          Object.keys(point).forEach((key) => {
            if (key !== 'latitude' && key !== 'longitude' && key !== 'lat' && key !== 'lon' && key !== 'lng' &&
                key !== 'firstName' && key !== 'firstname' && key !== 'first_name' &&
                key !== 'lastName' && key !== 'lastname' && key !== 'last_name') {
              const value = point[key];
              if (value !== null && value !== undefined && value !== '') {
                const displayKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim().replace(/\b\w/g, (l: string) => l.toUpperCase());
                
                // Format values based on type
                let displayValue = value;
                if (typeof value === 'number') {
                  // Format currency if it's a money field
                  if (key.toLowerCase().includes('spent') || key.toLowerCase().includes('amount') || 
                      key.toLowerCase().includes('price') || key.toLowerCase().includes('total')) {
                    displayValue = `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  } else {
                    displayValue = value.toLocaleString('en-US');
                  }
                } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                  // Format dates
                  try {
                    const date = new Date(value);
                    displayValue = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                  } catch (e) {
                    displayValue = value;
                  }
                }
                
                popupContent += `<div style="margin-bottom: 6px;"><strong style="color: #66ff66;">${displayKey}:</strong> <span style="color: #e0ffe0;">${displayValue}</span></div>`;
              }
            }
          });
          
          popupContent += '</div>';

          marker.bindPopup(popupContent, {
            maxWidth: 350,
            minWidth: 250,
            className: 'custom-popup',
            closeButton: true,
            autoPan: true, // CRITICAL: Auto-pan map to show popup
          });
          
          // CRITICAL: Add click event to ensure marker is interactive
          marker.on('click', () => {
            marker.openPopup();
          });
          
          markers.addLayer(marker);
          validMarkerCount++;
        } catch (error) {
          console.error('Failed to add marker:', error);
        }
      }
    });

    console.log('[HeatMap] Valid marker count:', validMarkerCount);

    // Add markers to map
    if (validMarkerCount > 0) {
      console.log('[HeatMap] Adding', validMarkerCount, 'markers to map');
      mapRef.current.addLayer(markers);
      markersLayerRef.current = markers;

      // Fit bounds to show all markers with padding
      try {
        const bounds = markers.getBounds();
        if (bounds.isValid()) {
          console.log('[HeatMap] Fitting bounds to markers');
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        } else {
          console.warn('[HeatMap] Bounds are invalid');
        }
      } catch (error) {
        console.error('[HeatMap] Failed to fit bounds:', error);
      }
    } else {
      console.warn('[HeatMap] No valid markers to add to map');
    }
  }, [L, mapReady, data]); // CRITICAL: Include mapReady in dependencies

  return (
    <div className="w-full rounded-lg overflow-hidden border-2 border-primary/40 shadow-xl" style={{ height: '600px', position: 'relative' }}>
      {!mapLoaded && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)' }}>
          <div className="text-center space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-primary font-semibold">Loading Interactive Map...</p>
            <p className="text-xs text-muted-foreground">Preparing {data.length.toLocaleString()} locations</p>
          </div>
        </div>
      )}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />
      {mapLoaded && (
        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1000 }} className="bg-background/95 backdrop-blur-sm px-4 py-3 rounded-lg border-2 border-primary/40 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
            <p className="text-sm text-primary font-semibold">
              {Math.min(data.length, MAX_MARKERS).toLocaleString()} Locations
            </p>
          </div>
          {data.length > MAX_MARKERS && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Showing first {MAX_MARKERS.toLocaleString()} for optimal performance
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Export as both default and named export for maximum compatibility
export default HeatMapInternal;
export { HeatMapInternal as HeatMap };