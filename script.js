import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyBk4oAO4LVlrwgBgrdk9m2waZaeiB1nrqY",
  authDomain: "floyds-489c8.firebaseapp.com",
  databaseURL: "https://floyds-489c8-default-rtdb.firebaseio.com",
  projectId: "floyds-489c8",
  storageBucket: "floyds-489c8.firebasestorage.app",
  messagingSenderId: "467837659879",
  appId: "1:467837659879:web:8fde5b1862184183ac9042",
  measurementId: "G-32RKBL830G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);  // Initialize Firestore
const auth = getAuth(app);

// Auth Elements
const authContainer = document.getElementById('authContainer');
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const submitSignup = document.getElementById('submitSignup');
const submitLogin = document.getElementById('submitLogin');
const heroLoginBtn = document.getElementById('heroLoginBtn');
const heroSignupBtn = document.getElementById('heroSignupBtn');

// Show/hide auth form
function toggleAuthForm(show = true) {
    authContainer.style.display = show ? 'block' : 'none';
    document.body.style.overflow = show ? 'hidden' : '';
}

// Event listeners for the new form
if (signUpButton) signUpButton.addEventListener('click', () => {
    authContainer.classList.add("right-panel-active");
});

if (signInButton) signInButton.addEventListener('click', () => {
    authContainer.classList.remove("right-panel-active");
});

if (heroLoginBtn) heroLoginBtn.addEventListener('click', () => {
    toggleAuthForm(true);
    authContainer.classList.remove("right-panel-active");
});

if (heroSignupBtn) heroSignupBtn.addEventListener('click', () => {
    toggleAuthForm(true);
    authContainer.classList.add("right-panel-active");
});

// Close form when clicking outside
document.addEventListener('click', (e) => {
    if (authContainer.style.display === 'block' && 
        !authContainer.contains(e.target) && 
        e.target !== heroLoginBtn && 
        e.target !== heroSignupBtn) {
        toggleAuthForm(false);
    }
});

// Form submissions
if (submitLogin) submitLogin.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogin();
});

if (submitSignup) submitSignup.addEventListener('click', (e) => {
    e.preventDefault();
    handleSignup();
});

// Updated handleLogin and handleSignup functions
async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        toggleAuthForm(false);
    } catch (error) {
        alert(getAuthErrorMessage(error.code));
        console.error('Login error:', error);
    }
}

