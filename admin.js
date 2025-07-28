import { 
    app, 
    db, 
    auth, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    serverTimestamp,
    query,
    where,
    createUserWithEmailAndPassword,
    updateProfile,
    ensureAdminStatus, // Assuming this is imported or defined elsewhere if needed
    onAuthStateChanged,
    addDoc,
    orderBy,
    limit,
    onSnapshot,
    getDeliveryStatusBadgeClass
} from './script.js';

import { GeoPoint } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

console.log("✅ admin.js is now running");

const OPENROUTE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU4OTBiNGUwYTZkYjQwZTU4YjY2ZjhkZGQxZjNkNTliIiwiaCI6Im11cm11cjY0In0='; // Replace with your OpenRouteService API key if you want geocoding to work

// DOM Elements
const lastUpdated = document.getElementById('lastUpdated');
const totalUsers = document.getElementById('totalUsers');
const totalProducts = document.getElementById('totalProducts');
const recentOrders = document.getElementById('recentOrders');
if (!recentOrders) console.warn('recentOrders element not found');
const totalRevenue = document.getElementById('totalRevenue');
if (!totalRevenue) console.warn('totalRevenue element not found');
const recentActivity = document.getElementById('recentActivity');
const productsTableBody = document.getElementById('productsTableBody');
const usersTableBody = document.getElementById('usersTableBody');
const ordersTableBody = document.getElementById('ordersTableBody');
const driversTableBody = document.getElementById('driversTableBody');
const driverDeliveriesTableBody = document.getElementById('driverDeliveriesTableBody');
const driverStatsSection = document.getElementById('driverStatsSection');
const totalDrivers = document.getElementById('totalDrivers');
const activeDrivers = document.getElementById('activeDrivers');
const onDutyDrivers = document.getElementById('onDutyDrivers');

// Order Action Modal Elements
const orderActionModal = document.getElementById('orderActionModal');
const orderActionModalOverlay = document.getElementById('orderActionModalOverlay');
const closeOrderActionModal = document.getElementById('closeOrderActionModal');
const orderIdDisplay = document.getElementById('orderIdDisplay');
const orderStatusDisplay = document.getElementById('orderStatusDisplay');
const confirmOrderButton = document.getElementById('confirmOrderButton');
const addDeliveryButton = document.getElementById('addDeliveryButton');
const adminDeliveryForm = document.getElementById('adminDeliveryForm');
const adminCustomerNameInput = document.getElementById('adminCustomerName');
const adminCustomerPhoneInput = document.getElementById('adminCustomerPhone');
const adminDeliveryAddressInput = document.getElementById('adminDeliveryAddress');
const adminDeliveryNotesInput = document.getElementById('adminDeliveryNotes');
const adminGpsCoordinatesInput = document.getElementById('adminGpsCoordinates');
const adminDeliveryDriverSelect = document.getElementById('adminDeliveryDriver');
const cancelAddDeliveryAdminBtn = document.getElementById('cancelAddDeliveryAdmin');



// Initialize admin panel
(async () => {
    console.log('✅ admin.js IIFE starting, DOM is already loaded');
    
    try {
        console.log('✅ Test log BEFORE admin check');

        // Replace the hardcoded isAdmin check with:
        const user = auth.currentUser;
        if (!user) {
        window.location.href = 'login.html';
        return;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        window.location.href = 'index.html';
        return;
        }
        console.log('✅ Test log AFTER admin check');

        initAdminPanel();
        console.log('✅ Test log AFTER initAdminPanel');

        await Promise.all([
            loadDashboardData(),
            loadProducts(),
            loadUsers(),
            loadOrders(),
            loadDrivers()
        ]);
        console.log('✅ All data loaded');

        setupAdminNavigation();
        setupModals();
        setupEventListeners();
        console.log('✅ All setup done');
    } catch (error) {
        console.error('❌ Error during admin initialization:', error);
        // If not admin and not already redirected, redirect to index
        // if (error.message !== "Redirecting to login" && !window.location.pathname.includes('index.html')) {
        //     window.location.href = 'index.html';
        // }
    }
})();


// Initialize admin panel components
function initAdminPanel() {
  console.log("Admin panel initialized");
  updateLastUpdated();
  setInterval(updateLastUpdated, 60000); // Update every minute
  
  // Initialize user search
  initUserSearch();
  
  initProductSearch();
  // Initialize order filter
  initOrderFilter();

  initDriverSearch();
  
  initDeliveryFilter();


  initEnhancedSearch();
  console.log("Admin panel components initialized");
  
}

// Update last updated time
function updateLastUpdated() {
    const now = new Date();
    lastUpdated.textContent = now.toLocaleString();
}

// Load dashboard data
async function loadDashboardData() {
    console.log('✅ Loading dashboard data...');
    
    try {
        // Check if DOM elements exist
        if (!totalUsers || !totalProducts || !recentOrders || !totalRevenue) {
            console.warn('One or more dashboard elements not found');
            return;
        }

        // Set loading states
        totalUsers.textContent = '...';
        totalProducts.textContent = '...';
        recentOrders.textContent = '...';
        totalRevenue.textContent = '...';
        if (totalDrivers) totalDrivers.textContent = '...';
        if (activeDrivers) activeDrivers.textContent = '...';
        if (onDutyDrivers) onDutyDrivers.textContent = '...';

        // Parallel data fetching
        const [
            usersCount, 
            productsCount, 
            ordersData,
            driversData
        ] = await Promise.all([
            getCollectionCount('users'),
            getCollectionCount('products'),
            getRecentOrdersData(),
            getDriversData()
        ]);

        // Update dashboard stats
        totalUsers.textContent = usersCount;
        totalProducts.textContent = productsCount;
        recentOrders.textContent = ordersData.count;
        totalRevenue.textContent = formatCurrency(ordersData.revenue);
        
        // Update driver stats if elements exist
        if (totalDrivers) totalDrivers.textContent = driversData.total;
        if (activeDrivers) activeDrivers.textContent = driversData.active;
        if (onDutyDrivers) onDutyDrivers.textContent = driversData.onDuty;

        // Load recent activity
        await loadRecentActivity();

        console.log('✅ Dashboard data loaded successfully');

    } catch (error) {
        console.error("❌ Dashboard load error:", error);
        showToast("Error loading dashboard data", "error");
        
        // Set error states
        totalUsers.textContent = '0';
        totalProducts.textContent = '0';
        recentOrders.textContent = '0';
        totalRevenue.textContent = '$0.00';
        if (totalDrivers) totalDrivers.textContent = '0';
        if (activeDrivers) activeDrivers.textContent = '0';
        if (onDutyDrivers) onDutyDrivers.textContent = '0';
    }
}

// Helper functions for dashboard data
async function getRecentOrdersData() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    try {
        const ordersQuery = query(
            collection(db, "orders"),
            where("createdAt", ">=", sevenDaysAgo),
            where("status", "in", ["completed", "delivered"])
        );
        
        const snapshot = await getDocs(ordersQuery);
        let revenue = 0;
        
        snapshot.forEach(doc => {
            const amount = parseFloat(doc.data().totalAmount) || 0;
            revenue += amount;
        });
        
        return {
            count: snapshot.size,
            revenue: revenue
        };
        
    } catch (error) {
        console.error("Orders data error:", error);
        return { count: 0, revenue: 0 };
    }
}

