// Gallery Page JavaScript

// DOM Elements
const galleryNavLinks = document.querySelectorAll('.gallery-nav-link');
const gallerySections = document.querySelectorAll('.gallery-section');
const galleryItems = document.querySelectorAll('.gallery-item');

// Gallery Navigation Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize gallery navigation
    initGalleryNavigation();
    
    // Initialize scroll spy for gallery sections
    initGalleryScrollSpy();
    
    // Initialize gallery item animations
    initGalleryItemAnimations();
    
    // Initialize lightbox functionality
    initLightbox();
    
    // Initialize gallery filtering
    initGalleryFiltering();
    
    // Initialize lazy loading
    initLazyLoading();
});

// Gallery Navigation
function initGalleryNavigation() {
    galleryNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            galleryNavLinks.forEach(navLink => {
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
                const galleryNavHeight = document.querySelector('.gallery-nav').offsetHeight;
                const offsetTop = targetSection.offsetTop - navHeight - galleryNavHeight;
                
                // Smooth scroll to section
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Scroll Spy for Gallery Sections
function initGalleryScrollSpy() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.getAttribute('id');
                const correspondingNavLink = document.querySelector(`a[href="#${sectionId}"]`);
                
                // Remove active class from all gallery nav links
                galleryNavLinks.forEach(link => {
                    link.classList.remove('active');
                });
                
                // Add active class to corresponding nav link
                if (correspondingNavLink && correspondingNavLink.classList.contains('gallery-nav-link')) {
                    correspondingNavLink.classList.add('active');
                }
            }
        });
    }, {
        threshold: 0.3,
        rootMargin: '-100px 0px -50% 0px'
    });

    // Observe all gallery sections
    gallerySections.forEach(section => {
        observer.observe(section);
    });
}

// Gallery Item Animations
function initGalleryItemAnimations() {
    const galleryItemObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                galleryItemObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    galleryItems.forEach(item => {
        galleryItemObserver.observe(item);
    });
}

// Lightbox Functionality
function initLightbox() {
    // Create lightbox modal
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <span class="lightbox-close">&times;</span>
            <img src="" alt="">
            <div class="lightbox-info">
                <h3></h3>
                <p></p>
            </div>
        </div>
    `;
    document.body.appendChild(lightbox);

    const lightboxImg = lightbox.querySelector('img');
    const lightboxTitle = lightbox.querySelector('h3');
    const lightboxDesc = lightbox.querySelector('p');
    const closeBtn = lightbox.querySelector('.lightbox-close');

    // Add click event to gallery items
    galleryItems.forEach(item => {
        item.addEventListener('click', function() {
            const img = this.querySelector('.gallery-image img');
            const overlay = this.querySelector('.gallery-overlay');
            
            if (img && overlay) {
                const title = overlay.querySelector('h3').textContent;
                const description = overlay.querySelector('p').textContent;
                
                lightboxImg.src = img.src;
                lightboxImg.alt = img.alt;
                lightboxTitle.textContent = title;
                lightboxDesc.textContent = description;
                
                lightbox.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        });
    });

    // Close lightbox events
    closeBtn.addEventListener('click', closeLightbox);
    
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.style.display === 'block') {
            closeLightbox();
        }
    });

    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Gallery Filtering
function initGalleryFiltering() {
    // Add filter functionality if filter buttons exist
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all filter buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Get filter category
                const filterCategory = this.getAttribute('data-filter');
                
                // Filter gallery items
                filterGalleryItems(filterCategory);
            });
        });
    }
}

// Filter Gallery Items by Category
function filterGalleryItems(category) {
    galleryItems.forEach(item => {
        const itemCategory = item.getAttribute('data-category');
        
        if (category === 'all' || itemCategory === category) {
            item.classList.remove('filtered-out');
            item.classList.add('filtered-in');
            item.style.display = 'block';
        } else {
            item.classList.remove('filtered-in');
            item.classList.add('filtered-out');
            setTimeout(() => {
                if (item.classList.contains('filtered-out')) {
                    item.style.display = 'none';
                }
            }, 300);
        }
    });
}

// Lazy Loading for Images
function initLazyLoading() {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');
                
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                    img.classList.add('loaded');
                }
                
                imageObserver.unobserve(img);
            }
        });
    });

    // Observe all images with data-src attribute
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
        imageObserver.observe(img);
    });
}

// Parallax Effect for Gallery Hero
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const galleryHero = document.querySelector('.gallery-hero');
    
    if (galleryHero) {
        const speed = scrolled * 0.3;
        galleryHero.style.backgroundPosition = `center ${speed}px`;
    }
});

// Smooth Reveal Animation for Gallery Sections
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
                
                // Animate gallery items with stagger
                const sectionGalleryItems = entry.target.querySelectorAll('.gallery-item');
                sectionGalleryItems.forEach((item, index) => {
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

    gallerySections.forEach(section => {
        sectionObserver.observe(section);
    });
}

// Initialize section reveal on page load
document.addEventListener('DOMContentLoaded', function() {
    initSectionReveal();
});

// Image Share Functionality
function initImageSharing() {
    galleryItems.forEach(item => {
        // Add share buttons to gallery items
        const shareContainer = document.createElement('div');
        shareContainer.className = 'social-share';
        shareContainer.innerHTML = `
            <a href="#" class="social-share-btn facebook" data-share="facebook">f</a>
            <a href="#" class="social-share-btn twitter" data-share="twitter">t</a>
            <a href="#" class="social-share-btn instagram" data-share="instagram">i</a>
        `;
        
        item.appendChild(shareContainer);
        
        // Add click events to share buttons
        const shareButtons = shareContainer.querySelectorAll('.social-share-btn');
        shareButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const platform = this.getAttribute('data-share');
                const img = item.querySelector('.gallery-image img');
                const title = item.querySelector('.gallery-overlay h3').textContent;
                
                shareImage(platform, img.src, title);
            });
        });
    });
}

// Share Image Function
function shareImage(platform, imageUrl, title) {
    const currentUrl = window.location.href;
    let shareUrl = '';
    
    switch(platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(currentUrl)}`;
            break;
        case 'instagram':
            // Instagram doesn't have a direct share URL, so we'll copy the URL to clipboard
            copyToClipboard(currentUrl);
            showShareMessage('Link copied to clipboard! Open Instagram to share.');
            return;
    }
    
    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }
}

