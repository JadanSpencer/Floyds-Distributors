import { 
    app, db, auth, 
    collection, getDocs, doc, getDoc, setDoc, 
    updateDoc, deleteDoc, serverTimestamp, query, 
    where, orderBy, limit, onSnapshot, addDoc,
    signOut, onAuthStateChanged, getCurrentPosition,
    getDeliveryStatusBadgeClass
} from './script.js';


// Add to imports at top of driver.js
import { GeoPoint } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

console.log("Driver module loaded");

const OPENROUTE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU4OTBiNGUwYTZkYjQwZTU4YjY2ZjhkZGQxZjNkNTliIiwiaCI6Im11cm11cjY0In0=';
const routeCache = {};

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
let currentRoute = null;
let positionWatchId = null;
let routeCalculationInProgress = false;

async function initializeDriverPortal() {
    console.log("Driver portal initialization started");
    
    try {
        // Wait for authentication state
        const user = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Authentication timeout')), 10000);
            
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                clearTimeout(timeout);
                unsubscribe();
                if (user) {
                    resolve(user);
                } else {
                    reject(new Error('User not authenticated'));
                }
            });
        });

        console.log("Authenticated user:", user.uid);
        
        // Check if user document exists
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            throw new Error('User profile not found');
        }
        
        const userRole = userDoc.data().role;
        const isAdminAccess = sessionStorage.getItem('adminAccessingDriverPortal') === 'true';
        sessionStorage.removeItem('adminAccessingDriverPortal');
        
        if (userRole !== 'driver' && !isAdminAccess) {
            throw new Error('Driver access only');
        }

        currentDriverId = user.uid;
        
        // Load UI components
        if (!isAdminAccess) {
            loadDriverInfo(user, userDoc.data());
        } else {
            document.getElementById('driverName').textContent = "Admin View";
            document.getElementById('driverEmail').textContent = "Admin Mode";
            document.getElementById('driverAvatar').textContent = "A";
        }
        
        setupNavigation();
        setupEventListeners();
        
        // Initialize data loading
        await Promise.all([
            loadDashboardStats(),
            loadDeliveries(),
            loadDeliveryHistory()
        ]);
        
        // Set current date for history filters
        const today = new Date().toISOString().split('T')[0];
        if (historyDateFrom) historyDateFrom.value = today;
        if (historyDateTo) historyDateTo.value = today;
        
        console.log("Driver portal initialization completed successfully");
        
    } catch (error) {
        console.error("Initialization error:", error);
        
        let errorMessage = 'Failed to initialize driver portal';
        if (error.message.includes('permission-denied')) {
            errorMessage = 'Access denied. Please contact administrator.';
        } else if (error.message.includes('Authentication timeout')) {
            errorMessage = 'Authentication failed. Please login again.';
        } else if (error.message.includes('Driver access only')) {
            errorMessage = 'You do not have driver permissions.';
        }
        
        showToast('error', errorMessage);
        
        // Redirect to login after showing error
        setTimeout(() => {
            window.location.href = user ? 'index.html' : 'login.html';
        }, 3000);
    }
}

window.addEventListener('beforeunload', () => {
    // Clean up all listeners
    if (window.driverDeliveriesUnsubscribe) {
        window.driverDeliveriesUnsubscribe();
    }
    if (window.deliveriesUnsubscribe) {
        window.deliveriesUnsubscribe();
    }
    
    // Stop position tracking
    stopPositionTracking();
    
    // Clear session storage
    sessionStorage.removeItem('adminAccessingDriverPortal');
});

initializeDriverPortal();

function validateCoordinates(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) && 
           Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