async function getDriversData() {
    try {
        const [totalSnapshot, activeSnapshot, onDutySnapshot] = await Promise.all([
            getDocs(query(collection(db, "users"), where("role", "==", "driver"))),
            getDocs(query(collection(db, "users"), 
                where("role", "==", "driver"),
                where("status", "==", "active"))),
            getDocs(query(collection(db, "users"), 
                where("role", "==", "driver"),
                where("status", "==", "on-duty")))
        ]);
        
        return {
            total: totalSnapshot.size,
            active: activeSnapshot.size,
            onDuty: onDutySnapshot.size
        };
        
    } catch (error) {
        console.error("Drivers data error:", error);
        return { total: 0, active: 0, onDuty: 0 };
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Get count of documents in a collection
async function getCollectionCount(collectionName) {
    try {
        console.log(`Attempting to count documents in ${collectionName} collection`);

        const snapshot = await getDocs(collection(db, collectionName));
        console.log(`Found ${snapshot.size} documents in ${collectionName}`);
        
        snapshot.forEach((doc, index) => {
            if (index < 3) { //Only log first 3 to avoid cluttero
                console.log(`Document ${index + 1}:`, doc.id, doc.data());
            }
        });

        return snapshot.size;
    } catch (error) {
        console.error(`Error counting ${collectionName}:`, error);
        showToast(`Error loading ${collectionName} count`, 'error')
        return 0;
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' :
                        type === 'success' ? 'fa-check-circle' :
                        'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="toast-close">&times;</button>
    `;

    toastContainer.appendChild(toast);

    //Auto remove after five seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 5000);

    //Manual Close
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300)
    });
}

// Load recent activity
// Load recent activity
async function loadRecentActivity() {
    try {
        const activityQuery = query(
            collection(db, "activity"),
            orderBy("timestamp", "desc"),
            limit(10)
        );
        
        // Add null check here
        if (!recentActivity) {
            console.warn('Recent activity element not found');
            return;
        }
        
        recentActivity.innerHTML = '';
        
        const snapshot = await getDocs(activityQuery);
        
        if (snapshot.empty) {
            recentActivity.innerHTML = '<tr><td colspan="4">No recent activity found</td></tr>';
            return;
        }
        
        snapshot.forEach(doc => {
            const activity = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${activity.userName || 'System'}</td>
                <td>${activity.action}</td>
                <td>${activity.timestamp ? new Date(activity.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                <td><span class="badge ${activity.status === 'success' ? 'badge-success' : 'badge-info'}">${activity.status || 'info'}</span></td>
            `;
            recentActivity.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading recent activity:", error);
        if (recentActivity) {
            recentActivity.innerHTML = '<tr><td colspan="4">Error loading activity</td></tr>';
        }
        showToast("Error loading recent activity", "error");
    }
}

// Load products
async function loadProducts(searchTerm = '') {
    try {
        const productsCollection = collection(db, "products");
        let q = productsCollection;

        if (searchTerm) {
            q = query(productsCollection, 
                      where("name", ">=", searchTerm), 
                      where("name", "<=", searchTerm + '\uf8ff'));
        }

        const snapshot = await getDocs(q);
        productsTableBody.innerHTML = '';
        snapshot.forEach(doc => {
            const product = doc.data();
            const row = document.createElement('tr');
            // In your loadProducts() function, update the row generation:
row.innerHTML = `
    <td><img src="${product.imageUrl || 'https://via.placeholder.com/50'}" alt="${product.name}" class="product-table-image"></td>
    <td>${product.name}</td>
    <td>${product.category}</td>
    <td>$${parseFloat(product.price).toFixed(2)}</td>
    <td>${product.stock}</td>
    <td>
        <span class="badge ${product.featured ? 'badge-success' : 'badge-danger'}">
            <i class="fas ${product.featured ? 'fa-check-circle' : 'fa-times-circle'}"></i> 
            ${product.featured ? 'Yes' : 'No'}
        </span>
    </td>
    <td>
        <div class="table-actions">
            <button class="btn-table-action btn-edit edit-product" data-id="${doc.id}">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-table-action btn-delete delete-product" data-id="${doc.id}">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </td>
`;
            productsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading products:", error);
        showToast("Error loading products", "error");
    }
}

// Load users
async function loadUsers(searchTerm = '') {
    try {
        const usersCollection = collection(db, "users");
        let q = usersCollection;

        if (searchTerm) {
            q = query(usersCollection, 
                      where("email", ">=", searchTerm), 
                      where("email", "<=", searchTerm + '\uf8ff'));
        }

        const snapshot = await getDocs(q);
        usersTableBody.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.role === 'admin') return; // Don't list admins here
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name || 'N/A'}</td>
                <td>${user.email}</td>
                <td>${user.role || 'customer'}</td>
                <td>
                    <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}">
                        ${user.status || 'inactive'}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-table-action btn-edit edit-user" data-id="${doc.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-table-action btn-delete delete-user" data-id="${doc.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            usersTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading users:", error);
        showToast("Error loading users", "error");
    }
}

// Load orders with filtering and search
async function loadOrders(filterStatus = 'all', searchTerm = '') {
    try {
        const ordersCollection = collection(db, "orders");
        let q = query(ordersCollection, orderBy("createdAt", "desc"));

        const conditions = [];

        if (filterStatus !== 'all') {
            conditions.push(where("status", "==", filterStatus));
        }

        if (searchTerm) {
            conditions.push(where("customerName", ">=", searchTerm), where("customerName", "<=", searchTerm + '\uf8ff'));
        }

        if (conditions.length > 0) {
            q = query(ordersCollection, ...conditions, orderBy("createdAt", "desc"));
        } else {
            q = query(ordersCollection, orderBy("createdAt", "desc"));
        }

        const snapshot = await getDocs(q);
        ordersTableBody.innerHTML = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            const orderId = doc.id;
            const createdAt = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleString() : 'N/A';
            const statusClass = getDeliveryStatusBadgeClass(order.status);

            // Make pending status clickable
            const statusHtml = order.status.toLowerCase() === 'pending'
                ? `<span class="badge ${statusClass} status-pending-clickable" data-order-id="${orderId}">Pending</span>`
                : `<span class="badge ${getDeliveryStatusBadgeClass(order.status)}">
                    ${order.status}
                  </span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
            <td>${orderId}</td>
            <td>${order.customerName || 'N/A'}</td>
            <td>${createdAt}</td>
            <td>$${parseFloat(order.totalAmount || 0).toFixed(2)}</td>
            <td>${statusHtml}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-action btn-view view-order" data-id="${orderId}">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-table-action btn-delete delete-order" data-id="${orderId}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
            ordersTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading orders:", error);
        showToast("Error loading orders", "error");
    }
}

// Function to handle clicking on a pending order status
// In admin.js, update the handlePendingOrderStatusClick function:

async function handlePendingOrderStatusClick(orderId) {
    console.log(`Clicked pending status for order ID: ${orderId}`);
    try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (!orderDoc.exists()) {
            showToast("Order not found!", "error");
            return;
        }
        
        currentOrderId = orderId;
        const order = orderDoc.data();

        // Update modal content
        if (orderIdDisplay) orderIdDisplay.textContent = orderId;
        if (orderStatusDisplay) orderStatusDisplay.textContent = order.status;

        // Show appropriate section based on order status
        if (order.status === 'pending') {
            document.getElementById('assignDriverSection').style.display = 'none';
            document.getElementById('addDeliverySection').style.display = 'none';
            document.getElementById('confirmOrderActionBtn').style.display = 'block';
        } else if (order.status === 'processing') {
            document.getElementById('assignDriverSection').style.display = 'none';
            document.getElementById('addDeliverySection').style.display = 'block';
            document.getElementById('confirmOrderActionBtn').style.display = 'none';
            
            // FIX: Pass the complete order object with ID to showAddDeliveryForm
            const orderWithId = { ...order, id: orderId };
            await showAddDeliveryForm(orderWithId);
        }

        showModal(orderActionModal, orderActionModalOverlay);
    } catch (error) {
        console.error("Error handling pending order status click:", error);
        showToast("Error opening order actions", "error");
    }
}

// Function to confirm an order
async function confirmOrder(orderId) {
    try {
        // Re-verify admin status
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            throw new Error("Admin privileges required");
        }

        if (!orderId) throw new Error("No order ID provided");
        
        // Only update allowed fields per security rules
        await updateDoc(doc(db, "orders", orderId), {
            status: "processing",
            updatedAt: serverTimestamp()
        });
        
        showToast("Order confirmed!", "success");
        
        // FIX: After confirming, automatically show the delivery form
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (orderDoc.exists()) {
            const order = orderDoc.data();
            const orderWithId = { ...order, id: orderId };
            
            // Update the modal to show delivery form section
            document.getElementById('confirmOrderActionBtn').style.display = 'none';
            document.getElementById('addDeliverySection').style.display = 'block';
            if (orderStatusDisplay) orderStatusDisplay.textContent = 'processing';
            
            await showAddDeliveryForm(orderWithId);
        }
        
        loadOrders(); // Refresh orders table
        
    } catch (error) {
        console.error("Error confirming order:", error);
        showToast(`Error: ${error.message}`, "error");
    }
}

// Function to show and populate the Add Delivery form within the modal
async function showAddDeliveryForm(order) {
    if (!adminDeliveryForm) {
        console.error("Admin delivery form element not found");
        showToast("Delivery form not available", "error");
        return;
    }

    console.log("Showing Add Delivery Form for order:", order.id || 'unknown');
    
    // Show the delivery form section
    document.getElementById('addDeliverySection').style.display = 'block';
    
    // Safely populate form fields with null checks
    if (adminCustomerNameInput) {
        adminCustomerNameInput.value = order?.customerName || '';
    }
    if (adminCustomerPhoneInput) {
        adminCustomerPhoneInput.value = order?.customerPhone || '';
    }
    if (adminDeliveryAddressInput) {
        adminDeliveryAddressInput.value = order?.deliveryAddress || '';
    }
    if (adminDeliveryNotesInput) {
        adminDeliveryNotesInput.value = order?.notes || '';
    }

    // Attempt to geocode the address if we have one
    if (order?.deliveryAddress && adminGpsCoordinatesInput) {
        const coords = await geocodeAddress(order.deliveryAddress);
        if (coords) {
            adminGpsCoordinatesInput.value = `${coords.lat}, ${coords.lng}`;
        } else {
            adminGpsCoordinatesInput.value = '';
        }
    }

    // Populate driver dropdown
    if (adminDeliveryDriverSelect) {
        await populateDriverDropdown(adminDeliveryDriverSelect);
    }

    // Set order ID on form
    if (order?.id) {
        adminDeliveryForm.dataset.orderId = order.id;
    }
}

// Geocoding function (ported from driver.js or similar)
async function geocodeAddress(address) {
    if (!address || !OPENROUTE_API_KEY) {
        console.warn("Address or API key missing");
        return null;
    }

    try {
        const response = await fetch(
            `https://api.openrouteservice.org/geocode/search?api_key=${OPENROUTE_API_KEY}&text=${encodeURIComponent(address)}`
        );
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        if (data.features?.length > 0) {
            const [lng, lat] = data.features[0].geometry.coordinates;
            return { lat, lng };
        }
        return null;
    } catch (error) {
        console.error("Geocoding error:", error);
        return null;
    }
}

// In the populateDriverDropdown function
// In admin.js, update the populateDriverDropdown function
async function populateDriverDropdown(selectElement, selectedDriverId = null) {
    if (!selectElement) {
        console.error("Select element not found for driver dropdown");
        return;
    }
    
    selectElement.innerHTML = '<option value="">-- Select Driver --</option>';
    
    try {
        const driversQuery = query(
            collection(db, "users"),
            where("role", "==", "driver")
        );
        const driversSnapshot = await getDocs(driversQuery);
        
        console.log("Found drivers for dropdown:", driversSnapshot.size);
        
        if (driversSnapshot.empty) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No drivers available";
            option.disabled = true;
            selectElement.appendChild(option);
            return;
        }
        
        driversSnapshot.forEach(doc => {
            const driver = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${driver.name || driver.email} (${driver.status || 'unknown'})`;
            
            if (selectedDriverId && doc.id === selectedDriverId) {
                option.selected = true;
            }
            
            selectElement.appendChild(option);
        });
        
    } catch (error) {
        console.error("Error populating drivers:", error);
        showToast("Error loading drivers for dropdown", "error");
        
        const errorOption = document.createElement('option');
        errorOption.value = "";
        errorOption.textContent = "Error loading drivers";
        errorOption.disabled = true;
        selectElement.appendChild(errorOption);
    }
}

// Function to create delivery from admin panel
async function createDelivery(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        const orderId = adminDeliveryForm.dataset.orderId || currentOrderId;
        if (!orderId) {
            throw new Error("Missing order ID - please try refreshing and selecting the order again");
        }

        const driverId = adminDeliveryDriverSelect.value;
        if (!driverId) {
            throw new Error("Please assign a driver to this delivery");
        }

        // Get driver info
        const driverDoc = await getDoc(doc(db, "users", driverId));
        const driverName = driverDoc.exists() ? 
            (driverDoc.data().name || driverDoc.data().email) : 'Unknown Driver';

        // Create delivery data
        const deliveryData = {
            orderId: orderId,
            customerName: adminCustomerNameInput.value.trim(),
            customerPhone: adminCustomerPhoneInput.value.trim(),
            deliveryAddress: adminDeliveryAddressInput.value.trim(),
            deliveryNotes: adminDeliveryNotesInput.value.trim() || null,
            status: "pending",
            driverId: driverId,
            driverName: driverName,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.uid
        };

        // Handle GPS coordinates properly
        const gpsInput = adminGpsCoordinatesInput.value.trim();
        if (gpsInput) {
            const coords = gpsInput.split(',').map(s => s.trim());
            if (coords.length === 2) {
                const lat = parseFloat(coords[0]);
                const lng = parseFloat(coords[1]);
                
                if (!isNaN(lat) && !isNaN(lng)) {
                    deliveryData.gpsCoordinates = new GeoPoint(lat, lng);
                }
            }
        }

        // Create delivery document
        const deliveryRef = await addDoc(collection(db, "deliveries"), deliveryData);
        
        // Update order status
        await updateDoc(doc(db, "orders", orderId), {
            status: "shipped",
            deliveryId: deliveryRef.id,
            updatedAt: serverTimestamp()
        });

        // Log activity
        await logAdminActivity(`Created delivery ${deliveryRef.id} for order ${orderId}`);

        showToast("Delivery created successfully!", "success");
        hideModal(orderActionModal, orderActionModalOverlay);
        loadOrders(); // Refresh orders table

    } catch (error) {
        console.error("Delivery creation error:", error);
        showToast(`Error: ${error.message}`, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Delivery';
    }
}

// Enhanced search functionality
function initEnhancedSearch() {
    document.querySelectorAll('.search-container').forEach(container => {
        const input = container.querySelector('.search-input');
        const clearBtn = document.createElement('button');
        clearBtn.className = 'search-clear';
        clearBtn.innerHTML = '<i class="fas fa-times"></i>';
        clearBtn.type = 'button';
        container.appendChild(clearBtn);
        
        // Clear search
        clearBtn.addEventListener('click', () => {
            input.value = '';
            input.focus();
            triggerSearch(input);
            clearBtn.style.display = 'none';
        });
        
        // Show/hide clear button based on input
        input.addEventListener('input', () => {
            clearBtn.style.display = input.value ? 'block' : 'none';
            triggerSearch(input);
        });
    });
}

function triggerSearch(input) {
    const section = input.closest('section').id;
    const searchTerm = input.value.trim();
    
    switch(section) {
        case 'products-section':
            loadProducts(searchTerm);
            break;
        case 'users-section':
            loadUsers(searchTerm);
            break;
        case 'orders-section':
            loadOrders(document.getElementById('orderFilter').value, searchTerm);
            break;
        case 'drivers-section':
            loadDrivers(searchTerm);
            break;
    }
}

async function logAdminActivity(action) {
    try {
        await addDoc(collection(db, "activity"), {
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || "Admin",
            action: action,
            timestamp: serverTimestamp(),
            status: "success"
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
}

// Load drivers
async function loadDrivers(searchTerm = '') {
    try {
        const driversCollection = collection(db, "users");
        let q = query(driversCollection, where("role", "==", "driver"));

        if (searchTerm) {
            q = query(driversCollection, 
                      where("role", "==", "driver"),
                      where("name", ">=", searchTerm), 
                      where("name", "<=", searchTerm + '\uf8ff'));
        }

        const snapshot = await getDocs(q);
        driversTableBody.innerHTML = '';
        
        if (snapshot.empty) {
            driversTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No drivers found</td></tr>';
            return;
        }
        
        snapshot.forEach(doc => {
            const driver = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${driver.name || 'N/A'}</td>
                <td>${driver.email}</td>
                <td>${driver.lastLogin ? new Date(driver.lastLogin.toDate()).toLocaleString() : 'Never'}</td>
                <td>
                    <span class="badge ${getDriverStatusBadgeClass(driver.status)}">
                        <i class="fas ${getDriverStatusIcon(driver.status)}"></i> ${driver.status || 'inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn-admin btn-admin-sm btn-admin-outline edit-driver" data-id="${doc.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-admin btn-admin-sm btn-admin-outline view-driver-deliveries" 
                            data-id="${doc.id}" 
                            data-driver-name="${driver.name || driver.email}">
                        <i class="fas fa-truck-loading"></i> Deliveries
                    </button>
                </td>
            `;
            driversTableBody.appendChild(row);
        });

        setupDeliveriesListener();
        
    } catch (error) {
        console.error("Error loading drivers:", error);
        showToast("Error loading drivers", "error");
    }
}

// Helper functions for driver status
function getDriverStatusBadgeClass(status) {
    switch(status) {
        case 'active':
            return 'badge-success';
        case 'on-duty':
            return 'badge-info';
        case 'inactive':
            return 'badge-danger';
        default:
            return 'badge-warning';
    }
}

function getDriverStatusIcon(status) {
    switch(status) {
        case 'active':
            return 'fa-user-check';
        case 'on-duty':
            return 'fa-truck-moving';
        case 'inactive':
            return 'fa-user-slash';
        default:
            return 'fa-question-circle';
    }
}

function setupDeliveriesListener() {
    const deliveriesRef = collection(db, "deliveries");
    const q = query(deliveriesRef, orderBy("createdAt", "desc"));
    
    // Remove existing listener if any
    if (window.deliveriesUnsubscribe) {
        window.deliveriesUnsubscribe();
    }
    
    window.deliveriesUnsubscribe = onSnapshot(q, 
        (snapshot) => {
            console.log("Admin deliveries updated:", snapshot.size);
            loadAllDeliveries(); // Refresh the table
        },
        (error) => {
            console.error("Deliveries listener error:", error);
            showToast("Error loading deliveries updates", "error");
        }
    );
}

async function getOnDutyDriversCount() {
    try {
        const q = query(collection(db, "users"), where("role", "==", "driver"), where("status", "==", "on-duty"));
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error getting on-duty drivers count:", error);
        return 0;
    }
}

// Get order status badge class
// function getOrderStatusBadgeClass(status) {
//     switch(status.toLowerCase()) {
//         case 'completed':
//         case 'delivered':
//             return 'badge-success';
//         case 'cancelled':
//             return 'badge-danger';
//         case 'processing':
//         case 'shipped':
//         case 'pending':
//             return 'badge-warning';
//         default:
//             return 'badge-info';
//     }
// }

// Setup Navigation
function setupAdminNavigation() {
    document.querySelectorAll('.admin-nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Cleanup previous listeners
            if (window.deliveriesUnsubscribe) {
                window.deliveriesUnsubscribe();
                window.deliveriesUnsubscribe = null;
            }
            
            document.querySelectorAll('.admin-nav a').forEach(navLink => navLink.classList.remove('active'));
            this.classList.add('active');

            const sectionId = this.dataset.section + '-section';
            const section = document.getElementById(sectionId);
            if (!section) {
                console.error(`Section with ID ${sectionId} not found`);
                return;
            }

            // Hide all sections
            document.querySelectorAll('.admin-content > section').forEach(section => {
                section.style.display = 'none';
            });

            // Show the selected section
            section.style.display = 'block';

            // Load data for the section
            switch(this.dataset.section) {
                case 'dashboard':
                    loadDashboardData();
                    break;
                case 'products':
                    loadProducts();
                    break;
                case 'users':
                    loadUsers();
                    break;
                case 'orders':
                    loadOrders();
                    break;
                case 'drivers':
                    loadDrivers();
                    loadAllDeliveries(); // Load all deliveries immediately
                    break;
                case 'settings':
                    break;
            }
        });
    });

    // Activate the dashboard by default
    const defaultLink = document.querySelector('.admin-nav a[data-section="dashboard"]');
    if (defaultLink) {
        defaultLink.click();
    }
}

