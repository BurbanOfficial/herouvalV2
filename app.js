// Hérouval Control - Main Application JavaScript
// Firebase configuration and shared functions

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCGiIgbUnum8hA7v21suDLxEWECecnxV-w",
    authDomain: "herouval-control.firebaseapp.com",
    projectId: "herouval-control",
    storageBucket: "herouval-control.firebasestorage.app",
    messagingSenderId: "299868008636",
    appId: "1:299868008636:web:adc7fa8282b01ae832a0b9",
    measurementId: "G-QW8D6W933Q"
};

const app = {
    db: null,
    groups: [],
    currentWeek: null,
    offlineMode: false,
    mockGroups: [],
    
    init() {
        if (typeof firebase !== 'undefined') {
            try {
                firebase.initializeApp(firebaseConfig);
                this.db = firebase.firestore();
                console.log('Firebase initialized successfully');
            } catch (err) {
                console.error('Firebase init error:', err);
                this.offlineMode = true;
            }
        } else {
            console.warn('Firebase SDK not loaded');
            this.offlineMode = true;
        }
        
        this.currentWeek = this.getWeekNumber();
        
        if (this.offlineMode) {
            console.log('Running in OFFLINE/DEMO mode');
        }
    },

    // Get current week number for group ID generation
    getWeekNumber() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const diff = now - start + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
        const oneDay = 1000 * 60 * 60 * 24;
        const day = Math.floor(diff / oneDay);
        return Math.ceil(day / 7);
    },

    // Generate unique group ID: #(year)-0000 format (resets weekly)
    async generateGroupId() {
        const year = new Date().getFullYear();
        const week = this.getWeekNumber();
        
        // Get count of groups this week
        const weekStart = this.getWeekStartDate();
        const weekEnd = this.getWeekEndDate();
        
        try {
            const snapshot = await this.db
                .collection('groups')
                .where('arrivalTime', '>=', weekStart.toISOString())
                .where('arrivalTime', '<=', weekEnd.toISOString())
                .get();
            
            const count = snapshot.size + 1;
            const paddedCount = count.toString().padStart(4, '0');
            
            return `#${year}-${paddedCount}`;
        } catch (err) {
            // Fallback if query fails
            const timestamp = Date.now().toString().slice(-4);
            return `#${year}-${timestamp}`;
        }
    },

    getWeekStartDate() {
        const now = new Date();
        const dayOfWeek = now.getDay() || 7;
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek + 1);
        start.setHours(0, 0, 0, 0);
        return start;
    },

    getWeekEndDate() {
        const start = this.getWeekStartDate();
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return end;
    },

    // Save a new group (Firebase or localStorage fallback)
    async saveGroup(groupData) {
        const groupId = await this.generateGroupId();
        
        const data = {
            ...groupData,
            id: groupId,
            createdAt: new Date().toISOString()
        };

        if (this.offlineMode || !this.db) {
            // Save to localStorage
            this.mockGroups.push(data);
            this.saveToLocalStorage();
            return groupId;
        }

        try {
            await this.db.collection('groups').doc(groupId).set({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return groupId;
        } catch (err) {
            console.error('Firebase save error, falling back to localStorage:', err);
            this.offlineMode = true;
            this.mockGroups.push(data);
            this.saveToLocalStorage();
            return groupId;
        }
    },

    saveToLocalStorage() {
        localStorage.setItem('herouval_groups', JSON.stringify(this.mockGroups));
    },

    loadFromLocalStorage() {
        const saved = localStorage.getItem('herouval_groups');
        if (saved) {
            this.mockGroups = JSON.parse(saved);
        }
    },

    // Get a single group by ID
    async getGroup(groupId) {
        if (this.offlineMode) {
            return this.mockGroups.find(g => g.id === groupId) || null;
        }

        if (!this.db) {
            throw new Error('Firebase not initialized');
        }

        try {
            const doc = await this.db.collection('groups').doc(groupId).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        } catch (err) {
            console.error('Firebase get error:', err);
            return this.mockGroups.find(g => g.id === groupId) || null;
        }
    },

    // Get all groups (Firebase or localStorage)
    async getAllGroups(forToday = true) {
        if (this.offlineMode) {
            return this.getLocalGroups(forToday);
        }

        if (!this.db) {
            return this.getLocalGroups(forToday);
        }

        try {
            let query = this.db.collection('groups');
            
            if (forToday) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                query = query
                    .where('arrivalTime', '>=', today.toISOString())
                    .where('arrivalTime', '<', tomorrow.toISOString());
            }

            const snapshot = await query.orderBy('arrivalTime', 'desc').get();
            
            const groups = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.groups = groups;
            return groups;
        } catch (err) {
            console.error('Error fetching groups:', err);
            this.offlineMode = true;
            return this.getLocalGroups(forToday);
        }
    },

    getLocalGroups(forToday = true) {
        this.loadFromLocalStorage();
        
        if (!forToday) return this.mockGroups;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return this.mockGroups.filter(g => {
            const arrival = new Date(g.arrivalTime);
            return arrival >= today && arrival < tomorrow;
        });
    },

    // Listen to real-time group updates (with polling fallback)
    listenToGroups(callback, forToday = true) {
        // First call with local data
        this.loadFromLocalStorage();
        const localGroups = this.getLocalGroups(forToday);
        this.groups = localGroups;
        callback(localGroups);

        if (!this.db || this.offlineMode) {
            // Poll localStorage every 2 seconds for updates
            const interval = setInterval(() => {
                this.loadFromLocalStorage();
                const groups = this.getLocalGroups(forToday);
                if (JSON.stringify(groups) !== JSON.stringify(this.groups)) {
                    this.groups = groups;
                    callback(groups);
                }
            }, 2000);
            
            return () => clearInterval(interval);
        }

        try {
            let query = this.db.collection('groups');
            
            if (forToday) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                query = query
                    .where('arrivalTime', '>=', today.toISOString())
                    .where('arrivalTime', '<', tomorrow.toISOString());
            }

            return query
                .orderBy('arrivalTime', 'desc')
                .onSnapshot(snapshot => {
                    const groups = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    
                    this.groups = groups;
                    callback(groups);
                }, err => {
                    console.error('Listen error:', err);
                    this.offlineMode = true;
                    // Fallback to polling
                    const interval = setInterval(() => {
                        this.loadFromLocalStorage();
                        const groups = this.getLocalGroups(forToday);
                        this.groups = groups;
                        callback(groups);
                    }, 2000);
                    return () => clearInterval(interval);
                });
        } catch (err) {
            console.error('Firestore listen error:', err);
            this.offlineMode = true;
            callback(localGroups);
            return () => {};
        }
    },

    // Update a group (Firebase or localStorage)
    async updateGroup(groupId, updates) {
        const updatedData = {
            ...updates,
            updatedAt: new Date().toISOString()
        };

        if (this.offlineMode || !this.db) {
            // Update in localStorage
            const index = this.mockGroups.findIndex(g => g.id === groupId);
            if (index !== -1) {
                this.mockGroups[index] = { ...this.mockGroups[index], ...updatedData };
                this.saveToLocalStorage();
            }
            return;
        }

        try {
            await this.db.collection('groups').doc(groupId).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) {
            console.error('Firebase update error, falling back to localStorage:', err);
            this.offlineMode = true;
            const index = this.mockGroups.findIndex(g => g.id === groupId);
            if (index !== -1) {
                this.mockGroups[index] = { ...this.mockGroups[index], ...updatedData };
                this.saveToLocalStorage();
            }
        }
    },

    // Delete a group (admin only)
    async deleteGroup(groupId) {
        if (!this.db) {
            throw new Error('Firebase not initialized');
        }

        await this.db.collection('groups').doc(groupId).delete();
    },

    // Toast notification system
    showToast(message, type = 'info') {
        // Remove existing toast container
        const existing = document.querySelector('.toast-container');
        if (existing) {
            existing.remove();
        }

        const container = document.createElement('div');
        container.className = 'toast-container';
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        document.body.appendChild(container);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => container.remove(), 300);
        }, 3000);
    },

    // Utility: Format date
    formatDate(dateString) {
        return new Date(dateString).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Utility: Validate French license plate
    validateLicensePlate(plate) {
        // Simplified French plate validation: XX-XXX-XX
        const regex = /^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$/;
        return regex.test(plate);
    },

    // Utility: Clean license plate text from OCR
    cleanPlateText(text) {
        return text
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, '')
            .replace(/([A-Z]{2})([0-9]{3})([A-Z]{2})/, '$1-$2-$3');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}