async function setupRealtimeListeners() {
    console.log("Setting up realtime listeners for driver:", currentDriverId);
    
    if (!currentDriverId) {
        console.error("No driver ID available for listeners");
        throw new Error("Driver ID not set");
    }

    try {
        // Test if we can access deliveries first
        const testQuery = query(
            collection(db, "deliveries"),
            where("driverId", "==", currentDriverId),
            limit(1)
        );
        
        // Try to get one document to test permissions
        await getDocs(testQuery);
        console.log("Delivery access confirmed");
        
        // Set up the real listener
        const deliveriesQuery = query(
            collection(db, "deliveries"),
            where("driverId", "==", currentDriverId),
            orderBy("createdAt", "desc")
        );
        
        const unsubscribe = onSnapshot(
            deliveriesQuery,
            (snapshot) => {
                console.log("Deliveries snapshot received, count:", snapshot.size);
                deliveries = [];
                snapshot.forEach(doc => {
                    deliveries.push({ id: doc.id, ...doc.data() });
                });
                updateDeliveryCounts();
                renderDeliveriesTable();
            },
            (error) => {
                console.error("Delivery listener error:", error);
                if (error.code === 'permission-denied') {
                    showToast('error', 'Permission denied accessing deliveries');
                } else {
                    showToast('error', 'Failed to load deliveries: ' + error.message);
                }
            }
        );
        
        // Store unsubscribe function for cleanup
        window.deliveriesUnsubscribe = unsubscribe;
        
        return unsubscribe;
        
    } catch (error) {
        console.error("Failed to set up delivery listeners:", error);
        if (error.code === 'permission-denied') {
            throw new Error('You do not have permission to access delivery data');
        }
        throw error;
    }
}

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
                startPositionTracking();
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
    
    // Clean up map if this is the delivery details modal
    if (modal.id === 'deliveryDetailsModal') {
        const mapElement = document.getElementById('deliveryMap');
        if (mapElement._leaflet_map) {
            mapElement._leaflet_map.remove();
            delete mapElement._leaflet_map;
        }
        
        // Clear any remaining Leaflet references
        for (const id in L.Map._instances) {
            if (L.Map._instances[id]._container.id === 'deliveryMap') {
                L.Map._instances[id].remove();
                delete L.Map._instances[id];
                break;
            }
        }
        
        // Clear the container
        mapElement.innerHTML = '';
    }
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
    
    const completedQuery = query(
      collection(db, "deliveries"),
      where("driverId", "==", currentDriverId),
      where("status", "==", "completed"),
      where("completedAt", ">=", today)
    );

    const [pendingSnapshot, completedSnapshot] = await Promise.all([
      getDocs(pendingQuery),
      getDocs(completedQuery)
    ]);

    pendingDeliveries.textContent = pendingSnapshot.size;
    completedDeliveries.textContent = completedSnapshot.size;
    avgDeliveryTime.textContent = "32m"; // Consider calculating this from actual data
    
  } catch (error) {
    console.error("Error loading dashboard stats:", error);
    let errorMessage = 'Failed to load dashboard stats';
    if (error.code === 'permission-denied') {
      errorMessage = 'You do not have permission to view delivery data';
    }
    showToast('error', errorMessage);
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
/**
 * Loads and manages real-time updates of deliveries for the current driver
 * @returns {function} Unsubscribe function to stop listening to updates
 */
// In driver.js, update the loadDeliveries function
async function loadDeliveries() {
    console.log("Loading deliveries for driver:", currentDriverId);
    
    if (!currentDriverId) {
        console.error("No driver ID available for loading deliveries");
        showToast('error', 'Driver ID not available');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Not authenticated');
        }

        console.log("Setting up deliveries query for driver:", currentDriverId);
        
        const deliveriesQuery = query(
            collection(db, "deliveries"),
            where("driverId", "==", currentDriverId),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
            deliveriesQuery,
            (snapshot) => {
                console.log("Deliveries snapshot received, count:", snapshot.size);
                deliveries = [];
                
                snapshot.forEach(doc => {
                    const deliveryData = doc.data();
                    
                    // Handle different GPS coordinate formats
                    let gpsCoordinates = null;
                    if (deliveryData.gpsCoordinates) {
                        if (deliveryData.gpsCoordinates.latitude && deliveryData.gpsCoordinates.longitude) {
                            // Firestore GeoPoint format
                            gpsCoordinates = `${deliveryData.gpsCoordinates.latitude},${deliveryData.gpsCoordinates.longitude}`;
                        } else if (typeof deliveryData.gpsCoordinates === 'string') {
                            // String format
                            gpsCoordinates = deliveryData.gpsCoordinates;
                        }
                    }
                    
                    deliveries.push({ 
                        id: doc.id, 
                        ...deliveryData,
                        gpsCoordinates: gpsCoordinates
                    });
                });
                
                console.log("Processed deliveries:", deliveries.length);
                updateDeliveryCounts();
                renderDeliveriesTable();
            },
            (error) => {
                console.error("Delivery listener error:", error);
                let errorMessage = 'Failed to load deliveries';
                
                if (error.code === 'permission-denied') {
                    errorMessage = 'Permission denied. Contact administrator.';
                } else if (error.code === 'failed-precondition') {
                    errorMessage = 'Database index required. Contact administrator.';
                }
                
                showToast('error', errorMessage);
                
                // Show error in table
                if (deliveriesTableBody) {
                    deliveriesTableBody.innerHTML = `
                        <tr>
                            <td colspan="5" class="empty-state">
                                ${errorMessage}
                            </td>
                        </tr>
                    `;
                }
            }
        );

        // Store unsubscribe function for cleanup
        window.driverDeliveriesUnsubscribe = unsubscribe;
        return unsubscribe;
        
    } catch (error) {
        console.error("Initial delivery load error:", error);
        showToast('error', 'Failed to initialize delivery system');
        return () => {};
    }
}