// Setup Modals
function setupModals() {
    // Product Modal
    const productModal = document.getElementById('productModal');
    const productModalOverlay = document.getElementById('productModalOverlay');
    const closeProductModal = document.getElementById('closeProductModal');
    const addProductBtn = document.getElementById('addProductBtn');
    const cancelProductBtn = document.getElementById('cancelProductBtn');
    const productImageInput = document.getElementById('productImage');
    const productImagePreview = document.getElementById('productImagePreview');

    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            document.getElementById('productForm').reset();
            document.getElementById('productId').value = '';
            document.getElementById('productModalTitle').innerHTML = '<i class="fas fa-box-open"></i> Add New Product';
            productImagePreview.style.display = 'none';
            showModal(productModal, productModalOverlay);
        });
    }

    if (closeProductModal) {
        closeProductModal.addEventListener('click', () => hideModal(productModal, productModalOverlay));
    }
    if (cancelProductBtn) {
        cancelProductBtn.addEventListener('click', () => hideModal(productModal, productModalOverlay));
    }
    if (productImageInput) {
        productImageInput.addEventListener('input', (e) => updateImagePreview(e.target.value));
    }

    // Admin Modal
    const adminModal = document.getElementById('adminModal');
    const adminModalOverlay = document.getElementById('adminModalOverlay');
    const closeAdminModal = document.getElementById('closeAdminModal');
    const addUserBtn = document.getElementById('addUserBtn'); // This now also handles adding admins if role is set
    const cancelAddAdminBtn = document.getElementById('cancelAddAdminBtn');

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            document.getElementById('adminForm').reset();
            document.getElementById('adminModalTitle').innerHTML = '<i class="fas fa-user-shield"></i> Add New User'; // Can be adjusted for admin/driver add
            showModal(adminModal, adminModalOverlay);
        });
    }
    if (closeAdminModal) {
        closeAdminModal.addEventListener('click', () => hideModal(adminModal, adminModalOverlay));
    }
    if (cancelAddAdminBtn) {
        cancelAddAdminBtn.addEventListener('click', () => hideModal(adminModal, adminModalOverlay));
    }

    // User Edit Modal
    const userModal = document.getElementById('userModal');
    const userModalOverlay = document.getElementById('userModalOverlay');
    const closeUserModal = document.getElementById('closeUserModal');
    const cancelUserEditBtn = document.getElementById('cancelUserEditBtn');

    if (closeUserModal) {
        closeUserModal.addEventListener('click', () => hideModal(userModal, userModalOverlay));
    }
    if (cancelUserEditBtn) {
        cancelUserEditBtn.addEventListener('click', () => hideModal(userModal, userModalOverlay));
    }

    // Edit Driver Modal
    const editDriverModal = document.getElementById('editDriverModal');
    const editDriverModalOverlay = document.getElementById('editDriverModalOverlay');
    const closeEditDriverModal = document.getElementById('closeEditDriverModal');
    const cancelEditDriverBtn = document.getElementById('cancelEditDriverBtn');

    if (closeEditDriverModal) {
        closeEditDriverModal.addEventListener('click', () => hideModal(editDriverModal, editDriverModalOverlay));
    }
    if (cancelEditDriverBtn) {
        cancelEditDriverBtn.addEventListener('click', () => hideModal(editDriverModal, editDriverModalOverlay));
    }

    // Delivery Details Modal (for drivers section)
    const deliveryDetailsModal = document.getElementById('deliveryDetailsModal');
    const deliveryDetailsModalOverlay = document.getElementById('deliveryDetailsModalOverlay');
    const closeDeliveryDetailsModal = document.getElementById('closeDeliveryDetailsModal');

    if (closeDeliveryDetailsModal) {
        closeDeliveryDetailsModal.addEventListener('click', () => hideModal(deliveryDetailsModal, deliveryDetailsModalOverlay));
    }
    
    // Edit Delivery Modal (for all deliveries table)
    const editDeliveryModal = document.getElementById('editDeliveryModal');
    const editDeliveryModalOverlay = document.getElementById('editDeliveryModalOverlay');
    const closeEditDeliveryModal = document.getElementById('closeEditDeliveryModal');
    const cancelEditDeliveryBtn = document.getElementById('cancelEditDeliveryBtn');

    if (closeEditDeliveryModal) {
        closeEditDeliveryModal.addEventListener('click', () => hideModal(editDeliveryModal, editDeliveryModalOverlay));
    }
    if (cancelEditDeliveryBtn) {
        cancelEditDeliveryBtn.addEventListener('click', () => hideModal(editDeliveryModal, editDeliveryModalOverlay));
    }

    // NEW: Order Action Modal
    if (closeOrderActionModal) {
        closeOrderActionModal.addEventListener('click', () => hideModal(orderActionModal, orderActionModalOverlay));
    }
    if (cancelAddDeliveryAdminBtn) {
        cancelAddDeliveryAdminBtn.addEventListener('click', () => hideModal(orderActionModal, orderActionModalOverlay));
    }
}