async function handleSignup() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        console.log('New user created:', name, email);
        toggleAuthForm(false);
    } catch (error) {
        alert(getAuthErrorMessage(error.code));
        console.error('Signup error:', error);
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
        case 'auth/email-already-in-use':
            return 'Email already in use';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters';
        default:
            return 'An error occurred. Please try again.';
    }
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log('User logged in:', user.email);
    } else {
        // User is signed out
        console.log('User logged out');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all functionality
    initMobileMenu();
    initDropdownMenu();
    initCartFunctionality();
    initSearchFunctionality();
    initProductSlider();
    initProductDetailTiles();
    initQuickView();
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

    // Initialize cart from storage
    loadCartFromStorage();
    updateAllCartCounts();

    // Event Listeners
    document.addEventListener('click', function(e) {
        // Handle clicks on cart icon or its children
        if (e.target.closest('.cart-icon, .cart-icon-symbol, .cart-count')) {
            toggleCart();
        }
    });
    if (cartOverlay) cartOverlay.addEventListener('click', toggleCart);
    if (closeCart) closeCart.addEventListener('click', toggleCart);
    
    function toggleCart() {
        cartSidebar.classList.toggle('active');
        cartOverlay.classList.toggle('active');
        
        // Update cart UI when opening
        if (cartSidebar.classList.contains('active')) {
            updateCartUI();
        }
        
        // Prevent body scroll when cart is open
        document.body.style.overflow = cartSidebar.classList.contains('active') ? 'hidden' : '';
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
        cartIcon.classList.add('added');
        setTimeout(() => {
            cartIcon.classList.remove('added');
        }, 500);
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

        if (typeof showRemovedFromCartFeedback === 'function') {
            showRemovedFromCartFeedback(productId);
        }
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
                const cartItemElement = document.createElement('div');
                cartItemElement.className = 'cart-item';
                cartItemElement.innerHTML = `
                    <div class="cart-item-info">
                        <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                        <div>
                            <h4>${item.name}</h4>
                            <p>${item.price} x ${item.quantity}</p>
                        </div>
                    </div>
                    <button class="remove-item" data-id="${item.id}">×</button>
                `;
                cartItemsElement.appendChild(cartItemElement);
                
                const price = parseFloat(item.price.replace('$', '')) || 0;
                total += price * item.quantity;
            });
        }
        
        cartCountElement.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
        totalPriceElement.textContent = `$${total.toFixed(2)}`;
        
        document.querySelectorAll('.remove-item').forEach(button => {
            button.addEventListener('click', (e) => {
                removeFromCart(e.target.dataset.id);
            });
        });
    }

    function saveCartToStorage() {
        localStorage.setItem('floydsDistributorsCart', JSON.stringify(cart));
    }

    function loadCartFromStorage() {
        const savedCart = localStorage.getItem('floydsDistributorsCart');
        if (savedCart) {
            cart = JSON.parse(savedCart);
            updateAllCartCounts();
        }
    }

    function initiateCheckout() {
        alert('Proceeding to checkout!');
        console.log('Checkout items:', cart);
        // In a real implementation, redirect to checkout page
        // window.location.href = 'checkout.html';
    }

    // Make functions available globally
    window.addToCart = addToCart;
    window.toggleCart = toggleCart;
    window.updateCartUI = updateCartUI;
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
  const productsCol = collection(db, 'products');
  const productSnapshot = await getDocs(productsCol);
  const productList = productSnapshot.docs.map(doc => {
    return { id: doc.id, ...doc.data() };
  });
  return productList;
}

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

/*****************************
 * PRODUCT SLIDER FUNCTIONALITY
 *****************************/
function initProductSlider() {
    const sliderTrack = document.querySelector('.slider-track');
    if (!sliderTrack) return;
    
    // Sample products data
    const products = [
        { id: 1, name: "Eco-Friendly Boxes", price: "$12.99", description: "Biodegradable food boxes", image: "images/eco-box-large.png" },
        { id: 2, name: "Compostable Bowls", price: "$8.99", description: "Sturdy compostable bowls", image: "images/compostable-bowls.png" },
        { id: 3, name: "Recyclable Trays", price: "$15.99", description: "Multi-compartment trays", image: "images/recyclable-trays.png" },
        { id: 4, name: "Paper Bags", price: "$5.99", description: "Durable paper bags", image: "images/paper-bags.png" },
        { id: 5, name: "Eco-Cups", price: "$7.99", description: "Recyclable cups", image: "images/eco-cups.png" },
        { id: 6, name: "Sustainable Cutlery", price: "$9.99", description: "Compostable utensils", image: "images/sustainable-cutlery.png" },
        { id: 7, name: "Eco-Straws", price: "$4.99", description: "Biodegradable straws", image: "images/eco-straws.png" }
    ];

    // Create product cards
    createProductCards();

    // Animation variables
    let animationId;
    let speed = 0.4;
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

    // Functions
    function createProductCards() {
        const duplicatedProducts = [...products, ...products, ...products];
    
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

    window.showProductDetail = function(product) {
    // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'tile-overlay active';
        document.body.appendChild(overlay);
        
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
    
    function showQuickView(productId) {
        // In a real implementation, fetch product data
        const product = getProductById(productId);
        
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
                    <a href="products.html" class="btn btn-outline">View Full Details</a>
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
    
    function getProductById(id) {
        // Mock function - replace with real data fetching
        return {
            id: id,
            name: "Sample Product",
            price: "$9.99",
            description: "This is a sample product description.",
            image: "images/sample-product.png"
        };
    }
}