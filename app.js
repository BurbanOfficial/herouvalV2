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

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
}

const app = {
    db: null,
    groups: [],
    currentWeek: null,
    
    init() {
        if (typeof firebase !== 'undefined') {
            this.db = firebase.firestore();
        }
        this.currentWeek = this.getWeekNumber();
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

    // Save a new group to Firestore
    async saveGroup(groupData) {
        if (!this.db) {
            throw new Error('Firebase not initialized');
        }

        const groupId = await this.generateGroupId();
        
        const data = {
            ...groupData,
            id: groupId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await this.db.collection('groups').doc(groupId).set(data);
        
        return groupId;
    },

    // Get a single group by ID
    async getGroup(groupId) {
        if (!this.db) {
            throw new Error('Firebase not initialized');
        }

        const doc = await this.db.collection('groups').doc(groupId).get();
        
        if (!doc.exists) {
            return null;
        }

        return { id: doc.id, ...doc.data() };
    },

    // Get all groups (for today or all)
    async getAllGroups(forToday = true) {
        if (!this.db) {
            return [];
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
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (err) {
            console.error('Error fetching groups:', err);
            return [];
        }
    },

    // Listen to real-time group updates
    listenToGroups(callback, forToday = true) {
        if (!this.db) {
            console.warn('Firebase not available, using mock data');
            callback([]);
            return () => {};
        }

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
                callback([]);
            });
    },

    // Update a group
    async updateGroup(groupId, updates) {
        if (!this.db) {
            throw new Error('Firebase not initialized');
        }

        await this.db.collection('groups').doc(groupId).update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
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