function showModal(modal, overlay) {
    console.log('Attempting to show modal:', modal.id);
    overlay.classList.add('show');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent scrolling of background
}

function hideModal(modal, overlay) {
    console.log('Attempting to hide modal:', modal.id);
    modal.classList.remove('show');
    overlay.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
}

function setupEventListeners() {
    // Initialize all modal elements first
    const productModal = document.getElementById('productModal');
    const productModalOverlay = document.getElementById('productModalOverlay');
    const adminModal = document.getElementById('adminModal');
    const adminModalOverlay = document.getElementById('adminModalOverlay');
    const userModal = document.getElementById('userModal');
    const userModalOverlay = document.getElementById('userModalOverlay');
    const editDriverModal = document.getElementById('editDriverModal');
    const editDriverModalOverlay = document.getElementById('editDriverModalOverlay');
    const deliveryDetailsModal = document.getElementById('deliveryDetailsModal');
    const deliveryDetailsModalOverlay = document.getElementById('deliveryDetailsModalOverlay');
    const editDeliveryModal = document.getElementById('editDeliveryModal');
    const editDeliveryModalOverlay = document.getElementById('editDeliveryModalOverlay');
    const orderActionModal = document.getElementById('orderActionModal');
    const orderActionModalOverlay = document.getElementById('orderActionModalOverlay');

    // Form submissions
    const productForm = document.getElementById('productForm');
    if (productForm) productForm.addEventListener('submit', saveProduct);
    
    const adminForm = document.getElementById('adminForm');
    if (adminForm) adminForm.addEventListener('submit', createNewUser);
    
    const userForm = document.getElementById('userForm');
    if (userForm) userForm.addEventListener('submit', saveUser);
    
    const editDriverForm = document.getElementById('editDriverForm');
    if (editDriverForm) editDriverForm.addEventListener('submit', saveDriver);
    
    const editDeliveryForm = document.getElementById('editDeliveryForm');
    if (editDeliveryForm) editDeliveryForm.addEventListener('submit', saveEditedDelivery);

    if (adminDeliveryForm) adminDeliveryForm.addEventListener('submit', createDelivery);

    // Delegated event listeners for edit/delete buttons on tables
    document.addEventListener('click', async (e) => {
        // Product actions
        if (e.target.classList.contains('edit-product')) {
            editProduct(e.target.dataset.id);
        } else if (e.target.classList.contains('delete-product')) {
            deleteProduct(e.target.dataset.id);
        }
        // User actions
        else if (e.target.classList.contains('edit-user')) {
            editUser(e.target.dataset.id);
        } else if (e.target.classList.contains('delete-user')) {
            deleteUser(e.target.dataset.id);
        }
        // Order actions
        else if (e.target.classList.contains('view-order')) {
            viewOrder(e.target.dataset.id);
        } else if (e.target.classList.contains('delete-order')) {
            deleteOrder(e.target.dataset.id);
        }
        // Driver actions
        else if (e.target.classList.contains('edit-driver')) {
            editDriver(e.target.dataset.id);
        } else if (e.target.classList.contains('view-driver-deliveries')) {
            const driverId = e.target.dataset.id;
            const driverName = e.target.dataset.driverName;
            await viewDriverDeliveries(driverId);
        }
        // Admin Deliveries table actions
        else if (e.target.classList.contains('view-delivery')) {
            viewDeliveryDetails(e.target.dataset.id);
        } else if (e.target.classList.contains('edit-delivery')) {
            editDelivery(e.target.dataset.id);
        } else if (e.target.classList.contains('delete-delivery')) {
            deleteDelivery(e.target.dataset.id);
        }
    });

    // Order Action Modal specific listeners
    if (ordersTableBody) {
        ordersTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('status-pending-clickable')) {
                const orderId = e.target.dataset.orderId;
                if (orderId) handlePendingOrderStatusClick(orderId);
            }
        });
    }

    const confirmOrderButton = document.getElementById('confirmOrderActionBtn');
    const addDeliveryButton = document.getElementById('addDeliveryBtn');
    const closeOrderActionModal = document.querySelector('[data-modal="orderActionModal"]');

    if (confirmOrderButton) {
        confirmOrderButton.addEventListener('click', () => {
            if (currentOrderId) confirmOrder(currentOrderId);
        });
    }

    if (addDeliveryButton) {
        addDeliveryButton.addEventListener('click', async () => {
            if (currentOrderId) {
                const orderDoc = await getDoc(doc(db, "orders", currentOrderId));
                if (orderDoc.exists()) showAddDeliveryForm(orderDoc.data());
            }
        });
    }

    if (closeOrderActionModal && orderActionModal && orderActionModalOverlay) {
        closeOrderActionModal.addEventListener('click', () => {
            hideModal(orderActionModal, orderActionModalOverlay);
        });
    }

    // Handle clicks on pending order status
    if (ordersTableBody) {
        ordersTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('status-pending-clickable')) {
                const orderId = e.target.dataset.orderId;
                if (orderId) {
                    handlePendingOrderStatusClick(orderId);
                }
            }
        });
    }

    // Settings form submission
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
    
    const refreshActivityBtn = document.getElementById('refreshActivity');
    if (refreshActivityBtn) refreshActivityBtn.addEventListener('click', loadRecentActivity);
    
    // Admin Add Delivery Button (if exists separately from order flow)
    const addDeliveryBtnAdmin = document.getElementById('addDeliveryBtnAdmin');
    if (addDeliveryBtnAdmin) {
        addDeliveryBtnAdmin.addEventListener('click', () => {
            showToast("This button is not yet fully implemented for standalone delivery creation. Please use the 'Pending' order flow.", "info");
        });
    }

    // Modal close buttons
    const closeButtons = [
        { btn: document.getElementById('closeProductModal'), modal: productModal, overlay: productModalOverlay },
        { btn: document.getElementById('closeAdminModal'), modal: adminModal, overlay: adminModalOverlay },
        { btn: document.getElementById('closeUserModal'), modal: userModal, overlay: userModalOverlay },
        { btn: document.getElementById('closeEditDriverModal'), modal: editDriverModal, overlay: editDriverModalOverlay },
        { btn: document.getElementById('closeDeliveryDetailsModal'), modal: deliveryDetailsModal, overlay: deliveryDetailsModalOverlay },
        { btn: document.getElementById('closeEditDeliveryModal'), modal: editDeliveryModal, overlay: editDeliveryModalOverlay }
    ];

    closeButtons.forEach(({btn, modal, overlay}) => {
        if (btn && modal && overlay) {
            btn.addEventListener('click', () => hideModal(modal, overlay));
        }
    });

    // Cancel buttons
    const cancelButtons = [
        { btn: document.getElementById('cancelProductEditBtn'), modal: productModal, overlay: productModalOverlay },
        { btn: document.getElementById('cancelAddAdminBtn'), modal: adminModal, overlay: adminModalOverlay },
        { btn: document.getElementById('cancelUserEditBtn'), modal: userModal, overlay: userModalOverlay },
        { btn: document.getElementById('cancelEditDriverBtn'), modal: editDriverModal, overlay: editDriverModalOverlay },
        { btn: document.getElementById('cancelEditDeliveryBtn'), modal: editDeliveryModal, overlay: editDeliveryModalOverlay },
        { btn: document.getElementById('cancelAddDeliveryAdminBtn'), modal: orderActionModal, overlay: orderActionModalOverlay }
    ];

    cancelButtons.forEach(({btn, modal, overlay}) => {
        if (btn && modal && overlay) {
            btn.addEventListener('click', () => hideModal(modal, overlay));
        }
    });
}

