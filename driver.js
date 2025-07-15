import { 
    app, db, auth, 
    collection, doc, getDoc, updateDoc, deleteDoc, addDoc,
    serverTimestamp, query, where, orderBy, onSnapshot,
    getDocs, setDoc, onAuthStateChanged
} from './script.js';

let map;
let marker;

// Initialize Driver Portal
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verify authentication and driver role
        const user = auth.currentUser;
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'driver') {
            window.location.href = 'index.html';
            return;
        }
        
        // Initialize the portal
        initDriverPortal(user, userDoc.data());
        
    } catch (error) {
        console.error("Initialization error:", error);
        window.location.href = 'login.html';
    }
});

function initDriverPortal(user, driverData) {
    // Load driver info
    loadDriverInfo(user, driverData);
    
    // Setup navigation
    setupNavigation();
    
    // Initialize delivery system
    initDeliverySystem(user.uid);
    
    // Setup logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Logout failed:", error);
        }
    });
}

function loadDriverInfo(user, driverData) {
    document.getElementById('driverName').textContent = driverData.name || user.email;
    document.getElementById('driverVehicle').textContent = driverData.vehicle || 'No vehicle assigned';
    
    // Set avatar initials
    const name = driverData.name || user.email;
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('driverAvatar').textContent = initials.substring(0, 2);
}

function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item:not(#logoutBtn)');
    const sections = document.querySelectorAll('.content-section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active menu item
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Show selected section
            const sectionId = this.dataset.section + 'Section';
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                }
            });
        });
    });
}

function initDeliverySystem(driverId) {
    // Load existing deliveries (keep your existing loadDeliveries call)
    loadDeliveries(driverId);
    
    // Setup form submission (keep your existing event listener)
    document.getElementById('deliveryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveDelivery(driverId);
    });
    
    document.getElementById('getLocationBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const mapContainer = document.getElementById('mapContainer');
            mapContainer.style.display = 'block';
            
            // Initialize map if not already done
            if (!map) {
                await initMap();
            } else {
                // If map already exists, just center on current location
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const { latitude: lat, longitude: lng } = position.coords;
                            map.setView([lat, lng], 15);
                            document.getElementById('gpsCoordinates').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                            updateMarker(lat, lng);
                        },
                        (error) => {
                            console.error("Geolocation error:", error);
                            // Default to a reasonable location if geolocation fails
                            map.setView([0, 0], 2);
                        }
                    );
                }
            }
        } catch (error) {
            console.error("Error initializing map:", error);
            alert("Failed to initialize map. Please try again.");
        }
    });
}

async function initMap() {
    return new Promise((resolve, reject) => {
        const mapContainer = document.getElementById('mapContainer');
        const coordsInput = document.getElementById('gpsCoordinates');
        
        try {
            // Initialize map
            map = L.map('map').setView([0, 0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            
            // Add click event to set location
            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                coordsInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                updateMarker(lat, lng);
            });
            
            // Try to get current location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude: lat, longitude: lng } = position.coords;
                        map.setView([lat, lng], 15);
                        coordsInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                        updateMarker(lat, lng);
                        resolve();
                    },
                    (error) => {
                        console.error("Geolocation error:", error);
                        // Default to a reasonable location if geolocation fails
                        map.setView([0, 0], 2);
                        resolve();
                    }
                );
            } else {
                map.setView([0, 0], 2);
                resolve();
            }
        } catch (error) {
            console.error("Map initialization error:", error);
            mapContainer.style.display = 'none';
            reject(error);
        }
    });
}

function updateMarker(lat, lng) {
    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng]).addTo(map)
            .bindPopup('Delivery Location').openPopup();
    }
}

/*function getCurrentLocation() {
    const gpsInput = document.getElementById('gpsCoordinates');
    const locationBtn = document.getElementById('getLocationBtn');
    
    locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
    locationBtn.disabled = true;
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                gpsInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                locationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Location Captured';
                locationBtn.disabled = false;
            },
            (error) => {
                console.error("Error getting location:", error);
                alert("Could not get your location. Please ensure location services are enabled.");
                locationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Try Again';
                locationBtn.disabled = false;
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
        locationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Get Location';
        locationBtn.disabled = false;
    }
}*/