// Copy to Clipboard Function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        console.log('URL copied to clipboard');
    }).catch(function(err) {
        console.error('Could not copy text: ', err);
    });
}

// Show Share Message
function showShareMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
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
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 3000);
}

// Masonry Layout for Gallery Grid
function initMasonryLayout() {
    const galleryGrids = document.querySelectorAll('.gallery-grid');
    
    galleryGrids.forEach(grid => {
        // Add masonry class
        grid.classList.add('masonry');
        
        // Randomly assign tall/wide classes for variety
        const items = grid.querySelectorAll('.gallery-item');
        items.forEach((item, index) => {
            if (index % 7 === 0) {
                item.classList.add('tall');
            } else if (index % 5 === 0) {
                item.classList.add('wide');
            }
        });
    });
}

// Search Functionality for Gallery
function initGallerySearch() {
    const searchInput = document.querySelector('.gallery-search-input');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            filterGalleryBySearch(searchTerm);
        });
    }
}

// Filter Gallery by Search Term
function filterGalleryBySearch(searchTerm) {
    galleryItems.forEach(item => {
        const overlay = item.querySelector('.gallery-overlay');
        const title = overlay.querySelector('h3').textContent.toLowerCase();
        const description = overlay.querySelector('p').textContent.toLowerCase();
        
        if (title.includes(searchTerm) || description.includes(searchTerm)) {
            item.style.display = 'block';
            item.style.opacity = '1';
        } else {
            item.style.display = 'none';
            item.style.opacity = '0';
        }
    });
}

// Keyboard Navigation for Gallery
function initKeyboardNavigation() {
    let currentIndex = -1;
    const totalItems = galleryItems.length;
    
    document.addEventListener('keydown', function(e) {
        if (document.querySelector('.lightbox').style.display === 'block') {
            return; // Don't navigate when lightbox is open
        }
        
        switch(e.key) {
            case 'ArrowRight':
                e.preventDefault();
                currentIndex = (currentIndex + 1) % totalItems;
                focusGalleryItem(currentIndex);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                currentIndex = currentIndex <= 0 ? totalItems - 1 : currentIndex - 1;
                focusGalleryItem(currentIndex);
                break;
            case 'Enter':
                if (currentIndex >= 0) {
                    galleryItems[currentIndex].click();
                }
                break;
        }
    });
}

// Focus Gallery Item
function focusGalleryItem(index) {
    galleryItems.forEach((item, i) => {
        if (i === index) {
            item.focus();
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.style.outline = '3px solid var(--primary-color)';
        } else {
            item.style.outline = 'none';
        }
    });
}

// Initialize all gallery functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize masonry layout
    initMasonryLayout();
    
    // Initialize image sharing
    initImageSharing();
    
    // Initialize gallery search
    initGallerySearch();
    
    // Initialize keyboard navigation
    initKeyboardNavigation();
    
    // Add smooth scrolling for all internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const navHeight = document.querySelector('.navbar').offsetHeight;
                const galleryNavHeight = document.querySelector('.gallery-nav').offsetHeight;
                const offsetTop = target.offsetTop - navHeight - galleryNavHeight;
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Instagram Feed Load Handler
window.addEventListener('load', function() {
    // Check if Instagram embed has loaded
    const instagramEmbed = document.querySelector('.elfsight-app-e34192b5-821d-49c6-a926-ff653ffd2dca');
    
    if (instagramEmbed) {
        // Add loading spinner while Instagram feed loads
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'gallery-loading';
        loadingSpinner.innerHTML = '<div class="loading-spinner"></div>';
        
        const instagramContainer = document.querySelector('.instagram-embed');
        instagramContainer.appendChild(loadingSpinner);
        
        // Remove spinner after a delay (Instagram widget should be loaded by then)
        setTimeout(() => {
            if (loadingSpinner.parentNode) {
                loadingSpinner.parentNode.removeChild(loadingSpinner);
            }
        }, 3000);
    }
});

console.log('🖼️ Gallery page loaded successfully');
console.log('📱 Interactive gallery features initialized');