// PRODUCT FUNCTIONS
async function saveProduct(event) {
    event.preventDefault();
    const productId = document.getElementById('productId').value;
    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const stock = parseInt(document.getElementById('productStock').value);
    const imageUrl = document.getElementById('productImage').value;
    const featured = document.getElementById('productFeatured').checked;

    if (!name || !category || isNaN(price) || isNaN(stock) || !imageUrl) {
        showToast("Please fill all required product fields.", "error");
        return;
    }

    try {
        const productData = {
            name, description, category, price, stock, imageUrl, featured,
            updatedAt: serverTimestamp()
        };

        if (productId) {
            await updateDoc(doc(db, "products", productId), productData);
            showToast("Product updated successfully!", "success");
        } else {
            productData.createdAt = serverTimestamp();
            await addDoc(collection(db, "products"), productData);
            showToast("Product added successfully!", "success");
        }
        hideModal(document.getElementById('productModal'), document.getElementById('productModalOverlay'));
        loadProducts();
    } catch (error) {
        console.error("Error saving product:", error);
        showToast("Error saving product", "error");
    }
}

async function editProduct(productId) {
    try {
        const productDoc = await getDoc(doc(db, "products", productId));
        if (productDoc.exists()) {
            const product = productDoc.data();
            document.getElementById('productId').value = productId;
            document.getElementById('productName').value = product.name || '';
            document.getElementById('productDescription').value = product.description || '';
            document.getElementById('productCategory').value = product.category || '';
            document.getElementById('productPrice').value = product.price || 0;
            document.getElementById('productStock').value = product.stock || 0;
            document.getElementById('productImage').value = product.imageUrl || '';
            document.getElementById('productFeatured').checked = product.featured || false;
            document.getElementById('productModalTitle').innerHTML = '<i class="fas fa-box-open"></i> Edit Product';
            updateImagePreview(product.imageUrl);
            showModal(document.getElementById('productModal'), document.getElementById('productModalOverlay'));
        } else {
            showToast('Product not found', 'error');
        }
    } catch (error) {
        console.error('Error editing product:', error);
        showToast('Error loading product details', 'error');
    }
}

