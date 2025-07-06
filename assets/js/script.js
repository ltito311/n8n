// ===== Navigation Functionality =====
document.addEventListener('DOMContentLoaded', function() {
    const navbar = document.querySelector('.navbar');
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const chatbotContainer = document.querySelector('.chatbot-container');
    
    // ===== Mobile Menu Toggle =====
    hamburger.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });
    
    // ===== Navbar Scroll Effect =====
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // ===== Smooth Scrolling for Anchor Links =====
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const navHeight = navbar.offsetHeight;
                const targetPosition = targetElement.offsetTop - navHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // ===== Active Navigation Link =====
    function updateActiveNavLink() {
        const sections = document.querySelectorAll('section[id]');
        const navbarHeight = navbar.offsetHeight;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - navbarHeight - 50;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    window.addEventListener('scroll', updateActiveNavLink);
    
    // ===== Chatbot Toggle =====
    function createChatbotToggle() {
        const chatbotToggle = document.createElement('div');
        chatbotToggle.classList.add('chatbot-toggle');
        chatbotToggle.innerHTML = '<i class="fas fa-comment"></i>';
        document.body.appendChild(chatbotToggle);
        
        chatbotToggle.addEventListener('click', function() {
            if (chatbotContainer) {
                chatbotContainer.classList.toggle('active');
                if (chatbotContainer.classList.contains('active')) {
                    chatbotToggle.innerHTML = '<i class="fas fa-times"></i>';
                } else {
                    chatbotToggle.innerHTML = '<i class="fas fa-comment"></i>';
                }
            }
        });
    }
    
    // Create chatbot toggle if chatbot container exists
    if (chatbotContainer) {
        createChatbotToggle();
    }
    
    // ===== Scroll Animations =====
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.feature, .menu-category, .service-item, .contact-item');
    animateElements.forEach(element => {
        observer.observe(element);
    });
    
    // ===== Newsletter Form =====
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = this.querySelector('input[type="email"]').value;
            if (email) {
                // Here you would typically send the email to your server
                alert('Thank you for subscribing! We\'ll keep you updated with our latest news and offers.');
                this.reset();
            }
        });
    }
    
    // ===== Loading Animation =====
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
    });
    
    // ===== Hours Status =====
    function updateHoursStatus() {
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const currentHour = now.getHours();
        
        let isOpen = false;
        
        // Check if restaurant is open based on hours
        if (currentDay >= 1 && currentDay <= 3) { // Monday - Wednesday
            isOpen = currentHour >= 11 && currentHour < 23;
        } else if (currentDay >= 4 && currentDay <= 6) { // Thursday - Saturday
            isOpen = currentHour >= 11 && currentHour < 23;
        } else if (currentDay === 0) { // Sunday
            isOpen = currentHour >= 17 && currentHour < 23;
        }
        
        const statusElement = document.querySelector('.info-item span');
        if (statusElement && statusElement.textContent === 'Open Now') {
            statusElement.textContent = isOpen ? 'Open Now' : 'Closed';
            statusElement.style.color = isOpen ? '#d4af37' : '#ff6b6b';
        }
    }
    
    updateHoursStatus();
    
    // ===== Preloader =====
    function showPreloader() {
        const preloader = document.createElement('div');
        preloader.classList.add('preloader');
        preloader.innerHTML = `
            <div class="preloader-content">
                <div class="preloader-logo">
                    <img src="assets/images/logo.png" alt="Eleven Restaurant and Lounge">
                </div>
                <div class="preloader-spinner"></div>
            </div>
        `;
        document.body.appendChild(preloader);
        
        // Hide preloader after page load
        window.addEventListener('load', function() {
            setTimeout(() => {
                preloader.classList.add('fade-out');
                setTimeout(() => {
                    preloader.remove();
                }, 500);
            }, 1000);
        });
    }
    
    // ===== Utility Functions =====
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
    
    // Debounce scroll events for better performance
    const debouncedScroll = debounce(function() {
        updateActiveNavLink();
    }, 10);
    
    window.addEventListener('scroll', debouncedScroll);
    
    // ===== Error Handling =====
    window.addEventListener('error', function(e) {
        console.error('An error occurred:', e.error);
    });
    
    // ===== Accessibility Improvements =====
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close mobile menu
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
            
            // Close chatbot
            if (chatbotContainer && chatbotContainer.classList.contains('active')) {
                chatbotContainer.classList.remove('active');
                const chatbotToggle = document.querySelector('.chatbot-toggle');
                if (chatbotToggle) {
                    chatbotToggle.innerHTML = '<i class="fas fa-comment"></i>';
                }
            }
        }
    });
    
    // ===== Image Lazy Loading =====
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    
    lazyImages.forEach(img => {
        imageObserver.observe(img);
    });
    
    // ===== Form Validation =====
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const inputs = form.querySelectorAll('input[required], textarea[required]');
            let isValid = true;
            
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    isValid = false;
                    input.classList.add('error');
                } else {
                    input.classList.remove('error');
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                alert('Please fill in all required fields.');
            }
        });
    });
    
    // ===== Custom Cursor (for desktop) =====
    if (window.innerWidth > 768) {
        const cursor = document.createElement('div');
        cursor.classList.add('custom-cursor');
        document.body.appendChild(cursor);
        
        document.addEventListener('mousemove', function(e) {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        });
        
        // Add cursor effects for interactive elements
        const interactiveElements = document.querySelectorAll('a, button, .btn');
        interactiveElements.forEach(element => {
            element.addEventListener('mouseenter', function() {
                cursor.classList.add('hover');
            });
            
            element.addEventListener('mouseleave', function() {
                cursor.classList.remove('hover');
            });
        });
    }
});

// ===== Additional CSS for dynamic elements =====
const additionalCSS = `
    .preloader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #0a0a0a;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: opacity 0.5s ease;
    }
    
    .preloader.fade-out {
        opacity: 0;
    }
    
    .preloader-content {
        text-align: center;
    }
    
    .preloader-logo img {
        width: 80px;
        height: 80px;
        margin-bottom: 20px;
    }
    
    .preloader-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #333;
        border-top: 3px solid #d4af37;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .custom-cursor {
        position: fixed;
        width: 20px;
        height: 20px;
        background: #d4af37;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transition: transform 0.1s ease;
        transform: translate(-50%, -50%);
    }
    
    .custom-cursor.hover {
        transform: translate(-50%, -50%) scale(1.5);
        background: #b8941f;
    }
    
    .error {
        border-color: #ff6b6b !important;
        background-color: rgba(255, 107, 107, 0.1) !important;
    }
    
    .hamburger.active span:nth-child(1) {
        transform: rotate(45deg) translate(5px, 5px);
    }
    
    .hamburger.active span:nth-child(2) {
        opacity: 0;
    }
    
    .hamburger.active span:nth-child(3) {
        transform: rotate(-45deg) translate(7px, -6px);
    }
`;

// Inject additional CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);