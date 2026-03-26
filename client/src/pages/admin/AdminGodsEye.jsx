import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import adminService from '../../services/adminService';
import { useSocket } from '../../context/SocketContext';

const formatCoords = (coordinates = []) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return 'Unknown';
  return `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`;
};

const Card = ({ children, className }) => (
  <div className={cn('bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5', className)}>{children}</div>
);

const AdminBirdEye = () => {
  const [data, setData] = useState({ arcData: [], heatmapData: [], liveTelemetry: [], dangerZones: [], weatherData: [], forecastData: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const { socket } = useSocket();

  const loadData = async (isRefresh = false) => {
    try {
      setError('');
      isRefresh ? setRefreshing(true) : setLoading(true);
      const [mainRes, weatherRes, forecastRes] = await Promise.all([
        adminService.getBirdEyeData(),
        adminService.getWeatherGrid().catch(() => ({ success: false, data: [] })),
        adminService.getSupplyForecast().catch(() => ({ success: false, data: [] }))
      ]);
      if (!mainRes?.success) throw new Error(mainRes?.message || 'Failed to load telemetry data');
      setData({
        arcData: mainRes.data?.arcData || [], heatmapData: mainRes.data?.heatmapData || [],
        liveTelemetry: mainRes.data?.liveTelemetry || [], dangerZones: mainRes.data?.dangerZones || [],
        weatherData: weatherRes?.data || [], forecastData: forecastRes?.data || []
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load Bird Eye data');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const handleLocationUpdate = (update) => {
      if (!update?.location?.coordinates) return;
      setData((prev) => {
        const liveTelemetry = [...prev.liveTelemetry];
        const existingIndex = liveTelemetry.findIndex(item => item.id === update.rideId || item.driverId === update.driverId);
        const nextItem = { id: update.rideId, driverId: update.driverId, driverName: liveTelemetry[existingIndex]?.driverName || 'Live driver', coordinates: update.location.coordinates, updatedAt: new Date().toISOString() };
        if (existingIndex >= 0) liveTelemetry[existingIndex] = { ...liveTelemetry[existingIndex], ...nextItem };
        else liveTelemetry.unshift(nextItem);
        return { ...prev, liveTelemetry: liveTelemetry.slice(0, 50) };
      });
      setLastUpdated(new Date());
    };
    socket.on('driverLocationUpdated', handleLocationUpdate);
    return () => socket.off('driverLocationUpdated', handleLocationUpdate);
  }, [socket]);

  const summary = useMemo(() => ({
    liveDrivers: data.liveTelemetry.length, activeCorridors: data.arcData.length,
    demandSignals: data.heatmapData.length, dangerZones: data.dangerZones.length
  }), [data]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 size={24} className="animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-6 min-h-screen">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Bird Eye Telemetry</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Live platform visibility without the optional Deck.gl stack.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN')}` : 'Waiting for data'}</span>
          <button onClick={() => loadData(true)} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 p-3 rounded-md border border-red-200 dark:border-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: 'Live Drivers', value: summary.liveDrivers, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Active Corridors', value: summary.activeCorridors, cls: 'text-zinc-900 dark:text-zinc-100' },
          { label: 'Demand Signals', value: summary.demandSignals, cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Danger Zones', value: summary.dangerZones, cls: 'text-red-600 dark:text-red-400' },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{s.label}</p>
            <p className={cn('text-2xl font-semibold mt-1', s.cls)}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live Telemetry</h2>
            <span className="text-xs text-zinc-400">{data.liveTelemetry.length} active</span>
          </div>
          {data.liveTelemetry.length === 0 ? (
            <p className="text-sm text-zinc-500">No active telemetry available.</p>
          ) : (
            <div className="space-y-2">
              {data.liveTelemetry.slice(0, 10).map((item, index) => (
                <div key={`${item.id || item.driverId || index}`} className="rounded-md border border-zinc-100 dark:border-zinc-800 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{item.driverName || 'Unknown driver'}</p>
                      <p className="text-xs text-zinc-400">Ride: {item.id || 'Unknown'}</p>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
                  </div>
                  <p className="text-sm text-zinc-500 mt-2">{formatCoords(item.coordinates)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Danger Zones</h2>
            <span className="text-xs text-zinc-400">{data.dangerZones.length} flagged</span>
          </div>
          {data.dangerZones.length === 0 ? (
            <p className="text-sm text-zinc-500">No critical danger zones detected.</p>
          ) : (
            <div className="space-y-2">
              {data.dangerZones.slice(0, 10).map((zone, index) => (
                <div key={`${zone.coordinates?.join('-') || index}`} className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-700 dark:text-red-400 text-sm">{zone.severity || 'HIGH'}</span>
                    <span className="text-xs text-red-500 dark:text-red-400">Deviation cluster</span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">{formatCoords(zone.coordinates)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top Corridors</h2>
            <span className="text-xs text-zinc-400">{data.arcData.length} recent routes</span>
          </div>
          <div className="space-y-2">
            {data.arcData.slice(0, 10).map((route, index) => (
              <div key={`${route.source?.join('-')}-${route.target?.join('-')}-${index}`} className="rounded-md border border-zinc-100 dark:border-zinc-800 p-3 text-sm">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">Corridor {index + 1}</p>
                <p className="text-zinc-500 mt-1">{formatCoords(route.source)} to {formatCoords(route.target)}</p>
                <p className="text-xs text-zinc-400 mt-1">Demand weight: {route.value || 0} | Avg. price: ₹{route.price || 0}</p>
              </div>
            ))}
            {data.arcData.length === 0 && <p className="text-sm text-zinc-500">No completed corridor data available.</p>}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Weather and Forecast Signals</h2>
            <span className="text-xs text-zinc-400">{data.weatherData.length} weather | {data.forecastData.length} forecast</span>
          </div>
          <div className="space-y-2">
            {data.weatherData.slice(0, 5).map((cell, index) => (
              <div key={`weather-${index}`} className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-3 text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-300">{cell.type || 'WEATHER'} cell</p>
                <p className="text-blue-600 dark:text-blue-400 mt-1">{formatCoords(cell.coordinates)}</p>
                <p className="text-xs text-blue-500 mt-1">Intensity: {Math.round(cell.intensity || 0)}</p>
              </div>
            ))}
            {data.forecastData.slice(0, 5).map((cell, index) => (
              <div key={`forecast-${index}`} className="rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10 p-3 text-sm">
                <p className="font-medium text-purple-800 dark:text-purple-300">Forecast hour {cell.hour ?? index}</p>
                <p className="text-purple-600 dark:text-purple-400 mt-1">{formatCoords(cell.coordinates)}</p>
                <p className="text-xs text-purple-500 mt-1">Predicted demand: {Math.round(cell.predictedDemand || 0)}</p>
              </div>
            ))}
            {data.weatherData.length === 0 && data.forecastData.length === 0 && (
              <p className="text-sm text-zinc-500">No environmental signals available.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminBirdEye;