function updateImagePreview(imageUrl) {
    const preview = document.getElementById('productImagePreview');
    if (imageUrl) {
        preview.src = imageUrl;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            await deleteDoc(doc(db, "products", productId));
            showToast("Product deleted successfully!", "success");
            loadProducts();
        } catch (error) {
            console.error("Error deleting product:", error);
            showToast("Error deleting product", "error");
        }
    }
}

// USER FUNCTIONS
async function createNewUser(event) {
    event.preventDefault();
    const name = document.getElementById('adminName').value;
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const role = document.getElementById('userRole') ? document.getElementById('userRole').value : 'customer'; // Default to customer

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
            role: role,
            status: 'active',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        });
        showToast(`User (${role}) created successfully!`, "success");
        hideModal(document.getElementById('adminModal'), document.getElementById('adminModalOverlay'));
        loadUsers();
    } catch (error) {
        console.error("Error creating new user:", error);
        showToast(`Error creating user: ${error.message}`, "error");
    }
}

async function editUser(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const user = userDoc.data();
            document.getElementById('userModalTitle').textContent = 'Edit User';
            document.getElementById('userId').value = userId;
            document.getElementById('userName').value = user.name || '';
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userRole').value = user.role || 'customer';
            document.getElementById('userStatus').value = user.status || 'active';
            showModal(document.getElementById('userModal'), document.getElementById('userModalOverlay'));
        } else {
            showToast('User not found', 'error');
        }
    } catch (error) {
        console.error('Error editing user:', error);
        showToast('Error loading user details', 'error');
    }
}

async function saveUser(event) {
    event.preventDefault();
    const userId = document.getElementById('userId').value;
    const name = document.getElementById('userName').value;
    const role = document.getElementById('userRole').value;
    const status = document.getElementById('userStatus').value;

    try {
        await updateDoc(doc(db, "users", userId), {
            name: name,
            role: role,
            status: status,
            updatedAt: serverTimestamp()
        });
        showToast("User updated successfully!", "success");
        hideModal(document.getElementById('userModal'), document.getElementById('userModalOverlay'));
        loadUsers();
    } catch (error) {
        console.error("Error saving user:", error);
        showToast("Error saving user", "error");
    }
}

async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            await deleteDoc(doc(db, "users", userId));
            showToast("User deleted successfully!", "success");
            loadUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
            showToast("Error deleting user", "error");
        }
    }
}

// ORDER FUNCTIONS
let currentOrderId = null; // Variable to store the order ID being acted upon

async function viewOrder(orderId) {
    try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (!orderDoc.exists()) {
            showToast("Order not found.", "error");
            return;
        }
        const order = orderDoc.data();
        
        // This 'viewOrder' is a placeholder. You might want a dedicated modal for viewing full order details.
        // For now, it just confirms the order if pending, or shows the delivery form if already processed.
        handlePendingOrderStatusClick(orderId);

    } catch (error) {
        console.error("Error viewing order:", error);
        showToast("Error loading order details", "error");
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
        return;
    }

    try {
        // First check if the order exists
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            showToast("Order not found", "error");
            return;
        }

        // If there's an associated delivery, delete that first
        const orderData = orderSnap.data();
        if (orderData.deliveryId) {
            try {
                await deleteDoc(doc(db, "deliveries", orderData.deliveryId));
            } catch (deliveryError) {
                console.error("Error deleting associated delivery:", deliveryError);
                // Continue with order deletion even if delivery deletion fails
            }
        }

        // Delete the order
        await deleteDoc(orderRef);
        showToast("Order deleted successfully!", "success");
        
        // Refresh orders table
        const currentFilter = document.getElementById('orderFilter')?.value || 'all';
        const currentSearch = document.getElementById('orderSearch')?.value || '';
        loadOrders(currentFilter, currentSearch);

    } catch (error) {
        console.error("Error deleting order:", error);
        showToast(`Error deleting order: ${error.message}`, "error");
    }
}


// DRIVER FUNCTIONS
async function saveDriver(event) {
    event.preventDefault();
    const driverId = document.getElementById('editDriverId').value;
    const status = document.getElementById('editDriverStatus').value;

    try {
        await updateDoc(doc(db, "users", driverId), {
            status: status,
            updatedAt: serverTimestamp()
        });
        showToast("Driver updated successfully!", "success");
        hideModal(document.getElementById('editDriverModal'), document.getElementById('editDriverModalOverlay'));
        loadDrivers();
    } catch (error) {
        console.error("Error saving driver:", error);
        showToast("Error saving driver", "error");
    }
}

async function editDriver(driverId) {
    try {
        const driverDoc = await getDoc(doc(db, "users", driverId));
        if (driverDoc.exists()) {
            const driver = driverDoc.data();
            document.getElementById('editDriverId').value = driverId;
            document.getElementById('editDriverName').value = driver.name || '';
            document.getElementById('editDriverEmail').value = driver.email || '';
            document.getElementById('editDriverStatus').value = driver.status || 'active';
            showModal(document.getElementById('editDriverModal'), document.getElementById('editDriverModalOverlay'));
        } else {
            showToast('Driver not found', 'error');
        }
    } catch (error) {
        console.error('Error editing driver:', error);
        showToast('Error loading driver details', 'error');
    }
}

