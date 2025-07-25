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
    ensureAdminStatus,
    onAuthStateChanged,
    addDoc,
    orderBy,
    limit,
    onSnapshot
} from './script.js';

import { GeoPoint } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

console.log("✅ admin.js is now running");

// DOM Elements
const lastUpdated = document.getElementById('lastUpdated');
const totalUsers = document.getElementById('totalUsers');
const totalProducts = document.getElementById('totalProducts');
const recentOrders = document.getElementById('recentOrders');
const totalRevenue = document.getElementById('totalRevenue');
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


// Initialize admin panel
/*document.addEventListener('DOMContentLoaded', async () => {
  console.log('Admin panel loading');
  document.body.classList.add('loading');

  try {
    console.log('Checking admin status...');
    const isAdmin = await ensureAdminStatus();
    console.log('Admin check result:', isAdmin);
    
    if (!isAdmin) {
      console.log("❌ User is not an admin, redirecting...");
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
      return;
    }

    console.log("✅ Admin access granted");
    console.log('loadDashboardData running...');
    initAdminPanel();
    await Promise.all([
      loadDashboardData(),
      loadProducts(),
      loadUsers(),
      loadOrders()
    ]);
    
    setupAdminNavigation();
    setupModals();
    setupEventListeners();
    
  } catch (error) {
    console.error("Admin init error:", error);
    window.location.href = 'index.html';
  } finally {
    document.body.classList.remove('loading');
  }
});*/

(async () => {
    console.log('✅ admin.js IIFE starting, DOM is already loaded');
    
    try {
        console.log('✅ Test log BEFORE admin check');

        const isAdmin = true; // override for testing
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
        console.log('✅ Test log AFTER loading data');

        setupAdminNavigation();
        setupModals();
        setupEventListeners();
        console.log('✅ All setup done');
    } catch (error) {
        console.error('❌ Error during admin initialization:', error);
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
  
}

// Update last updated time
function updateLastUpdated() {
    const now = new Date();
    lastUpdated.textContent = now.toLocaleString();
}

// Load dashboard data
async function loadDashboardData() {
    console.log('✅ loadDashboardData started');

    try {
        // Check DOM Elements
        console.log('totalUsers element: ', totalUsers);
        console.log('totalProducts element: ', totalProducts);
        console.log('recentOrders element: ', recentOrders);
        console.log('totalRevenue element: ', totalRevenue);
        
        // Get counts from Firestore
        console.log('Fetching users count...');
        const usersCount = await getCollectionCount('users');
        console.log('Users count fetched: ', usersCount);

        console.log('Fetch products count...');
        const productsCount = await getCollectionCount('products');
        console.log('Products count fetched: ', productsCount);
                
        // Get recent orders (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        console.log('Fetching recent orders since: ', sevenDaysAgo);
        
        let recentOrdersCount = 0;
        let revenue = 0;
        
        try {
            const ordersQuery = query(
                collection(db, "orders"),
                where("createdAt", ">=", sevenDaysAgo),
                where("status", "in", ["completed", "delivered"])
            );
            
            const ordersSnapshot = await getDocs(ordersQuery);
            recentOrdersCount = ordersSnapshot.size;
            
            ordersSnapshot.forEach(doc => {
                const amount = parseFloat(doc.data().totalAmount) || 0;
                revenue += amount;
            });
        } catch (error) {
            console.error("Error loading orders:", error);
            showToast("Error loading recent orders data", "error");
        }
        
        // Update dashboard stats
        if (totalUsers) totalUsers.textContent = usersCount;
        if (totalProducts) totalProducts.textContent = productsCount;
        if (recentOrders) recentOrders.textContent = recentOrdersCount;
        if (totalRevenue) totalRevenue.textContent = `$${revenue.toFixed(2)}`;
        
        // Load recent activity
        await loadRecentActivity();

        const driversQuery = query(collection(db, "users"), where("role", "==", "driver"));
        const driversSnapshot = await getDocs(driversQuery);
        
        const activeDriversQuery = query(
            collection(db, "users"),
            where("role", "==", "driver"),
            where("status", "==", "active")
        );
        const activeDriversSnapshot = await getDocs(activeDriversQuery);
        
        if (totalDrivers) totalDrivers.textContent = driversSnapshot.size;
        if (activeDrivers) activeDrivers.textContent = activeDriversSnapshot.size;
        
        // For on-duty drivers
        const onDutyCount = await getOnDutyDriversCount();
        if (onDutyDrivers) onDutyDrivers.textContent = onDutyCount;
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        showToast("Error loading dashboard data", "error");
    }
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
async function loadRecentActivity() {
    try {
        const activityQuery = query(
            collection(db, "activity"),
            orderBy("timestamp", "desc"),
            limit(10)
        );
        
        const snapshot = await getDocs(activityQuery);
        recentActivity.innerHTML = '';
        
        snapshot.forEach(doc => {
            const activity = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${activity.userName || 'System'}</td>
                <td>${activity.action}</td>
                <td>${activity.timestamp?.toDate().toLocaleString() || 'N/A'}</td>
                <td><span class="badge ${getStatusBadgeClass(activity.status)}">${activity.status}</span></td>
            `;
            
            recentActivity.appendChild(row);
        });
        
    } catch (error) {
        console.error("Error loading recent activity:", error);
    }
}

// Get badge class based on status
function getStatusBadgeClass(status) {
    switch(status.toLowerCase()) {
        case 'success': return 'badge-success';
        case 'failed': return 'badge-danger';
        case 'pending': return 'badge-warning';
        default: return '';
    }
}

// Load products
async function loadProducts(searchTerm = '') {
    try {
        let productsQuery;
        const productsRef = collection(db, "products");
        
        if (searchTerm) {
            // Convert search term to lowercase for case-insensitive search
            const term = searchTerm.toLowerCase();
            productsQuery = query(productsRef, 
                where("name_lowercase", ">=", term),
                where("name_lowercase", "<=", term + '\uf8ff')
            );
        } else {
            productsQuery = query(productsRef);
        }

        const productsSnapshot = await getDocs(productsQuery);
        productsTableBody.innerHTML = '';
        
        if (productsSnapshot.empty) {
            productsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center;">No products found</td>
                </tr>
            `;
            return;
        }
        
        productsSnapshot.forEach(doc => {
            const product = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><img src="${product.image}" alt="${product.name}" class="product-table-image"></td>
                <td>${product.name}</td>
                <td>$${product.price?.toFixed(2) || '0.00'}</td>
                <td>${product.stock || 0}</td>
                <td>${product.category || 'Uncategorized'}</td>
                <td>
                    <button class="btn-admin btn-admin-outline edit-product" data-id="${doc.id}">Edit</button>
                    <button class="btn-admin btn-admin-outline delete-product" data-id="${doc.id}">Delete</button>
                </td>
            `;
            
            productsTableBody.appendChild(row);
        });
        
        // Add event listeners to edit/delete buttons
        // Add event listeners to edit/delete buttons
        document.querySelectorAll('.edit-product').forEach(btn => {
            console.log('Binding edit button for product:', btn.dataset.id);
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                console.log('Edit button clicked for product:', btn.dataset.id);
                editProduct(btn.dataset.id);
            });
        });
        
        document.querySelectorAll('.delete-product').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
        });
        
    } catch (error) {
        console.error('Error loading products:', error);
        alert('Error loading products. Please try again.');
    }
}

// Edit product
async function editProduct(productId) {
    console.log('Editing product:', productId);
    
    const productModal = document.getElementById('productModal');
    if (!productModal) {
        console.error('Product modal not found in DOM');
        return;
    }

    try {
        const productDoc = await getDoc(doc(db, "products", productId));
        if (productDoc.exists()) {
            const product = productDoc.data();
            console.log('Product data loaded:', product);
            
            // Update form fields
            document.getElementById('productId').value = productId;
            document.getElementById('productName').value = product.name || '';
            document.getElementById('productPrice').value = product.price || '';
            document.getElementById('productDescription').value = product.description || '';
            document.getElementById('productCategory').value = product.category || '';
            document.getElementById('productStock').value = product.stock || 0;
            document.getElementById('productImage').value = product.image || '';
            document.getElementById('productFeatured').checked = product.featured || false;
            
            // Update image preview
            updateImagePreview(product.image);
            
            // Show modal
            console.log('Showing product modal');
            showModal(productModal);
        } else {
            console.error('Product not found:', productId);
            showToast('Product not found', 'error');
        }
    } catch (error) {
        console.error('Error editing product:', error);
        showToast('Error loading product details', 'error');
    }
}

// Update image preview
function updateImagePreview(imageUrl) {
    const preview = document.getElementById('productImagePreview');
    if (imageUrl) {
        preview.src = imageUrl;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

// Delete product
async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product? This cannot be undone.')) {
        try {
            await deleteDoc(doc(db, "products", productId));
            
            // Log activity
            await logActivity('Product deleted', `Product ID: ${productId}`);
            
            loadProducts();
            alert('Product deleted successfully');
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Error deleting product. Please try again.');
        }
    }
}

//handle product search
function initProductSearch() {
    const productSearch = document.getElementById('productSearch');
    const searchBtn = document.querySelector('#productSearch + .search-btn');
    
    if (productSearch && searchBtn) {
        // Handle search on button click
        searchBtn.addEventListener('click', () => {
            loadProducts(productSearch.value.trim());
        });
        
        // Handle search on Enter key
        productSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadProducts(productSearch.value.trim());
            }
        });
        
        // Handle search with debounce on input
        productSearch.addEventListener('input', debounce(() => {
            loadProducts(productSearch.value.trim());
        }, 300));
    }
}

// Load users with search functionality
async function loadUsers(searchTerm = '') {
    try {
        let usersQuery;
        const usersRef = collection(db, "users");
        
        if (searchTerm) {
            usersQuery = query(usersRef, 
                where("name", ">=", searchTerm),
                where("name", "<=", searchTerm + '\uf8ff')
            );
        } else {
            usersQuery = query(usersRef);
        }

        const usersSnapshot = await getDocs(usersQuery);
        usersTableBody.innerHTML = '';
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${user.name || 'No name'}</td>
                <td>${user.email}</td>
                <td>${user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                <td>${user.lastLogin ? new Date(user.lastLogin.toDate()).toLocaleString() : 'Never'}</td>
                <td>
                    <span class="badge ${user.status === 'suspended' ? 'badge-danger' : 
                                      user.role === 'admin' ? 'badge-info' : 
                                      user.role === 'driver' ? 'badge-warning' : 'badge-success'}">
                        ${user.role || 'customer'}
                    </span>
                </td>
                <td>
                    <button class="btn-admin btn-admin-outline edit-user" data-id="${doc.id}">Edit</button>
                    ${user.role !== 'admin' && user.role !== 'driver' ? 
                        `<button class="btn-admin btn-admin-outline delete-user" data-id="${doc.id}">Delete</button>` : 
                        ''}
                </td>
            `;
            
            usersTableBody.appendChild(row);
        });
        
        // Add event listeners to edit/delete buttons
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', () => editUser(btn.dataset.id));
        });
        
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.dataset.id));
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
        alert('Error loading users. Please try again.');
    }
}