// Add this function to handle admin editing deliveries
async function editDeliveryAsAdmin(deliveryId) {
    try {
        const deliveryDoc = await getDoc(doc(db, "deliveries", deliveryId));
        if (!deliveryDoc.exists()) {
            showToast("Delivery not found", "error");
            return;
        }
        
        const delivery = deliveryDoc.data();
        const driversQuery = query(collection(db, "users"), where("role", "==", "driver"));
        const driversSnapshot = await getDocs(driversQuery);
        
        const modalContent = `
            <div class="modal-header">
                <h3><i class="fas fa-truck"></i> Edit Delivery</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="editDeliveryFormAdmin">
                    <input type="hidden" id="adminEditDeliveryId" value="${deliveryId}">
                    <div class="form-group">
                        <label for="adminEditCustomerName">Customer Name</label>
                        <input type="text" id="adminEditCustomerName" class="form-control" value="${delivery.customerName || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="adminEditCustomerPhone">Phone Number</label>
                        <input type="tel" id="adminEditCustomerPhone" class="form-control" value="${delivery.customerPhone || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="adminEditDeliveryAddress">Delivery Address</label>
                        <input type="text" id="adminEditDeliveryAddress" class="form-control" value="${delivery.deliveryAddress || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="adminEditDeliveryDriver">Assign Driver</label>
                        <select id="adminEditDeliveryDriver" class="form-control">
                            <option value="">-- Select Driver --</option>
                            ${driversSnapshot.docs.map(doc => 
                                `<option value="${doc.id}" ${delivery.driverId === doc.id ? 'selected' : ''}>${doc.data().name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="adminEditDeliveryStatus">Status</label>
                        <select id="adminEditDeliveryStatus" class="form-control">
                            <option value="pending" ${delivery.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in-progress" ${delivery.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${delivery.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${delivery.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="adminEditDeliveryNotes">Notes</label>
                        <textarea id="adminEditDeliveryNotes" class="form-control" rows="3">${delivery.notes || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-admin btn-admin-outline cancel-modal">Cancel</button>
                        <button type="submit" class="btn-admin">Save Changes</button>
                    </div>
                </form>
            </div>
        `;
        
        // Create modal if it doesn't exist
        let editModal = document.getElementById('adminEditDeliveryModal');
        if (!editModal) {
            editModal = document.createElement('div');
            editModal.id = 'adminEditDeliveryModal';
            editModal.className = 'modal';
            document.body.appendChild(editModal);
        }
        
        editModal.innerHTML = modalContent;
        showModal(editModal);
        
        // Form submission
        document.getElementById('editDeliveryFormAdmin').addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateDeliveryAsAdmin(deliveryId);
        });
        
        // Close modal
        editModal.querySelector('.close-modal').addEventListener('click', () => {
            hideModal(editModal);
        });
        
        editModal.querySelector('.cancel-modal').addEventListener('click', () => {
            hideModal(editModal);
        });
        
    } catch (error) {
        console.error("Error editing delivery:", error);
        showToast("Error loading delivery details", "error");
    }
}

async function updateDeliveryAsAdmin(deliveryId) {
    try {
        const submitBtn = document.getElementById('editDeliveryFormAdmin').querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        const updateData = {
            customerName: document.getElementById('adminEditCustomerName').value.trim(),
            customerPhone: document.getElementById('adminEditCustomerPhone').value.trim(),
            deliveryAddress: document.getElementById('adminEditDeliveryAddress').value.trim(),
            status: document.getElementById('adminEditDeliveryStatus').value,
            notes: document.getElementById('adminEditDeliveryNotes').value.trim() || null,
            updatedAt: serverTimestamp()
        };
        
        const driverId = document.getElementById('adminEditDeliveryDriver').value;
        if (driverId) {
            updateData.driverId = driverId;
        } else {
            updateData.driverId = null;
        }
        
        // If status changed to completed, add completedAt timestamp
        const deliveryDoc = await getDoc(doc(db, "deliveries", deliveryId));
        const currentStatus = deliveryDoc.data().status;
        
        if (updateData.status === 'completed' && currentStatus !== 'completed') {
            updateData.completedAt = serverTimestamp();
        }
        
        await updateDoc(doc(db, "deliveries", deliveryId), updateData);
        
        showToast("Delivery updated successfully", "success");
        hideModal(document.getElementById('adminEditDeliveryModal'));
        
    } catch (error) {
        console.error("Error updating delivery:", error);
        showToast("Failed to update delivery", "error");
    } finally {
        const submitBtn = document.getElementById('editDeliveryFormAdmin').querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Save Changes';
        }
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
        // Safely get date values with fallbacks
        const fromDateStr = historyDateFrom.value || new Date().toISOString().split('T')[0];
        const toDateStr = historyDateTo.value || new Date().toISOString().split('T')[0];
        
        const fromDate = new Date(fromDateStr);
        const toDate = new Date(toDateStr);
        toDate.setHours(23, 59, 59, 999);
        
        // Validate dates
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new Error('Invalid date range selected');
        }
        
        const historyQuery = query(
            collection(db, "deliveries"),
            where("driverId", "==", currentDriverId),
            where("status", "==", "completed"),
            where("completedAt", ">=", fromDate),
            where("completedAt", "<=", toDate),
            orderBy("completedAt", "desc")
        );
        
        // Rest of the function remains the same...
    } catch (error) {
        console.error("Error loading delivery history:", error);
        historyTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Error loading history: ' + error.message + '</td></tr>';
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
            deliveryAddress: deliveryAddressInput.value.trim(), // Use the address input
            gpsCoordinates: new GeoPoint(lat, lng), // Store as GeoPoint for consistency
            deliveryNotes: deliveryNotesInput.value.trim() || null,
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

function switchToMapPanel() {
    // Update navigation
    document.querySelectorAll('.driver-nav a').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector('.driver-nav a[data-section="map"]').classList.add('active');
    
    // Show map section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('map-section').classList.add('active');
}

function showCurrentLocationOnMap() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                currentLocation = L.latLng(latitude, longitude);
                
                // Add marker for current location
                addDriverMarker(currentLocation);
                
                // Center map on current location
                if (map) {
                    map.setView(currentLocation, 15);
                }
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

async function viewDeliveryDetails(delivery) {
    console.log("Viewing delivery details:", delivery.id);
    selectedDelivery = delivery;
    
    try {
        // Populate details
        document.getElementById('detailCustomerName').textContent = delivery.customerName || 'N/A';
        document.getElementById('detailAddress').textContent = delivery.deliveryAddress || 'N/A';
        document.getElementById('detailPhone').textContent = delivery.customerPhone || 'N/A';
        document.getElementById('detailStatus').textContent = delivery.status || 'N/A';
        document.getElementById('detailNotes').textContent = delivery.deliveryNotes || delivery.notes || 'None';
        
        // Set button states based on status
        const startBtn = document.getElementById('startDeliveryBtn');
        const completeBtn = document.getElementById('completeDeliveryBtn');
        
        if (startBtn) startBtn.style.display = delivery.status === 'pending' ? 'block' : 'none';
        if (completeBtn) completeBtn.style.display = delivery.status === 'in-progress' ? 'block' : 'none';
        
        showModal(deliveryDetailsModal, deliveryDetailsOverlay);
        
        // Initialize map for this delivery
        const deliveryMap = await initializeDeliveryMap(delivery);
        
        // Handle GPS coordinates
        let deliveryLocation = null;
        if (delivery.gpsCoordinates) {
            let lat, lng;
            
            if (typeof delivery.gpsCoordinates === 'string') {
                // String format: "lat,lng"
                const coords = delivery.gpsCoordinates.split(',');
                lat = parseFloat(coords[0]);
                lng = parseFloat(coords[1]);
            } else if (delivery.gpsCoordinates.latitude && delivery.gpsCoordinates.longitude) {
                // GeoPoint format
                lat = delivery.gpsCoordinates.latitude;
                lng = delivery.gpsCoordinates.longitude;
            }
            
            if (!isNaN(lat) && !isNaN(lng)) {
                deliveryLocation = L.latLng(lat, lng);
                
                // Add marker for delivery location
                const deliveryMarker = L.marker(deliveryLocation, {
                    icon: L.divIcon({
                        className: 'delivery-marker-icon',
                        html: '<i class="fas fa-map-marker-alt"></i>',
                        iconSize: [30, 30]
                    })
                }).addTo(deliveryMap)
                .bindPopup(`Delivery to ${delivery.customerName}`)
                .openPopup();
                
                // Center map on delivery location
                deliveryMap.setView(deliveryLocation, 15);
                
                // Add route if we have current location
                if (currentLocation) {
                    await showRoute(deliveryMap, currentLocation, deliveryLocation);
                }
            }
        }
        
    } catch (error) {
        console.error("Error showing delivery details:", error);
        showToast('error', 'Failed to load delivery details');
    }
}

async function initializeDeliveryMap(delivery) {
    const mapElement = document.getElementById('deliveryMap');
    
    // More robust cleanup of existing map
    if (mapElement._leaflet_map) {
        mapElement._leaflet_map.remove();
        delete mapElement._leaflet_map;
    }
    
    // Clear any remaining Leaflet references
    for (const id in L.Map._instances) {
        if (L.Map._instances[id]._container.id === 'deliveryMap') {
            L.Map._instances[id].remove();
            delete L.Map._instances[id];
            break;
        }
    }
    
    // Clear the container's innerHTML to ensure complete cleanup
    mapElement.innerHTML = '';
    
    // Create new map
    const deliveryMap = L.map('deliveryMap', {
        zoomControl: false
    });
    
    // Store reference to the map on the element
    mapElement._leaflet_map = deliveryMap;
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(deliveryMap);
    
    // Set initial view
    if (delivery.gpsCoordinates) {
        const [lat, lng] = delivery.gpsCoordinates.split(',').map(Number);
        deliveryMap.setView([lat, lng], 15);
    } else {
        deliveryMap.setView([0, 0], 2);
    }
    
    return deliveryMap;
}

async function startDelivery() {
    if (!selectedDelivery) {
        showToast('error', 'No delivery selected');
        return;
    }

    try {
        const startBtn = document.getElementById('startDeliveryBtn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
        }

        // Get current position
        const position = await getCurrentPositionWithTimeout(10000);
        currentLocation = L.latLng(position.coords.latitude, position.coords.longitude);

        // Prepare update data
        const updateData = {
            status: 'in-progress',
            startedAt: serverTimestamp(),
            startLocation: new GeoPoint(position.coords.latitude, position.coords.longitude),
            updatedAt: serverTimestamp() // Always include updatedAt
        };

        // Update delivery document
        await updateDoc(doc(db, "deliveries", selectedDelivery.id), updateData);

        // Switch to map view
        switchToMapPanel();
        if (!map) initMap('map');

        // Parse delivery coordinates
        let deliveryLat, deliveryLng;
        if (selectedDelivery.gpsCoordinates) {
            if (typeof selectedDelivery.gpsCoordinates === 'string') {
                const coords = selectedDelivery.gpsCoordinates.split(',');
                deliveryLat = parseFloat(coords[0]);
                deliveryLng = parseFloat(coords[1]);
            } else if (selectedDelivery.gpsCoordinates.latitude) {
                deliveryLat = selectedDelivery.gpsCoordinates.latitude;
                deliveryLng = selectedDelivery.gpsCoordinates.longitude;
            }
            
            if (!isNaN(deliveryLat) && !isNaN(deliveryLng)) {
                const deliveryLoc = L.latLng(deliveryLat, deliveryLng);
                clearMapLayers();
                addDriverMarker(currentLocation);
                await showRoute(map, currentLocation, deliveryLoc);
                showToast('success', 'Delivery started! Follow the route.');
                hideModal(deliveryDetailsModal, deliveryDetailsOverlay);
                startPositionTracking();
            }
        }

    } catch (error) {
        console.error("Delivery start error:", error);
        let errorMessage = 'Failed to start delivery';
        
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Contact administrator.';
        } else if (error.code === 'failed-precondition') {
            errorMessage = 'Database error. Please try again.';
        }
        
        showToast('error', errorMessage);
    } finally {
        const startBtn = document.getElementById('startDeliveryBtn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> Start Delivery';
        }
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
        if (!confirm('Are you sure you want to delete this delivery?')) return;
        
        await deleteDoc(doc(db, "deliveries", deliveryId));
        showToast('success', 'Delivery deleted successfully');
    } catch (error) {
        console.error("Error deleting delivery:", error);
        showToast('error', 'Failed to delete delivery. You may not have permission.');
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
    const mapElement = document.getElementById(mapElementId);
    
    // Check if map already exists by looking for Leaflet's internal _leaflet_id
    if (mapElement._leaflet_id) {
        // Find the existing map instance
        for (const id in L.Map._instances) {
            if (L.Map._instances[id]._container.id === mapElementId) {
                return L.Map._instances[id];
            }
        }
    }

    // Create new map only if it doesn't exist
    const newMap = L.map(mapElementId).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(newMap);
    
    // Store reference if this is the main map
    if (mapElementId === 'map') {
        map = newMap;
        showCurrentLocationOnMap();
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
        showCurrentLocationOnMap();
    }
}

async function checkGeolocationPermission() {
    if (!navigator.permissions) return true; // Assume granted if API not available
    
    try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state === 'granted';
    } catch {
        return true; // Fallback if permission query fails
    }
}

async function requestGeolocationPermission() {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            (error) => {
                console.warn("Geolocation permission denied:", error);
                resolve(false);
            },
            { maximumAge: 0, timeout: 5000 }
        );
    });
}

async function showAllDeliveriesOnMap() {
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
            let lat, lng;
            
            if (typeof delivery.gpsCoordinates === 'string') {
                const coords = delivery.gpsCoordinates.split(',');
                lat = parseFloat(coords[0]);
                lng = parseFloat(coords[1]);
            } else if (delivery.gpsCoordinates.latitude) {
                lat = delivery.gpsCoordinates.latitude;
                lng = delivery.gpsCoordinates.longitude;
            }
            
            if (!isNaN(lat) && !isNaN(lng)) {
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
        }
    });
    
    // Add current location marker if available
    if (currentLocation) {
        addDriverMarker(currentLocation);
        
        // Show routes to pending deliveries
        deliveries.forEach(delivery => {
            if (delivery.gpsCoordinates && delivery.status === 'pending') {
                let lat, lng;
                
                if (typeof delivery.gpsCoordinates === 'string') {
                    const coords = delivery.gpsCoordinates.split(',');
                    lat = parseFloat(coords[0]);
                    lng = parseFloat(coords[1]);
                } else if (delivery.gpsCoordinates.latitude) {
                    lat = delivery.gpsCoordinates.latitude;
                    lng = delivery.gpsCoordinates.longitude;
                }
                
                if (!isNaN(lat) && !isNaN(lng)) {
                    const deliveryLocation = L.latLng(lat, lng);
                    showRoute(map, currentLocation, deliveryLocation);
                }
            }
        });
    }
    
    // Fit map to show all markers if we have any
    const deliveryLocations = [];
    
    deliveries.forEach(delivery => {
        if (delivery.gpsCoordinates) {
            let lat, lng;
            
            if (typeof delivery.gpsCoordinates === 'string') {
                const coords = delivery.gpsCoordinates.split(',');
                lat = parseFloat(coords[0]);
                lng = parseFloat(coords[1]);
            } else if (delivery.gpsCoordinates.latitude) {
                lat = delivery.gpsCoordinates.latitude;
                lng = delivery.gpsCoordinates.longitude;
            }
            
            if (!isNaN(lat) && !isNaN(lng)) {
                deliveryLocations.push(L.latLng(lat, lng));
            }
        }
    });
    
    if (deliveryLocations.length > 0) {
        const bounds = L.latLngBounds(deliveryLocations);
        
        if (currentLocation) {
            bounds.extend(currentLocation);
        }
        
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function renderDeliveriesTable() {
    console.log("Rendering deliveries table with", deliveries.length, "deliveries");
    
    if (!deliveriesTableBody) {
        console.error("Deliveries table body not found");
        return;
    }
    
    // Clear existing table content
    deliveriesTableBody.innerHTML = '';
    
    // Handle empty state
    if (deliveries.length === 0) {
        deliveriesTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    No deliveries assigned to you
                </td>
            </tr>
        `;
        return;
    }
    
    // Render each delivery
    deliveries.forEach(delivery => {
        const row = document.createElement('tr');
        
        // Format dates safely
        const createdAt = delivery.createdAt?.toDate ? delivery.createdAt.toDate() : new Date(delivery.createdAt);
        const completedAt = delivery.completedAt?.toDate ? delivery.completedAt.toDate() : null;
        
        // Handle address display - prefer deliveryAddress over gpsCoordinates
        let displayAddress = delivery.deliveryAddress || 'N/A';
        if (!delivery.deliveryAddress && delivery.gpsCoordinates) {
            displayAddress = `GPS: ${delivery.gpsCoordinates}`;
        }
        
        row.innerHTML = `
            <td>${delivery.customerName || 'N/A'}</td>
            <td>${displayAddress}</td>
            <td>${createdAt ? createdAt.toLocaleString() : 'N/A'}</td>
            <td>
                <span class="badge ${getDeliveryStatusBadgeClass(delivery.status)}">
                    ${delivery.status}
                </span>
            </td>
            <td class="actions">
                <button class="action-btn view-btn" data-id="${delivery.id}">
                    <i class="fas fa-eye"></i> View
                </button>
                ${delivery.status === 'pending' ? `
                    <button class="action-btn start-btn" data-id="${delivery.id}">
                        <i class="fas fa-play"></i> Start
                    </button>
                ` : ''}
                ${delivery.status === 'in-progress' ? `
                    <button class="action-btn complete-btn" data-id="${delivery.id}">
                        <i class="fas fa-check"></i> Complete
                    </button>
                ` : ''}
            </td>
        `;
        
        // Add event listeners
        const viewBtn = row.querySelector('.view-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                viewDeliveryDetails(delivery);
            });
        }
        
        const startBtn = row.querySelector('.start-btn');
        if (startBtn && delivery.status === 'pending') {
            startBtn.addEventListener('click', () => {
                selectedDelivery = delivery;
                startDelivery();
            });
        }
        
        const completeBtn = row.querySelector('.complete-btn');
        if (completeBtn && delivery.status === 'in-progress') {
            completeBtn.addEventListener('click', () => {
                selectedDelivery = delivery;
                completeDelivery();
            });
        }
        
        deliveriesTableBody.appendChild(row);
    });
    
    console.log("Deliveries table rendered successfully");
}

async function showCustomerLocations() {
    try {
        const customersQuery = query(
            collection(db, "users"),
            where("role", "==", "customer")
        );
        
        const customersSnapshot = await getDocs(customersQuery);
        
        customersSnapshot.forEach(doc => {
            const customer = doc.data();
            if (customer.location) {
                // Add marker for each customer location
                const customerMarker = L.marker([customer.location.latitude, customer.location.longitude], {
                    icon: L.divIcon({
                        className: 'customer-icon',
                        html: '<i class="fas fa-user"></i>',
                        iconSize: [24, 24]
                    })
                }).addTo(map)
                .bindPopup(`<b>Customer:</b> ${customer.name || 'Unknown'}`);
            }
        });
        
    } catch (error) {
        console.error("Error loading customer locations:", error);
        showToast('warning', 'Could not load customer locations');
        // Optionally show a message to the driver
        if (error.code === 'permission-denied') {
            showToast('info', 'Contact admin for location access');
        }
    }
}

async function showRoute(mapInstance, start, end) {
    if (!validateCoordinates(start.lat, start.lng) || !validateCoordinates(end.lat, end.lng)) {
        console.error("Invalid coordinates:", start, end);
        showToast('error', 'Invalid delivery location coordinates');
        return;
    }
    // Check if route calculation is already in progress
    if (routeCalculationInProgress) return;
    routeCalculationInProgress = true;

    const cacheKey = `${start.lat},${start.lng}-${end.lat},${end.lng}`;
    
    // Clear any existing route
    if (currentRoute) {
        currentRoute.line.remove();
        currentRoute.markers.forEach(marker => marker.remove());
        currentRoute = null;
    }

    try {
        showToast('info', 'Calculating optimal route...');
        
        // Validate coordinates
        if (Math.abs(start.lat) > 90 || Math.abs(start.lng) > 180 || 
            Math.abs(end.lat) > 90 || Math.abs(end.lng) > 180) {
            throw new Error('Invalid coordinates');
        }

        // Format coordinates for OpenRouteService API (longitude first)
        const startCoords = `${start.lng},${start.lat}`;
        const endCoords = `${end.lng},${end.lat}`;
        
        const response = await fetch(
            `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${OPENROUTE_API_KEY}&start=${startCoords}&end=${endCoords}`,
            {
                headers: {
                    'Accept': 'application/json, application/geo+json'
                }
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Routing service unavailable');
        }
        
        const data = await response.json();
        
        if (!data.features || data.features.length === 0) {
            throw new Error('No route found');
        }
        
        // Extract coordinates from response
        const routeCoordinates = data.features[0].geometry.coordinates.map(coord => 
            [coord[1], coord[0]] // Convert [lng,lat] to [lat,lng] for Leaflet
        );
        
        // Draw the route on the map
        const routeLine = L.polyline(routeCoordinates, {
            color: '#008080',
            weight: 5,
            opacity: 0.8,
            lineJoin: 'round'
        }).addTo(mapInstance);
        
        // Add custom markers
        const startMarker = L.marker(start, {
            icon: L.divIcon({
                className: 'driver-location-icon',
                html: '<i class="fas fa-truck"></i>',
                iconSize: [30, 30]
            })
        }).addTo(mapInstance).bindPopup('Your Location');
        
        const endMarker = L.marker(end, {
            icon: L.divIcon({
                className: 'delivery-icon in-progress',
                html: '<i class="fas fa-map-marker-alt"></i>',
                iconSize: [30, 30]
            })
        }).addTo(mapInstance).bindPopup('Delivery Point');
        
        // Calculate and display route info
        const distance = (data.features[0].properties.summary.distance / 1000).toFixed(1);
        const duration = Math.round(data.features[0].properties.summary.duration / 60);
        
        currentRoute = {
            line: routeLine,
            markers: [startMarker, endMarker],
            popup: L.popup()
                .setLatLng(end)
                .setContent(`
                    <strong>Route Info</strong><br>
                    Distance: ${distance} km<br>
                    Estimated Time: ${duration} mins
                `)
                .openOn(mapInstance)
        };
        
        mapInstance.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        
    } catch (error) {
        console.error("Routing error:", error);
        showToast('warning', 'Using straight-line approximation');
        
        // Fallback to straight line
        L.polyline([start, end], {
            color: '#008080',
            weight: 3,
            opacity: 0.6,
            dashArray: '10, 10'
        }).addTo(mapInstance);
        
        mapInstance.fitBounds(L.latLngBounds([start, end]));
    } finally {
        routeCalculationInProgress = false;
    }
}

async function showRouteToDelivery(delivery) {
    if (!map || !delivery.gpsCoordinates) return;
    
    try {
        // Get current location
        const position = await getCurrentPosition();
        currentLocation = L.latLng(position.coords.latitude, position.coords.longitude);
        
        // Center map on current location
        map.setView(currentLocation, 15);
        
        // Parse delivery coordinates
        const [lat, lng] = delivery.gpsCoordinates.split(',').map(Number);
        const deliveryLocation = L.latLng(lat, lng);
        
        // Clear existing markers and routes
        map.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.Routing.Control) {
                map.removeLayer(layer);
            }
        });
        
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
        
        // Add marker for delivery location
        const deliveryIcon = L.divIcon({
            className: 'delivery-icon in-progress',
            html: '<i class="fas fa-map-marker-alt"></i>',
            iconSize: [30, 30]
        });
        
        L.marker(deliveryLocation, {
            icon: deliveryIcon
        }).addTo(map)
        .bindPopup(`Delivery to ${delivery.customerName}`)
        .openPopup();
        
        // Show route between locations
        showRoute(currentLocation, deliveryLocation);
        
    } catch (error) {
        console.error("Error showing route:", error);
        showToast('warning', 'Could not show route - using default view');
        
        // Fallback to just showing the delivery location
        const [lat, lng] = delivery.gpsCoordinates.split(',').map(Number);
        const deliveryLocation = L.latLng(lat, lng);
        map.setView(deliveryLocation, 15);
        
        L.marker(deliveryLocation).addTo(map)
            .bindPopup(`Delivery to ${delivery.customerName}`)
            .openPopup();
    }
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

