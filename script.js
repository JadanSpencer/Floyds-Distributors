import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { 
  getAnalytics 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  query,
  where,
  addDoc,
  orderBy,
  onSnapshot,
  limit
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBk4oAO4LVlrwgBgrdk9m2waZaeiB1nrqY",
  authDomain: "floyds-489c8.firebaseapp.com",
  databaseURL: "https://floyds-489c8-default-rtdb.firebaseio.com",
  projectId: "floyds-489c8",
  storageBucket: "floyds-489c8.appspot.com",
  messagingSenderId: "467837659879",
  appId: "1:467837659879:web:8fde5b1862184183ac9042",
  measurementId: "G-32RKBL830G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);


// Export all needed functions
export { 
  app, db, auth, 
  collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, query, where, orderBy, limit, onSnapshot,
  addDoc,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut
};


// ===== ADD THIS AUTH STATE OBSERVER RIGHT HERE =====
const isLoginPage = window.location.pathname.includes('login.html');
const publicPages = ['index.html', 'about.html', 'contact.html']; // Add any public pages
const isPublicPage = publicPages.some(page => window.location.pathname.includes(page));

console.log(`Page: ${window.location.pathname}, isLoginPage: ${isLoginPage}, isPublicPage: ${isPublicPage}`);

// Auth state observer for protected pages
if (!isLoginPage && !isPublicPage) {
  console.log('Checking protected page access');
  
  const user = await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Important to unsubscribe immediately
      resolve(user);
    });
  });

  if (!user) {
    console.log("No user authenticated, redirecting to login...");
    // Store current URL for post-login redirect
    localStorage.setItem('returnUrl', window.location.pathname + window.location.search);
    window.location.href = 'login.html';
    // Stop execution of remaining code on this page
    throw new Error("Redirecting to login");
  }
}
// ===== END OF AUTH STATE OBSERVER =====


// Auth Elements
const authContainer = document.getElementById('authContainer');
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const submitSignup = document.getElementById('submitSignup');
const submitLogin = document.getElementById('submitLogin');
const heroLoginBtn = document.getElementById('heroLoginBtn');
const heroSignupBtn = document.getElementById('heroSignupBtn');

const headerLoginBtn = document.getElementById('headerLoginBtn');
const headerSignupBtn = document.getElementById('headerSignupBtn');

let currentUserRole = null;

// async function checkHardcodedAdminOrDriver(email, password) {
//   // Only check against the hardcoded lists
//   const admin = HARDCODED_ADMINS.find(a => a.email === email && a.password === password);
//   if (admin) {
//     try {
//       await signInWithEmailAndPassword(auth, email, password);
//       window.location.href = 'admin.html';
//       return true;
//     } catch (error) {
//       console.error("Error signing in hardcoded admin:", error);
//       return false;
//     }
//   }
  
//   const driver = HARDCODED_DRIVERS.find(d => d.email === email && d.password === password);
//   if (driver) {
//     try {
//       await signInWithEmailAndPassword(auth, email, password);
//       window.location.href = 'driver.html';
//       return true;
//     } catch (error) {
//       console.error("Error signing in hardcoded driver:", error);
//       return false;
//     }
//   }
  
//   return false;
// }


// Single event delegation for all auth-related buttons
document.addEventListener('click', function(e) {
  // Handle header login button
  if (e.target.closest('#headerLoginBtn')) {
    e.preventDefault();
    showAuthModal('login');
    return;
  }
  
  // Handle header signup button
  if (e.target.closest('#headerSignupBtn')) {
    e.preventDefault();
    showAuthModal('signup');
    return;
  }
  
  // Handle logout button
  if (e.target.closest('#logoutBtn')) {
    e.preventDefault();
    handleLogout();
    return;
  }
  
  // Close form when clicking outside
  // Close form when clicking outside
if (authContainer && authContainer.style.display === 'block' && 
    !authContainer.contains(e.target) && 
    !e.target.closest('#headerLoginBtn') && 
    !e.target.closest('#headerSignupBtn') &&
    !e.target.closest('#heroLoginBtn') && 
    !e.target.closest('#heroSignupBtn')) {
  toggleAuthForm(false);
}
});

// Mobile toggle functionality
document.getElementById('mobileToggleSignup')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('authContainer').classList.add('right-panel-active');
});

document.getElementById('mobileToggleLogin')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('authContainer').classList.remove('right-panel-active');
});

// Event listeners for the new form
if (signUpButton) signUpButton.addEventListener('click', () => {
    authContainer.classList.add("right-panel-active");
});

if (signInButton) signInButton.addEventListener('click', () => {
    authContainer.classList.remove("right-panel-active");
});

if (heroLoginBtn) heroLoginBtn.addEventListener('click', () => showAuthModal('login'));
if (heroSignupBtn) heroSignupBtn.addEventListener('click', () => showAuthModal('signup'));

// Form submissions
if (submitLogin) submitLogin.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogin();
});

if (submitSignup) submitSignup.addEventListener('click', (e) => {
    e.preventDefault();
    handleSignup();
});

async function handleLogin() {
  console.log('Login initiated');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('submitLogin');
  
  if (!email || !password) {
    showAuthError('Please fill in all fields');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Signing in...`;
  
  try {
    const hardcodedUser = [...HARDCODED_ADMINS, ...HARDCODED_DRIVERS].find(u => 
      u.email === email && u.password === password);
    
    if (hardcodedUser) {
      await signInWithEmailAndPassword(auth, email, password);
      const role = HARDCODED_ADMINS.some(a => a.email === email) ? 'admin' : 'driver';
      redirectBasedOnRole(role);
      return;
    }

    // Normal Firebase auth flow
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

    let role = 'customer';
    if (userDoc.exists()) {
      role = userDoc.data().role || 'customer';
      await updateDoc(doc(db, "users", userCredential.user.uid), {
        lastLogin: serverTimestamp()
      });
    } else {
      // Create new customer document
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: email,
        name: email.split('@')[0],
        role: 'customer',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        status: 'active'
      });
    }
    
    redirectBasedOnRole(role);

  } catch (error) {
    console.error('Login error:', error);
    showAuthError(getAuthErrorMessage(error.code));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign In';
  }
}

// Add this helper function
function updateUserUI(userName) {
  const authButtons = document.getElementById('authButtons');
  if (authButtons) {
    authButtons.innerHTML = `
      <span class="welcome-message">Welcome, ${userName}</span>
      <button id="logoutBtn" class="auth-btn">Logout</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  }
  
  // Also update any other headers that might exist
  document.querySelectorAll('.auth-buttons').forEach(container => {
    if (container.id !== 'authButtons') {
      container.innerHTML = `
        <span class="welcome-message">Welcome, ${userName}</span>
        <button class="auth-btn logout-btn">Logout</button>
      `;
      container.querySelector('.logout-btn').addEventListener('click', handleLogout);
    }
  });
}

