// Menu Page JavaScript

// DOM Elements
const menuNavLinks = document.querySelectorAll('.menu-nav-link');
const menuSections = document.querySelectorAll('.menu-section');
const menuItems = document.querySelectorAll('.menu-item');

// Menu Navigation Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize menu navigation
    initMenuNavigation();
    
    // Initialize scroll spy for menu sections
    initScrollSpy();
    
    // Initialize menu item animations
    initMenuItemAnimations();
    
    // Initialize menu item hover effects
    initMenuItemHoverEffects();
});

// Menu Navigation
function initMenuNavigation() {
    menuNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            menuNavLinks.forEach(navLink => {
                navLink.classList.remove('active');
            });
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Get target section
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                // Calculate offset for sticky navigation
                const navHeight = document.querySelector('.navbar').offsetHeight;
                const menuNavHeight = document.querySelector('.menu-nav').offsetHeight;
                const offsetTop = targetSection.offsetTop - navHeight - menuNavHeight;
                
                // Smooth scroll to section
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Scroll Spy for Menu Sections
function initScrollSpy() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.getAttribute('id');
                const correspondingNavLink = document.querySelector(`a[href="#${sectionId}"]`);
                
                // Remove active class from all menu nav links
                menuNavLinks.forEach(link => {
                    link.classList.remove('active');
                });
                
                // Add active class to corresponding nav link
                if (correspondingNavLink) {
                    correspondingNavLink.classList.add('active');
                }
            }
        });
    }, {
        threshold: 0.3,
        rootMargin: '-100px 0px -50% 0px'
    });

    // Observe all menu sections
    menuSections.forEach(section => {
        observer.observe(section);
    });
}

// Menu Item Animations
function initMenuItemAnimations() {
    const menuItemObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                menuItemObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    menuItems.forEach(item => {
        menuItemObserver.observe(item);
    });
}

// Menu Item Hover Effects
function initMenuItemHoverEffects() {
    menuItems.forEach(item => {
        const image = item.querySelector('.menu-item-image img');
        const button = item.querySelector('.menu-item-btn');
        
        item.addEventListener('mouseenter', function() {
            // Add hover class for additional effects
            this.classList.add('hovered');
            
            // Animate button
            if (button) {
                button.style.transform = 'translateY(-2px)';
            }
        });
        
        item.addEventListener('mouseleave', function() {
            // Remove hover class
            this.classList.remove('hovered');
            
            // Reset button animation
            if (button) {
                button.style.transform = 'translateY(0)';
            }
        });
    });
}

// Menu Item Button Click Tracking
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('menu-item-btn')) {
        // Track menu item clicks (for analytics)
        const menuItem = e.target.closest('.menu-item');
        const itemName = menuItem.querySelector('h3').textContent;
        
        // Console log for demonstration (replace with actual analytics)
        console.log(`Menu item clicked: ${itemName}`);
        
        // Optional: Show loading state
        e.target.style.opacity = '0.7';
        e.target.textContent = 'Loading...';
        
        // Reset button after a brief delay (for demo purposes)
        setTimeout(() => {
            e.target.style.opacity = '1';
            e.target.textContent = 'Order Now';
        }, 1000);
    }
});

// Search Functionality (if search bar is added)
function initMenuSearch() {
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchInput && searchBtn) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            filterMenuItems(searchTerm);
        });
        
        searchBtn.addEventListener('click', function() {
            const searchTerm = searchInput.value.toLowerCase();
            filterMenuItems(searchTerm);
        });
    }
}

// Filter Menu Items
function filterMenuItems(searchTerm) {
    menuItems.forEach(item => {
        const itemName = item.querySelector('h3').textContent.toLowerCase();
        const itemDescription = item.querySelector('.menu-item-description').textContent.toLowerCase();
        
        if (itemName.includes(searchTerm) || itemDescription.includes(searchTerm)) {
            item.style.display = 'block';
            item.style.opacity = '1';
        } else {
            item.style.display = 'none';
            item.style.opacity = '0';
        }
    });
}

// Menu Filter Functionality (for category filtering)
function initMenuFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all filter buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Get filter category
            const filterCategory = this.getAttribute('data-filter');
            
            // Filter menu items
            filterMenuItemsByCategory(filterCategory);
        });
    });
}

// Filter Menu Items by Category
function filterMenuItemsByCategory(category) {
    menuItems.forEach(item => {
        const itemCategory = item.getAttribute('data-category');
        
        if (category === 'all' || itemCategory === category) {
            item.style.display = 'block';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        } else {
            item.style.display = 'none';
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
        }
    });
}

