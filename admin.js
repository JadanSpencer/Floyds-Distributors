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
    onAuthStateChanged
} from './script.js';

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

// Initialize admin panel
document.addEventListener('DOMContentLoaded', async () => {
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
});

// Initialize admin panel components
function initAdminPanel() {
  console.log("Admin panel initialized");
  updateLastUpdated();
  setInterval(updateLastUpdated, 60000); // Update every minute
  
  // Initialize user search
  initUserSearch();
  
  // Initialize order filter
  initOrderFilter();
}

// Update last updated time
function updateLastUpdated() {
    const now = new Date();
    lastUpdated.textContent = now.toLocaleString();
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Get counts from Firestore
        const usersCount = await getCollectionCount('users');
        const productsCount = await getCollectionCount('products');
        
        // Get recent orders (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const ordersQuery = query(
            collection(db, "orders"),
            where("createdAt", ">=", sevenDaysAgo),
            where("status", "in", ["completed", "delivered"])
        );
        
        const ordersSnapshot = await getDocs(ordersQuery);
        const recentOrdersCount = ordersSnapshot.size;
        
        // Calculate revenue
        let revenue = 0;
        ordersSnapshot.forEach(doc => {
            revenue += doc.data().totalAmount || 0;
        });
        
        // Update dashboard stats
        totalUsers.textContent = usersCount;
        totalProducts.textContent = productsCount;
        recentOrders.textContent = recentOrdersCount;
        totalRevenue.textContent = `$${revenue.toFixed(2)}`;
        
        // Load recent activity
        await loadRecentActivity();
        
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        alert("Error loading dashboard data. Please try again.");
    }
}