async function saveDelivery(driverId) {
    const coordsInput = document.getElementById('gpsCoordinates');
    const customerName = document.getElementById('customerName').value.trim();
    const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
    const deliveryTime = document.getElementById('deliveryTime').value;
    
    // Validate inputs
    if (!customerName || !deliveryAddress || !deliveryTime || !coordsInput.value) {
        alert('Please fill in all fields and select a location on the map');
        return;
    }

    try {
        // Create delivery object
        const delivery = {
            driverId: driverId,
            customerName: customerName,
            deliveryAddress: deliveryAddress,
            deliveryTime: deliveryTime,
            gpsCoordinates: coordsInput.value,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Add to Firestore
        const docRef = await addDoc(collection(db, "deliveries"), delivery);
        console.log("Delivery saved with ID: ", docRef.id);

        // Add the new delivery to the UI immediately
        addDeliveryToUI({
            id: docRef.id,
            ...delivery,
            // Add a temporary timestamp for display until Firestore provides the real one
            createdAt: new Date()
        });

        // Reset form and hide map
        document.getElementById('deliveryForm').reset();
        document.getElementById('mapContainer').style.display = 'none';
        
        // Clear map marker if exists
        if (marker) {
            map.removeLayer(marker);
            marker = null;
        }

    } catch (error) {
        console.error("Error saving delivery: ", error);
        alert("Failed to save delivery. Please try again.");
    }
}

async function loadDeliveries(driverId) {
    try {
        // Query deliveries for this driver from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const q = query(
            collection(db, "deliveries"),
            where("driverId", "==", driverId),
            where("createdAt", ">=", today),
            orderBy("createdAt", "desc")
        );
        
        // Set up real-time listener
        onSnapshot(q, (querySnapshot) => {
            const deliveriesList = document.getElementById('deliveriesList');
            deliveriesList.innerHTML = '';
            
            if (querySnapshot.empty) {
                deliveriesList.innerHTML = '<p>No deliveries scheduled for today.</p>';
                return;
            }
            
            querySnapshot.forEach((doc) => {
                addDeliveryToUI({
                    id: doc.id,
                    ...doc.data()
                });
            });
        });
        
    } catch (error) {
        console.error("Error loading deliveries: ", error);
        document.getElementById('deliveriesList').innerHTML = 
            '<p>Error loading deliveries. Please refresh the page.</p>';
    }
}

function addDeliveryToUI(delivery) {
    const deliveriesList = document.getElementById('deliveriesList');
    
    // Convert Firestore timestamp to readable time if needed
    const deliveryTime = delivery.deliveryTime || 
        (delivery.createdAt?.toDate ? delivery.createdAt.toDate().toLocaleTimeString() : 
         typeof delivery.createdAt === 'string' ? delivery.createdAt : 
         new Date().toLocaleTimeString());
    
    const deliveryElement = document.createElement('div');
    deliveryElement.className = 'delivery-item';
    deliveryElement.innerHTML = `
        <div class="delivery-header">
            <h3>${delivery.customerName}</h3>
            <div class="delivery-actions">
                <button class="navigate-btn" data-coords="${delivery.gpsCoordinates}">
                    <i class="fas fa-directions"></i>
                </button>
                <button class="delete-btn" data-id="${delivery.id}">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="complete-btn" data-id="${delivery.id}">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        </div>
        <p><strong>Address:</strong> ${delivery.deliveryAddress}</p>
        <p><strong>Time:</strong> ${deliveryTime}</p>
        <p class="status ${delivery.status}">${delivery.status}</p>
    `;
    
    deliveriesList.prepend(deliveryElement); // Add new deliveries at the top
    
    // Add event listeners
    deliveryElement.querySelector('.navigate-btn').addEventListener('click', () => {
        window.open(`https://www.google.com/maps?q=${delivery.gpsCoordinates}`, '_blank');
    });
    
    deliveryElement.querySelector('.complete-btn').addEventListener('click', () => {
        markDeliveryComplete(delivery.id);
    });
    
    deliveryElement.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this delivery?')) {
            try {
                await deleteDoc(doc(db, "deliveries", delivery.id));
                deliveryElement.remove();
            } catch (error) {
                console.error("Error deleting delivery: ", error);
                alert("Failed to delete delivery. Please try again.");
            }
        }
    });
}

async function markDeliveryComplete(deliveryId) {
    try {
        await updateDoc(doc(db, "deliveries", deliveryId), {
            status: 'completed',
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error marking delivery complete: ", error);
        alert("Failed to update delivery status. Please try again.");
    }
}