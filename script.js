// DOM Elements
const navbar = document.getElementById('navbar');
const navMenu = document.getElementById('nav-menu');
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelectorAll('.nav-link');

// Sticky Navbar
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile Menu Toggle
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

// Smooth Scroll for Internal Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            const offsetTop = targetElement.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Scroll Reveal Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, observerOptions);

// Observe elements for scroll animations
document.addEventListener('DOMContentLoaded', () => {
    // Add reveal classes to elements
    const revealElements = document.querySelectorAll('.section-title, .section-description, .about-text, .about-image, .menu-category, .feature, .gallery-item, .location-info, .location-map, .footer-section');
    
    revealElements.forEach((element, index) => {
        element.classList.add('reveal');
        observer.observe(element);
        
        // Add staggered animation delay
        element.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Add left/right reveal classes for specific elements
    const leftRevealElements = document.querySelectorAll('.about-text, .experience-text, .location-info');
    leftRevealElements.forEach(element => {
        element.classList.add('reveal-left');
        observer.observe(element);
    });
    
    const rightRevealElements = document.querySelectorAll('.about-image, .experience-gallery, .location-map');
    rightRevealElements.forEach(element => {
        element.classList.add('reveal-right');
        observer.observe(element);
    });
});

// ScrollReveal Configuration
if (typeof ScrollReveal !== 'undefined') {
    ScrollReveal({
        distance: '60px',
        duration: 2000,
        delay: 200,
        reset: false
    });

    // Hero Section Animations
    ScrollReveal().reveal('.hero-title', { delay: 500, origin: 'top' });
    ScrollReveal().reveal('.hero-subtitle', { delay: 700, origin: 'bottom' });
    ScrollReveal().reveal('.hero-buttons', { delay: 900, origin: 'bottom' });
    ScrollReveal().reveal('.hero-scroll', { delay: 1100, origin: 'bottom' });

    // Section Animations
    ScrollReveal().reveal('.section-title', { delay: 300, origin: 'top' });
    ScrollReveal().reveal('.section-description', { delay: 400, origin: 'top' });
    
    // About Section
    ScrollReveal().reveal('.about-text', { delay: 300, origin: 'left' });
    ScrollReveal().reveal('.about-image', { delay: 400, origin: 'right' });
    ScrollReveal().reveal('.stat', { delay: 500, origin: 'bottom', interval: 200 });
    
    // Menu Categories
    ScrollReveal().reveal('.menu-category', { delay: 300, origin: 'bottom', interval: 200 });
    
    // Experience Section
    ScrollReveal().reveal('.experience-text', { delay: 300, origin: 'left' });
    ScrollReveal().reveal('.experience-gallery', { delay: 400, origin: 'right' });
    ScrollReveal().reveal('.feature', { delay: 500, origin: 'left', interval: 200 });
    
    // Location Section
    ScrollReveal().reveal('.location-info', { delay: 300, origin: 'left' });
    ScrollReveal().reveal('.location-map', { delay: 400, origin: 'right' });
    ScrollReveal().reveal('.detail', { delay: 500, origin: 'bottom', interval: 200 });
    
    // Footer
    ScrollReveal().reveal('.footer-section', { delay: 300, origin: 'bottom', interval: 200 });
}

// Image Lazy Loading with Fade In Effect
const images = document.querySelectorAll('img');
const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.5s ease';
            
            img.addEventListener('load', () => {
                img.style.opacity = '1';
            });
            
            if (img.complete) {
                img.style.opacity = '1';
            }
            
            imageObserver.unobserve(img);
        }
    });
});

images.forEach(img => {
    imageObserver.observe(img);
});

// Parallax Effect for Hero Section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    
    if (hero) {
        const speed = scrolled * 0.5;
        hero.style.transform = `translateY(${speed}px)`;
    }
});

// Smooth Page Load Animation
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// Add loading class to body initially
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loading');
});

// Button Hover Effects
const buttons = document.querySelectorAll('.btn');
buttons.forEach(button => {
    button.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
    });
    
    button.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// Menu Category Hover Effects
const menuCategories = document.querySelectorAll('.menu-category');
menuCategories.forEach(category => {
    category.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    category.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Add scroll progress indicator
const scrollProgress = document.createElement('div');
scrollProgress.className = 'scroll-progress';
scrollProgress.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 3px;
    background: linear-gradient(90deg, #B8860B, #D4AF37);
    z-index: 9999;
    transition: width 0.3s ease;
`;
document.body.appendChild(scrollProgress);

window.addEventListener('scroll', () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = (window.pageYOffset / scrollHeight) * 100;
    scrollProgress.style.width = scrolled + '%';
});

// Easter egg: Konami code
let konamiCode = [];
const konamiSequence = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.code);
    
    if (konamiCode.length > konamiSequence.length) {
        konamiCode.shift();
    }
    
    if (konamiCode.join('') === konamiSequence.join('')) {
        // Show special message
        const message = document.createElement('div');
        message.innerHTML = '🎉 Welcome to Eleven\'s secret menu! 🎉';
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #B8860B, #D4AF37);
            color: white;
            padding: 20px 30px;
            border-radius: 10px;
            font-size: 1.2rem;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: fadeInUp 0.5s ease;
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 3000);
        
        konamiCode = [];
    }
});

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounce to scroll events
const debouncedScroll = debounce(() => {
    // Any heavy scroll operations can go here
}, 16); // ~60fps

window.addEventListener('scroll', debouncedScroll);

// Preload critical images
const criticalImages = [
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80'
];

criticalImages.forEach(src => {
    const img = new Image();
    img.src = src;
});

// Add custom cursor effect for premium feel
document.addEventListener('mousemove', (e) => {
    const cursor = document.querySelector('.custom-cursor');
    if (cursor) {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    }
});

// Initialize all animations after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add loaded class to enable CSS animations
    setTimeout(() => {
        document.body.classList.add('animations-ready');
    }, 100);
});

console.log('🍽️ Welcome to Eleven\'s - Luxury Dining Experience');
console.log('🌟 Website loaded successfully');