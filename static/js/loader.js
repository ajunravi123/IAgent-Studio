class StudioLoader {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        
        this.loaderContainer = document.createElement('div');
        this.loaderContainer.id = 'studio-loader';
        this.loaderContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #0f172a; /* Dark blue background */
            display: flex;
            flex-direction: column; /* Stack items vertically */
            justify-content: center;
            align-items: center;
            z-index: 9999;
            transition: opacity 0.5s ease-out;
        `;

        // Create Logo Element
        this.logoImage = document.createElement('img');
        this.logoImage.src = 'static/images/ialogo.png'; // Path to your logo
        this.logoImage.alt = 'IAgent Studio Logo';
        this.logoImage.style.cssText = `
            width: 100px; /* Adjust size as needed */
            height: auto;
            margin-bottom: 20px; /* Space between logo and text/animation */
            position: relative; /* Ensure it's above the canvas */
            z-index: 10000; /* Above canvas */
        `;
        
        this.loaderText = document.createElement('div');
        this.loaderText.style.cssText = `
            /* Removed absolute positioning */
            color: #63b3ed; /* Light blue text */
            font-size: 1.2rem;
            font-weight: 500;
            text-align: center;
            font-family: 'Inter', sans-serif;
            margin-top: 10px; /* Space below the canvas */
            position: relative; /* Ensure it's above the canvas */
            z-index: 10000; /* Above canvas */
        `;
        this.loaderText.textContent = 'Loading IAgent Studio...';
        
        // Append elements
        this.loaderContainer.appendChild(this.logoImage); // Add logo first
        this.loaderContainer.appendChild(this.renderer.domElement); // Then the canvas
        // Position the canvas using styles instead of direct appending order affecting layout
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '9998'; // Behind logo and text

        this.loaderContainer.appendChild(this.loaderText); // Add text last (visually below canvas due to flex-direction? No, text needs z-index)

        document.body.appendChild(this.loaderContainer);
        
        this.init();
    }

    init() {
        // Create particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 1000;
        const posArray = new Float32Array(particlesCount * 3);
        
        for(let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 5;
        }
        
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.005,
            color: '#63b3ed',
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(this.particles);
        
        // Position camera
        this.camera.position.z = 2;
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // Start animation
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Remove loader after 2 seconds
        setTimeout(() => this.remove(), 3000);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.particles.rotation.x += 0.001;
        this.particles.rotation.y += 0.001;
        
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    remove() {
        this.loaderContainer.style.opacity = '0';
        setTimeout(() => {
            this.loaderContainer.remove();
            window.removeEventListener('resize', this.onWindowResize);
        }, 500);
    }
} 