function resetAuthUI() {
  const authButtons = document.getElementById('authButtons');
  if (authButtons) {
    authButtons.innerHTML = `
      <a href="login.html" class="auth-btn">Login</a>
      <a href="login.html?signup=true" class="auth-btn auth-btn-primary">Sign Up</a>
    `;
  }
  
  // Reset any other headers
  document.querySelectorAll('.auth-buttons').forEach(container => {
    if (container.id !== 'authButtons') {
      container.innerHTML = `
        <a href="login.html" class="auth-btn">Login</a>
        <a href="login.html?signup=true" class="auth-btn auth-btn-primary">Sign Up</a>
      `;
    }
  });
}

async function handleSignup() {
  console.log('Signup initiated');
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const submitBtn = document.getElementById('submitSignup');
  const role = document.getElementById('signupRole')?.value || 'customer';

  if (!name || !email || !password) {
    showAuthError('Please fill in all fields');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Creating account...`;

  try {
    // Create auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile with name
    await updateProfile(userCredential.user, {
      displayName: name
    });

    // Create user document with customer role
    await setDoc(doc(db, "users", userCredential.user.uid), {
      name: name,
      email: email,
      role: role,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      status: 'active'
    });

    // Update UI and redirect
    updateUserUI(name);
    redirectBasedOnRole(role);
    
  } catch (error) {
    console.error('Signup error:', error);
    showAuthError(getAuthErrorMessage(error.code));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign Up';
  }
}

// Add these with your other utility functions
export async function getUserRole(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data().role : null;
}

export async function isUserAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  return await getUserRole(user.uid) === 'admin';
}

async function handlePasswordReset() {
  const email = prompt('Please enter your email address for password reset:');
  if (!email) return;

  try {
    await sendPasswordResetEmail(auth, email);
    alert('Password reset email sent. Please check your inbox.');
  } catch (error) {
    alert(getAuthErrorMessage(error.code));
  }
}

function getAuthErrorMessage(code) {
    switch(code) {
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/user-disabled':
            return 'This account has been disabled';
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/too-many-requests':
            return 'Too many attempts. Account temporarily locked.';
        default:
            return 'Login failed. Please try again.';
    }
}
// Admin Signup Functionality
function initAdminSignup() {
    const adminSignupBtn = document.getElementById('adminSignupBtn'); // You'll need to add this button somewhere
    const adminSignupOverlay = document.getElementById('adminSignupOverlay');
    const adminSignupContainer = document.getElementById('adminSignupContainer') || 
                                document.getElementById('adminSignupModal');
    const closeAdminSignup = document.getElementById('closeAdminSignup') || 
                           document.querySelector('#adminSignupContainer .close-auth') ||
                           document.querySelector('#adminSignupModal .close-modal');
    
    // Show admin signup form (you can trigger this from a secret button/link)
    if (adminSignupBtn) {
        adminSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            adminSignupOverlay.style.display = 'block';
            adminSignupContainer.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    }
    
    // Close admin signup form
    if (closeAdminSignup) {
        closeAdminSignup.addEventListener('click', () => {
            adminSignupOverlay.style.display = 'none';
            adminSignupContainer.style.display = 'none';
            document.body.style.overflow = '';
        });
    }
    
    // Handle admin signup form submission
    const adminSignupForm = document.getElementById('adminSignupForm');
    if (adminSignupForm) {
        adminSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('adminName').value.trim();
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            const role = document.getElementById('adminRole').value;
            
            if (!name || !email || !password) {
                alert('Please fill in all fields');
                return;
            }
            
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Update user profile
                await updateProfile(userCredential.user, {
                    displayName: name
                });
                
                // Create user document with admin role
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    name: name,
                    email: email,
                    role: role,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    isAdmin: true,
                    adminApproved: true // You might want to set this to false and require approval
                });
                
                // Close the form
                adminSignupOverlay.style.display = 'none';
                adminSignupContainer.style.display = 'none';
                document.body.style.overflow = '';
                
                alert('Admin account created successfully!');
                
                // Clear form
                adminSignupForm.reset();
                
            } catch (error) {
                console.error('Admin signup error:', error);
                alert(getAuthErrorMessage(error.code));
            }
        });
    }
}

export async function ensureAdminStatus() {
  console.log('Checking admin status');
  const user = auth.currentUser;
  
  if (!user) {
    console.log("No user logged in");
    return false;
  }
  
  console.log("Current user:", user.email);
  
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (!userDoc.exists()) {
      console.log("User document doesn't exist");
      return false;
    }
    
    const userData = userDoc.data();
    console.log("User data:", userData);
    
    const isAdmin = userData.role === 'admin';
    console.log("Admin status:", isAdmin);
    return isAdmin;
  } catch (error) {
    console.error("Admin check error:", error);
    return false;
  }
}

let authInitialized = false;

onAuthStateChanged(auth, async (user) => {
  if (!authInitialized) {
    authInitialized = true;
    return; // Skip first automatic fire
  }

  console.log('Auth state changed. User:', user ? user.uid : 'none');
  
  // Skip auth checks if we're on login page
  if (isLoginPage) return;
  
  if (user) {
    console.log('User authenticated:', user.email);
    loadCartFromStorage();
    updateCartUI();
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let role = 'customer';
      
      if (userDoc.exists()) {
        role = userDoc.data().role || 'customer';

        if (window.location.pathname.includes('driver.html')) {
            if (!canAccessDriverPortal(role)) {
                window.location.href = 'index.html';
                return;
            }
            // Clear the admin access flag after successful check
            sessionStorage.removeItem('adminAccessingDriverPortal');
        }
      } else {
        loadCartFromStorage(); // Load guest cart
        updateCartUI();

        // Create new customer document
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          role: 'customer',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          status: 'active'
        });
      }

      // Only redirect if we have a returnUrl
      const returnUrl = localStorage.getItem('returnUrl');
      if (returnUrl) {
        localStorage.removeItem('returnUrl');
        window.location.href = returnUrl;
      }
    } catch (error) {
      console.error("Error in auth observer:", error);
    }
  } else {
    // Only redirect to login if we're not on a public page
    const currentPage = window.location.pathname.split('/').pop();
    if (!publicPages.includes(currentPage)) {
      localStorage.setItem('returnUrl', window.location.pathname + window.location.search);
      window.location.href = 'login.html';
    }
  }
});

function redirectBasedOnRole(role) {
  const returnUrl = localStorage.getItem('returnUrl');
  localStorage.removeItem('returnUrl');
  
  console.log(`Redirecting based on role: ${role}`);
  
  switch(role) {
    case 'admin':
      console.log('Redirecting to admin.html');
      window.location.href = returnUrl || 'admin.html';
      break;
    case 'driver':
      console.log('Redirecting to driver.html');
      window.location.href = returnUrl || 'driver.html';
      break;
    default:
      const redirectUrl = returnUrl || 'index.html';
      console.log(`Redirecting to: ${redirectUrl}`);
      window.location.href = redirectUrl;
  }
}

export function canAccessDriverPortal(role) {
    // Allow access if user is admin and specifically accessing from admin panel
    const adminAccessing = sessionStorage.getItem('adminAccessingDriverPortal') === 'true';
    return role === 'driver' || (role === 'admin' && adminAccessing);
}

function showAuthError(message, container = null) {
  // Remove any existing error messages
  const errorContainer = container || document.querySelector('.auth-container');
  errorContainer.querySelectorAll('.auth-error').forEach(el => el.remove());
  
  // Create and display new error message
  const errorElement = document.createElement('div');
  errorElement.className = 'auth-error';
  errorElement.style.color = '#ff6b6b';
  errorElement.style.margin = '1rem 0';
  errorElement.style.textAlign = 'center';
  errorElement.textContent = message;
  
  // Insert after the submit button or at the end of the form
  const submitBtn = errorContainer.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.insertAdjacentElement('afterend', errorElement);
  } else {
    errorContainer.appendChild(errorElement);
  }
}

async function handleLogout() {
    try {
        await signOut(auth);
        resetAuthUI();
        // Switch to guest cart
        loadCartFromStorage();
        updateCartUI();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function checkAuthState() {
  const auth = getAuth();
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userName = userDoc.exists() ? userDoc.data().name : user.email;
      updateUserUI(userName);
    } else {
      // User is signed out
      resetAuthUI();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
    
    if (!window.location.pathname.includes('login.html')) {
        initCartFunctionality();
        initProductSlider();
        checkAuthState();
    }

    const forgotPasswordLink = document.getElementById('forgotPassword');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            handlePasswordReset();
        });
    }

    // Initialize all functionality
    initCartFunctionality();
    initMobileMenu();
    initDropdownMenu();
    initSearchFunctionality();
    initProductSlider();
    initProductDetailTiles();
    initQuickView();
    initAdminSignup();
    debugFirestoreConnection();
    initPageTransitions();

    const loginEmail = document.getElementById('loginEmail');
    const signupEmail = document.getElementById('signupEmail');
    
    if (loginEmail) {
        loginEmail.addEventListener('blur', function() {
            if (this.value && !validateEmail(this.value)) {
                this.classList.add('invalid');
            } else {
                this.classList.remove('invalid');
            }
        });
    }
    
    if (signupEmail) {
        signupEmail.addEventListener('blur', function() {
            if (this.value && !validateEmail(this.value)) {
                this.classList.add('invalid');
            } else {
                this.classList.remove('invalid');
            }
        });
    }

    const loginForm = document.querySelector('.sign-in-container form');
    const signupForm = document.querySelector('.sign-up-container form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }
    
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSignup();
        });
    }
});

/*****************************
 * MOBILE MENU FUNCTIONALITY
 *****************************/
function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (!hamburger || !navLinks) return;
    
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });
}

/*****************************
 * DROPDOWN MENU FUNCTIONALITY
 *****************************/
function initDropdownMenu() {
    const dropdown = document.querySelector('.dropdown');
    if (!dropdown) return;

    // Toggle dropdown on mobile
    dropdown.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            e.preventDefault();
            dropdown.classList.toggle('active');
        }
    });

    // Close dropdown when clicking elsewhere on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

/*****************************
 * CART FUNCTIONALITY
 *****************************/
function initCartFunctionality() {
    let cart = [];
    
    // DOM Elements
    const cartIcon = document.querySelector('.cart-icon');
    const cartSidebar = document.querySelector('.cart-sidebar');
    const cartOverlay = document.querySelector('.cart-overlay');
    const closeCart = document.querySelector('.close-cart');
    const checkoutBtn = document.querySelector('.checkout-btn');

    // Make sure these elements exist
    if (!cartIcon || !cartSidebar || !cartOverlay) {
        return;
    }

    // Initialize cart from storage
    loadCartFromStorage();
    updateAllCartCounts();

    // Event Listeners
    document.addEventListener('click', function(e) {
        // Handle cart icon clicks
        if (e.target.closest('.cart-icon, .cart-icon-symbol, .cart-count')) {
            e.preventDefault();
            toggleCart();
            return;
        }
        
        // Handle remove item clicks
        if (e.target.closest('.remove-item')) {
            e.preventDefault();
            const productId = e.target.closest('.remove-item').dataset.id;
            removeFromCart(productId);
        }
    });
    
    if (cartOverlay) cartOverlay.addEventListener('click', toggleCart);
    if (closeCart) closeCart.addEventListener('click', toggleCart);
    
    function getCartStorageKey() {
        const user = auth.currentUser;
        return user ? `cart_${user.uid}` : 'guest_cart';
    }

    function toggleCart() {
        const cartSidebar = document.querySelector('.cart-sidebar');
        const cartOverlay = document.querySelector('.cart-overlay');
        
        if (!cartSidebar || !cartOverlay) return;
        
        cartSidebar.classList.toggle('active');
        cartOverlay.classList.toggle('active');
        
        if (cartSidebar.classList.contains('active')) {
            updateCartUI();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length > 0) {
                initiateCheckout();
            } else {
                alert('Your cart is empty!');
            }
        });
    }

    // Cart Functions
    function addToCart(product) {
        if (product.stock <= 0) {
            alert('This product is out of stock');
            return;
        }
        
        const existingItem = cart.find(item => item.id === product.id);
        
        if (existingItem) {
            if (existingItem.quantity >= product.stock) {
                alert(`Only ${product.stock} available in stock`);
                return;
            }
            existingItem.quantity += 1;
        } else {
            cart.push({
                ...product,
                quantity: 1
            });
        }
        
        updateAllCartCounts();
        saveCartToStorage();
        
        // Visual feedback
        const cartIcon = document.querySelector('.cart-icon');
        if (cartIcon) {
            cartIcon.classList.add('added');
            setTimeout(() => {
                cartIcon.classList.remove('added');
            }, 500);
        }
    }

    function updateAllCartCounts() {
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        document.querySelectorAll('.cart-count').forEach(el => {
            el.textContent = count;
            el.style.visibility = count > 0 ? 'visible' : 'hidden';
        });
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        updateAllCartCounts();
        saveCartToStorage();
        updateCartUI();
    }

    function updateCartUI() {
        const cartItemsElement = document.querySelector('.cart-items');
        const cartCountElement = document.querySelector('.cart-count');
        const totalPriceElement = document.querySelector('.total-price');
        
        if (!cartItemsElement || !cartCountElement || !totalPriceElement) return;
        
        cartItemsElement.innerHTML = '';
        let total = 0;
        
        if (cart.length === 0) {
            cartItemsElement.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
        } else {
            cart.forEach(item => {
                const price = parseFloat(item.price) || 0;
                const cartItemElement = document.createElement('div');
                cartItemElement.className = 'cart-item';
                cartItemElement.innerHTML = `
                    <div class="cart-item-info">
                        <img src="${item.image}" alt="${item.name}" class="cart-item-image"
                            onerror="this.src='https://placehold.co/100?text=Product'">
                        <div>
                            <h4>${item.name}</h4>
                            <p>$${price.toFixed(2)} x ${item.quantity}</p>
                            ${item.options ? `<p class="cart-item-options">${formatOptions(item.options)}</p>` : ''}
                        </div>
                    </div>
                    <button class="remove-item" data-id="${item.id}">×</button>
                `;
                cartItemsElement.appendChild(cartItemElement);
                
                total += price * item.quantity;
            });
        }
        
        cartCountElement.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
        totalPriceElement.textContent = `$${total.toFixed(2)}`;
    }

    function saveCartToStorage() {
        localStorage.setItem(getCartStorageKey(), JSON.stringify(cart));
    }

    function loadCartFromStorage() {
        const savedCart = localStorage.getItem(getCartStorageKey());
        cart = savedCart ? JSON.parse(savedCart) : [];
        updateAllCartCounts();
    }

    function formatOptions(options) {
        return Object.entries(options)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
    }

    function initiateCheckout() {
    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
    const tax = subtotal * 0.15; // 15% tax
    const total = subtotal + tax;
    
    // Prepare order data
    const orderData = {
        items: cart,
        subtotal: subtotal,
        tax: tax,
        total: total
    };
    
    // Save order data temporarily
    localStorage.setItem('currentOrder', JSON.stringify(orderData));
    
    // Redirect to checkout
    window.location.href = 'checkout.html';
}

    // Make functions available globally
    window.addToCart = addToCart;
    window.toggleCart = toggleCart;
    window.updateCartUI = updateCartUI;
}

window.validateDeliveryInfo = function() {
    const requiredFields = ['email', 'first-name', 'last-name', 'phone', 'address', 'city'];
    let isValid = true;
    
    // Validate required fields
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            isValid = false;
            field.classList.add('invalid');
        } else {
            field.classList.remove('invalid');
        }
    });
    
    // Validate email format if email field exists and has value
    const emailField = document.getElementById('email');
    if (emailField && emailField.value.trim() && !validateEmail(emailField.value.trim())) {
        isValid = false;
        emailField.classList.add('invalid');
    }
    
    if (!isValid) {
        alert('Please fill in all required fields correctly');
    }
    
    return isValid;
}

window.validatePaymentInfo = function() {
    const selectedPayment = document.querySelector('input[name="payment"]:checked');
    if (!selectedPayment) {
        alert('Please select a payment method');
        return false;
    }
    return true;
}

window.updateReviewSection= function() {
    const reviewDeliveryInfo = document.getElementById('reviewDeliveryInfo');
    if (reviewDeliveryInfo) {
        reviewDeliveryInfo.innerHTML = `
            <p>${document.getElementById('first-name').value} ${document.getElementById('last-name').value}</p>
            <p>${document.getElementById('address').value}</p>
            <p>${document.getElementById('city').value}, ${document.getElementById('parish').value}</p>
            <p>${document.getElementById('phone').value}</p>
            <p>${document.getElementById('email').value}</p>
        `;
    }
    
    const reviewPaymentMethod = document.getElementById('reviewPaymentMethod');
    if (reviewPaymentMethod) {
        const selectedPayment = document.querySelector('input[name="payment"]:checked');
        if (selectedPayment) {
            const paymentLabel = selectedPayment.nextElementSibling.nextElementSibling.textContent;
            reviewPaymentMethod.innerHTML = `<p>${paymentLabel}</p>`;
        }
    }
}

window.showStep = function(stepNumber) {
    const progress = document.getElementById('stepProgress');
    if (progress) {
        progress.style.width = `${(stepNumber - 1) * 50}%`;
    }
    
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById(`step${i}`);
        if (step) {
            step.classList.toggle('active', i === stepNumber);
            step.classList.toggle('completed', i < stepNumber);
        }
    }
    
    const sections = ['deliveryInfoSection', 'paymentMethodSection', 'reviewOrderSection'];
    sections.forEach((sectionId, index) => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.toggle('active', index + 1 === stepNumber);
        }
    });
}

// Top of script.js (after Firebase initialization)
window.processOrder = async function(orderData) {
    const user = auth.currentUser;
    if (!user) {
        alert('Please log in to complete your order');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        // Create order document with all required fields
        const orderDoc = {
            userId: user.uid,
            customerName: `${document.getElementById('first-name').value} ${document.getElementById('last-name').value}`,
            customerEmail: document.getElementById('email').value,
            customerPhone: document.getElementById('phone').value,
            deliveryAddress: document.getElementById('address').value,
            deliveryCity: document.getElementById('city').value,
            deliveryParish: document.getElementById('parish').value,
            deliveryInstructions: document.getElementById('instructions').value,
            items: orderData.items.map(item => ({
                productId: item.id,
                name: item.name,
                price: parseFloat(item.price),
                quantity: item.quantity,
                image: item.image
            })),
            paymentMethod: document.querySelector('input[name="payment"]:checked').id,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            subtotal: orderData.subtotal,
            tax: orderData.tax,
            total: orderData.total,
            orderNumber: generateOrderNumber() // Make sure this function exists
        };
        
        // Add order to Firestore
        const docRef = await addDoc(collection(db, "orders"), orderDoc);
        
        // Clear cart and redirect
        localStorage.removeItem('currentOrder');
        const cartStorageKey = user ? `cart_${user.uid}` : 'guest_cart';
        localStorage.removeItem(cartStorageKey);
        
        // Redirect with the new document ID
        window.location.href = `order-confirmation.html?orderId=${docRef.id}`;
        
    } catch (error) {
        console.error("Error processing order:", error);
        alert("Error processing order. Please try again.");
    }
};

// Helper function (also global)
function generateOrderNumber() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
}

function filterProducts(query) {
    // Example: filter products shown on the products page based on the query string
    // Implement your filtering logic here, e.g. hide/show product cards
    const products = document.querySelectorAll('.product-card');
    products.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        if (name.includes(query.toLowerCase())) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}


/*****************************
 * SEARCH FUNCTIONALITY
 *****************************/
function initSearchFunctionality() {
    // Initialize search suggestions
    initSearchSuggestions();
    
    // Handle all search forms
    const searchForms = document.querySelectorAll('form.search-form');
    const searchInputs = document.querySelectorAll('.search-input');
    const searchBtns = document.querySelectorAll('.search-btn');

    // Form submission handler
    searchForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const searchInput = this.querySelector('input[name="q"]');
            if (searchInput?.value.trim()) {
                performSearch(searchInput.value.trim());
            }
        });
    });

    // Search button click handler
    searchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const searchInput = btn.previousElementSibling;
            if (searchInput?.value.trim()) {
                performSearch(searchInput.value.trim());
            }
        });
    });

    // Enter key handler
    searchInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                performSearch(input.value.trim());
            }
        });
    });

    // Handle search on products page load
    if (window.location.pathname.includes('products.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('q');
        if (searchQuery && typeof handleProductsPageSearch === 'function') {
            handleProductsPageSearch(searchQuery);
        }
    }
}

function initSearchSuggestions() {
    const searchInputs = document.querySelectorAll('.search-input');
    
    if (searchInputs.length === 0) return;

    searchInputs.forEach(input => {
        const suggestionContainer = document.createElement('div');
        suggestionContainer.className = 'search-suggestions';
        input.parentNode.appendChild(suggestionContainer);
        
        input.addEventListener('input', debounce(function() {
            const query = this.value.toLowerCase();
            suggestionContainer.innerHTML = '';
            
            if (query.length < 2) {
                suggestionContainer.style.display = 'none';
                return;
            }
            
            const suggestions = getSearchSuggestions(query);
            
            if (suggestions.length) {
                suggestions.forEach(product => {
                    const suggestion = document.createElement('div');
                    suggestion.className = 'search-suggestion';
                    suggestion.innerHTML = `
                        <i class="fas fa-search"></i>
                        <span>${product.name}</span>
                    `;
                    suggestion.addEventListener('click', () => {
                        input.value = product.name;
                        suggestionContainer.style.display = 'none';
                        performSearch(product.name);
                    });
                    suggestionContainer.appendChild(suggestion);
                });
                suggestionContainer.style.display = 'block';
            } else {
                suggestionContainer.style.display = 'none';
            }
        }, 300));
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target)) {
                suggestionContainer.style.display = 'none';
            }
        });
    });

    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
}

async function fetchProducts() {
  try {
    const productsCol = collection(db, 'products');
    const productSnapshot = await getDocs(productsCol);
    
    return productSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Product',
        price: `$${data.price || '0.00'}`, // Format price
        description: data.description || 'No description',
        image: data.image || 'https://via.placeholder.com/300',
        category: data.category || 'uncategorized',
        featured: data.featured || false,
        stock: data.stock || 0
      };
    });
  } catch (error) {
    console.error("Firestore error:", error);
    return []; // Return empty array if error
  }
}

const testProducts = await fetchProducts();
console.log("Firestore products:", testProducts);

function performSearch(query) {
    // Store the search query in localStorage
    localStorage.setItem('searchQuery', query);
    // Redirect to products page
    window.location.href = `products.html?q=${encodeURIComponent(query)}`;
}

function handleProductsPageSearch(query) {
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    
    if (searchInput) searchInput.value = query;
    if (mobileSearchInput) mobileSearchInput.value = query;
    
    // Filter products based on search query
    if (typeof filterProducts === 'function') {
        filterProducts(query);
    }
}

export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
        } else {
            navigator.geolocation.getCurrentPosition(
                position => resolve(position),
                error => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        }
    });
}

async function debugFirestoreConnection() {
  try {
    const testDoc = await getDoc(doc(db, "test", "test"));
    console.log("Firestore connection test:", testDoc.exists() ? "Success" : "Test doc doesn't exist");
    
    const productsCol = collection(db, 'products');
    const productSnapshot = await getDocs(productsCol);
    console.log("Products collection size:", productSnapshot.size);
    
    productSnapshot.forEach((doc) => {
      console.log(`Product ${doc.id}:`, doc.data());
    });
  } catch (error) {
    console.error("Firestore debug error:", error);
  }
}

/*****************************
 * PRODUCT SLIDER FUNCTIONALITY
 *****************************/
async function initProductSlider() {
    console.log("Initializing product slider...");

    const sliderTrack = document.querySelector('.slider-track');
    if (!sliderTrack) {
        //console.error("Slider track element not found");
        return;
    }

    // Show loading state
    sliderTrack.innerHTML = `
        <div class="loading-placeholder">
            <div class="loading-spinner large"></div>
            <p>Loading products...</p>
        </div>
    `;
    console.log("Showing loading state");

    let products = [];
    try {
        console.log("Fetching products from Firestore...");
        // First try to fetch from Firestore
        products = await fetchProducts();
        console.log("Products fetched:", products);
        
        // If no products from Firestore, use fallback
        if (products.length === 0) {
            console.log("Using fallback products");
            products = [
                { id: 1, name: "Eco-Friendly Boxes", price: "$12.99", description: "Biodegradable food boxes", image: "images/eco-box-large.png" },
                { id: 2, name: "Compostable Bowls", price: "$8.99", description: "Sturdy compostable bowls", image: "images/compostable-bowls.png" },
                { id: 3, name: "Recyclable Trays", price: "$15.99", description: "Multi-compartment trays", image: "images/recyclable-trays.png" },
                { id: 4, name: "Paper Bags", price: "$5.99", description: "Durable paper bags", image: "images/paper-bags.png" },
                { id: 5, name: "Eco-Cups", price: "$7.99", description: "Recyclable cups", image: "images/eco-cups.png" },
                { id: 6, name: "Sustainable Cutlery", price: "$9.99", description: "Compostable utensils", image: "images/sustainable-cutlery.png" }
            ];
            console.log("Using fallback products due to error");
        }
    } catch (error) {
        console.error('Error loading products:', error);
        // Use fallback products if Firestore fails
        products = [
            { id: 1, name: "Eco-Friendly Boxes", price: "$12.99", description: "Biodegradable food boxes", image: "images/eco-box-large.png" },
            { id: 2, name: "Compostable Bowls", price: "$8.99", description: "Sturdy compostable bowls", image: "images/compostable-bowls.png" },
            { id: 3, name: "Recyclable Trays", price: "$15.99", description: "Multi-compartment trays", image: "images/recyclable-trays.png" },
            { id: 4, name: "Paper Bags", price: "$5.99", description: "Durable paper bags", image: "images/paper-bags.png" },
            { id: 5, name: "Eco-Cups", price: "$7.99", description: "Recyclable cups", image: "images/eco-cups.png" },
            { id: 6, name: "Sustainable Cutlery", price: "$9.99", description: "Compostable utensils", image: "images/sustainable-cutlery.png" }
        ];
        console.log("Using fallback products due to error");
    }

    // Clear loading state
    sliderTrack.innerHTML = '';
    console.log("Creating product cards");
    
    // Create product cards
    createProductCards(products, sliderTrack);
    console.log("Product cards created");

    // Animation variables
    let animationId;
    let speed = 0.1;
    let position = 0;
    let isPaused = false;
    let hoverPauseTimeout;
    const RESUME_DELAY = 1000;
    let cardWidth = 250;
    let gapWidth = 20;

    // Drag and scroll variables
    let isDragging = false;
    let startX;
    let scrollLeft;
    let lastScrollTime = 0;
    const AUTO_RESUME_DELAY = 3000;

    // Start animation
    animate();

    // Event Listeners
    sliderTrack.addEventListener('mousedown', handleMouseDown);
    sliderTrack.addEventListener('mouseleave', handleMouseLeave);
    sliderTrack.addEventListener('mouseup', handleMouseUp);
    sliderTrack.addEventListener('mousemove', handleMouseMove);
    sliderTrack.addEventListener('touchstart', handleTouchStart);
    sliderTrack.addEventListener('touchend', handleTouchEnd);
    sliderTrack.addEventListener('touchmove', handleTouchMove);
    sliderTrack.addEventListener('wheel', handleWheel);
    sliderTrack.addEventListener('mouseenter', originalMouseEnter);
    sliderTrack.addEventListener('mouseleave', originalMouseLeave);

    // Animation function
    function animate() {
        if (!isPaused && !isDragging) {
            position -= speed;
        
            if (position <= -products.length * (cardWidth + gapWidth)) {
                position += products.length * (cardWidth + gapWidth);
            }
        
            sliderTrack.style.transform = `translateX(${position}px)`;
        }
        animationId = requestAnimationFrame(animate);
    }

    // Event handler functions
    function handleMouseDown(e) {
        isDragging = true;
        startX = e.pageX - sliderTrack.offsetLeft;
        scrollLeft = position;
        isPaused = true;
        sliderTrack.style.cursor = 'grabbing';
    }

    function handleMouseLeave() {
        isDragging = false;
        sliderTrack.style.cursor = 'grab';
        resetAutoScroll();
    }

    function handleMouseUp() {
        isDragging = false;
        sliderTrack.style.cursor = 'grab';
        resetAutoScroll();
    }

    function handleMouseMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - sliderTrack.offsetLeft;
        const walk = (x - startX) * 2;
        position = scrollLeft - walk;
        lastScrollTime = Date.now();
        sliderTrack.style.transform = `translateX(${position}px)`;
    }

    function handleTouchStart(e) {
        isDragging = true;
        startX = e.touches[0].pageX - sliderTrack.offsetLeft;
        scrollLeft = position;
        isPaused = true;
    }

    function handleTouchEnd() {
        isDragging = false;
        resetAutoScroll();
    }

    function handleTouchMove(e) {
        if (!isDragging) return;
        const x = e.touches[0].pageX - sliderTrack.offsetLeft;
        const walk = (x - startX) * 2;
        position = scrollLeft - walk;
        lastScrollTime = Date.now();
        sliderTrack.style.transform = `translateX(${position}px)`;
    }

    function handleWheel(e) {
        e.preventDefault();
        isPaused = true;
        position += e.deltaY * 0.5;
        lastScrollTime = Date.now();
        sliderTrack.style.transform = `translateX(${position}px)`;
        resetAutoScroll();
    }

    function resetAutoScroll() {
        const checkAutoScroll = () => {
            const timeSinceLastScroll = Date.now() - lastScrollTime;
            if (!isDragging && timeSinceLastScroll > AUTO_RESUME_DELAY) {
                isPaused = false;
            } else {
                requestAnimationFrame(checkAutoScroll);
            }
        };
        checkAutoScroll();
    }

    function originalMouseEnter() {
        isPaused = true;
        clearTimeout(hoverPauseTimeout);
    }

    function originalMouseLeave() {
        hoverPauseTimeout = setTimeout(() => {
            if (!isDragging) {
                isPaused = false;
            }
        }, RESUME_DELAY);
    }

    // Cleanup
    window.addEventListener('beforeunload', () => {
        cancelAnimationFrame(animationId);
    });
}

function createProductCards(products, sliderTrack) {
    console.log(`Creating ${products.length} product cards`); // Debug log


    if (!products || !Array.isArray(products) || products.length === 0) {
        sliderTrack.innerHTML = '<div class="no-products">No products available</div>';
        return;
    }

    sliderTrack.innerHTML = "";
    const duplicatedProducts = [...products, ...products, ...products];
    console.log(`Displaying ${duplicatedProducts.length} cards (with duplication)`); // Debug log


    duplicatedProducts.forEach((product) => {
        const card = document.createElement('div');
        card.classList.add('product-card');
        card.dataset.id = product.id;
        card.innerHTML = `
            <div class="card-header">
                <h3>${product.name}</h3>
                <img src="${product.image}" alt="${product.name}" class="product-image">
            </div>
            <div class="card-body">
                <p class="price">${product.price}</p>
                <p class="description">${product.description}</p>
                <button class="view-btn">View Details</button>
                <button class="card-add-to-cart">Add to Cart</button>
            </div>
        `;
        sliderTrack.appendChild(card);

        console.log(`Created card for product: ${product.name}`); // Debug log

        card.querySelector('.view-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showProductDetail(product);
        });
    
        // Add click handler for product detail
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.card-add-to-cart')) {
                showProductDetail(product);
            }
        });
        
        // Add to cart functionality
        card.querySelector('.card-add-to-cart').addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(product);
            
            // Visual feedback
            const btn = e.target;
            btn.textContent = "Added!";
            setTimeout(() => {
                btn.textContent = "Add to Cart";
            }, 2000);
        });
    });
}

// Page Transition Functionality
function initPageTransitions() {
    // Create transition overlay if it doesn't exist
    let transitionOverlay = document.querySelector('.page-transition');
    
    if (!transitionOverlay) {
        transitionOverlay = document.createElement('div');
        transitionOverlay.className = 'page-transition';
        transitionOverlay.innerHTML = '<div class="page-transition-logo">FD</div>';
        document.body.appendChild(transitionOverlay);
    }

    // Show transition immediately when page loads
    transitionOverlay.classList.add('active');
    
    // Hide transition after page is fully loaded
    window.addEventListener('load', function() {
        setTimeout(() => {
            transitionOverlay.classList.remove('active');
            document.body.classList.remove('page-transitioning');
        }, 1000);
    });

    // Handle navigation clicks
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (!link) return;
        
        // Skip special links
        if (link.href.includes('#') || 
            link.href.startsWith('javascript:') || 
            link.href.startsWith('mailto:') || 
            !link.href.includes(window.location.hostname)) {
            return;
        }
        
        // Skip if target is blank
        if (link.target === '_blank') return;
        
        // Skip if it's a download link
        if (link.hasAttribute('download')) return;
        
        e.preventDefault();
        document.body.classList.add('page-transitioning');
        transitionOverlay.classList.add('active');
        
        setTimeout(() => {
            window.location.href = link.href;
        }, 3000);
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initPageTransitions);

// Add this near your other event listeners
document.addEventListener('DOMContentLoaded', function() {
  const mobileToggleLogin = document.getElementById('mobileToggleLogin');
  const mobileToggleSignup = document.getElementById('mobileToggleSignup');
  
  if (mobileToggleLogin) {
    mobileToggleLogin.addEventListener('click', function(e) {
      e.preventDefault();
      authContainer.classList.remove("right-panel-active");
    });
  }
  
  if (mobileToggleSignup) {
    mobileToggleSignup.addEventListener('click', function(e) {
      e.preventDefault();
      authContainer.classList.add("right-panel-active");
    });
  }
});

/*****************************
 * PRODUCT DETAIL TILES
 *****************************/
function initProductDetailTiles() {
    const closeTileBtn = document.querySelector('.close-tile');
    const detailTile = document.querySelector('.product-detail-tile');
    const addToCartBtn = document.querySelector('.add-to-cart-btn');

    if (!closeTileBtn || !detailTile || !addToCartBtn) return;

    closeTileBtn.addEventListener('click', () => {
        detailTile.style.display = 'none';
    });

    addToCartBtn.addEventListener('click', function() {
        const productId = detailTile.dataset.id;
        if (productId) {
            // In a real implementation, you would get the product details
            const product = {
                id: productId,
                name: detailTile.querySelector('h2').textContent,
                price: detailTile.querySelector('.price').textContent,
                description: detailTile.querySelector('p').textContent,
                image: detailTile.querySelector('img').src
            };
            addToCart(product);
            this.textContent = "Added to Cart!";
            setTimeout(() => {
                this.textContent = "Add to Cart";
                detailTile.style.display = 'none';
            }, 2000);
        }
    });

    async function showProductDetail(product) {
        // If product is just an ID, fetch the full details
        if (typeof product === 'string') {
            product = await getProductById(product);
            if (!product) return;
        }
        
        // Create detail tile
        const detailTile = document.createElement('div');
        detailTile.className = 'product-detail-tile active';
        detailTile.dataset.id = product.id;
        detailTile.innerHTML = `
            <button class="close-tile">×</button>
            <div class="tile-content">
                <div class="product-images">
                    <img src="${product.image}" alt="${product.name}" class="detail-image">
                    <div class="thumbnail-container">
                        <!-- Thumbnails would go here -->
                    </div>
                </div>
                <div class="product-info">
                    <h2>${product.name}</h2>
                    <p class="price">${product.price}</p>
                    <p class="product-description">${product.description}</p>
                    
                    <div class="product-options">
                        <div class="option-group">
                            <label>Size:</label>
                            <div class="option-selector">
                                <div class="option-item selected">Small</div>
                                <div class="option-item">Medium</div>
                                <div class="option-item">Large</div>
                            </div>
                        </div>
                        
                        <div class="option-group">
                            <label>Color:</label>
                            <div class="option-selector">
                                <div class="option-item selected">White</div>
                                <div class="option-item">Green</div>
                                <div class="option-item">Brown</div>
                            </div>
                        </div>
                        
                        <div class="option-group">
                            <label>Quantity:</label>
                            <div class="quantity-selector">
                                <button class="quantity-btn minus">-</button>
                                <input type="number" value="1" min="1" class="quantity-input">
                                <button class="quantity-btn plus">+</button>
                            </div>
                        </div>
                    </div>
                    
                    <button class="btn add-to-cart-btn">Add to Cart</button>
                    <a href="product-detail.html?id=${product.id}" class="btn btn-outline">View Full Details</a>
                </div>
            </div>
        `;
        document.body.appendChild(detailTile);
        
        // Add event listeners for option selection
        detailTile.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', function() {
                this.parentNode.querySelectorAll('.option-item').forEach(i => 
                    i.classList.remove('selected'));
                this.classList.add('selected');
            });
        });
        
        // Quantity controls
        detailTile.querySelector('.minus').addEventListener('click', () => {
            const input = detailTile.querySelector('.quantity-input');
            if (input.value > 1) input.value--;
        });
        
        detailTile.querySelector('.plus').addEventListener('click', () => {
            const input = detailTile.querySelector('.quantity-input');
            input.value++;
        });
        
        // Add to cart from detail view
        detailTile.querySelector('.add-to-cart-btn').addEventListener('click', function() {
            const quantity = parseInt(detailTile.querySelector('.quantity-input').value);
            const selectedSize = detailTile.querySelector('.option-group:nth-child(1) .selected').textContent;
            const selectedColor = detailTile.querySelector('.option-group:nth-child(2) .selected').textContent;
            
            const productWithOptions = {
                ...product,
                quantity,
                options: {
                    size: selectedSize,
                    color: selectedColor
                }
            };
            
            addToCart(productWithOptions);
            this.textContent = "Added to Cart!";
            setTimeout(() => {
                detailTile.remove();
                overlay.remove();
            }, 1500);
        });
        
        // Close functionality
        detailTile.querySelector('.close-tile').addEventListener('click', () => {
            detailTile.remove();
            overlay.remove();
        });
        
        overlay.addEventListener('click', () => {
            detailTile.remove();
            overlay.remove();
        });
    };
}

/*****************************
 * SCROLL EFFECTS
 *****************************/
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
});

// Handle back/forward navigation
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        const transitionOverlay = document.querySelector('.page-transition');
        if (transitionOverlay) {
            transitionOverlay.classList.remove('active');
            document.body.classList.remove('page-transitioning');
        }
    }
});
/*****************************
 * QUICK VIEW MODAL
 *****************************/
function initQuickView() {
    const quickViewModal = document.createElement('div');
    quickViewModal.className = 'quick-view-modal';
    quickViewModal.style.display = 'none';
    document.body.appendChild(quickViewModal);
    
    document.querySelectorAll('.product-card, .related-product-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.btn')) {
                const productId = this.dataset.id;
                showQuickView(productId);
            }
        });
    });
    
    async function showQuickView(productId) {
        const product = await getProductById(productId);
        if (!product) return;

        quickViewModal.innerHTML = `
            <div class="quick-view-content">
            <span class="close-quick-view">×</span>
            <div class="quick-view-image">
                <img src="${product.image}" alt="${product.name}">
            </div>
            <div class="quick-view-info">
                <h3>${product.name}</h3>
                <p class="price">${product.price}</p>
                <p>${product.description}</p>
                <button class="btn add-to-cart">Add to Cart</button>
                <a href="product-detail.html?id=${product.id}" class="btn btn-outline">View Full Details</a>
            </div>
            </div>
        `;
        
        quickViewModal.style.display = 'flex';
        
        // Add event listeners
        document.querySelector('.close-quick-view').addEventListener('click', () => {
            quickViewModal.style.display = 'none';
        });
        
        document.querySelector('.quick-view-content .add-to-cart').addEventListener('click', () => {
            addToCart(product);
            quickViewModal.style.display = 'none';
        });
    }

    
    async function getProductById(id) {
        try {
            const productRef = doc(db, 'products', id);
            const productSnap = await getDoc(productRef);
            
            if (productSnap.exists()) {
            return { id: productSnap.id, ...productSnap.data() };
            } else {
            console.log('No such product!');
            return null;
            }
        } catch (error) {
            console.error('Error getting product:', error);
            return null;
        }
    }
}

// async function handleUserRedirect(role) {
//     const returnUrl = localStorage.getItem('returnUrl');
//     localStorage.removeItem('returnUrl');

//     switch(role) {
//         case 'admin':
//             window.location.href = 'admin.html';
//             break;
//         case 'driver':
//             window.location.href = 'driver.html';
//             break;
//         default:
//             window.location.href = returnUrl || 'index.html';
//     }
// }

/*****************************
 * ORDER CONFIRMATION FUNCTIONALITY
 *****************************/

export async function initOrderConfirmation() {
    console.log('Initializing order confirmation...');
    
    const confirmationCard = document.querySelector('.confirmation-card');
    if (!confirmationCard) {
        console.error('Confirmation card element not found');
        return;
    }

    // Show loading state
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'loading-spinner';
    confirmationCard.querySelector('.confirmation-icon').appendChild(loadingSpinner);

    try {
        // Get order ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('orderId');
        
        if (!orderId) {
            throw new Error('No order ID found in URL parameters');
        }

        console.log('Fetching order:', orderId);
        
        // Fetch from Firestore
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            throw new Error('Order not found in database');
        }
        
        const order = orderSnap.data();
        console.log('Order data:', order);
        
        // Remove loading spinner
        loadingSpinner.remove();
        
        // Display order details
        displayOrderDetails(order, orderId);
        
    } catch (error) {
        console.error('Error loading order:', error);
        showError(error.message);
        throw error; // Re-throw for the calling code to handle
    }
    
    function showError(message) {
        const confirmationIcon = document.querySelector('.confirmation-icon');
        if (confirmationIcon) {
            confirmationIcon.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#F44336"></i>';
        }
        
        const errorDetails = document.createElement('div');
        errorDetails.className = 'error-details';
        errorDetails.innerHTML = `
            <p>${message}</p>
            <p>Please contact our support team:</p>
            <ul class="contact-info">
                <li><i class="fas fa-phone"></i> (876) 123-4567</li>
                <li><i class="fas fa-envelope"></i> support@floydsdistributors.com</li>
            </ul>
        `;
        
        const detailsContainer = document.querySelector('.confirmation-details');
        if (detailsContainer) {
            detailsContainer.appendChild(errorDetails);
        }
    }
    
    function displayOrderDetails(order, orderId) {
        // Format dates
        const orderDate = order.createdAt?.toDate?.() || new Date();
        const formattedDate = orderDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Helper function to safely set text content
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text || 'Not provided';
        };

        // Display order info
        setText('order-id', order.orderNumber || orderId);
        setText('order-date', formattedDate);
        setText('order-email', order.customerEmail);
        
        // Format total amount
        const totalAmount = order.total ? 
            `$${parseFloat(order.total).toFixed(2)}` : '$0.00';
        setText('order-total', totalAmount);
        
        // Format payment method for display
        let paymentMethod = 'Unknown';
        if (order.paymentMethod) {
            switch(order.paymentMethod) {
                case 'cod': paymentMethod = 'Cash on Delivery (COD)'; break;
                case 'bank-transfer': paymentMethod = 'Bank Account Transfer'; break;
                case 'deposit': paymentMethod = 'Deposit to Our Account'; break;
                case 'net14': paymentMethod = 'Net 14 Days (Credit Account)'; break;
                default: paymentMethod = order.paymentMethod;
            }
        }
        setText('payment-method', paymentMethod);
        
        // Display shipping info
        setText('shipping-name', order.customerName);
        setText('shipping-address', order.deliveryAddress);
        setText('shipping-city', 
            [order.deliveryCity, order.deliveryParish].filter(Boolean).join(', '));
        setText('shipping-phone', order.customerPhone);
        
        // Set delivery estimate
        setDeliveryEstimate(order.deliveryParish);
        
        // Display order items
        const orderItemsContainer = document.getElementById('order-items');
        if (orderItemsContainer) {
            orderItemsContainer.innerHTML = '';
            
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const price = typeof item.price === 'number' ? item.price : 0;
                    const quantity = item.quantity || 1;
                    const itemEl = document.createElement('div');
                    itemEl.className = 'order-item';
                    itemEl.innerHTML = `
                        <div style="display: flex; align-items: center;">
                            <img src="${item.image || 'https://placehold.co/60x60?text=Product'}" 
                                 alt="${item.name || 'Product'}" 
                                 class="order-item-image">
                            <div class="order-item-info">
                                <div>${item.name || 'Unnamed Product'}</div>
                                <div>Qty: ${quantity}</div>
                            </div>
                        </div>
                        <div>$${(price * quantity).toFixed(2)}</div>
                    `;
                    orderItemsContainer.appendChild(itemEl);
                });
            } else {
                orderItemsContainer.innerHTML = '<div class="no-items">No items in this order</div>';
            }
        }
        
        // Display order summary total
        setText('order-summary-total', totalAmount);
    }

    function setDeliveryEstimate(parish) {
        const estimateEl = document.getElementById('delivery-estimate');
        if (!estimateEl) return;
        
        let estimate = '3-5 business days';
        
        if (parish) {
            const parishLower = parish.toLowerCase();
            
            if (parishLower.includes('kingston') || parishLower.includes('st andrew')) {
                estimate = '1-2 business days';
            } else if (parishLower.includes('st catherine')) {
                estimate = '2-3 business days';
            }
        }
        
        estimateEl.textContent = estimate;
    }
}

if (window.location.pathname.includes('order-confirmation.html')) {
    document.addEventListener('DOMContentLoaded', async () => {
        await initOrderConfirmation();
    });
}

console.log("DOM fully loaded, initializing functions...");
initCartFunctionality();