// Parallax Effect for Menu Hero
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const menuHero = document.querySelector('.menu-hero');
    
    if (menuHero) {
        const speed = scrolled * 0.3;
        menuHero.style.backgroundPosition = `center ${speed}px`;
    }
});

// Dynamic Price Formatting
function formatPrices() {
    const priceElements = document.querySelectorAll('.menu-item-price');
    
    priceElements.forEach(priceElement => {
        const price = priceElement.textContent;
        // Add currency symbol if not present
        if (!price.includes('$')) {
            priceElement.textContent = `$${price}`;
        }
    });
}

// Smooth Reveal Animation for Menu Sections
function initSectionReveal() {
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                
                // Animate section header
                const sectionHeader = entry.target.querySelector('.section-header');
                if (sectionHeader) {
                    sectionHeader.style.opacity = '1';
                    sectionHeader.style.transform = 'translateY(0)';
                }
                
                // Animate menu items with stagger
                const sectionMenuItems = entry.target.querySelectorAll('.menu-item');
                sectionMenuItems.forEach((item, index) => {
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, index * 100);
                });
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    });

    menuSections.forEach(section => {
        sectionObserver.observe(section);
    });
}

// Initialize section reveal on page load
document.addEventListener('DOMContentLoaded', function() {
    initSectionReveal();
});

// Menu Item Quantity Selector (for future enhancement)
function initQuantitySelector() {
    const quantityInputs = document.querySelectorAll('.quantity-input');
    
    quantityInputs.forEach(input => {
        const decreaseBtn = input.previousElementSibling;
        const increaseBtn = input.nextElementSibling;
        
        decreaseBtn.addEventListener('click', function() {
            let currentValue = parseInt(input.value);
            if (currentValue > 1) {
                input.value = currentValue - 1;
            }
        });
        
        increaseBtn.addEventListener('click', function() {
            let currentValue = parseInt(input.value);
            input.value = currentValue + 1;
        });
    });
}

// Add to Cart Functionality (for future enhancement)
function initAddToCart() {
    const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');
    
    addToCartButtons.forEach(button => {
        button.addEventListener('click', function() {
            const menuItem = this.closest('.menu-item');
            const itemName = menuItem.querySelector('h3').textContent;
            const itemPrice = menuItem.querySelector('.menu-item-price').textContent;
            const quantity = menuItem.querySelector('.quantity-input')?.value || 1;
            
            // Add item to cart (implement cart logic)
            addItemToCart({
                name: itemName,
                price: itemPrice,
                quantity: quantity
            });
            
            // Show success message
            showAddToCartSuccess(itemName);
        });
    });
}

// Add Item to Cart
function addItemToCart(item) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Check if item already exists in cart
    const existingItem = cart.find(cartItem => cartItem.name === item.name);
    
    if (existingItem) {
        existingItem.quantity += parseInt(item.quantity);
    } else {
        cart.push(item);
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCounter();
}

// Update Cart Counter
function updateCartCounter() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartCounter = document.querySelector('.cart-counter');
    
    if (cartCounter) {
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        cartCounter.textContent = totalItems;
        
        if (totalItems > 0) {
            cartCounter.style.display = 'block';
        } else {
            cartCounter.style.display = 'none';
        }
    }
}

// Show Add to Cart Success Message
function showAddToCartSuccess(itemName) {
    const message = document.createElement('div');
    message.className = 'cart-success-message';
    message.innerHTML = `
        <div class="success-content">
            <span class="success-icon">✓</span>
            <span class="success-text">${itemName} added to cart</span>
        </div>
    `;
    
    message.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background-color: var(--primary-color);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(message);
        }, 300);
    }, 3000);
}

// Add CSS animations for cart success message
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .success-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .success-icon {
        font-size: 1.2rem;
        font-weight: bold;
    }
`;
document.head.appendChild(style);

// Initialize all menu functionality
document.addEventListener('DOMContentLoaded', function() {
    formatPrices();
    updateCartCounter();
    
    // Add smooth scrolling for all internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const navHeight = document.querySelector('.navbar').offsetHeight;
                const menuNavHeight = document.querySelector('.menu-nav').offsetHeight;
                const offsetTop = target.offsetTop - navHeight - menuNavHeight;
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
});

console.log('🍽️ Menu page loaded successfully');
console.log('📱 Interactive features initialized');