// Edit user
async function editUser(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const user = userDoc.data();
            
            // Safely get modal title element
            const modalTitle = document.getElementById('userModalTitle');
            if (modalTitle) {
                modalTitle.textContent = 'Edit User';
            }
            
            document.getElementById('userId').value = userId;
            document.getElementById('userName').value = user.name || '';
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userRole').value = user.role || 'customer';
            document.getElementById('userStatus').value = user.status || 'active';
            
            showModal(document.getElementById('userModal'));
        }
    } catch (error) {
        console.error('Error editing user:', error);
        showToast('Error loading user details', 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This cannot be undone.')) {
        try {
            await deleteDoc(doc(db, "users", userId));
            
            // Log activity
            await logActivity('User deleted', `User ID: ${userId}`);
            
            loadUsers();
            alert('User deleted successfully');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error deleting user. Please try again.');
        }
    }
}

// Load orders with filter
async function loadOrders(filter = 'all') {
    try {
        let ordersQuery;
        const ordersRef = collection(db, "orders");
        
        if (filter !== 'all') {
            ordersQuery = query(ordersRef, where("status", "==", filter), orderBy("createdAt", "desc"));
        } else {
            ordersQuery = query(ordersRef, orderBy("createdAt", "desc"));
        }

        // Use onSnapshot for real-time updates
        const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            ordersTableBody.innerHTML = '';
            
            snapshot.forEach(doc => {
                const order = doc.data();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${order.orderNumber || doc.id.substring(0, 8)}</td>
                    <td>${order.customerName || 'N/A'}</td>
                    <td>${order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                    <td>$${order.total?.toFixed(2) || '0.00'}</td>
                    <td><span class="badge ${getOrderStatusBadgeClass(order.status)}">${order.status}</span></td>
                    <td>
                        <button class="btn-admin btn-admin-outline view-order" data-id="${doc.id}">View</button>
                        <button class="btn-admin btn-admin-outline update-status" data-id="${doc.id}">Update</button>
                    </td>
                `;
                
                ordersTableBody.appendChild(row);
            });
            
            // Reattach event listeners
            document.querySelectorAll('.view-order').forEach(btn => {
                btn.addEventListener('click', () => viewOrder(btn.dataset.id));
            });
            
            document.querySelectorAll('.update-status').forEach(btn => {
                btn.addEventListener('click', () => updateOrderStatus(btn.dataset.id));
            });
        });
        
        // Return unsubscribe function if needed
        return unsubscribe;
        
    } catch (error) {
        console.error('Error loading orders:', error);
        showToast('Error loading orders', 'error');
    }
}

// Get order status badge class
function getOrderStatusBadgeClass(status) {
    switch(status.toLowerCase()) {
        case 'completed':
        case 'delivered': return 'badge-success';
        case 'cancelled': return 'badge-danger';
        case 'processing': 
        case 'shipped': return 'badge-warning';
        default: return '';
    }
}

function getDeliveryStatusBadgeClass(status) {
  switch(status.toLowerCase()) {
    case 'completed': return 'badge-success';
    case 'in-progress': return 'badge-warning';
    case 'pending': return 'badge-info';
    case 'cancelled': return 'badge-danger';
    default: return '';
  }
}

// View order details
async function viewOrder(orderId) {
    try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (orderDoc.exists()) {
            const order = orderDoc.data();
            
            // Create modal if it doesn't exist
            let orderModal = document.getElementById('orderModal');
            let orderModalOverlay = document.getElementById('orderModalOverlay');
            
            if (!orderModal) {
                orderModal = document.createElement('div');
                orderModal.id = 'orderModal';
                orderModal.className = 'modal';
                document.body.appendChild(orderModal);
                
                orderModalOverlay = document.createElement('div');
                orderModalOverlay.className = 'modal-overlay';
                orderModalOverlay.id = 'orderModalOverlay';
                document.body.appendChild(orderModalOverlay);
            }
            
            // Rest of the modal content creation...
            
            showModal(orderModal, orderModalOverlay);
        }
    } catch (error) {
        console.error('Error viewing order:', error);
        showToast('Error loading order details', 'error');
    }
}

// Update order status
async function updateOrderStatus(orderId) {
    try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (orderDoc.exists()) {
            const order = orderDoc.data();
            
            const newStatus = prompt('Enter new status (pending, processing, shipped, delivered, cancelled):', order.status);
            if (newStatus && newStatus !== order.status) {
                await updateDoc(doc(db, "orders", orderId), {
                    status: newStatus,
                    updatedAt: serverTimestamp()
                });
                
                // Log activity
                await logActivity('Order status updated', `Order ${orderId} set to ${newStatus}`);
                
                loadOrders(document.getElementById('orderFilter').value);
                alert('Order status updated successfully');
            }
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Error updating order status. Please try again.');
    }
}

// Initialize user search
function initUserSearch() {
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(() => {
            loadUsers(userSearch.value.trim());
        }, 300));
    }
}

// Initialize order filter
function initOrderFilter() {
    const orderFilter = document.getElementById('orderFilter');
    if (orderFilter) {
        orderFilter.addEventListener('change', () => {
            loadOrders(orderFilter.value);
        });
    }
}

// Update the setupAdminNavigation function
function setupAdminNavigation() {
  const navLinks = document.querySelectorAll('.admin-nav a');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all links
      navLinks.forEach(l => l.classList.remove('active'));
      
      // Add active class to clicked link
      link.classList.add('active');
      
      // Get the section to show
      const sectionId = `${link.dataset.section}-section`;
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
      
      // Load data for the section if needed
      switch(link.dataset.section) {
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
        case 'drivers': // Add this case
          loadDrivers();
          break;
        case 'settings':
          // No special loading needed for settings
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

// Setup modals
function setupModals() {
    // Setup for product modal
    const productModal = document.getElementById('productModal');
    const productModalOverlay = document.getElementById('productModalOverlay');
    
    if (productModal && productModalOverlay) {
        // Show modal when Add Product button is clicked
        document.getElementById('addProductBtn')?.addEventListener('click', () => {
            document.getElementById('productModalTitle').textContent = 'Add New Product';
            document.getElementById('productForm').reset();
            document.getElementById('productImagePreview').style.display = 'none';
            showModal(productModal);
        });
        
        // Close modal when overlay or X is clicked
        productModalOverlay.addEventListener('click', () => hideModal(productModal));
        productModal.querySelector('.close-modal')?.addEventListener('click', () => hideModal(productModal));
        productModal.querySelector('.cancel-modal')?.addEventListener('click', () => hideModal(productModal));
        
        // Image URL preview
        document.getElementById('productImage').addEventListener('input', function() {
            updateImagePreview(this.value);
        });
    }
    
    // Setup for admin modal
    const adminModal = document.getElementById('adminModal');
    const adminModalOverlay = document.getElementById('adminModalOverlay');
    
    if (adminModal && adminModalOverlay) {
        // Show modal when Create Admin button is clicked
        document.getElementById('addAdminBtn')?.addEventListener('click', () => {
            document.getElementById('adminModalTitle').textContent = 'Create New Admin';
            document.getElementById('adminForm').reset();
            showModal(adminModal);
        });
        
        // Close modal when overlay or X is clicked
        adminModalOverlay.addEventListener('click', () => hideModal(adminModal));
        adminModal.querySelector('.close-modal')?.addEventListener('click', () => hideModal(adminModal));
        adminModal.querySelector('.cancel-modal')?.addEventListener('click', () => hideModal(adminModal));
    }
    
    // Setup for user modal
    const userModal = document.getElementById('userModal');
    const userModalOverlay = document.getElementById('userModalOverlay');
    
    if (userModal && userModalOverlay) {
        // Close modal when overlay or X is clicked
        userModalOverlay.addEventListener('click', () => hideModal(userModal));
        userModal.querySelector('.close-modal')?.addEventListener('click', () => hideModal(userModal));
        userModal.querySelector('.cancel-modal')?.addEventListener('click', () => hideModal(userModal));
    }
}

// Setup event listeners for forms
function setupEventListeners() {

    document.getElementById('addDeliveryBtnAdmin')?.addEventListener('click', showAddDeliveryModal);
    document.getElementById('driverPortalLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Store a flag that this is admin accessing driver portal
        sessionStorage.setItem('adminAccessingDriverPortal', 'true');
        window.location.href = 'driver.html';
    });
    // Product form submission
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const productId = document.getElementById('productId').value;
            const productData = {
                name: document.getElementById('productName').value,
                price: parseFloat(document.getElementById('productPrice').value),
                description: document.getElementById('productDescription').value,
                category: document.getElementById('productCategory').value,
                stock: parseInt(document.getElementById('productStock').value),
                image: document.getElementById('productImage').value,
                featured: document.getElementById('productFeatured').checked,
                updatedAt: serverTimestamp()
            };
            
            try {
                if (productId) {
                    // Update existing product
                    await updateDoc(doc(db, "products", productId), productData);
                    
                    // Log activity
                    await logActivity('Product updated', `Product ID: ${productId}`);
                    
                    alert('Product updated successfully');
                } else {
                    // Add new product
                    const docRef = await addDoc(collection(db, "products"), {
                        ...productData,
                        createdAt: serverTimestamp()
                    });
                    
                    // Log activity
                    await logActivity('Product added', `Product ID: ${docRef.id}`);
                    
                    alert('Product added successfully');
                }
                
                hideModal(document.getElementById('productModal'));
                loadProducts();
            } catch (error) {
                console.error('Error saving product:', error);
                alert('Error saving product. Please try again.');
            }
        });
    }
    
    // Admin form submission
    const adminForm = document.getElementById('adminForm');
    if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('adminName').value;
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            
            try {
                // Create auth user
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Update profile with name
                await updateProfile(userCredential.user, {
                    displayName: name
                });
                
                // Create user document with admin role
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    name: name,
                    email: email,
                    role: 'admin',
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    status: 'active'
                });
                
                // Log activity
                await logActivity('Admin created', `Admin: ${email}`);
                
                hideModal(document.getElementById('adminModal'));
                alert('Admin account created successfully!');
                loadUsers();
            } catch (error) {
                console.error('Error creating admin:', error);
                alert(getAuthErrorMessage(error.code));
            }
        });
    }
    
    // User form submission
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userId = document.getElementById('userId').value;
            const userData = {
                name: document.getElementById('userName').value,
                email: document.getElementById('userEmail').value,
                role: document.getElementById('userRole').value,
                status: document.getElementById('userStatus').value,
                updatedAt: serverTimestamp()
            };
            
            try {
                await updateDoc(doc(db, "users", userId), userData);
                
                // Log activity
                await logActivity('User updated', `User ID: ${userId}`);
                
                hideModal(document.getElementById('userModal'));
                loadUsers();
                alert('User updated successfully');
            } catch (error) {
                console.error('Error updating user:', error);
                alert('Error updating user. Please try again.');
            }
        });
    }
    
    // Settings form submission
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const settings = {
                siteName: document.getElementById('siteName').value,
                adminEmail: document.getElementById('adminEmailSettings').value,
                maintenanceMode: document.getElementById('maintenanceMode').value === 'true',
                updatedAt: serverTimestamp()
            };
            
            try {
                await setDoc(doc(db, "settings", "general"), settings, { merge: true });
                
                // Log activity
                await logActivity('Settings updated', 'General settings modified');
                
                alert('Settings saved successfully');
            } catch (error) {
                console.error('Error saving settings:', error);
                alert('Error saving settings. Please try again.');
            }
        });
    }
}

function showModal(modal) {
    console.log('Attempting to show modal:', modal.id);
    const overlay = modal.previousElementSibling;
    if (!overlay || !overlay.classList.contains('modal-overlay')) {
        console.error('Modal overlay not found for modal:', modal.id);
        return;
    }
    overlay.classList.add('show'); // Add this
    modal.classList.add('show');   // Add this
    document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
    console.log('Attempting to hide modal:', modal.id);
    const overlay = modal.previousElementSibling;
    overlay.classList.remove('show'); // Add this
    modal.classList.remove('show');   // Add this
    document.body.style.overflow = '';
}

// Log activity
async function logActivity(action, details = '', status = 'success') {
    const user = auth.currentUser;
    
    try {
        const activityData = {
            action: action,
            details: details,
            userId: user?.uid || 'system',
            userName: user?.displayName || 'System',
            timestamp: serverTimestamp(),
            status: status
        };
        
        await addDoc(collection(db, "activity"), activityData);
        return true;
    } catch (error) {
        console.error('Error logging activity:', error);
        
        // Fallback - try to log the error itself
        try {
            await addDoc(collection(db, "activity"), {
                action: "Activity Log Failed",
                details: `Original action: ${action}. Error: ${error.message}`,
                userId: 'system',
                userName: 'System',
                timestamp: serverTimestamp(),
                status: 'error'
            });
        } catch (fallbackError) {
            console.error('Fallback activity log also failed:', fallbackError);
        }
        
        return false;
    }
}

// Helper function for debouncing
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Get auth error message
function getAuthErrorMessage(code) {
    switch(code) {
        case 'auth/invalid-email': return 'Invalid email address';
        case 'auth/user-disabled': return 'This account has been disabled';
        case 'auth/user-not-found': return 'No account found with this email';
        case 'auth/wrong-password': return 'Incorrect password';
        case 'auth/email-already-in-use': return 'Email already in use';
        case 'auth/weak-password': return 'Password should be at least 6 characters';
        case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
        default: return 'An error occurred. Please try again.';
    }
}

async function loadDrivers(searchTerm = '') {
  try {
    const driversTableBody = document.getElementById('driversTableBody');
    if (!driversTableBody) {
      console.error('Drivers table body not found');
      return;
    }

    let driversQuery;
    const driversRef = collection(db, "users");
    
    if (searchTerm) {
      driversQuery = query(driversRef,
        where("role", "==", "driver"),
        where("name", ">=", searchTerm),
        where("name", "<=", searchTerm + '\uf8ff')
      );
    } else {
      driversQuery = query(driversRef, where("role", "==", "driver"));
    }

    const driversSnapshot = await getDocs(driversQuery);
    driversTableBody.innerHTML = '';
    
    driversSnapshot.forEach(doc => {
      const driver = doc.data();
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${driver.name || 'No name'}</td>
        <td>${driver.email}</td>
        <td>${driver.lastLogin ? new Date(driver.lastLogin.toDate()).toLocaleString() : 'Never'}</td>
        <td>
          <span class="badge ${driver.status === 'active' ? 'badge-success' : 'badge-danger'}">
            ${driver.status || 'inactive'}
          </span>
        </td>
        <td>
          <button class="btn-admin btn-admin-outline edit-driver" data-id="${doc.id}">Edit</button>
          <button class="btn-admin btn-admin-outline view-driver-deliveries" data-id="${doc.id}">Deliveries</button>
        </td>
      `;
      
      driversTableBody.appendChild(row);
    });
    
    // Add event listeners
    document.querySelectorAll('.edit-driver').forEach(btn => {
      btn.addEventListener('click', () => editDriver(btn.dataset.id));
    });
    
    document.querySelectorAll('.view-driver-deliveries').forEach(btn => {
      btn.addEventListener('click', () => viewDriverDeliveries(btn.dataset.id));
    });
    
    // Update dashboard stats
    updateDriverStats(driversSnapshot.size);
    
  } catch (error) {
    console.error('Error loading drivers:', error);
    showToast('Error loading drivers', 'error');
  }
}

async function editDriver(driverId) {
  try {
    const driverDoc = await getDoc(doc(db, "users", driverId));
    if (driverDoc.exists()) {
      const driver = driverDoc.data();
      
      // Populate the user modal (reusing existing modal)
      document.getElementById('userModalTitle').textContent = 'Edit Driver';
      document.getElementById('userId').value = driverId;
      document.getElementById('userName').value = driver.name || '';
      document.getElementById('userEmail').value = driver.email || '';
      document.getElementById('userRole').value = 'driver'; // Locked to driver role
      document.getElementById('userStatus').value = driver.status || 'active';
      
      showModal(document.getElementById('userModal'));
    }
  } catch (error) {
    console.error('Error editing driver:', error);
    showToast('Error loading driver details', 'error');
  }
}

async function viewDriverDeliveries(driverId) {
  try {
    // Safely get elements
    const driverStatsSection = document.getElementById('driverStatsSection');
    const driverDeliveriesTableBody = document.getElementById('driverDeliveriesTableBody');
    const driverNameHeader = document.getElementById('driverNameHeader');
    
    if (!driverStatsSection || !driverDeliveriesTableBody || !driverNameHeader) {
      console.error('Required elements not found');
      showToast('Error loading driver deliveries', 'error');
      return;
    }

    // Show loading state
    driverDeliveriesTableBody.innerHTML = '<tr><td colspan="6">Loading deliveries...</td></tr>';
    driverStatsSection.style.display = 'block';
    
    // Get driver info
    const driverDoc = await getDoc(doc(db, "users", driverId));
    if (!driverDoc.exists()) {
      showToast('Driver not found', 'error');
      return;
    }
    
    const driverName = driverDoc.data().name;
    driverNameHeader.textContent = `${driverName}'s Deliveries`;
    
    // Load deliveries for this driver
    const deliveriesQuery = query(
      collection(db, "deliveries"),
      where("driverId", "==", driverId),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    
    const unsubscribe = onSnapshot(deliveriesQuery, (snapshot) => {
      driverDeliveriesTableBody.innerHTML = '';
      
      if (snapshot.empty) {
        driverDeliveriesTableBody.innerHTML = '<tr><td colspan="6">No deliveries found</td></tr>';
        return;
      }
      
      snapshot.forEach(doc => {
        const delivery = doc.data();
        const row = document.createElement('tr');
        
        row.innerHTML = `
          <td>${delivery.customerName || 'N/A'}</td>
          <td>${delivery.deliveryAddress || 'N/A'}</td>
          <td>${delivery.createdAt?.toDate().toLocaleString() || 'N/A'}</td>
          <td>
            <span class="badge ${getDeliveryStatusBadgeClass(delivery.status)}">
              ${delivery.status}
            </span>
          </td>
          <td>${delivery.completedAt?.toDate().toLocaleString() || 'In progress'}</td>
          <td>
            <button class="btn-admin btn-admin-outline view-delivery" data-id="${doc.id}">View</button>
            <button class="btn-admin btn-admin-outline edit-delivery" data-id="${doc.id}">Edit</button>
          </td>
        `;
        
        driverDeliveriesTableBody.appendChild(row);
      });
      
      // Add event listeners
      document.querySelectorAll('.view-delivery').forEach(btn => {
        btn.addEventListener('click', () => viewDeliveryDetails(btn.dataset.id));
      });
      
      document.querySelectorAll('.edit-delivery').forEach(btn => {
        btn.addEventListener('click', () => editDelivery(btn.dataset.id));
      });
      
      // Update driver stats
      updateDriverStats(null, snapshot);
    });
    
    return unsubscribe;
    
  } catch (error) {
    console.error('Error loading driver deliveries:', error);
    showToast('Error loading deliveries', 'error');
    const driverDeliveriesTableBody = document.getElementById('driverDeliveriesTableBody');
    if (driverDeliveriesTableBody) {
      driverDeliveriesTableBody.innerHTML = '<tr><td colspan="6">Error loading deliveries</td></tr>';
    }
  }
}

async function viewDeliveryDetails(deliveryId) {
    try {
        // Get delivery document
        const deliveryDoc = await getDoc(doc(db, "deliveries", deliveryId));
        if (!deliveryDoc.exists()) {
            showToast("Delivery not found", "error");
            return;
        }

        const delivery = deliveryDoc.data();
        
        // Get driver details if assigned
        let driverName = "Unassigned";
        if (delivery.driverId) {
            const driverDoc = await getDoc(doc(db, "users", delivery.driverId));
            if (driverDoc.exists()) {
                driverName = driverDoc.data().name;
            }
        }

        // Get customer details if available (assuming customers are stored separately)
        let customerDetails = {};
        if (delivery.customerId) {
            const customerDoc = await getDoc(doc(db, "customers", delivery.customerId));
            if (customerDoc.exists()) {
                customerDetails = customerDoc.data();
            }
        }

        // Format dates
        const formatDate = (timestamp) => {
            if (!timestamp) return "N/A";
            return timestamp.toDate().toLocaleString();
        };

        // Create modal content
        const modalContent = `
            <div class="modal-header">
                <h3><i class="fas fa-truck"></i> Delivery Details (#${deliveryId.substring(0, 8)})</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="delivery-details-grid">
                    <!-- Customer Information -->
                    <div class="delivery-section">
                        <h4><i class="fas fa-user"></i> Customer Information</h4>
                        <div class="detail-row">
                            <span class="detail-label">Name:</span>
                            <span class="detail-value">${delivery.customerName || customerDetails.name || "N/A"}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Phone:</span>
                            <span class="detail-value">${delivery.customerPhone || customerDetails.phone || "N/A"}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Email:</span>
                            <span class="detail-value">${customerDetails.email || "N/A"}</span>
                        </div>
                    </div>

                    <!-- Delivery Information -->
                    <div class="delivery-section">
                        <h4><i class="fas fa-map-marker-alt"></i> Delivery Information</h4>
                        <div class="detail-row">
                            <span class="detail-label">Address:</span>
                            <span class="detail-value">${delivery.deliveryAddress || "N/A"}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Coordinates:</span>
                            <span class="detail-value">${delivery.gpsCoordinates || "N/A"}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Notes:</span>
                            <span class="detail-value">${delivery.notes || "No notes"}</span>
                        </div>
                    </div>

                    <!-- Status Information -->
                    <div class="delivery-section">
                        <h4><i class="fas fa-info-circle"></i> Status Information</h4>
                        <div class="detail-row">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value">
                                <span class="badge ${getDeliveryStatusBadgeClass(delivery.status)}">
                                    ${delivery.status}
                                </span>
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Assigned Driver:</span>
                            <span class="detail-value">${driverName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Created:</span>
                            <span class="detail-value">${formatDate(delivery.createdAt)}</span>
                        </div>
                        ${delivery.startedAt ? `
                        <div class="detail-row">
                            <span class="detail-label">Started:</span>
                            <span class="detail-value">${formatDate(delivery.startedAt)}</span>
                        </div>
                        ` : ''}
                        ${delivery.completedAt ? `
                        <div class="detail-row">
                            <span class="detail-label">Completed:</span>
                            <span class="detail-value">${formatDate(delivery.completedAt)}</span>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Driver Tracking -->
                    <div class="delivery-section">
                        <h4><i class="fas fa-map-marked"></i> Driver Tracking</h4>
                        ${delivery.currentLocation ? `
                        <div class="detail-row">
                            <span class="detail-label">Last Location:</span>
                            <span class="detail-value">
                                ${delivery.currentLocation.latitude}, ${delivery.currentLocation.longitude}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Last Updated:</span>
                            <span class="detail-value">${formatDate(delivery.lastUpdated)}</span>
                        </div>
                        <div id="deliveryMap" style="height: 250px; margin-top: 15px;"></div>
                        ` : `
                        <div class="detail-row">
                            <span class="detail-value">No location data available</span>
                        </div>
                        `}
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="delivery-actions">
                    <button class="btn-admin btn-admin-outline" id="editDeliveryBtn">
                        <i class="fas fa-edit"></i> Edit Delivery
                    </button>
                    <button class="btn-admin btn-admin-outline" id="assignDriverBtn">
                        <i class="fas fa-user-tie"></i> Assign Driver
                    </button>
                    ${delivery.status !== 'completed' && delivery.status !== 'cancelled' ? `
                    <button class="btn-admin ${delivery.status === 'pending' ? 'btn-admin-warning' : 'btn-admin-success'}" 
                            id="updateStatusBtn">
                        <i class="fas ${delivery.status === 'pending' ? 'fa-play' : 'fa-check'}"></i>
                        ${delivery.status === 'pending' ? 'Start Delivery' : 'Complete Delivery'}
                    </button>
                    ` : ''}
                    ${delivery.status !== 'cancelled' ? `
                    <button class="btn-admin btn-admin-danger" id="cancelDeliveryBtn">
                        <i class="fas fa-times"></i> Cancel Delivery
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        // Create or update modal
        let detailsModal = document.getElementById('deliveryDetailsModal');
        if (!detailsModal) {
            detailsModal = document.createElement('div');
            detailsModal.id = 'deliveryDetailsModal';
            detailsModal.className = 'modal';
            document.body.appendChild(detailsModal);
        }

        detailsModal.innerHTML = modalContent;
        showModal(detailsModal);

        // Initialize map if we have location data
        if (delivery.currentLocation && delivery.gpsCoordinates) {
            initDeliveryMap(
                delivery.currentLocation.latitude,
                delivery.currentLocation.longitude,
                delivery.gpsCoordinates
            );
        }

        // Add event listeners for buttons
        document.getElementById('editDeliveryBtn')?.addEventListener('click', () => {
            hideModal(detailsModal);
            editDeliveryAdmin(deliveryId);
        });

        document.getElementById('assignDriverBtn')?.addEventListener('click', () => {
            hideModal(detailsModal);
            assignDriverToDelivery(deliveryId);
        });

        document.getElementById('updateStatusBtn')?.addEventListener('click', async () => {
            try {
                let updateData = {
                    updatedAt: serverTimestamp()
                };

                if (delivery.status === 'pending') {
                    updateData.status = 'in-progress';
                    updateData.startedAt = serverTimestamp();
                } else if (delivery.status === 'in-progress') {
                    updateData.status = 'completed';
                    updateData.completedAt = serverTimestamp();
                }

                await updateDoc(doc(db, "deliveries", deliveryId), updateData);
                showToast("Delivery status updated", "success");
            } catch (error) {
                console.error("Error updating status:", error);
                showToast("Failed to update status", "error");
            }
        });

        document.getElementById('cancelDeliveryBtn')?.addEventListener('click', async () => {
            if (confirm("Are you sure you want to cancel this delivery?")) {
                try {
                    await updateDoc(doc(db, "deliveries", deliveryId), {
                        status: 'cancelled',
                        cancelledAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    showToast("Delivery cancelled", "success");
                } catch (error) {
                    console.error("Error cancelling delivery:", error);
                    showToast("Failed to cancel delivery", "error");
                }
            }
        });

        // Close modal handler
        detailsModal.querySelector('.close-modal').addEventListener('click', () => {
            hideModal(detailsModal);
        });

    } catch (error) {
        console.error("Error viewing delivery details:", error);
        showToast("Error loading delivery details", "error");
    }
}

function initDeliveryMap(driverLat, driverLng, deliveryCoords) {
    const mapElement = document.getElementById('deliveryMap');
    if (!mapElement) return;

    // Clear any existing map
    if (mapElement._leaflet_id) {
        for (const id in L.Map._instances) {
            if (L.Map._instances[id]._container.id === 'deliveryMap') {
                L.Map._instances[id].remove();
                break;
            }
        }
    }

    // Create new map centered on driver location
    const map = L.map('deliveryMap').setView([driverLat, driverLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add driver marker with custom icon
    L.marker([driverLat, driverLng], {
        icon: L.divIcon({
            className: 'driver-marker-icon',
            html: '<i class="fas fa-truck"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        })
    }).addTo(map).bindPopup('Driver Location');

    // Add delivery location marker if coordinates exist
    if (deliveryCoords) {
        const [deliveryLat, deliveryLng] = deliveryCoords.split(',').map(Number);
        
        L.marker([deliveryLat, deliveryLng], {
            icon: L.divIcon({
                className: 'delivery-marker-icon',
                html: '<i class="fas fa-map-marker-alt"></i>',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(map).bindPopup('Delivery Location');

        // Add route line between points
        L.polyline(
            [
                [driverLat, driverLng],
                [deliveryLat, deliveryLng]
            ],
            {
                color: '#008080',
                weight: 4,
                opacity: 0.7,
                dashArray: '5, 5'
            }
        ).addTo(map);

        // Calculate distance between points
        const distance = calculateDistance(driverLat, driverLng, deliveryLat, deliveryLng);
        L.popup()
            .setLatLng([(driverLat + deliveryLat) / 2, (driverLng + deliveryLng) / 2])
            .setContent(`Distance: ${distance.toFixed(1)} km`)
            .openOn(map);
    }
}

async function editDelivery(deliveryId) {
  try {
    const deliveryDoc = await getDoc(doc(db, "deliveries", deliveryId));
    if (deliveryDoc.exists()) {
      const delivery = deliveryDoc.data();
      
      // Create and show edit modal
      const modalContent = `
        <div class="modal-header">
          <h3>Edit Delivery #${deliveryId.substring(0, 8)}</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editDeliveryForm">
            <input type="hidden" id="deliveryId" value="${deliveryId}">
            
            <div class="form-group">
              <label for="deliveryStatus">Status</label>
              <select id="deliveryStatus" class="form-control">
                <option value="pending" ${delivery.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="in-progress" ${delivery.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${delivery.status === 'completed' ? 'selected' : ''}>Completed</option>
                <option value="cancelled" ${delivery.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="deliveryNotes">Notes</label>
              <textarea id="deliveryNotes" class="form-control">${delivery.notes || ''}</textarea>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn-admin">Save Changes</button>
              <button type="button" class="btn-admin btn-admin-outline cancel-modal">Cancel</button>
            </div>
          </form>
        </div>
      `;
      
      // Create modal if it doesn't exist
      let editDeliveryModal = document.getElementById('editDeliveryModal');
      if (!editDeliveryModal) {
        editDeliveryModal = document.createElement('div');
        editDeliveryModal.id = 'editDeliveryModal';
        editDeliveryModal.className = 'modal';
        document.body.appendChild(editDeliveryModal);
      }
      
      editDeliveryModal.innerHTML = modalContent;
      showModal(editDeliveryModal);
      
      // Form submission
      document.getElementById('editDeliveryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const status = document.getElementById('deliveryStatus').value;
        const notes = document.getElementById('deliveryNotes').value;
        
        try {
          const updateData = {
            status: status,
            notes: notes,
            updatedAt: serverTimestamp()
          };
          
          // Add completedAt timestamp if status changed to completed
          if (status === 'completed' && delivery.status !== 'completed') {
            updateData.completedAt = serverTimestamp();
          }
          
          // Add startedAt timestamp if status changed to in-progress
          if (status === 'in-progress' && delivery.status !== 'in-progress') {
            updateData.startedAt = serverTimestamp();
          }
          
          await updateDoc(doc(db, "deliveries", deliveryId), updateData);
          
          showToast('Delivery updated successfully', 'success');
          hideModal(editDeliveryModal);
        } catch (error) {
          console.error('Error updating delivery:', error);
          showToast('Error updating delivery', 'error');
        }
      });
      
      // Close modal
      editDeliveryModal.querySelector('.close-modal').addEventListener('click', () => {
        hideModal(editDeliveryModal);
      });
      
      editDeliveryModal.querySelector('.cancel-modal').addEventListener('click', () => {
        hideModal(editDeliveryModal);
      });
    }
  } catch (error) {
    console.error('Error editing delivery:', error);
    showToast('Error loading delivery details', 'error');
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
      // This would filter the driver deliveries table
      const driverId = document.getElementById('currentDriverId')?.value;
      if (driverId) {
        viewDriverDeliveries(driverId);
      }
    });
  }
}

function updateDriverStats(totalDriversCount = null, deliveriesSnapshot = null) {
  if (totalDriversCount !== null) {
    totalDrivers.textContent = totalDriversCount;
  }
  
  if (deliveriesSnapshot) {
    const deliveries = deliveriesSnapshot.docs.map(doc => doc.data());
    const completedCount = deliveries.filter(d => d.status === 'completed').length;
    const inProgressCount = deliveries.filter(d => d.status === 'in-progress').length;
    
    document.getElementById('driverCompletedDeliveries').textContent = completedCount;
    document.getElementById('driverInProgressDeliveries').textContent = inProgressCount;
    document.getElementById('driverTotalDeliveries').textContent = deliveries.length;
  }
}

async function getOnDutyDriversCount() {
  try {
    // Get all drivers with in-progress deliveries
    const deliveriesQuery = query(
      collection(db, "deliveries"),
      where("status", "==", "in-progress")
    );
    
    const snapshot = await getDocs(deliveriesQuery);
    const uniqueDriverIds = new Set();
    
    snapshot.forEach(doc => {
      uniqueDriverIds.add(doc.data().driverId);
    });
    
    return uniqueDriverIds.size;
  } catch (error) {
    console.error("Error counting on-duty drivers:", error);
    return 0;
  }
}

async function loadAllDeliveries() {
    try {
        const deliveriesQuery = query(
            collection(db, "deliveries"),
            orderBy("createdAt", "desc")
        );
        
        const unsubscribe = onSnapshot(deliveriesQuery, async (snapshot) => {
            const deliveriesTableBody = document.getElementById('allDeliveriesTableBody');
            deliveriesTableBody.innerHTML = '';
            
            if (snapshot.empty) {
                deliveriesTableBody.innerHTML = '<tr><td colspan="6">No deliveries found</td></tr>';
                return;
            }
            
            // Get all drivers for lookup
            const driversQuery = query(collection(db, "users"), where("role", "==", "driver"));
            const driversSnapshot = await getDocs(driversQuery);
            const drivers = {};
            driversSnapshot.forEach(doc => {
                drivers[doc.id] = doc.data().name;
            });
            
            snapshot.forEach(doc => {
                const delivery = doc.data();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${delivery.customerName || 'N/A'}</td>
                    <td>${delivery.driverId ? (drivers[delivery.driverId] || 'Unassigned') : 'Unassigned'}</td>
                    <td>${delivery.deliveryAddress || 'N/A'}</td>
                    <td>${delivery.createdAt?.toDate().toLocaleString() || 'N/A'}</td>
                    <td>
                        <span class="badge ${getDeliveryStatusBadgeClass(delivery.status)}">
                            ${delivery.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn-admin btn-admin-outline edit-delivery-admin" data-id="${doc.id}">Edit</button>
                        <button class="btn-admin btn-admin-outline assign-driver" data-id="${doc.id}">Assign</button>
                    </td>
                `;
                
                deliveriesTableBody.appendChild(row);
            });
            
            // Add event listeners
            document.querySelectorAll('.edit-delivery-admin').forEach(btn => {
                btn.addEventListener('click', () => editDeliveryAdmin(btn.dataset.id));
            });
            
            document.querySelectorAll('.assign-driver').forEach(btn => {
                btn.addEventListener('click', () => assignDriverToDelivery(btn.dataset.id));
            });
        });
        
        return unsubscribe;
    } catch (error) {
        console.error("Error loading all deliveries:", error);
        showToast("Error loading deliveries", "error");
    }
}


async function showAddDeliveryModal() {
    try {
        // Get available drivers
        const driversQuery = query(collection(db, "users"), where("role", "==", "driver"));
        const driversSnapshot = await getDocs(driversQuery);
        
        const modalContent = `
            <div class="modal-header">
                <h3><i class="fas fa-truck"></i> Create New Delivery</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="adminDeliveryForm">
                    <div class="form-group">
                        <label for="adminCustomerName">Customer Name</label>
                        <input type="text" id="adminCustomerName" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="adminCustomerPhone">Phone Number</label>
                        <input type="tel" id="adminCustomerPhone" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="adminDeliveryAddress">Delivery Address</label>
                        <input type="text" id="adminDeliveryAddress" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="adminDeliveryDriver">Assign Driver</label>
                        <select id="adminDeliveryDriver" class="form-control">
                            <option value="">-- Select Driver --</option>
                            ${driversSnapshot.docs.map(doc => 
                                `<option value="${doc.id}">${doc.data().name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="adminDeliveryNotes">Notes</label>
                        <textarea id="adminDeliveryNotes" class="form-control" rows="3"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-admin btn-admin-outline cancel-modal">Cancel</button>
                        <button type="submit" class="btn-admin">Create Delivery</button>
                    </div>
                </form>
            </div>
        `;
        
        // Create modal if it doesn't exist
        let deliveryModal = document.getElementById('adminDeliveryModal');
        if (!deliveryModal) {
            deliveryModal = document.createElement('div');
            deliveryModal.id = 'adminDeliveryModal';
            deliveryModal.className = 'modal';
            document.body.appendChild(deliveryModal);
        }
        
        deliveryModal.innerHTML = modalContent;
        showModal(deliveryModal);
        
        // Form submission
        document.getElementById('adminDeliveryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await createDeliveryAsAdmin();
        });
        
        // Close modal
        deliveryModal.querySelector('.close-modal').addEventListener('click', () => {
            hideModal(deliveryModal);
        });
        
        deliveryModal.querySelector('.cancel-modal').addEventListener('click', () => {
            hideModal(deliveryModal);
        });
        
    } catch (error) {
        console.error("Error showing delivery modal:", error);
        showToast("Error loading delivery form", "error");
    }
}

async function createDeliveryAsAdmin() {
    try {
        const submitBtn = document.getElementById('adminDeliveryForm').querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        const deliveryData = {
            customerName: document.getElementById('adminCustomerName').value.trim(),
            customerPhone: document.getElementById('adminCustomerPhone').value.trim(),
            deliveryAddress: document.getElementById('adminDeliveryAddress').value.trim(),
            notes: document.getElementById('adminDeliveryNotes').value.trim() || null,
            status: 'pending',
            createdAt: serverTimestamp()
        };
        
        const driverId = document.getElementById('adminDeliveryDriver').value;
        if (driverId) {
            deliveryData.driverId = driverId;
        }
        
        await addDoc(collection(db, "deliveries"), deliveryData);
        
        showToast("Delivery created successfully", "success");
        hideModal(document.getElementById('adminDeliveryModal'));
        
    } catch (error) {
        console.error("Error creating delivery:", error);
        showToast("Failed to create delivery", "error");
    } finally {
        const submitBtn = document.getElementById('adminDeliveryForm').querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Delivery';
        }
    }
}

async function editDeliveryAdmin(deliveryId) {
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

async function assignDriverToDelivery(deliveryId) {
    try {
        const driversQuery = query(collection(db, "users"), where("role", "==", "driver"));
        const driversSnapshot = await getDocs(driversQuery);
        
        const modalContent = `
            <div class="modal-header">
                <h3><i class="fas fa-user-tie"></i> Assign Driver</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="assignDriverForm">
                    <div class="form-group">
                        <label for="assignDriverSelect">Select Driver</label>
                        <select id="assignDriverSelect" class="form-control">
                            <option value="">-- Unassign Driver --</option>
                            ${driversSnapshot.docs.map(doc => 
                                `<option value="${doc.id}">${doc.data().name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-admin btn-admin-outline cancel-modal">Cancel</button>
                        <button type="submit" class="btn-admin">Assign Driver</button>
                    </div>
                </form>
            </div>
        `;
        
        // Create modal if it doesn't exist
        let assignModal = document.getElementById('assignDriverModal');
        if (!assignModal) {
            assignModal = document.createElement('div');
            assignModal.id = 'assignDriverModal';
            assignModal.className = 'modal';
            document.body.appendChild(assignModal);
        }
        
        assignModal.innerHTML = modalContent;
        showModal(assignModal);
        
        // Form submission
        document.getElementById('assignDriverForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const driverId = document.getElementById('assignDriverSelect').value;
            const updateData = {
                updatedAt: serverTimestamp()
            };
            
            if (driverId) {
                updateData.driverId = driverId;
                // If delivery is pending and being assigned, set to in-progress
                const deliveryDoc = await getDoc(doc(db, "deliveries", deliveryId));
                if (deliveryDoc.data().status === 'pending') {
                    updateData.status = 'in-progress';
                }
            } else {
                updateData.driverId = null;
            }
            
            await updateDoc(doc(db, "deliveries", deliveryId), updateData);
            
            showToast("Driver assignment updated", "success");
            hideModal(assignModal);
        });
        
        // Close modal
        assignModal.querySelector('.close-modal').addEventListener('click', () => {
            hideModal(assignModal);
        });
        
        assignModal.querySelector('.cancel-modal').addEventListener('click', () => {
            hideModal(assignModal);
        });
        
    } catch (error) {
        console.error("Error assigning driver:", error);
        showToast("Error assigning driver", "error");
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula to calculate distance between two coordinates
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}