async function viewDriverDeliveries(driverId) {
    try {
        const driverDoc = await getDoc(doc(db, "users", driverId));
        if (!driverDoc.exists()) {
            showToast("Driver not found.", "error");
            return;
        }
        
        const driver = driverDoc.data();
        const driverNameHeader = document.getElementById('driverNameHeader');
        
        if (driverNameHeader) {
            driverNameHeader.innerHTML = `<i class="fas fa-truck"></i> ${driver.name || driver.email}`;
            driverNameHeader.dataset.driverId = driverId;
        }
        
        // Load stats and deliveries
        await loadDriverStats(driverId);
        await loadDeliveriesForDriver(driverId, 'all');

        // Show the section and scroll to it
        if (driverStatsSection) {
            driverStatsSection.style.display = 'block';
            driverStatsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

    } catch (error) {
        console.error("Error viewing driver deliveries:", error);
        showToast("Error loading driver deliveries", "error");
    }
}

async function loadDriverStats(driverId) {
    try {
        const deliveriesRef = collection(db, "deliveries");
        const q = query(deliveriesRef, where("driverId", "==", driverId));
        const snapshot = await getDocs(q);

        let total = snapshot.size;
        let completed = 0;
        let inProgress = 0;

        snapshot.forEach(doc => {
            const delivery = doc.data();
            if (delivery.status === 'completed') {
                completed++;
            } else if (delivery.status === 'in-progress') {
                inProgress++;
            }
        });

        document.getElementById('driverTotalDeliveries').textContent = total;
        document.getElementById('driverCompletedDeliveries').textContent = completed;
        document.getElementById('driverInProgressDeliveries').textContent = inProgress;

    } catch (error) {
        console.error("Error loading driver stats:", error);
        showToast("Error loading driver statistics", "error");
    }
}

async function loadDeliveriesForDriver(driverId, filterStatus = 'all') {
    try {
        const deliveriesRef = collection(db, "deliveries");
        let q = query(deliveriesRef, where("driverId", "==", driverId), orderBy("createdAt", "desc"));

        if (filterStatus !== 'all') {
            q = query(deliveriesRef, 
                      where("driverId", "==", driverId), 
                      where("status", "==", filterStatus),
                      orderBy("createdAt", "desc"));
        }

        const snapshot = await getDocs(q);
        driverDeliveriesTableBody.innerHTML = '';
        
        if (snapshot.empty) {
            driverDeliveriesTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No deliveries found for this driver.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const delivery = doc.data();
            const deliveryId = doc.id;
            const createdAt = delivery.createdAt ? new Date(delivery.createdAt.toDate()).toLocaleString() : 'N/A';
            const completedAt = delivery.completedAt ? new Date(delivery.completedAt.toDate()).toLocaleString() : 'N/A';
            const statusClass = getDeliveryStatusBadgeClass(delivery.status);

            const row = document.createElement('tr');
            row.innerHTML = `
            <td>${delivery.customerName || 'N/A'}</td>
            <td>${delivery.deliveryAddress || 'N/A'}</td>
            <td>${createdAt}</td>
            <td><span class="badge ${statusClass}">${delivery.status}</span></td>
            <td>${completedAt}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-action btn-view view-delivery" data-id="${deliveryId}">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-table-action btn-edit edit-delivery" data-id="${deliveryId}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </td>
        `;
            driverDeliveriesTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading deliveries for driver:", error);
        driverDeliveriesTableBody.innerHTML = '<tr><td colspan="6">Error loading deliveries</td></tr>';
    }
}

// Function to view delivery details (admin-side, from driver's list or all deliveries list)
async function viewDeliveryDetails(deliveryId) {
    try {
        const deliveryDoc = await getDoc(doc(db, "deliveries", deliveryId));
        if (!deliveryDoc.exists()) {
            showToast("Delivery not found.", "error");
            return;
        }
        const delivery = deliveryDoc.data();

        // Update modal content
        document.getElementById('detailOrderId').textContent = delivery.orderId || 'N/A';
        document.getElementById('detailCustomerName').textContent = delivery.customerName || 'N/A';
        document.getElementById('detailAddress').textContent = delivery.deliveryAddress || 'N/A';
        document.getElementById('detailPhone').textContent = delivery.customerPhone || 'N/A';
        document.getElementById('detailNotes').textContent = delivery.deliveryNotes || 'N/A';
        document.getElementById('detailStatus').textContent = delivery.status || 'N/A';
        document.getElementById('detailAssignedDriver').textContent = delivery.driverName || 'N/A';
        document.getElementById('detailCreatedAt').textContent = delivery.createdAt ? new Date(delivery.createdAt.toDate()).toLocaleString() : 'N/A';
        document.getElementById('detailUpdatedAt').textContent = delivery.updatedAt ? new Date(delivery.updatedAt.toDate()).toLocaleString() : 'N/A';

        // Show the modal
        showModal(document.getElementById('deliveryDetailsModal'), document.getElementById('deliveryDetailsModalOverlay'));

        // Initialize map - ensure the element exists and Leaflet is loaded
        const mapElement = document.getElementById('deliveryMap');
        if (!mapElement) {
            console.error("Map element not found");
            return;
        }

        // Clear any existing map
        if (mapElement._map) {
            mapElement._map.remove();
        }

        // Create new map
        const map = L.map('deliveryMap').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Store map reference on the element
        mapElement._map = map;

        // Add marker if we have coordinates
        if (delivery.gpsCoordinates) {
            const latLng = [delivery.gpsCoordinates.latitude, delivery.gpsCoordinates.longitude];
            L.marker(latLng).addTo(map)
                .bindPopup(`<b>Delivery Location:</b><br>${delivery.deliveryAddress}`)
                .openPopup();
            map.setView(latLng, 15);
        } else if (delivery.deliveryAddress) {
            // Attempt geocoding if no coordinates but have address
            const coords = await geocodeAddress(delivery.deliveryAddress);
            if (coords) {
                const latLng = [coords.lat, coords.lng];
                L.marker(latLng).addTo(map)
                    .bindPopup(`<b>Delivery Location:</b><br>${delivery.deliveryAddress}`)
                    .openPopup();
                map.setView(latLng, 15);
            }
        }

        // Ensure map renders correctly in modal
        setTimeout(() => map.invalidateSize(), 100);

    } catch (error) {
        console.error("Error viewing delivery details:", error);
        showToast("Error loading delivery details", "error");
    }
}

// Function to edit delivery (admin-side)
async function editDelivery(deliveryId) {
    try {
        const deliveryDoc = await getDoc(doc(db, "deliveries", deliveryId));
        if (!deliveryDoc.exists()) {
            showToast("Delivery not found.", "error");
            return;
        }
        const delivery = deliveryDoc.data();

        document.getElementById('editDeliveryId').value = deliveryId;
        document.getElementById('editCustomerName').value = delivery.customerName || '';
        document.getElementById('editCustomerPhone').value = delivery.customerPhone || '';
        document.getElementById('editDeliveryAddress').value = delivery.deliveryAddress || '';
        document.getElementById('editDeliveryNotes').value = delivery.deliveryNotes || '';
        document.getElementById('editGpsCoordinates').value = delivery.gpsCoordinates ? `${delivery.gpsCoordinates.latitude}, ${delivery.gpsCoordinates.longitude}` : '';
        document.getElementById('editDeliveryStatus').value = delivery.status || 'pending';

        await populateDriverDropdown(document.getElementById('editDeliveryDriver'), delivery.driverId);

        showModal(document.getElementById('editDeliveryModal'), document.getElementById('editDeliveryModalOverlay'));
    } catch (error) {
        console.error("Error editing delivery:", error);
        showToast("Error loading delivery details", "error");
    }
}

async function saveEditedDelivery(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        const deliveryId = document.getElementById('editDeliveryId').value;
        const driverId = document.getElementById('editDeliveryDriver').value;
        
        if (!driverId) {
            showToast("Please assign a driver", "error");
            return;
        }
        
        // Get driver name
        const driverDoc = await getDoc(doc(db, "users", driverId));
        const driverName = driverDoc.exists() ? 
            (driverDoc.data().name || driverDoc.data().email) : 'Unknown Driver';
        
        const updateData = {
            customerName: document.getElementById('editCustomerName').value.trim(),
            customerPhone: document.getElementById('editCustomerPhone').value.trim(),
            deliveryAddress: document.getElementById('editDeliveryAddress').value.trim(),
            deliveryNotes: document.getElementById('editDeliveryNotes').value.trim() || null,
            status: document.getElementById('editDeliveryStatus').value,
            driverId: driverId,
            driverName: driverName,
            updatedAt: serverTimestamp()
        };
        
        // Handle GPS coordinates
        const gpsInput = document.getElementById('editGpsCoordinates').value.trim();
        if (gpsInput) {
            const [latStr, lngStr] = gpsInput.split(',').map(s => s.trim());
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                updateData.gpsCoordinates = new GeoPoint(lat, lng);
            }
        }
        
        await updateDoc(doc(db, "deliveries", deliveryId), updateData);
        
        showToast("Delivery updated successfully!", "success");
        hideModal(document.getElementById('editDeliveryModal'), document.getElementById('editDeliveryModalOverlay'));
        
        // Refresh the appropriate view
        const currentSection = document.querySelector('.admin-nav a.active')?.dataset.section;
        if (currentSection === 'drivers') {
            const activeDriverId = document.getElementById('driverNameHeader')?.dataset.driverId;
            if (activeDriverId) {
                await loadDeliveriesForDriver(activeDriverId, 'all');
            }
        }
        await loadAllDeliveries();
        
    } catch (error) {
        console.error("Error saving delivery:", error);
        showToast(`Error saving delivery: ${error.message}`, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Changes';
    }
}


async function deleteDelivery(deliveryId) {
    if (confirm('Are you sure you want to delete this delivery?')) {
        try {
            await deleteDoc(doc(db, "deliveries", deliveryId));
            showToast("Delivery deleted successfully!", "success");
            
            // Refresh the appropriate table
            const currentSection = document.querySelector('.admin-nav a.active').dataset.section;
            if (currentSection === 'drivers') {
                const driverId = document.getElementById('driverNameHeader')?.dataset.driverId;
                if (driverId) {
                    loadDeliveriesForDriver(driverId);
                } else {
                    loadAllDeliveries();
                }
            } else {
                loadAllDeliveries();
            }
        } catch (error) {
            console.error("Error deleting delivery:", error);
            showToast("Error deleting delivery", "error");
        }
    }
}

// async function createDelivery(event) {
//     event.preventDefault();
//     const submitBtn = adminDeliveryForm.querySelector('button[type="submit"]');
//     submitBtn.disabled = true;
//     submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating...';

//     const orderId = adminDeliveryForm.dataset.orderId;
//     if (!orderId) {
//         showToast("Order ID not found for delivery creation.", "error");
//         submitBtn.disabled = false;
//         submitBtn.innerHTML = 'Create Delivery';
//         return;
//     }

//     const customerName = adminCustomerNameInput.value;
//     const customerPhone = adminCustomerPhoneInput.value;
//     const deliveryAddress = adminDeliveryAddressInput.value;
//     const deliveryNotes = adminDeliveryNotesInput.value;
//     const gpsCoordinatesText = adminGpsCoordinatesInput.value;
//     const driverId = adminDeliveryDriverSelect.value;
//     const assignedDriverName = adminDeliveryDriverSelect.options[adminDeliveryDriverSelect.selectedIndex].text;

//     let gpsCoordinates = null;
//     if (gpsCoordinatesText) {
//         const [lat, lng] = gpsCoordinatesText.split(',').map(s => parseFloat(s.trim()));
//         if (!isNaN(lat) && !isNaN(lng)) {
//             gpsCoordinates = new GeoPoint(lat, lng);
//         } else {
//             showToast("Invalid GPS Coordinates format. Please use 'latitude, longitude'.", "error");
//             submitBtn.disabled = false;
//             submitBtn.innerHTML = 'Create Delivery';
//             return;
//         }
//     }

//     if (!driverId) {
//         showToast("Please assign a driver.", "error");
//         submitBtn.disabled = false;
//         submitBtn.innerHTML = 'Create Delivery';
//         return;
//     }

//     try {
//         // Create the delivery document
//         const deliveryRef = await addDoc(collection(db, "deliveries"), {
//             orderId: orderId,
//             customerName: customerName,
//             customerPhone: customerPhone,
//             deliveryAddress: deliveryAddress,
//             deliveryNotes: deliveryNotes,
//             gpsCoordinates: gpsCoordinates,
//             driverId: driverId,
//             assignedDriverName: assignedDriverName,
//             status: "pending", // Important: Set to pending
//             createdAt: serverTimestamp(),
//             updatedAt: serverTimestamp()
//         });

//         // Update the order status
//         await updateDoc(doc(db, "orders", orderId), {
//             status: "shipped",
//             deliveryId: deliveryRef.id,
//             updatedAt: serverTimestamp()
//         });

//         showToast("Delivery created and order updated successfully!", "success");
//         hideModal(orderActionModal, orderActionModalOverlay);
//         loadOrders(); // Refresh orders table

//     } catch (error) {
//         console.error("Error creating delivery:", error);
//         showToast("Failed to create delivery", "error");
//     } finally {
//         submitBtn.disabled = false;
//         submitBtn.innerHTML = 'Create Delivery';
//     }
// }

// SETTINGS FUNCTIONS
async function saveSettings(event) {
    event.preventDefault();
    const siteName = document.getElementById('siteName').value;
    const currency = document.getElementById('currency').value;
    const adminEmailForNotifications = document.getElementById('adminEmailForNotifications').value;

    try {
        // Example: save settings to a 'settings' document in Firestore
        await setDoc(doc(db, "settings", "appSettings"), {
            siteName,
            currency,
            adminEmailForNotifications,
            updatedAt: serverTimestamp()
        }, { merge: true }); // Use merge to update without overwriting other settings
        showToast("Settings saved successfully!", "success");
    } catch (error) {
        console.error("Error saving settings:", error);
        showToast("Error saving settings. Please try again.", "error");
    }
}

// SEARCH AND FILTER FUNCTIONS
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function initUserSearch() {
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(() => {
            loadUsers(userSearch.value.trim());
        }, 300));
    }
}