// Get count of documents in a collection
async function getCollectionCount(collectionName) {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.size;
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
            productsQuery = query(productsRef, 
                where("name", ">=", searchTerm),
                where("name", "<=", searchTerm + '\uf8ff')
            );
        } else {
            productsQuery = query(productsRef);
        }

        const productsSnapshot = await getDocs(productsQuery);
        productsTableBody.innerHTML = '';
        
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
        document.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', () => editProduct(btn.dataset.id));
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
    try {
        const productDoc = await getDoc(doc(db, "products", productId));
        if (productDoc.exists()) {
            const product = productDoc.data();
            
            document.getElementById('productModalTitle').textContent = 'Edit Product';
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
            showModal(document.getElementById('productModal'));
        }
    } catch (error) {
        console.error('Error editing product:', error);
        alert('Error loading product details. Please try again.');
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
                    <span class="badge ${user.status === 'suspended' ? 'badge-danger' : 'badge-success'}">
                        ${user.status || 'active'}
                    </span>
                </td>
                <td>
                    <button class="btn-admin btn-admin-outline edit-user" data-id="${doc.id}">Edit</button>
                    ${user.role !== 'admin' ? 
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
            
            document.getElementById('userModalTitle').textContent = 'Edit User';
            document.getElementById('userId').value = userId;
            document.getElementById('userName').value = user.name || '';
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userRole').value = user.role || 'customer';
            document.getElementById('userStatus').value = user.status || 'active';
            
            showModal(document.getElementById('userModal'));
        }
    } catch (error) {
        console.error('Error editing user:', error);
        alert('Error loading user details. Please try again.');
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
            ordersQuery = query(ordersRef, where("status", "==", filter));
        } else {
            ordersQuery = query(ordersRef);
        }

        const ordersSnapshot = await getDocs(ordersQuery);
        ordersTableBody.innerHTML = '';
        
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${order.orderNumber || doc.id.substring(0, 8)}</td>
                <td>${order.customerName || 'N/A'}</td>
                <td>${order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                <td>$${order.totalAmount?.toFixed(2) || '0.00'}</td>
                <td><span class="badge ${getOrderStatusBadgeClass(order.status)}">${order.status}</span></td>
                <td>
                    <button class="btn-admin btn-admin-outline view-order" data-id="${doc.id}">View</button>
                    <button class="btn-admin btn-admin-outline update-status" data-id="${doc.id}">Update</button>
                </td>
            `;
            
            ordersTableBody.appendChild(row);
        });
        
        // Add event listeners
        document.querySelectorAll('.view-order').forEach(btn => {
            btn.addEventListener('click', () => viewOrder(btn.dataset.id));
        });
        
        document.querySelectorAll('.update-status').forEach(btn => {
            btn.addEventListener('click', () => updateOrderStatus(btn.dataset.id));
        });
        
    } catch (error) {
        console.error('Error loading orders:', error);
        alert('Error loading orders. Please try again.');
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

// View order details
async function viewOrder(orderId) {
    try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (orderDoc.exists()) {
            const order = orderDoc.data();
            
            // Create and show order details modal
            const modalContent = `
                <div class="modal-header">
                    <h3>Order #${order.orderNumber || orderId.substring(0, 8)}</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="order-details-grid">
                        <div class="order-section">
                            <h4>Customer Information</h4>
                            <p><strong>Name:</strong> ${order.customerName || 'N/A'}</p>
                            <p><strong>Email:</strong> ${order.customerEmail || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${order.customerPhone || 'N/A'}</p>
                        </div>
                        
                        <div class="order-section">
                            <h4>Shipping Information</h4>
                            <p><strong>Address:</strong> ${order.shippingAddress || 'N/A'}</p>
                            <p><strong>City:</strong> ${order.shippingCity || 'N/A'}</p>
                            <p><strong>Zip:</strong> ${order.shippingZip || 'N/A'}</p>
                        </div>
                        
                        <div class="order-section">
                            <h4>Order Information</h4>
                            <p><strong>Date:</strong> ${order.createdAt ? new Date(order.createdAt.toDate()).toLocaleString() : 'N/A'}</p>
                            <p><strong>Status:</strong> <span class="badge ${getOrderStatusBadgeClass(order.status)}">${order.status}</span></p>
                            <p><strong>Total:</strong> $${order.totalAmount?.toFixed(2) || '0.00'}</p>
                        </div>
                        
                        <div class="order-items-section">
                            <h4>Order Items (${order.items?.length || 0})</h4>
                            <table class="order-items-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Price</th>
                                        <th>Qty</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items?.map(item => `
                                        <tr>
                                            <td>${item.name}</td>
                                            <td>$${item.price?.toFixed(2)}</td>
                                            <td>${item.quantity}</td>
                                            <td>$${(item.price * item.quantity).toFixed(2)}</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="4">No items found</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Create modal if it doesn't exist
            let orderModal = document.getElementById('orderModal');
            if (!orderModal) {
                orderModal = document.createElement('div');
                orderModal.id = 'orderModal';
                orderModal.className = 'modal';
                document.body.appendChild(orderModal);
                
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.id = 'orderModalOverlay';
                document.body.appendChild(overlay);
            }
            
            orderModal.innerHTML = modalContent;
            showModal(orderModal);
            
            // Add close event
            orderModal.querySelector('.close-modal').addEventListener('click', () => {
                hideModal(orderModal);
            });
        }
    } catch (error) {
        console.error('Error viewing order:', error);
        alert('Error loading order details. Please try again.');
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

// Show modal
function showModal(modal) {
    const overlay = modal.previousElementSibling;
    overlay.style.display = 'block';
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Hide modal
function hideModal(modal) {
    const overlay = modal.previousElementSibling;
    overlay.style.display = 'none';
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Log activity
async function logActivity(action, details = '') {
    const user = auth.currentUser;
    
    try {
        await addDoc(collection(db, "activity"), {
            action: action,
            details: details,
            userId: user?.uid || 'system',
            userName: user?.displayName || 'System',
            timestamp: serverTimestamp(),
            status: 'success'
        });
    } catch (error) {
        console.error('Error logging activity:', error);
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