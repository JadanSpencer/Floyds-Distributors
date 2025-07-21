import { 
    app, db, auth, 
    collection, getDocs, doc, getDoc, setDoc, 
    updateDoc, deleteDoc, serverTimestamp, query, 
    where, orderBy, limit, onSnapshot, addDoc,
    signOut, onAuthStateChanged, getCurrentPosition
} from './script.js';

console.log("Driver module loaded");

// DOM Elements
const driverName = document.getElementById('driverName');
const driverEmail = document.getElementById('driverEmail');
const driverAvatar = document.getElementById('driverAvatar');
const lastUpdated = document.getElementById('lastUpdated');
const pendingDeliveries = document.getElementById('pendingDeliveries');
const completedDeliveries = document.getElementById('completedDeliveries');
const avgDeliveryTime = document.getElementById('avgDeliveryTime');
const driverRating = document.getElementById('driverRating');
const recentActivity = document.getElementById('recentActivity');
const deliveriesTableBody = document.getElementById('deliveriesTableBody');
const historyTableBody = document.getElementById('historyTableBody');
const totalDeliveries = document.getElementById('totalDeliveries');
const onTimeRate = document.getElementById('onTimeRate');
const totalMiles = document.getElementById('totalMiles');
const logoutBtn = document.getElementById('logoutBtn');
const addDeliveryBtn = document.getElementById('addDeliveryBtn');
const deliveryForm = document.getElementById('deliveryForm');
const deliveryModal = document.getElementById('deliveryModal');
const deliveryModalOverlay = document.getElementById('deliveryModalOverlay');
const closeDeliveryModal = document.getElementById('closeDeliveryModal');
const cancelDeliveryBtn = document.getElementById('cancelDeliveryBtn');
const deliveryDetailsModal = document.getElementById('deliveryDetailsModal');
const deliveryDetailsOverlay = document.getElementById('deliveryDetailsOverlay');
const closeDetailsModal = document.getElementById('closeDetailsModal');
const startDeliveryBtn = document.getElementById('startDeliveryBtn');
const completeDeliveryBtn = document.getElementById('completeDeliveryBtn');
const cancelDeliveryBtnDetails = document.getElementById('cancelDeliveryBtn');
const refreshMapBtn = document.getElementById('refreshMapBtn');
const centerMapBtn = document.getElementById('centerMapBtn');
const showAllDeliveriesBtn = document.getElementById('showAllDeliveriesBtn');
const deliveryFilter = document.getElementById('deliveryFilter');
const deliverySearch = document.getElementById('deliverySearch');
const historyDateFrom = document.getElementById('historyDateFrom');
const historyDateTo = document.getElementById('historyDateTo');
const toastContainer = document.getElementById('toastContainer');

// Form inputs
const customerNameInput = document.getElementById('customerName');
const customerPhoneInput = document.getElementById('customerPhone');
const deliveryAddressInput = document.getElementById('deliveryAddress');
const deliveryNotesInput = document.getElementById('deliveryNotes');
const gpsCoordinatesInput = document.getElementById('gpsCoordinates');
const mapPreview = document.getElementById('mapPreview');

// Map variables
let map;
let marker;
let routeControl;
let currentDriverId;
let currentLocation = null;
let deliveries = [];
let selectedDelivery = null;

async function initializeDriverPortal() {
    console.log("Driver portal initialization started");
    
    try {
        // Check authentication
        const user = auth.currentUser;
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Check if user is a driver
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'driver') {
            window.location.href = 'index.html';
            return;
        }

        currentDriverId = user.uid;
        
        // Load driver info
        loadDriverInfo(user, userDoc.data());
        
        // Initialize navigation
        setupNavigation();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        loadDashboardStats();
        loadDeliveries();
        loadDeliveryHistory();
        
        // Set current date for history filters
        const today = new Date().toISOString().split('T')[0];
        historyDateFrom.value = today;
        historyDateTo.value = today;
        
    } catch (error) {
        console.error("Initialization error:", error);
        showToast('error', 'Failed to initialize driver portal');
    }
}

initializeDriverPortal();