function getCurrentPositionWithTimeout(timeout) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Geolocation request timed out'));
        }, timeout);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                clearTimeout(timer);
                resolve(position);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: timeout - 1000 // Allow some buffer
            }
        );
    });
}

function clearMapLayers() {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Routing.Control) {
            map.removeLayer(layer);
        }
    });
}

function addDriverMarker(location) {
    if (!map) return;
    
    // Remove existing driver marker if it exists
    if (window.driverMarker) {
        map.removeLayer(window.driverMarker);
    }
    
    // Create custom icon
    const driverIcon = L.divIcon({
        className: 'driver-location-icon',
        html: '<i class="fas fa-podcast"></i>',
        iconSize: [30, 30]
    });
    
    // Add new marker and store reference
    window.driverMarker = L.marker(location, {
        icon: driverIcon,
        zIndexOffset: 1000 // Ensure it stays on top
    }).addTo(map)
    .bindPopup('Your Location')
    .openPopup();
    
    return window.driverMarker;
}

function startPositionTracking() {
    // Stop any existing tracking
    if (positionWatchId !== null) {
        navigator.geolocation.clearWatch(positionWatchId);
    }

    positionWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const newLocation = L.latLng(position.coords.latitude, position.coords.longitude);
            currentLocation = newLocation;
            
            // Update driver marker
            addDriverMarker(newLocation);
            
            // Optionally center map on new location
            if (map) {
                map.setView(newLocation, map.getZoom());
            }
        },
        (error) => {
            console.warn("Position tracking error:", error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 10000
        }
    );
}

function stopPositionTracking() {
    if (positionWatchId !== null) {
        navigator.geolocation.clearWatch(positionWatchId);
        positionWatchId = null;
    }
}