function initProductSearch() {
    const productSearch = document.getElementById('productSearch');
    if (productSearch) {
        productSearch.addEventListener('input', debounce(() => {
            loadProducts(productSearch.value.trim());
        }, 300));
    }
}

function initOrderFilter() {
    const orderFilter = document.getElementById('orderFilter');
    const orderSearch = document.getElementById('orderSearch');
    if (orderFilter) {
        orderFilter.addEventListener('change', () => {
            loadOrders(orderFilter.value, orderSearch ? orderSearch.value.trim() : '');
        });
    }
    if (orderSearch) {
        orderSearch.addEventListener('input', debounce(() => {
            loadOrders(orderFilter ? orderFilter.value : 'all', orderSearch.value.trim());
        }, 300));
    }
}

function initDriverSearch() {
    const driverSearch = document.getElementById('driverSearch');
    if (driverSearch) {
        driverSearch.addEventListener('input', debounce(() => {
            loadDrivers(driverSearch.value.trim());
        }, 300));
    }
}

function initDeliveryFilter() {
    const deliveryFilter = document.getElementById('deliveryFilter');
    if (deliveryFilter) {
        deliveryFilter.addEventListener('change', () => {
            // This would filter the driver deliveries table if driverStatsSection is open
            const activeDriverId = document.getElementById('driverNameHeader').dataset.driverId; // Assuming you set this
            if (activeDriverId) {
                loadDeliveriesForDriver(activeDriverId, deliveryFilter.value);
            }
        });
    }
}

// Load all deliveries (admin function)
async function loadAllDeliveries() {
    try {
        const deliveriesRef = collection(db, "deliveries");
        const q = query(deliveriesRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        console.log("Loading all deliveries:", snapshot.size);
        
        if (!driverDeliveriesTableBody) {
            console.error("Driver deliveries table body not found");
            return;
        }
        
        driverDeliveriesTableBody.innerHTML = '';
        
        if (snapshot.empty) {
            driverDeliveriesTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No deliveries found.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const delivery = doc.data();
            const deliveryId = doc.id;
            const createdAt = delivery.createdAt ? new Date(delivery.createdAt.toDate()).toLocaleString() : 'N/A';
            const completedAt = delivery.completedAt ? new Date(delivery.completedAt.toDate()).toLocaleString() : 'N/A';
            const statusClass = getDeliveryStatusBadgeClass(delivery.status);

            const row = document.createElement('tr');
            row.innerHTML = `
    <td>${delivery.customerName || 'N/A'}</td>
    <td>${delivery.deliveryAddress || 'N/A'}</td>
    <td>${createdAt}</td>
    <td><span class="badge ${statusClass}">${delivery.status}</span></td>
    <td>${completedAt}</td>
    <td>
        <div class="table-actions">
            <button class="btn-table-action btn-view view-delivery" data-id="${deliveryId}">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-table-action btn-edit edit-delivery" data-id="${deliveryId}">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-table-action btn-delete delete-delivery" data-id="${deliveryId}">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    </td>
`;
            driverDeliveriesTableBody.appendChild(row);
        });
        
    } catch (error) {
        console.error("Error loading all deliveries:", error);
        if (driverDeliveriesTableBody) {
            driverDeliveriesTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading deliveries</td></tr>';
        }
        showToast("Error loading deliveries", "error");
    }
}

async function confirmDeleteDelivery(deliveryId) {
    if (!confirm('Are you sure you want to delete this delivery? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Check if user has admin role
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            throw new Error("Admin privileges required");
        }
        
        await deleteDoc(doc(db, "deliveries", deliveryId));
        showToast("Delivery deleted successfully!", "success");
        
        // Refresh the appropriate table
        const currentSection = document.querySelector('.admin-nav a.active')?.dataset.section;
        if (currentSection === 'drivers') {
            const activeDriverId = document.getElementById('driverNameHeader')?.dataset.driverId;
            if (activeDriverId) {
                await loadDeliveriesForDriver(activeDriverId, 'all');
            }
        }
        await loadAllDeliveries();
        
    } catch (error) {
        console.error("Error deleting delivery:", error);
        showToast(`Error deleting delivery: ${error.message}`, "error");
    }
}