function loadDriverInfo(user, userData) {
    console.log("Loading driver info");
    driverName.textContent = userData.name || user.displayName || 'Driver';
    driverEmail.textContent = user.email;
    
    // Set avatar initials
    const nameParts = (userData.name || user.displayName || 'Driver').split(' ');
    const initials = nameParts.map(part => part[0]).join('').toUpperCase();
    driverAvatar.textContent = initials;
    
    // Update last updated time
    updateLastUpdated();
}

function updateLastUpdated() {
    const now = new Date();
    lastUpdated.textContent = now.toLocaleTimeString();
}

function setupNavigation() {
    console.log("Setting up navigation");
    const navLinks = document.querySelectorAll('.driver-nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Show selected section
            const sectionId = link.dataset.section + '-section';
            const section = document.getElementById(sectionId);
            section.classList.add('active');
            
            // Initialize map if this is the map section
            if (sectionId === 'map-section') {
                initMap('map');
            }
        });
    });
}

function setupEventListeners() {
    console.log("Setting up event listeners");

    document.getElementById('useCurrentLocationBtn').addEventListener('click', useCurrentLocation);
    gpsCoordinatesInput.addEventListener('change', updateMapFromCoordinates);
    
    // Logout button
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Logout error:", error);
            showToast('error', 'Failed to logout');
        }
    });
    
    // Add delivery button
    addDeliveryBtn.addEventListener('click', () => {
        showModal(deliveryModal, deliveryModalOverlay);
        initMap('mapPreview');
    });
    
    // Modal close buttons
    closeDeliveryModal.addEventListener('click', () => hideModal(deliveryModal, deliveryModalOverlay));
    cancelDeliveryBtn.addEventListener('click', () => hideModal(deliveryModal, deliveryModalOverlay));
    closeDetailsModal.addEventListener('click', () => hideModal(deliveryDetailsModal, deliveryDetailsOverlay));
    deliveryModalOverlay.addEventListener('click', () => hideModal(deliveryModal, deliveryModalOverlay));
    deliveryDetailsOverlay.addEventListener('click', () => hideModal(deliveryDetailsModal, deliveryDetailsOverlay));
    
    // Delivery form submission
    deliveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveDelivery();
    });
    
    // Map controls
    refreshMapBtn.addEventListener('click', refreshMap);
    centerMapBtn.addEventListener('click', centerMap);
    showAllDeliveriesBtn.addEventListener('click', showAllDeliveriesOnMap);
    
    // Delivery actions
    startDeliveryBtn.addEventListener('click', startDelivery);
    completeDeliveryBtn.addEventListener('click', completeDelivery);
    cancelDeliveryBtnDetails.addEventListener('click', cancelDelivery);
    
    // Filters and search
    deliveryFilter.addEventListener('change', filterDeliveries);
    deliverySearch.addEventListener('input', searchDeliveries);
    historyDateFrom.addEventListener('change', loadDeliveryHistory);
    historyDateTo.addEventListener('change', loadDeliveryHistory);
}

function showModal(modal, overlay) {
    modal.classList.add('show');
    overlay.classList.add('show');
}

function hideModal(modal, overlay) {
    modal.classList.remove('show');
    overlay.classList.remove('show');
}

async function loadDashboardStats() {
    console.log("Loading dashboard stats");
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get pending deliveries count
        const pendingQuery = query(
            collection(db, "deliveries"),
            where("driverId", "==", currentDriverId),
            where("status", "==", "pending"),
            where("createdAt", ">=", today)
        );
        const pendingSnapshot = await getDocs(pendingQuery);
        pendingDeliveries.textContent = pendingSnapshot.size;
        
        // Get completed deliveries count
        const completedQuery = query(
            collection(db, "deliveries"),
            where("driverId", "==", currentDriverId),
            where("status", "==", "completed"),
            where("completedAt", ">=", today)
        );
        const completedSnapshot = await getDocs(completedQuery);
        completedDeliveries.textContent = completedSnapshot.size;
        
        // Calculate average delivery time (mock data for now)
        avgDeliveryTime.textContent = "32m";
        
        // Load recent activity
        loadRecentActivity();
        
    } catch (error) {
        console.error("Error loading dashboard stats:", error);
        showToast('error', 'Failed to load dashboard stats');
    }
}

