/**
 * BirdEye View Seed Data
 * Creates realistic geospatial data within Chennai area to populate all BirdEyeView layers:
 *   - Completed rides (arcs, heatmap, density, hourly)
 *   - Active rides (live drivers, active routes, breadcrumb trails)
 *   - Bookings (pickup/dropoff points)
 *   - Route deviations (danger zones)
 *   - Emergencies (SOS)
 *   - Search logs with 0 results (unfulfilled demand)
 *   - Route alerts (subscribed corridors)
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Chennai landmarks with real [lng, lat] coordinates
const LOCATIONS = [
  { name: 'T. Nagar',            address: 'T. Nagar, Chennai 600017',                      coords: [80.2341, 13.0418] },
  { name: 'Anna Nagar',          address: 'Anna Nagar, Chennai 600040',                     coords: [80.2095, 13.0878] },
  { name: 'Adyar',               address: 'Adyar, Chennai 600020',                          coords: [80.2574, 13.0067] },
  { name: 'Velachery',           address: 'Velachery, Chennai 600042',                      coords: [80.2218, 12.9815] },
  { name: 'Guindy',              address: 'Guindy, Chennai 600032',                         coords: [80.2121, 13.0067] },
  { name: 'Mylapore',            address: 'Mylapore, Chennai 600004',                       coords: [80.2689, 13.0334] },
  { name: 'OMR - Tidel Park',    address: 'Rajiv Gandhi Salai, Taramani, Chennai 600113',   coords: [80.2270, 12.9825] },
  { name: 'Tambaram',            address: 'Tambaram, Chennai 600045',                       coords: [80.1198, 12.9249] },
  { name: 'Porur',               address: 'Porur, Chennai 600116',                          coords: [80.1567, 13.0382] },
  { name: 'Sholinganallur',      address: 'Sholinganallur, Chennai 600119',                 coords: [80.2279, 12.9010] },
  { name: 'Chrompet',            address: 'Chrompet, Chennai 600044',                       coords: [80.1441, 12.9513] },
  { name: 'Thiruvanmiyur',       address: 'Thiruvanmiyur, Chennai 600041',                  coords: [80.2640, 12.9830] },
  { name: 'Perungudi',           address: 'Perungudi, Chennai 600096',                      coords: [80.2370, 12.9613] },
  { name: 'Ambattur',            address: 'Ambattur, Chennai 600053',                       coords: [80.1518, 13.1143] },
  { name: 'Mogappair',           address: 'Mogappair, Chennai 600037',                      coords: [80.1722, 13.0856] },
  { name: 'Vadapalani',          address: 'Vadapalani, Chennai 600026',                     coords: [80.2116, 13.0524] },
  { name: 'Nungambakkam',        address: 'Nungambakkam, Chennai 600034',                   coords: [80.2425, 13.0609] },
  { name: 'Egmore',              address: 'Egmore, Chennai 600008',                         coords: [80.2603, 13.0732] },
  { name: 'Central Station',     address: 'Chennai Central, Chennai 600003',                coords: [80.2754, 13.0827] },
  { name: 'Marina Beach',        address: 'Marina Beach, Chennai 600001',                   coords: [80.2838, 13.0499] },
  { name: 'Saidapet',            address: 'Saidapet, Chennai 600015',                       coords: [80.2230, 13.0210] },
  { name: 'Ashok Nagar',         address: 'Ashok Nagar, Chennai 600083',                    coords: [80.2128, 13.0367] },
  { name: 'Pallavaram',          address: 'Pallavaram, Chennai 600043',                     coords: [80.1513, 12.9676] },
  { name: 'Medavakkam',          address: 'Medavakkam, Chennai 600100',                     coords: [80.1922, 12.9189] },
  { name: 'Thoraipakkam',        address: 'Thoraipakkam, Chennai 600097',                   coords: [80.2279, 12.9365] },
  { name: 'Kelambakkam',         address: 'Kelambakkam, Chennai 603103',                    coords: [80.2220, 12.7885] },
  { name: 'ECR - Mahabalipuram', address: 'East Coast Rd, Mahabalipuram, Chennai 603104',   coords: [80.1746, 12.6259] },
  { name: 'Avadi',               address: 'Avadi, Chennai 600054',                          coords: [80.1010, 13.1146] },
  { name: 'Koyambedu',           address: 'Koyambedu, Chennai 600107',                      coords: [80.1950, 13.0693] },
  { name: 'Royapettah',          address: 'Royapettah, Chennai 600014',                     coords: [80.2614, 13.0539] },
];

const FIRST_NAMES = ['Priya', 'Rahul', 'Arun', 'Divya', 'Karthik', 'Meena', 'Vijay', 'Lakshmi', 'Suresh', 'Anitha', 'Deepak', 'Kavitha', 'Ravi', 'Sangeetha', 'Mohan'];

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickTwo(arr) {
  const i = Math.floor(Math.random() * arr.length);
  let j = Math.floor(Math.random() * arr.length);
  while (j === i) j = Math.floor(Math.random() * arr.length);
  return [arr[i], arr[j]];
}

// Generate a rough route geometry between two points (with waypoints)
function generateGeometry(start, end, numPoints = 8) {
  const coords = [start];
  for (let i = 1; i < numPoints; i++) {
    const t = i / numPoints;
    // Interpolate with some randomness for natural-looking route
    const lng = start[0] + (end[0] - start[0]) * t + rand(-0.008, 0.008);
    const lat = start[1] + (end[1] - start[1]) * t + rand(-0.005, 0.005);
    coords.push([lng, lat]);
  }
  coords.push(end);
  return coords;
}

// Generate breadcrumbs along a route with timestamps
function generateBreadcrumbs(geometry, startTime, durationMin) {
  const totalMs = durationMin * 60 * 1000;
  return geometry.map((coords, i) => ({
    coordinates: coords,
    timestamp: new Date(startTime.getTime() + (i / (geometry.length - 1)) * totalMs),
    speed: rand(15, 65)
  }));
}

function jitter(coords, amountLng = 0.003, amountLat = 0.002) {
  return [coords[0] + rand(-amountLng, amountLng), coords[1] + rand(-amountLat, amountLat)];
}

function haversineKm(a, b) {
  const toRad = d => d * Math.PI / 180;
  const [lng1, lat1] = a; const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = require('./models/User');
  const Ride = require('./models/Ride');
  const Booking = require('./models/Booking');
  const RouteDeviation = require('./models/RouteDeviation');
  const Emergency = require('./models/Emergency');
  const SearchLog = require('./models/SearchLog');
  const RouteAlert = require('./models/RouteAlert');

  // Get existing users
  const users = await User.find().select('_id vehicles').limit(10);
  if (users.length === 0) {
    console.error('No users found. Run main seed first.');
    process.exit(1);
  }
  const userIds = users.map(u => u._id);
  // Try to get a vehicle ID from the first user
  const vehicleId = users[0]?.vehicles?.[0]?._id || new mongoose.Types.ObjectId();

  const now = new Date();
  const createdRideIds = [];
  const createdBookingIds = [];

  // ════════════════════════════════════════════════════
  //  1. COMPLETED RIDES (50 rides → arcs, heatmap, density)
  // ════════════════════════════════════════════════════
  console.log('\n Creating 50 completed rides...');
  const completedRides = [];
  for (let i = 0; i < 50; i++) {
    const [startLoc, endLoc] = pickTwo(LOCATIONS);
    const distance = haversineKm(startLoc.coords, endLoc.coords);
    const duration = Math.round(distance * 2.5 + rand(5, 20)); // rough estimate
    const seatsTotal = randInt(2, 4);
    const seatsAvailable = randInt(0, seatsTotal - 1);
    const pricePerSeat = Math.round(distance * rand(4, 8));
    const occupiedSeats = seatsTotal - seatsAvailable;
    const hoursAgo = rand(1, 168); // past week
    const createdAt = new Date(now.getTime() - hoursAgo * 3600000);
    const geometry = generateGeometry(startLoc.coords, endLoc.coords, randInt(6, 12));
    const breadcrumbs = generateBreadcrumbs(geometry, createdAt, duration);

    const ride = {
      rider: pick(userIds),
      vehicle: vehicleId,
      route: {
        start: { name: startLoc.name, address: startLoc.address, coordinates: startLoc.coords },
        destination: { name: endLoc.name, address: endLoc.address, coordinates: endLoc.coords },
        geometry: { type: 'LineString', coordinates: geometry },
        distance: Math.round(distance * 10) / 10,
        duration
      },
      schedule: {
        date: createdAt,
        time: `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`,
        departureDateTime: createdAt
      },
      pricing: {
        pricePerSeat,
        totalSeats: seatsTotal,
        availableSeats: seatsAvailable,
        currency: 'INR',
        totalEarnings: pricePerSeat * occupiedSeats
      },
      status: 'COMPLETED',
      tracking: {
        isLive: false,
        startedAt: createdAt,
        completedAt: new Date(createdAt.getTime() + duration * 60000),
        currentLocation: {
          coordinates: endLoc.coords,
          timestamp: new Date(createdAt.getTime() + duration * 60000),
          speed: 0
        },
        breadcrumbs
      },
      carbon: {
        totalEmission: Math.round(distance * 0.12 * 10) / 10,
        perPersonEmission: Math.round(distance * 0.12 / Math.max(occupiedSeats, 1) * 10) / 10,
        carbonSaved: Math.round(distance * 0.08 * (occupiedSeats - 1) * 10) / 10,
        equivalentTrees: Math.round(distance * 0.0005 * 10) / 10
      },
      createdAt,
      startPoint: { type: 'Point', coordinates: startLoc.coords },
      destPoint: { type: 'Point', coordinates: endLoc.coords }
    };
    completedRides.push(ride);
  }

  const insertedCompleted = await Ride.insertMany(completedRides);
  insertedCompleted.forEach(r => createdRideIds.push(r._id));
  console.log(`  ✓ ${insertedCompleted.length} completed rides`);

  // ════════════════════════════════════════════════════
  //  2. ACTIVE / IN_PROGRESS RIDES (15 rides → live drivers, routes, trails)
  // ════════════════════════════════════════════════════
  console.log(' Creating 15 active rides...');
  const activeRides = [];
  for (let i = 0; i < 15; i++) {
    const [startLoc, endLoc] = pickTwo(LOCATIONS);
    const distance = haversineKm(startLoc.coords, endLoc.coords);
    const duration = Math.round(distance * 2.5 + rand(5, 20));
    const seatsTotal = randInt(2, 4);
    const pricePerSeat = Math.round(distance * rand(4, 8));
    const minutesAgo = rand(5, 45); // started within last 45 min
    const startedAt = new Date(now.getTime() - minutesAgo * 60000);
    const geometry = generateGeometry(startLoc.coords, endLoc.coords, randInt(8, 15));
    
    // Current position: partially along the route
    const progress = Math.min(minutesAgo / duration, 0.95);
    const currentIdx = Math.floor(progress * (geometry.length - 1));
    const currentCoords = geometry[currentIdx] || geometry[Math.floor(geometry.length / 2)];
    
    // Breadcrumbs up to current position
    const breadcrumbs = geometry.slice(0, currentIdx + 1).map((coords, j) => ({
      coordinates: coords,
      timestamp: new Date(startedAt.getTime() + (j / currentIdx) * minutesAgo * 60000),
      speed: rand(10, 55)
    }));

    const status = i < 10 ? 'IN_PROGRESS' : 'ACTIVE';
    activeRides.push({
      rider: pick(userIds),
      vehicle: vehicleId,
      route: {
        start: { name: startLoc.name, address: startLoc.address, coordinates: startLoc.coords },
        destination: { name: endLoc.name, address: endLoc.address, coordinates: endLoc.coords },
        geometry: { type: 'LineString', coordinates: geometry },
        distance: Math.round(distance * 10) / 10,
        duration
      },
      schedule: {
        date: startedAt,
        time: `${String(startedAt.getHours()).padStart(2, '0')}:${String(startedAt.getMinutes()).padStart(2, '0')}`,
        departureDateTime: startedAt
      },
      pricing: {
        pricePerSeat,
        totalSeats: seatsTotal,
        availableSeats: randInt(0, seatsTotal - 1),
        currency: 'INR',
        totalEarnings: 0
      },
      status,
      tracking: {
        isLive: status === 'IN_PROGRESS',
        startedAt: status === 'IN_PROGRESS' ? startedAt : undefined,
        currentLocation: {
          coordinates: currentCoords,
          timestamp: now,
          speed: rand(20, 50)
        },
        breadcrumbs
      },
      createdAt: startedAt,
      startPoint: { type: 'Point', coordinates: startLoc.coords },
      destPoint: { type: 'Point', coordinates: endLoc.coords }
    });
  }

  const insertedActive = await Ride.insertMany(activeRides);
  insertedActive.forEach(r => createdRideIds.push(r._id));
  console.log(`  ✓ ${insertedActive.length} active rides`);

  // ════════════════════════════════════════════════════
  //  3. BOOKINGS (80 bookings → pickup/dropoff points, heatmap)
  // ════════════════════════════════════════════════════
  console.log(' Creating 80 bookings...');
  const bookings = [];
  // Assign bookings to both completed and active rides
  const allRides = [...insertedCompleted, ...insertedActive];
  for (let i = 0; i < 80; i++) {
    const ride = pick(allRides);
    const startCoords = ride.route.start.coordinates;
    const endCoords = ride.route.destination.coordinates;
    const pickupCoords = jitter(startCoords);
    const dropoffCoords = jitter(endCoords);
    const seats = randInt(1, 2);
    const price = (ride.pricing.pricePerSeat || 100) * seats;
    const isCompleted = ride.status === 'COMPLETED';
    const refNum = String(10000 + i).slice(1);

    bookings.push({
      bookingReference: `BK-SEED-${refNum}`,
      ride: ride._id,
      passenger: pick(userIds),
      rider: ride.rider,
      pickupPoint: {
        name: ride.route.start.name,
        address: ride.route.start.address,
        coordinates: pickupCoords,
        distanceFromStart: rand(0.1, 0.5)
      },
      dropoffPoint: {
        name: ride.route.destination.name,
        address: ride.route.destination.address,
        coordinates: dropoffCoords,
        distanceFromEnd: rand(0.1, 0.5)
      },
      seatsBooked: seats,
      totalPrice: price,
      status: isCompleted ? 'COMPLETED' : 'CONFIRMED',
      payment: {
        totalAmount: price,
        status: isCompleted ? 'PAID' : 'PENDING'
      },
      createdAt: ride.createdAt
    });
  }

  const insertedBookings = await Booking.insertMany(bookings);
  insertedBookings.forEach(b => createdBookingIds.push(b._id));
  console.log(`  ✓ ${insertedBookings.length} bookings`);

  // Update rides with booking references
  for (const booking of insertedBookings) {
    await Ride.findByIdAndUpdate(booking.ride, { $push: { bookings: booking._id } });
  }

  // ════════════════════════════════════════════════════
  //  4. ROUTE DEVIATIONS (20 → danger zones on map)
  // ════════════════════════════════════════════════════
  console.log(' Creating 20 route deviations...');
  const deviations = [];
  const deviationTypes = ['ROUTE_DEVIATION', 'WRONG_DIRECTION', 'SUSPICIOUS_STOP', 'OFF_ROUTE'];
  
  for (let i = 0; i < 20; i++) {
    const ride = pick(allRides);
    const startCoords = ride.route.start.coordinates;
    const endCoords = ride.route.destination.coordinates;
    // Deviation happened somewhere along but off the route
    const t = rand(0.2, 0.8);
    const onRouteCoords = [
      startCoords[0] + (endCoords[0] - startCoords[0]) * t,
      startCoords[1] + (endCoords[1] - startCoords[1]) * t
    ];
    const deviationCoords = jitter(onRouteCoords, 0.012, 0.008); // larger deviation
    const deviationDist = haversineKm(onRouteCoords, deviationCoords);

    deviations.push({
      ride: ride._id,
      driver: ride.rider,
      passengers: [pick(userIds)],
      deviationType: pick(deviationTypes),
      severity: i < 8 ? 'HIGH' : 'CRITICAL',
      deviationLocation: {
        type: 'Point',
        coordinates: deviationCoords
      },
      expectedLocation: {
        type: 'Point',
        coordinates: onRouteCoords
      },
      deviationDistance: Math.round(deviationDist * 100) / 100,
      duration: randInt(60, 600), // seconds
      status: i < 15 ? 'ACTIVE' : 'ESCALATED',
      metadata: {
        speed: rand(5, 60),
        heading: rand(0, 360)
      },
      createdAt: new Date(now.getTime() - rand(0, 72) * 3600000)
    });
  }

  await RouteDeviation.insertMany(deviations);
  console.log(`  ✓ ${deviations.length} route deviations`);

  // ════════════════════════════════════════════════════
  //  5. EMERGENCIES (5 → SOS pulsing dots)
  // ════════════════════════════════════════════════════
  console.log(' Creating 5 emergencies...');
  const emergencyTypes = ['SOS', 'ACCIDENT', 'MEDICAL', 'SAFETY'];
  const emergencies = [];

  for (let i = 0; i < 5; i++) {
    const loc = pick(LOCATIONS);
    const coords = jitter(loc.coords, 0.005, 0.003);
    emergencies.push({
      user: pick(userIds),
      status: i < 3 ? 'ACTIVE' : 'ACKNOWLEDGED',
      type: pick(emergencyTypes),
      severity: i < 2 ? 'CRITICAL' : 'HIGH',
      location: {
        coordinates: {
          type: 'Point',
          coordinates: coords
        },
        address: loc.address
      },
      description: [
        'Driver not following route, feeling unsafe',
        'Vehicle breakdown on highway, need assistance',
        'Medical emergency - passenger feeling unwell',
        'Suspicious behavior, requesting help immediately',
        'Road accident witnessed, need emergency services'
      ][i] || 'Emergency assistance required',
      adminNotes: i === 0 ? 'High priority — monitoring' : '',
      createdAt: new Date(now.getTime() - rand(0, 4) * 3600000)
    });
  }

  await Emergency.insertMany(emergencies);
  console.log(`  ✓ ${emergencies.length} emergencies`);

  // ════════════════════════════════════════════════════
  //  6. SEARCH LOGS WITH 0 RESULTS (30 → unfulfilled demand)
  // ════════════════════════════════════════════════════
  console.log(' Creating 30 unfulfilled searches...');
  const searches = [];

  for (let i = 0; i < 30; i++) {
    const [originLoc, destLoc] = pickTwo(LOCATIONS);
    searches.push({
      user: pick(userIds),
      searchParams: {
        origin: {
          address: originLoc.address,
          coordinates: originLoc.coords
        },
        destination: {
          address: destLoc.address,
          coordinates: destLoc.coords
        },
        date: new Date(now.getTime() + rand(1, 72) * 3600000),
        seats: randInt(1, 3)
      },
      resultsCount: 0,
      originPoint: { type: 'Point', coordinates: originLoc.coords },
      destPoint: { type: 'Point', coordinates: destLoc.coords },
      createdAt: new Date(now.getTime() - rand(0, 48) * 3600000)
    });
  }

  await SearchLog.insertMany(searches);
  console.log(`  ✓ ${searches.length} unfulfilled searches`);

  // ════════════════════════════════════════════════════
  //  7. ROUTE ALERTS (10 → subscribed corridors)
  // ════════════════════════════════════════════════════
  console.log(' Creating 10 route alerts...');
  const alerts = [];

  for (let i = 0; i < 10; i++) {
    const [originLoc, destLoc] = pickTwo(LOCATIONS);
    alerts.push({
      user: pick(userIds),
      origin: {
        address: originLoc.address,
        coordinates: {
          type: 'Point',
          coordinates: originLoc.coords
        }
      },
      destination: {
        address: destLoc.address,
        coordinates: {
          type: 'Point',
          coordinates: destLoc.coords
        }
      },
      radiusKm: randInt(3, 10),
      schedule: {
        daysOfWeek: [1, 2, 3, 4, 5], // weekdays
        timeRangeStart: '07:00',
        timeRangeEnd: '10:00'
      },
      minSeats: 1,
      maxPricePerSeat: randInt(80, 300),
      active: true,
      triggerCount: randInt(0, 5),
      expiresAt: new Date(now.getTime() + 30 * 24 * 3600000), // 30 days from now
      createdAt: new Date(now.getTime() - rand(1, 168) * 3600000)
    });
  }

  await RouteAlert.insertMany(alerts);
  console.log(`  ✓ ${alerts.length} route alerts`);

  // ════════════════════════════════════════════════════
  //  SUMMARY
  // ════════════════════════════════════════════════════
  console.log('\n BirdEye seed complete!');
  console.log('═══════════════════════════════════');
  console.log(`  Completed rides:    50`);
  console.log(`  Active rides:       15`);
  console.log(`  Bookings:           80`);
  console.log(`  Route deviations:   20`);
  console.log(`  Emergencies:        5`);
  console.log(`  Unfulfilled search: 30`);
  console.log(`  Route alerts:       10`);
  console.log('═══════════════════════════════════\n');
  console.log(' All BirdEyeView layers now populated with Chennai data.');
  console.log(' Restart the server and navigate to BirdEye View to see the visualization.');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