async function loadRecentActivity() {
    console.log("Loading recent activity");
    try {
        const activityQuery = query(
            collection(db, "activities"),
            where("userId", "==", currentDriverId),
            orderBy("timestamp", "desc"),
            limit(5)
        );
        
        const unsubscribe = onSnapshot(activityQuery, (snapshot) => {
            recentActivity.innerHTML = '';
            
            if (snapshot.empty) {
                recentActivity.innerHTML = '<div class="empty-state">No recent notifications</div>';
                return;
            }
            
            snapshot.forEach(doc => {
                const activity = doc.data();
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                activityItem.innerHTML = `
                    <div class="activity-icon">
                        <i class="fas fa-${activity.icon || 'bell'}"></i>
                    </div>
                    <div class="activity-content">
                        <p>${activity.message}</p>
                        <span class="activity-time">${new Date(activity.timestamp?.toDate()).toLocaleTimeString()}</span>
                    </div>
                `;
                recentActivity.appendChild(activityItem);
            });
        });
        
        return unsubscribe;
    } catch (error) {
        console.error("Error loading recent activity:", error);
        recentActivity.innerHTML = '<div class="empty-state">Error loading activity</div>';
    }
}

async function loadDeliveries() {
    console.log("Loading deliveries");
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const deliveriesQuery = query(
            collection(db, "deliveries"),
            where("driverId", "==", currentDriverId),
            where("createdAt", ">=", today),
            orderBy("createdAt", "desc")
        );
        
        const unsubscribe = onSnapshot(deliveriesQuery, (snapshot) => {
            deliveries = [];
            deliveriesTableBody.innerHTML = '';
            
            if (snapshot.empty) {
                deliveriesTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No deliveries scheduled for today</td></tr>';
                return;
            }
            
            snapshot.forEach(doc => {
                const delivery = {
                    id: doc.id,
                    ...doc.data()
                };
                deliveries.push(delivery);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${delivery.customerName}</td>
                    <td>${delivery.deliveryAddress}</td>
                    <td>${delivery.createdAt?.toDate().toLocaleTimeString() || 'N/A'}</td>
                    <td><span class="status-badge status-${delivery.status}">${delivery.status}</span></td>
                    <td class="actions">
                        <button class="action-btn view-btn" data-id="${doc.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn delete-btn" data-id="${doc.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                // Add click event to view button
                row.querySelector('.view-btn').addEventListener('click', () => viewDeliveryDetails(delivery));
                
                // Add click event to delete button
                row.querySelector('.delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete delivery to ${delivery.customerName}?`)) {
                        deleteDelivery(doc.id);
                    }
                });
                
                deliveriesTableBody.appendChild(row);
            });
            
            // Update dashboard stats
            updateDeliveryCounts();
            
            // If map is active, update deliveries on map
            if (document.getElementById('map-section').classList.contains('active')) {
                showAllDeliveriesOnMap();
            }
        });
        
        return unsubscribe;
    } catch (error) {
        console.error("Error loading deliveries:", error);
        deliveriesTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Error loading deliveries</td></tr>';
        showToast('error', 'Failed to load deliveries');
    }
}

function updateDeliveryCounts() {
    const pendingCount = deliveries.filter(d => d.status === 'pending').length;
    const completedCount = deliveries.filter(d => d.status === 'completed').length;
    
    pendingDeliveries.textContent = pendingCount;
    completedDeliveries.textContent = completedCount;
}

async function loadDeliveryHistory() {
    console.log("Loading delivery history");
    try {
        const fromDate = new Date(historyDateFrom.value);
        const toDate = new Date(historyDateTo.value);
        toDate.setHours(23, 59, 59, 999);
        
        const historyQuery = query(
            collection(db, "deliveries"),
            where("driverId", "==", currentDriverId),
            where("completedAt", ">=", fromDate),
            where("completedAt", "<=", toDate),
            orderBy("completedAt", "desc")
        );
        
        const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
            historyTableBody.innerHTML = '';
            let total = 0;
            let onTime = 0;
            
            if (snapshot.empty) {
                historyTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No deliveries found for selected period</td></tr>';
                totalDeliveries.textContent = '0';
                onTimeRate.textContent = '0%';
                totalMiles.textContent = '0';
                return;
            }
            
            snapshot.forEach(doc => {
                const delivery = doc.data();
                total++;
                
                // Mock on-time calculation (would compare to estimated time in real app)
                if (Math.random() > 0.3) onTime++;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${delivery.completedAt?.toDate().toLocaleDateString() || 'N/A'}</td>
                    <td>${delivery.customerName}</td>
                    <td>${delivery.deliveryAddress}</td>
                    <td><span class="status-badge status-${delivery.status}">${delivery.status}</span></td>
                    <td>${Math.floor(Math.random() * 60) + 10} mins</td>
                `;
                historyTableBody.appendChild(row);
            });
            
            // Update stats
            totalDeliveries.textContent = total;
            onTimeRate.textContent = `${Math.round((onTime / total) * 100)}%`;
            totalMiles.textContent = (total * 5.3).toFixed(1); // Mock mileage calculation
        });
        
        return unsubscribe;
    } catch (error) {
        console.error("Error loading delivery history:", error);
        historyTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Error loading history</td></tr>';
        showToast('error', 'Failed to load delivery history');
    }
}

async function saveDelivery() {
    console.log("Saving delivery");
    try {
        const submitBtn = deliveryForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        // Validate coordinates
        if (!gpsCoordinatesInput.value) {
            throw new Error('Please set a delivery location');
        }
        
        const [latStr, lngStr] = gpsCoordinatesInput.value.split(',');
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        
        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('Invalid coordinates format. Use "latitude,longitude"');
        }
        
        const deliveryData = {
            driverId: currentDriverId,
            customerName: customerNameInput.value.trim(),
            customerPhone: customerPhoneInput.value.trim(),
            deliveryAddress: deliveryAddressInput.value.trim(),
            gpsCoordinates: `${lat},${lng}`,
            notes: deliveryNotesInput.value.trim() || null,
            status: 'pending',
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, "deliveries"), deliveryData);
        
        showToast('success', 'Delivery added successfully');
        hideModal(deliveryModal, deliveryModalOverlay);
        deliveryForm.reset();
        
    } catch (error) {
        console.error("Error saving delivery:", error);
        showToast('error', error.message || 'Failed to save delivery');
    } finally {
        const submitBtn = deliveryForm.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Delivery';
    }
}

function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = `${position.coords.latitude},${position.coords.longitude}`;
                gpsCoordinatesInput.value = coords;
                updateMapFromCoordinates();
                showToast('success', 'Current location set');
            },
            (error) => {
                console.error("Geolocation error:", error);
                showToast('error', 'Could not get current location');
            }
        );
    } else {
        showToast('warning', 'Geolocation not supported by your browser');
    }
}

function updateMapFromCoordinates() {
    const coords = gpsCoordinatesInput.value.trim();
    if (!coords) return;
    
    const [latStr, lngStr] = coords.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    
    if (isNaN(lat) || isNaN(lng)) {
        showToast('error', 'Invalid coordinates format. Use "latitude,longitude"');
        return;
    }
    
    const previewMap = document.getElementById('mapPreview')._leaflet_map;
    if (!previewMap) return;
    
    const location = L.latLng(lat, lng);
    previewMap.setView(location, 15);
    
    if (marker) previewMap.removeLayer(marker);
    marker = L.marker(location).addTo(previewMap)
        .bindPopup('Delivery Location')
        .openPopup();
}

// Modify the initMap function for the preview map
if (mapElementId === 'mapPreview') {
    const previewMap = newMap;
    previewMap.setView([51.505, -0.09], 13); // Default view for preview
    
    // Add click handler to set delivery location
    previewMap.on('click', (e) => {
        if (marker) previewMap.removeLayer(marker);
        marker = L.marker(e.latlng).addTo(previewMap)
            .bindPopup('Delivery Location')
            .openPopup();
        
        gpsCoordinatesInput.value = `${e.latlng.lat},${e.latlng.lng}`;
    });
    
    // If coordinates already exist when opening modal, show them
    if (gpsCoordinatesInput.value) {
        updateMapFromCoordinates();
    }
}

function viewDeliveryDetails(delivery) {
    console.log("Viewing delivery details:", delivery.id);
    selectedDelivery = delivery;
    
    // Populate details
    document.getElementById('detailCustomerName').textContent = delivery.customerName;
    document.getElementById('detailAddress').textContent = delivery.deliveryAddress;
    document.getElementById('detailPhone').textContent = delivery.customerPhone || 'N/A';
    document.getElementById('detailStatus').textContent = delivery.status;
    document.getElementById('detailNotes').textContent = delivery.notes || 'None';
    
    // Set button states based on status
    startDeliveryBtn.style.display = delivery.status === 'pending' ? 'block' : 'none';
    completeDeliveryBtn.style.display = delivery.status === 'in-progress' ? 'block' : 'none';
    
    showModal(deliveryDetailsModal, deliveryDetailsOverlay);
    
    // Initialize map for this delivery
    initMap('deliveryMap');
    
    if (delivery.gpsCoordinates) {
        const [lat, lng] = delivery.gpsCoordinates.split(',').map(Number);
        const deliveryLocation = L.latLng(lat, lng);
        
        // Center map on delivery location
        map.setView(deliveryLocation, 15);
        
        // Add marker for delivery location
        if (marker) map.removeLayer(marker);
        marker = L.marker(deliveryLocation).addTo(map)
            .bindPopup(`Delivery to ${delivery.customerName}`)
            .openPopup();
        
        // Add route if we have current location
        if (currentLocation) {
            showRoute(currentLocation, deliveryLocation);
        }
    }
}

async function startDelivery() {
    if (!selectedDelivery) return;
    
    try {
        await updateDoc(doc(db, "deliveries", selectedDelivery.id), {
            status: 'in-progress',
            startedAt: serverTimestamp()
        });
        
        showToast('success', 'Delivery started');
        hideModal(deliveryDetailsModal, deliveryDetailsOverlay);
    } catch (error) {
        console.error("Error starting delivery:", error);
        showToast('error', 'Failed to start delivery');
    }
}

async function completeDelivery() {
    if (!selectedDelivery) return;
    
    try {
        await updateDoc(doc(db, "deliveries", selectedDelivery.id), {
            status: 'completed',
            completedAt: serverTimestamp()
        });
        
        showToast('success', 'Delivery completed');
        hideModal(deliveryDetailsModal, deliveryDetailsOverlay);
    } catch (error) {
        console.error("Error completing delivery:", error);
        showToast('error', 'Failed to complete delivery');
    }
}

async function cancelDelivery() {
    if (!selectedDelivery) return;
    
    if (!confirm(`Cancel delivery to ${selectedDelivery.customerName}?`)) return;
    
    try {
        await updateDoc(doc(db, "deliveries", selectedDelivery.id), {
            status: 'cancelled',
            cancelledAt: serverTimestamp()
        });
        
        showToast('success', 'Delivery cancelled');
        hideModal(deliveryDetailsModal, deliveryDetailsOverlay);
    } catch (error) {
        console.error("Error cancelling delivery:", error);
        showToast('error', 'Failed to cancel delivery');
    }
}

async function deleteDelivery(deliveryId) {
    try {
        await deleteDoc(doc(db, "deliveries", deliveryId));
        showToast('success', 'Delivery deleted');
    } catch (error) {
        console.error("Error deleting delivery:", error);
        showToast('error', 'Failed to delete delivery');
    }
}

function filterDeliveries() {
    const status = deliveryFilter.value;
    const rows = deliveriesTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        if (row.classList.contains('empty-state')) return;
        
        const statusBadge = row.querySelector('.status-badge');
        const rowStatus = statusBadge ? statusBadge.textContent.toLowerCase() : '';
        
        if (status === 'all' || rowStatus === status) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function searchDeliveries() {
    const searchTerm = deliverySearch.value.toLowerCase();
    const rows = deliveriesTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        if (row.classList.contains('empty-state')) return;
        
        const customerName = row.cells[0].textContent.toLowerCase();
        const address = row.cells[1].textContent.toLowerCase();
        
        if (customerName.includes(searchTerm) || address.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function initMap(mapElementId = 'map') {
    console.log("Initializing map:", mapElementId);
    
    // If map already exists for this element, remove it first
    const mapElement = document.getElementById(mapElementId);
    if (mapElement._leaflet_map) {
        mapElement._leaflet_map.remove();
    }
    
    // Create new map instance with default view (will be updated with geolocation)
    const newMap = L.map(mapElementId, {
        zoomControl: false, // We'll add our own
        doubleClickZoom: false,
        scrollWheelZoom: true,
        touchZoom: true,
        dragging: true
    }).setView([0, 0], 2); // Default view (will be updated)

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(newMap);

    // Add zoom control with custom position
    L.control.zoom({
        position: 'topright'
    }).addTo(newMap);

    // For the main map or delivery details map
    if (mapElementId === 'map' || mapElementId === 'deliveryMap') {
        map = newMap;
        
        // Try to get current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    currentLocation = L.latLng(position.coords.latitude, position.coords.longitude);
                    map.setView(currentLocation, 15);
                    
                    // Add marker for current location with custom icon
                    const driverIcon = L.divIcon({
                        className: 'driver-location-icon',
                        html: '<i class="fas fa-truck"></i>',
                        iconSize: [30, 30]
                    });
                    
                    L.marker(currentLocation, {
                        icon: driverIcon,
                        zIndexOffset: 1000
                    }).addTo(map)
                    .bindPopup('Your Location')
                    .openPopup();
                    
                    // If showing delivery details, show route
                    if (selectedDelivery && selectedDelivery.gpsCoordinates) {
                        const [lat, lng] = selectedDelivery.gpsCoordinates.split(',').map(Number);
                        const deliveryLocation = L.latLng(lat, lng);
                        showRoute(currentLocation, deliveryLocation);
                    }
                    
                    // If this is the main map, show all deliveries
                    if (mapElementId === 'map') {
                        showAllDeliveriesOnMap();
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    showToast('warning', 'Could not get your current location');
                    // Fallback to a reasonable default location
                    const defaultLocation = L.latLng(51.505, -0.09);
                    map.setView(defaultLocation, 13);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            // Geolocation not supported
            showToast('warning', 'Geolocation is not supported by your browser');
            const defaultLocation = L.latLng(51.505, -0.09);
            map.setView(defaultLocation, 13);
        }
    }
    
    // For the preview map in add delivery modal
    if (mapElementId === 'mapPreview') {
        const previewMap = newMap;
        previewMap.setView([51.505, -0.09], 13); // Default view for preview
        
        // Add click handler to set delivery location
        previewMap.on('click', (e) => {
            if (marker) previewMap.removeLayer(marker);
            marker = L.marker(e.latlng).addTo(previewMap)
                .bindPopup('Delivery Location')
                .openPopup();
            
            gpsCoordinatesInput.value = `${e.latlng.lat},${e.latlng.lng}`;
        });
    }
    
    return newMap;
}

function refreshMap() {
    if (!map) return;
    
    // Invalidate size to fix any container sizing issues
    map.invalidateSize(true);
    
    // Try to re-center on current location if available
    if (currentLocation) {
        map.setView(currentLocation, map.getZoom());
        showToast('success', 'Map refreshed and recentered');
    } else {
        // If no current location, try to get it again
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    currentLocation = L.latLng(position.coords.latitude, position.coords.longitude);
                    map.setView(currentLocation, 15);
                    showToast('success', 'Map refreshed with your current location');
                },
                (error) => {
                    console.error("Geolocation error on refresh:", error);
                    showToast('warning', 'Could not refresh location');
                }
            );
        }
    }
    
    // Re-show all deliveries if this is the main map
    if (document.getElementById('map-section').classList.contains('active')) {
        showAllDeliveriesOnMap();
    }
}


function centerMap() {
    if (!map) return;
    
    if (currentLocation) {
        map.setView(currentLocation, 15);
        showToast('success', 'Centered on your location');
    } else {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    currentLocation = L.latLng(position.coords.latitude, position.coords.longitude);
                    map.setView(currentLocation, 15);
                    showToast('success', 'Centered on your location');
                },
                (error) => {
                    console.error("Geolocation error on center:", error);
                    showToast('error', 'Could not get your location');
                }
            );
        } else {
            showToast('warning', 'Geolocation is not supported');
        }
    }
}

function showAllDeliveriesOnMap() {
    if (!map) return;
    
    // Clear existing markers and routes
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Routing.Control) {
            map.removeLayer(layer);
        }
    });
    
    // Add markers for all deliveries with status-based icons
    deliveries.forEach(delivery => {
        if (delivery.gpsCoordinates) {
            const [lat, lng] = delivery.gpsCoordinates.split(',').map(Number);
            const deliveryLocation = L.latLng(lat, lng);
            
            // Create custom icon based on status
            let icon;
            if (delivery.status === 'completed') {
                icon = L.divIcon({
                    className: 'delivery-icon completed',
                    html: '<i class="fas fa-check-circle"></i>',
                    iconSize: [30, 30]
                });
            } else if (delivery.status === 'in-progress') {
                icon = L.divIcon({
                    className: 'delivery-icon in-progress',
                    html: '<i class="fas fa-truck-moving"></i>',
                    iconSize: [30, 30]
                });
            } else { // pending
                icon = L.divIcon({
                    className: 'delivery-icon pending',
                    html: '<i class="fas fa-clock"></i>',
                    iconSize: [30, 30]
                });
            }
            
            const deliveryMarker = L.marker(deliveryLocation, { icon }).addTo(map)
                .bindPopup(`<b>${delivery.customerName}</b><br>${delivery.deliveryAddress}<br>Status: ${delivery.status}`);
            
            // Add click handler to view details
            deliveryMarker.on('click', () => {
                viewDeliveryDetails(delivery);
            });
        }
    });
    
    // If we have current location, show all routes to pending deliveries
    if (currentLocation) {
        deliveries.forEach(delivery => {
            if (delivery.gpsCoordinates && delivery.status === 'pending') {
                const [lat, lng] = delivery.gpsCoordinates.split(',').map(Number);
                const deliveryLocation = L.latLng(lat, lng);
                showRoute(currentLocation, deliveryLocation);
            }
        });
    }
    
    // Fit map to show all markers if we have any
    const deliveryLocations = deliveries
        .filter(d => d.gpsCoordinates)
        .map(d => {
            const [lat, lng] = d.gpsCoordinates.split(',').map(Number);
            return L.latLng(lat, lng);
        });
    
    if (deliveryLocations.length > 0) {
        const bounds = L.latLngBounds(deliveryLocations);
        
        if (currentLocation) {
            bounds.extend(currentLocation);
        }
        
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}


function showRoute(start, end) {
    if (routeControl) {
        map.removeControl(routeControl);
    }
    
    routeControl = L.Routing.control({
        waypoints: [start, end],
        routeWhileDragging: false,
        showAlternatives: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        lineOptions: {
            styles: [{ 
                color: '#008080', 
                opacity: 0.8, 
                weight: 5,
                dashArray: '10, 10'
            }]
        },
        createMarker: function() { return null; } // Don't add default markers
    }).addTo(map);
    
    routeControl.on('routesfound', function(e) {
        const routes = e.routes;
        if (routes && routes.length > 0) {
            const route = routes[0];
            const distance = (route.summary.totalDistance / 1000).toFixed(1); // km
            const time = (route.summary.totalTime / 60).toFixed(0); // minutes
            
            // Add popup with route info to the destination marker
            const markers = document.querySelectorAll('.leaflet-marker-icon');
            if (markers.length > 1) {
                const destinationMarker = markers[markers.length - 1];
                L.popup()
                    .setLatLng(end)
                    .setContent(`Distance: ${distance} km<br>Estimated time: ${time} mins`)
                    .openOn(map);
            }
        }
    });
}

function showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${getToastIcon(type)}"></i>
        <span>${message}</span>
        <button class="toast-close">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    });
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': return 'fa-info-circle';
        default: return 'fa-info-circle';
    }
}