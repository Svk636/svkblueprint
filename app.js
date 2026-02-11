const DB_KEY = 'svk_blueprint_15year';
const SCHEMA = {
    blueprintMeta: null,
    allCycles: [],
    currentCycle: null,
    cycleHistory: [],
    tasks: { quick: [], scheduled: [], delegated: [] },
    system: { habits: [], reflections: { morning: [], evening: [] }, journal: [], reviews: [], labs: { experiments: [], newFailures: [], repeatedFailures: [] } },
    vault: { 
        learnings: { notes: [], quotes: [], bookSummaries: [], mindmaps: [] },
        growth: { books: [], courses: [], skills: [], mentors: [] },
        resources: { ideas: [], contacts: [], incomeStreams: [], assets: [] },
        reflections: { morning: [], evening: [] }, 
        journal: { morning: [], evening: [] } 
    },
    plan: { affirmations: [], bucketList: [] },
    goals: [],
    timeblocks: [],
    completed: []
};

const esc = s => {
    if (s === null || s === undefined) return '';
    if (typeof s !== 'string') s = String(s);
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

const App = {
    data: null,
    tab: 0,
    sub: {},
    
    // Custom Blueprint Generator state
    customBlueprintData: {},
    customPrompt: null,
    
    // Search state
    journalSearch: '',
    reflectionSearch: '',
    noteSearch: '',
    quoteSearch: '',
    
    // SYSTEM Tab Enhancement - Sorting states
    systemSort: { reflections: 'date-desc', journal: 'date-desc', reviews: 'date-desc' },
    
    // SYSTEM Tab Enhancement - Bulk mode states
    bulkMode: { reflections: false, journal: false, reviews: false },
    selectedItems: { reflections: new Set(), journal: new Set(), reviews: new Set() },
    
    // NEW: Undo/Redo system
    undoStack: [],
    redoStack: [],
    maxUndoSteps: 20,
    
    // NEW: Backup reminder system
    lastBackupReminder: null,
    backupReminderInterval: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    
    // NEW: Performance - Lazy loading flags
    tabsLoaded: { execute: false, build: false, strategy: false, system: false, vault: false },
    
    // NEW: Online/Offline status
    isOnline: true,
    
    habitTimer: {
        habitId: null,
        startTime: null,
        duration: 0,
        interval: null,
        isPaused: false
    },
    
    // NEW: Zen Mode Timer state
    zenMode: {
        active: false,
        habitId: null,
        taskId: null,
        intention: '',
        currentStepIndex: 0,
        startTime: null,
        duration: 0,
        targetDuration: 0,
        interval: null,
        isPaused: false,
        steps: []
    },

    timer: {
        running: false,
        seconds: 1500, // 25 minutes
        maxSeconds: 1500,
        interval: null,
        phase: 'work', // work, shortBreak, longBreak
        
        show() {
            const modal = document.getElementById('modal');
            const body = document.getElementById('modal-body');
            
            body.innerHTML = `
                <h3 style="margin-bottom:20px;color:var(--accent);text-align:center;">Focus Timer</h3>
                
                <div style="position:relative;width:200px;height:200px;margin:20px auto;">
                    <svg style="position:absolute;top:0;left:0;width:100%;height:100%;transform:rotate(-90deg);" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--sub)" stroke-width="8"/>
                        <circle id="timer-progress" cx="100" cy="100" r="90" fill="none" stroke="var(--success)" 
                                stroke-width="8" stroke-linecap="round" stroke-dasharray="565.48" stroke-dashoffset="0"
                                style="transition:stroke-dashoffset 1s linear;"/>
                    </svg>
                    <div id="timer-display" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                         font-family:monospace;font-size:36px;font-weight:700;">25:00</div>
                </div>
                
                <div style="text-align:center;margin-bottom:20px;">
                    <div id="timer-phase" style="color:var(--dim);font-size:13px;">Work Phase - Stay Focused</div>
                </div>
                
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                    <button class="btn-sec btn-success" id="timer-start" onclick="App.timer.start()">Start</button>
                    <button class="btn-sec" id="timer-pause" onclick="App.timer.pause()" style="display:none;">Pause</button>
                    <button class="btn-sec" onclick="App.timer.reset()">Reset</button>
                    <button class="btn-sec btn-danger" onclick="App.timer.skip()">Skip</button>
                </div>
                
                <div style="text-align:center;margin-top:16px;font-size:11px;color:var(--dim);">
                    Work: 25 min | Short Break: 5 min | Long Break: 15 min
                </div>
            `;
            
            modal.classList.add('open');
            this.updateDisplay();
        },
        
        start() {
            if (this.running) return;
            
            this.running = true;
            document.getElementById('timer-start').style.display = 'none';
            document.getElementById('timer-pause').style.display = 'block';
            
            this.interval = setInterval(() => {
                if (this.seconds > 0) {
                    this.seconds--;
                    this.updateDisplay();
                } else {
                    this.complete();
                }
            }, 1000);
        },
        
        pause() {
            this.running = false;
            document.getElementById('timer-start').style.display = 'block';
            document.getElementById('timer-pause').style.display = 'none';
            
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        },
        
        reset() {
            this.pause();
            this.seconds = this.maxSeconds;
            this.updateDisplay();
        },
        
        skip() {
            if (!confirm('Skip this phase?')) return;
            this.seconds = 0;
            this.complete();
        },
        
        complete() {
            this.pause();
            
            // Play sound
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                osc.type = 'sine';
                gain.gain.value = 0.3;
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            } catch(e) {}
            
            const phaseComplete = this.phase === 'work' ? 'Work session' : 'Break';
            App.toast(`✓ ${phaseComplete} complete!`);
            
            // Switch phases
            if (this.phase === 'work') {
                this.phase = 'shortBreak';
                this.maxSeconds = 300; // 5 min
            } else {
                this.phase = 'work';
                this.maxSeconds = 1500; // 25 min
            }
            
            this.seconds = this.maxSeconds;
            this.updateDisplay();
        },
        
        updateDisplay() {
            const mins = Math.floor(this.seconds / 60);
            const secs = this.seconds % 60;
            const display = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const timerDisplay = document.getElementById('timer-display');
            const phaseLabel = document.getElementById('timer-phase');
            const progress = document.getElementById('timer-progress');
            
            if (timerDisplay) timerDisplay.textContent = display;
            
            if (phaseLabel) {
                const labels = {
                    'work': 'Work Phase - Stay Focused',
                    'shortBreak': 'Short Break - Rest & Recharge',
                    'longBreak': 'Long Break - Deep Rest'
                };
                phaseLabel.textContent = labels[this.phase];
            }
            
            if (progress) {
                const percentage = this.seconds / this.maxSeconds;
                const circumference = 565.48;
                const offset = circumference * (1 - percentage);
                progress.style.strokeDashoffset = offset;
                progress.style.stroke = this.phase === 'work' ? 'var(--success)' : 'var(--blue)';
            }
        }
    },

    init() {
        // ERROR BOUNDARY: Wrap entire initialization in try-catch
        try {
            const saved = localStorage.getItem(DB_KEY);
            const hasSeenWelcome = localStorage.getItem('svkWelcomeSeen');
            
            if (saved) {
                try { 
                    this.data = JSON.parse(saved);
                    // Validate data structure
                    if (!this.data || typeof this.data !== 'object') {
                        throw new Error('Invalid data structure');
                    }
                    // SYSTEM Tab Enhancement - Ensure IDs on all items for backward compatibility
                    this.ensureIds(this.data);
                }
                catch(e) { 
                    console.error('Data parse error:', e);
                    // Backup corrupted data
                    const corrupted = localStorage.getItem(DB_KEY);
                    if (corrupted) {
                        localStorage.setItem('svk_corrupted_backup_' + Date.now(), corrupted);
                    }
                    this.data = JSON.parse(JSON.stringify(SCHEMA));
                    this.toast('⚠️ Data restored from backup');
                }
            } else {
                this.data = JSON.parse(JSON.stringify(SCHEMA));
            }
        
        // BUG FIX: Ensure ALL data structures exist, including vault sub-properties
        if (!this.data.blueprintMeta) this.data.blueprintMeta = null;
        if (!this.data.allCycles) this.data.allCycles = [];
        if (!this.data.cycleHistory) this.data.cycleHistory = [];
        if (!this.data.tasks) this.data.tasks = { quick: [], scheduled: [], delegated: [] };
        if (!this.data.tasks.quick) this.data.tasks.quick = [];
        if (!this.data.system) this.data.system = { habits: [], reflections: { morning: [], evening: [] }, journal: [], reviews: [] };
        if (!this.data.system.habits) this.data.system.habits = [];
        if (!this.data.system.reflections) this.data.system.reflections = { morning: [], evening: [] };
        if (!this.data.system.journal) this.data.system.journal = [];
        if (!this.data.vault) this.data.vault = { learnings: {}, growth: {}, resources: {} };
        
        // Initialize learnings sub-properties
        if (!this.data.vault.learnings) this.data.vault.learnings = {};
        if (!this.data.vault.learnings.notes) this.data.vault.learnings.notes = [];
        if (!this.data.vault.learnings.quotes) this.data.vault.learnings.quotes = [];
        if (!this.data.vault.learnings.bookSummaries) this.data.vault.learnings.bookSummaries = [];
        if (!this.data.vault.learnings.mindmaps) this.data.vault.learnings.mindmaps = [];
        
        // BUG FIX: Initialize growth sub-properties (was missing)
        if (!this.data.vault.growth) this.data.vault.growth = {};
        if (!this.data.vault.growth.books) this.data.vault.growth.books = [];
        if (!this.data.vault.growth.courses) this.data.vault.growth.courses = [];
        if (!this.data.vault.growth.skills) this.data.vault.growth.skills = [];
        if (!this.data.vault.growth.mentors) this.data.vault.growth.mentors = [];
        
        // BUG FIX: Initialize resources sub-properties (was missing)
        if (!this.data.vault.resources) this.data.vault.resources = {};
        if (!this.data.vault.resources.ideas) this.data.vault.resources.ideas = [];
        if (!this.data.vault.resources.contacts) this.data.vault.resources.contacts = [];
        if (!this.data.vault.resources.incomeStreams) this.data.vault.resources.incomeStreams = [];
        if (!this.data.vault.resources.assets) this.data.vault.resources.assets = [];
        
        // Enhanced Vault LEARN/EARN structures
        if (!this.data.vaultLearn) this.data.vaultLearn = { ideas: [], notes: [], books: [], skills: [] };
        if (!this.data.vaultLearn.ideas) this.data.vaultLearn.ideas = [];
        if (!this.data.vaultLearn.notes) this.data.vaultLearn.notes = [];
        if (!this.data.vaultLearn.books) this.data.vaultLearn.books = [];
        if (!this.data.vaultLearn.skills) this.data.vaultLearn.skills = [];
        
        if (!this.data.vaultEarn) this.data.vaultEarn = { strat: [], exec: [], leverage: [], contacts: [] };
        if (!this.data.vaultEarn.strat) this.data.vaultEarn.strat = [];
        if (!this.data.vaultEarn.exec) this.data.vaultEarn.exec = [];
        if (!this.data.vaultEarn.leverage) this.data.vaultEarn.leverage = [];
        if (!this.data.vaultEarn.contacts) this.data.vaultEarn.contacts = [];
        
        // Vault metadata and settings
        if (!this.data.vaultPromotions) this.data.vaultPromotions = [];
        if (!this.data.vaultSettings) this.data.vaultSettings = {
            viewMode: 'card', // 'card', 'compact', 'timeline'
            sortBy: 'recent',
            showAnalytics: true,
            searchQuery: '',
            activeFilters: [],
            selectedTags: [],
            dateRange: { start: null, end: null },
            importanceFilter: [],
            starredOnly: false,
            pinnedOnly: false,
            batchMode: false,
            selectedItems: [],
            categoryColors: {},
            showFilters: false
        };
        
        // Ensure enhanced settings exist for existing users
        if (!this.data.vaultSettings.selectedTags) this.data.vaultSettings.selectedTags = [];
        if (!this.data.vaultSettings.dateRange) this.data.vaultSettings.dateRange = { start: null, end: null };
        if (!this.data.vaultSettings.importanceFilter) this.data.vaultSettings.importanceFilter = [];
        if (this.data.vaultSettings.starredOnly === undefined) this.data.vaultSettings.starredOnly = false;
        if (this.data.vaultSettings.pinnedOnly === undefined) this.data.vaultSettings.pinnedOnly = false;
        if (this.data.vaultSettings.batchMode === undefined) this.data.vaultSettings.batchMode = false;
        if (!this.data.vaultSettings.selectedItems) this.data.vaultSettings.selectedItems = [];
        if (!this.data.vaultSettings.categoryColors) this.data.vaultSettings.categoryColors = {};
        if (this.data.vaultSettings.showFilters === undefined) this.data.vaultSettings.showFilters = false;
        
        if (!this.data.plan) this.data.plan = { affirmations: [], bucketList: [] };
        if (!this.data.goals) this.data.goals = [];
        if (!this.data.timeblocks) this.data.timeblocks = [];
        
        // Load custom blueprint data
        try {
            const storedCustom = localStorage.getItem('svkCustomBlueprintData');
            if (storedCustom) {
                this.customBlueprintData = JSON.parse(storedCustom);
            } else {
                this.customBlueprintData = this.getEmptyCustomBlueprintData();
            }
        } catch (e) {
            this.customBlueprintData = this.getEmptyCustomBlueprintData();
        }
        
        this.updateCycleIndicator();
        this.navigate(0);
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC to close modal
            if (e.key === 'Escape' && document.getElementById('modal').classList.contains('open')) {
                this.closeModal();
            }
            
            // Ctrl+Z / Cmd+Z for Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.performUndo();
            }
            
            // Ctrl+Shift+Z / Cmd+Shift+Z for Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.performRedo();
            }
        });
        
        // NEW: Online/Offline detection
        window.addEventListener('online', () => {
            this.isOnline = true;
            document.getElementById('offline-badge').classList.remove('show');
            this.toast('✓ Back online');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            document.getElementById('offline-badge').classList.add('show');
        });
        
        // Check initial online status
        this.isOnline = navigator.onLine;
        if (!this.isOnline) {
            document.getElementById('offline-badge').classList.add('show');
        }
        
        // NEW: Check for backup reminder on load
        this.checkBackupReminder();
        
        // Show welcome modal for first-time users
        // Only show if: (1) hasn't seen welcome AND (2) no blueprint data exists
        if (!hasSeenWelcome && !this.data.blueprintMeta && (!this.data.allCycles || this.data.allCycles.length === 0)) {
            setTimeout(() => {
                document.getElementById('welcome-overlay').style.display = 'flex';
            }, 300);
        }
        
        // PWA: Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('SVK Blueprint: Service Worker registered', registration.scope);
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New version available
                                    if (confirm('📱 New version available! Reload to update?')) {
                                        window.location.reload();
                                    }
                                }
                            });
                        }
                    });
                })
                .catch(err => {
                    console.log('Service Worker registration failed:', err);
                });
        }
        } catch (initError) {
            // CRITICAL ERROR HANDLER
            console.error('Critical initialization error:', initError);
            alert('⚠️ App failed to start. Please refresh the page. If this persists, clear your browser data.');
            // Attempt emergency data export
            try {
                const emergencyData = localStorage.getItem(DB_KEY);
                if (emergencyData) {
                    const blob = new Blob([emergencyData], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `svk_emergency_backup_${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (e) {
                console.error('Emergency export failed:', e);
            }
        }
    },

    save() {
        try {
            // Create auto-backup every 10 saves
            if (!this.saveCount) this.saveCount = 0;
            this.saveCount++;
            
            if (this.saveCount % 10 === 0) {
                try {
                    const backupKey = 'svk_auto_backup';
                    const backups = JSON.parse(localStorage.getItem(backupKey) || '[]');
                    backups.push({
                        timestamp: Date.now(),
                        data: this.data
                    });
                    // Keep only last 3 backups
                    if (backups.length > 3) backups.shift();
                    localStorage.setItem(backupKey, JSON.stringify(backups));
                } catch (backupError) {
                    console.warn('Auto-backup failed:', backupError);
                }
            }
            
            localStorage.setItem(DB_KEY, JSON.stringify(this.data)); 
            localStorage.setItem('svkCustomBlueprintData', JSON.stringify(this.customBlueprintData));
            
            // Update last save timestamp
            localStorage.setItem('svk_last_save', Date.now().toString());
        }
        catch(e) { 
            if (e.name === 'QuotaExceededError') {
                // Try to free up space
                try {
                    localStorage.removeItem('svk_auto_backup');
                    localStorage.setItem(DB_KEY, JSON.stringify(this.data));
                    this.toast('⚠️ Storage full - auto-backups cleared');
                } catch (retryError) {
                    this.toast('❌ Storage critically full - export your data NOW');
                    // Trigger emergency export
                    setTimeout(() => this.exportData(), 2000);
                }
            } else {
                this.toast('⚠️ Save failed: ' + e.message);
            }
            console.error('Save error:', e);
        }
    },
    
    // NEW: Undo/Redo System
    saveToUndoStack(action, data) {
        // Save current state before making changes
        this.undoStack.push({
            action: action,
            data: JSON.parse(JSON.stringify(data)), // Deep clone
            timestamp: Date.now()
        });
        
        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
    },
    
    performUndo() {
        if (this.undoStack.length === 0) {
            this.toast('⚠️ Nothing to undo');
            return;
        }
        
        const lastAction = this.undoStack.pop();
        
        // Save current state to redo stack
        this.redoStack.push({
            action: lastAction.action,
            data: JSON.parse(JSON.stringify(this.data)),
            timestamp: Date.now()
        });
        
        // Restore previous state
        this.data = lastAction.data;
        this.save();
        this.render();
        
        // Show undo toast with action description
        this.showUndoToast(`Undone: ${lastAction.action}`, false);
    },
    
    performRedo() {
        if (this.redoStack.length === 0) {
            this.toast('⚠️ Nothing to redo');
            return;
        }
        
        const lastRedo = this.redoStack.pop();
        
        // Save current state back to undo stack
        this.undoStack.push({
            action: lastRedo.action,
            data: JSON.parse(JSON.stringify(this.data)),
            timestamp: Date.now()
        });
        
        // Restore redo state
        this.data = lastRedo.data;
        this.save();
        this.render();
        
        this.toast(`✓ Redone: ${lastRedo.action}`);
    },
    
    showUndoToast(message, showUndo = true) {
        const undoToast = document.getElementById('undo-toast');
        const undoMessage = document.getElementById('undo-message');
        
        undoMessage.textContent = message;
        undoToast.classList.add('show');
        
        if (!showUndo) {
            undoToast.querySelector('button').style.display = 'none';
        }
        
        setTimeout(() => {
            undoToast.classList.remove('show');
            if (!showUndo) {
                undoToast.querySelector('button').style.display = 'block';
            }
        }, 3000);
    },
    
    // NEW: Backup Reminder System
    checkBackupReminder() {
        const lastReminder = localStorage.getItem('svkLastBackupReminder');
        const lastBackupTime = lastReminder ? parseInt(lastReminder) : 0;
        const now = Date.now();
        
        // Show reminder if more than 7 days since last backup
        if (now - lastBackupTime > this.backupReminderInterval) {
            setTimeout(() => {
                document.getElementById('backup-reminder').classList.add('show');
            }, 5000); // Show 5 seconds after app loads
        }
    },
    
    dismissBackupReminder() {
        localStorage.setItem('svkLastBackupReminder', Date.now().toString());
        document.getElementById('backup-reminder').classList.remove('show');
    },
    
    exportAllData() {
        try {
            const exportData = {
                version: '2.1.3',
                exportDate: new Date().toISOString(),
                data: this.data,
                customBlueprint: this.customBlueprintData
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `svk-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            // Update last backup time
            localStorage.setItem('svkLastBackupReminder', Date.now().toString());
            document.getElementById('backup-reminder').classList.remove('show');
            
            this.toast('✓ Backup downloaded');
        } catch (e) {
            console.error('Export error:', e);
            this.toast('⚠️ Export failed');
        }
    },

    getEmptyCustomBlueprintData() {
        return {
            name: '',
            vision: '',
            years: '15',
            domain1: '',
            domain2: '',
            domain3: '',
            milestone1: '',
            milestone2: '',
            milestone3: '',
            habit1: '',
            habit2: '',
            habit3: ''
        };
    },

    navigate(i) {
        this.tab = i;
        document.querySelectorAll('.nav-btn').forEach((b, idx) => b.classList.toggle('active', idx === i));
        
        // NEW: Mark tab as loaded for lazy loading
        const tabNames = ['execute', 'build', 'strategy', 'system', 'vault'];
        this.tabsLoaded[tabNames[i]] = true;
        
        this.render();
    },

    render() {
        // NEW: Lazy loading - only render if tab has been visited
        const views = [this.viewExecute, this.viewBuild, this.viewStrategy, this.viewSystem, this.viewVault];
        
        // For performance: check if we should use pagination
        const shouldPaginate = this.shouldUsePagination();
        
        if (shouldPaginate) {
            // If large dataset, add pagination note
            console.log('Large dataset detected - consider pagination');
        }
        
        document.getElementById('app').innerHTML = views[this.tab].call(this);
    },
    
    // NEW: Check if data is large enough to warrant pagination
    shouldUsePagination() {
        const habitCount = this.data.system?.habits?.length || 0;
        const journalCount = this.data.system?.journal?.length || 0;
        const notesCount = this.data.vault?.learnings?.notes?.length || 0;
        const goalsCount = this.data.goals?.length || 0;
        
        // Consider pagination if any collection has 100+ items
        return habitCount > 100 || journalCount > 100 || notesCount > 100 || goalsCount > 100;
    },

    toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2200);
    },

    celebrate(emoji, title, sub) {
        document.getElementById('celebrate-emoji').textContent = emoji;
        document.getElementById('celebrate-title').textContent = title;
        document.getElementById('celebrate-sub').textContent = sub;
        document.getElementById('celebrate').classList.add('show');
    },
    closeCelebrate() { document.getElementById('celebrate').classList.remove('show'); },

    // VIEW: EXECUTE
    viewExecute() {
        const quotes = ["The obstacle is the path.", "One breath. One task. Full presence.", "Empty your cup to receive."];
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        
        let html = `<div class="zen-quote">"${quote}"</div>`;
        
        // QUICK TASKS - Max 3 urgent items
        if (!this.data.tasks) this.data.tasks = { quick: [] };
        if (!this.data.tasks.quick) this.data.tasks.quick = [];
        const quickTasks = this.data.tasks.quick || [];
        const canAddQuick = quickTasks.length < 3;
        
        html += `<div class="section-header">
            <span>⚡ Quick Tasks (${quickTasks.length}/3)</span>
            ${canAddQuick ? `<button class="btn-sec" onclick="App.addQuickTask()">+ Add</button>` : ''}
        </div>`;
        
        if (quickTasks.length > 0) {
            quickTasks.forEach(task => {
                html += `<div class="task-row ${task.done ? 'done' : ''}">
                    <div style="flex:1;min-width:0;">
                        <div class="task-title">${esc(task.title)}</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        ${!task.done ? `<button class="btn-sec btn-success" onclick="App.toggleQuickTask('${task.id}')" style="font-size:12px;padding:6px 12px;">✓</button>` : ''}
                        <button class="btn-sec" onclick="App.deleteQuickTask('${task.id}')" style="font-size:11px;padding:4px 10px;opacity:0.6;">✕</button>
                    </div>
                </div>`;
            });
        }
        
        if (!canAddQuick) {
            html += `<div style="text-align:center;margin-top:8px;font-size:11px;color:var(--dim);">
                Max 3 quick tasks. Complete or delete to add more.
            </div>`;
        }
        
        // MEDITATIVE FIGURE - Empty Cup (shown when no quick tasks)
        if (quickTasks.length === 0) {
            html += `<div style="margin-top:32px;text-align:center;padding:40px 20px;background:var(--sub);border-radius:12px;">
                <div style="font-size:14px;color:var(--accent);margin-bottom:20px;letter-spacing:1px;text-transform:uppercase;">
                    The Empty Cup
                </div>
                <div style="font-size:80px;line-height:1;margin-bottom:16px;">🧘</div>
                <div style="font-size:13px;color:var(--dim);max-width:280px;margin:0 auto;line-height:1.6;">
                    Your mind is clear, ready to receive.<br>
                    Tasks will appear when needed.
                </div>
            </div>`;
        }
        
        // ACTIVE CYCLE TASKS
        if (!this.data.currentCycle) {
            html += `<div class="section-header" style="margin-top:24px;"><span>📋 Active Cycle</span></div>`;
            html += `<div class="card" style="text-align:center;padding:40px 20px;">
                <div style="font-size:48px;margin-bottom:20px;">🎯</div>
                <div style="font-size:20px;font-weight:700;margin-bottom:12px;">No Blueprint Yet</div>
                <p style="color:var(--dim);margin-bottom:24px;line-height:1.5;">
                    Create your personalized 15-year blueprint with AI or import an existing one.
                </p>
                <button class="btn" style="margin-bottom:12px;" onclick="App.tab=3;App.sub.system='custom';App.render()">
                    🤖 Create Custom Blueprint
                </button>
                <button class="btn-sec" onclick="App.tab=1;App.sub.build='stats';App.render()">
                    📤 Import Blueprint
                </button>
            </div>`;
        } else {
            const tasks = this.data.currentCycle.tasks || [];
            const week = this.getCurrentWeek();
            const weekTasks = tasks.filter(t => t.week === week && !t.done);
            
            html += `<div class="section-header" style="margin-top:24px;">
                <span>📅 This Week (Week ${week}/13)</span>
                <span style="font-size:10px;color:var(--dim);font-weight:400;">${weekTasks.length} pending</span>
            </div>`;
            
            if (weekTasks.length === 0) {
                html += `<div class="card" style="text-align:center;padding:20px;background:var(--sub);">
                    <div style="font-size:13px;color:var(--dim);">All tasks completed for this week! 🎉</div>
                </div>`;
            } else {
                // Show first 5 pending tasks
                weekTasks.slice(0, 5).forEach(task => {
                    html += `<div class="task-row" onclick="App.startTask('${task.id}')">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;">${esc(task.title)}</div>
                            <div class="task-meta">
                                ${task.duration ? `⏱ ${task.duration}m` : ''}
                                <span>Week ${task.week}</span>
                            </div>
                        </div>
                        <button class="btn-sec btn-success" onclick="event.stopPropagation();App.toggleTask('${task.id}')">✓</button>
                    </div>`;
                });
                
                if (weekTasks.length > 5) {
                    html += `<div style="text-align:center;margin-top:12px;">
                        <button class="btn-sec" onclick="App.navigate(2)" style="font-size:12px;">
                            View All ${weekTasks.length} Tasks →
                        </button>
                    </div>`;
                }
            }
        }
        
        // TODAY'S TIMEBLOCKS
        const today = new Date().toISOString().split('T')[0];
        const todayTimeblocks = (this.data.timeblocks || []).filter(tb => tb.date === today && !tb.completed);
        
        if (todayTimeblocks.length > 0) {
            html += `<div class="section-header" style="margin-top:24px;">
                <span>⏰ Today's Timeblocks</span>
                <button class="btn-sec" onclick="App.viewTimeblocks()" style="font-size:11px;padding:4px 10px;">View All</button>
            </div>`;
            
            todayTimeblocks.slice(0, 3).forEach(tb => {
                html += `<div class="card" style="border-left:4px solid var(--accent);">
                    <div style="display:flex;justify-content:space-between;align-items:start;">
                        <div style="flex:1;">
                            <div style="font-weight:700;">${esc(tb.title)}</div>
                            <div style="font-size:12px;color:var(--dim);margin-top:4px;">
                                ${tb.time || 'Anytime'} • ${tb.duration || 60} min • ${tb.type || 'Focus'}
                            </div>
                        </div>
                        <button class="btn-sec btn-success" onclick="App.toggleTimeblock('${tb.id}')" 
                                style="font-size:12px;padding:6px 12px;">✓</button>
                    </div>
                </div>`;
            });
        }
        
        return html;
    },

    // VIEW: BUILD
    viewBuild() {
        if (!this.data.blueprintMeta) {
            return `<div class="card" style="text-align:center;padding:40px 20px;">
                <div style="font-size:48px;margin-bottom:12px;">📜</div>
                <div style="font-size:20px;font-weight:700;margin-bottom:8px;color:var(--accent);">Load Your 15-Year Vision</div>
                <div style="font-size:13px;color:var(--dim);margin-bottom:24px;">Import your master blueprint to begin execution.</div>
                <input type="file" id="bp-file" accept=".json" onchange="App.importBlueprint(event)" style="display:none;">
                <button class="btn" onclick="document.getElementById('bp-file').click()">Import Blueprint JSON</button>
            </div>`;
        }
        
        const meta = this.data.blueprintMeta;
        const sub = this.sub.build || 'aim';
        
        let html = `<div class="segment">
            <button class="segment-btn ${sub==='aim'?'active':''}" onclick="App.sub.build='aim';App.render()">Chief Aim</button>
            <button class="segment-btn ${sub==='goals'?'active':''}" onclick="App.sub.build='goals';App.render()">Goals</button>
            <button class="segment-btn ${sub==='affirmations'?'active':''}" onclick="App.sub.build='affirmations';App.render()">Affirmations</button>
            <button class="segment-btn ${sub==='bucketlist'?'active':''}" onclick="App.sub.build='bucketlist';App.render()">Bucket List</button>
            <button class="segment-btn ${sub==='stats'?'active':''}" onclick="App.sub.build='stats';App.render()">Stats</button>
        </div>`;
        
        if (sub === 'aim') {
            // FULL SCREEN CHIEF AIM
            html += `
                <div style="min-height:calc(100vh - 200px);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 20px;">
                    <div style="font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;font-weight:700;">DEFINITE CHIEF AIM</div>
                    <div style="font-size:18px;line-height:1.8;color:var(--zen);max-width:600px;white-space:pre-wrap;font-weight:400;">${esc(meta.vision)}</div>
                    <div style="margin-top:40px;font-size:12px;color:var(--dim);">↓ Scroll for Blueprint Details</div>
                </div>
                
                <!-- BLUEPRINT DETAILS BELOW FOLD -->
                <div style="margin-top:60px;">
                    <div class="section-header"><span>Blueprint Overview</span></div>
                    <div class="card" style="border-left:4px solid var(--accent);">
                        <div style="font-size:18px;font-weight:700;color:var(--accent);margin-bottom:8px;">${esc(meta.name)}</div>
                        <div style="font-size:13px;color:var(--dim);">${meta.years} Years | ${meta.totalCycles} Cycles</div>
                    </div>
                    
                    <div class="stat-grid">
                        <div class="stat-box"><div class="stat-val">${this.data.allCycles.length}</div><div class="stat-label">Total Cycles</div></div>
                        <div class="stat-box"><div class="stat-val">${this.data.currentCycle?.number || 0}</div><div class="stat-label">Current Cycle</div></div>
                        <div class="stat-box"><div class="stat-val">${this.data.cycleHistory?.length || 0}</div><div class="stat-label">Completed</div></div>
                        <div class="stat-box"><div class="stat-val">${meta.totalCycles - (this.data.currentCycle?.number || 0)}</div><div class="stat-label">Remaining</div></div>
                    </div>
                    
                    <div class="section-header"><span>Domains</span></div>
                    ${Object.entries(meta.domains || {}).map(([key, domain]) => `
                        <div class="card" style="border-left:4px solid ${domain.color};">
                            <div style="font-weight:700;color:${domain.color};">${esc(domain.name)}</div>
                            ${domain.description ? `<div style="font-size:13px;color:var(--dim);margin-top:4px;">${esc(domain.description)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (sub === 'goals') {
            html += `<div class="section-header"><span>Goals</span></div>`;
            
            // Goals UI
            if (!this.data.goals || this.data.goals.length === 0) {
                html += `
                    <div class="empty-state">
                        <div class="empty-state-icon">🎯</div>
                        <p>No goals yet. Set 3-5 major goals aligned with your Chief Aim.</p>
                        <button class="btn" onclick="App.addGoal()" style="max-width:240px;margin:20px auto 0;">
                            Add First Goal
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <button class="btn mb-2" onclick="App.addGoal()">+ Add Goal</button>
                    <div style="font-size:12px;color:var(--dim);margin-bottom:16px;">
                        Add 3-5 major long-term goals aligned with your Chief Aim
                    </div>
                `;
                
                this.data.goals.forEach(goal => {
                    const expanded = goal.expanded || false;
                    const subgoals = goal.subgoals || [];
                    const completedSubs = subgoals.filter(s => s.done).length;
                    
                    html += `
                        <div class="goal-card ${expanded ? 'expanded' : ''}" onclick="App.toggleGoal('${goal.id}')">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                                <div style="font-weight:700;font-size:16px;line-height:1.4;flex:1;">${esc(goal.title)}</div>
                                <div style="font-size:20px;color:${expanded ? 'var(--accent)' : 'var(--dim)'};
                                     transition:transform 0.2s;transform:rotate(${expanded ? '180deg' : '0deg'});">▼</div>
                            </div>
                            
                            ${expanded ? `
                                <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
                                    <div style="display:flex;gap:12px;margin:12px 0;flex-wrap:wrap;">
                                        ${goal.timeline ? `
                                            <div style="min-width:120px;">
                                                <div style="font-size:10px;color:var(--dim);text-transform:uppercase;
                                                     letter-spacing:1px;margin-bottom:4px;">Timeline</div>
                                                <div style="font-weight:600;font-size:14px;">${esc(goal.timeline)}</div>
                                            </div>
                                        ` : ''}
                                        ${goal.domain ? `
                                            <div style="min-width:120px;">
                                                <div style="font-size:10px;color:var(--dim);text-transform:uppercase;
                                                     letter-spacing:1px;margin-bottom:4px;">Domain</div>
                                                <div style="font-weight:600;font-size:14px;">${esc(goal.domain)}</div>
                                            </div>
                                        ` : ''}
                                        ${goal.metrics ? `
                                            <div style="min-width:120px;">
                                                <div style="font-size:10px;color:var(--dim);text-transform:uppercase;
                                                     letter-spacing:1px;margin-bottom:4px;">Success Metric</div>
                                                <div style="font-weight:600;font-size:14px;">${esc(goal.metrics)}</div>
                                            </div>
                                        ` : ''}
                                    </div>
                                    
                                    <div style="margin-top:16px;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                                                Subgoals (${completedSubs}/${subgoals.length})
                                            </div>
                                            <button class="btn-sec" onclick="event.stopPropagation();App.addSubgoal('${goal.id}')">
                                                + Add
                                            </button>
                                        </div>
                                        ${subgoals.length > 0 ? `
                                            <div style="margin-top:12px;">
                                                ${subgoals.map(sub => `
                                                    <div style="padding:10px;background:var(--void);border-radius:8px;
                                                         margin-bottom:6px;display:flex;justify-content:space-between;
                                                         align-items:center;gap:8px;">
                                                        <div class="checkbox ${sub.done ? 'checked' : ''}" 
                                                             onclick="event.stopPropagation();App.toggleSubgoal('${goal.id}','${sub.id}')">
                                                        </div>
                                                        <div style="flex:1;${sub.done ? 'text-decoration:line-through;opacity:0.5;' : ''}">${esc(sub.title)}</div>
                                                        <button class="btn-sec btn-danger" style="padding:4px 8px;" 
                                                                onclick="event.stopPropagation();App.deleteSubgoal('${goal.id}','${sub.id}')">
                                                            &times;
                                                        </button>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : `
                                            <div style="text-align:center;padding:12px;color:var(--dim);font-size:13px;">
                                                No subgoals yet
                                            </div>
                                        `}
                                    </div>
                                    
                                    <!-- GOAL STAGES SECTION -->
                                    ${goal.stages && goal.stages.length > 0 ? `
                                        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
                                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
                                                    Stages (${goal.stages.filter(s => s.completed).length}/${goal.stages.length})
                                                </div>
                                            </div>
                                            <div style="margin-top:12px;">
                                                ${goal.stages.map(stage => `
                                                    <div style="padding:12px;background:var(--void);border-radius:8px;
                                                         margin-bottom:8px;border-left:3px solid ${stage.completed ? 'var(--success)' : 'var(--accent)'};">
                                                        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px;">
                                                            <div style="flex:1;">
                                                                <div style="font-weight:600;${stage.completed ? 'text-decoration:line-through;opacity:0.6;' : ''}">${esc(stage.title)}</div>
                                                                ${stage.target ? `<div style="font-size:11px;color:var(--dim);margin-top:4px;">🎯 Target: ${new Date(stage.target).toLocaleDateString()}</div>` : ''}
                                                                ${stage.description ? `<div style="font-size:12px;color:var(--dim);margin-top:6px;">${esc(stage.description)}</div>` : ''}
                                                            </div>
                                                        </div>
                                                        <div style="display:flex;gap:6px;margin-top:8px;">
                                                            <button class="btn-sec ${stage.completed ? '' : 'btn-success'}" 
                                                                    onclick="event.stopPropagation();App.toggleGoalStage('${goal.id}','${stage.id}')"
                                                                    style="font-size:11px;padding:4px 10px;">
                                                                ${stage.completed ? '◯ Reopen' : '✓ Complete'}
                                                            </button>
                                                            <button class="btn-sec btn-danger" style="padding:4px 10px;font-size:11px;" 
                                                                    onclick="event.stopPropagation();App.deleteGoalStage('${goal.id}','${stage.id}')">
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    <div style="display:flex;gap:8px;margin-top:16px;">
                                        <button class="btn-sec" onclick="event.stopPropagation();App.editGoal('${goal.id}')">
                                            Edit
                                        </button>
                                        <button class="btn-sec btn-danger" onclick="event.stopPropagation();App.deleteGoal('${goal.id}')">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
            }
        } else if (sub === 'affirmations') {
            html += `<div class="section-header"><span>Affirmations</span><button class="btn-sec" onclick="App.addAffirmation()">+</button></div>`;
            const affs = this.data.plan.affirmations || [];
            if (affs.length === 0) {
                html += `<div class="empty-state"><div class="empty-state-icon">✨</div><p>No affirmations yet</p></div>`;
            } else {
                affs.forEach(aff => {
                    html += `<div class="card" style="border-left:3px solid var(--accent);">
                        <div style="font-weight:700;">${esc(aff.text)}</div>
                        ${aff.timestamp ? `<div class="task-meta" style="margin-top:8px;">${new Date(aff.timestamp).toLocaleDateString()}</div>` : ''}
                        <button class="btn-sec btn-danger" onclick="App.deleteAffirmation('${aff.id}')" style="margin-top:8px;font-size:11px;">Delete</button>
                    </div>`;
                });
            }
        } else if (sub === 'bucketlist') {
            html += `<div class="section-header"><span>Bucket List</span><button class="btn-sec" onclick="App.addBucketItem()">+</button></div>`;
            const items = this.data.plan.bucketList || [];
            if (items.length === 0) {
                html += `<div class="empty-state"><div class="empty-state-icon">🪣</div><p>No bucket list items yet</p></div>`;
            } else {
                items.forEach(item => {
                    html += `<div class="card" style="border-left:3px solid ${item.done?'var(--success)':'var(--blue)'};">
                        <div style="display:flex;justify-content:space-between;align-items:start;">
                            <div style="flex:1;">
                                <div style="font-weight:700;${item.done?'text-decoration:line-through;color:var(--dim);':''}">${esc(item.title)}</div>
                                ${item.description ? `<div style="color:var(--dim);font-size:13px;margin-top:4px;">${esc(item.description)}</div>` : ''}
                            </div>
                            ${item.done ? `<span style="color:var(--success);font-size:18px;">✓</span>` : ''}
                        </div>
                        <div style="display:flex;gap:6px;margin-top:8px;">
                            ${!item.done ? `<button class="btn-sec btn-success" onclick="App.toggleBucketItem('${item.id}')">✓ Done</button>` : `<button class="btn-sec" onclick="App.toggleBucketItem('${item.id}')">Undo</button>`}
                            <button class="btn-sec btn-danger" onclick="App.deleteBucketItem('${item.id}')" style="margin-left:auto;">Delete</button>
                        </div>
                    </div>`;
                });
            }
        } else if (sub === 'stats') {
            html += `<div class="section-header"><span>Blueprint Stats</span></div>`;
            html += `<div class="card">
                <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Export / Import</div>
                <button class="btn" onclick="App.exportData()" style="margin-bottom:8px;">📥 Export All Data (JSON)</button>
                <button class="btn btn-danger" onclick="App.resetBlueprint()">🔄 Reset Blueprint</button>
            </div>`;
            
            html += `<div class="card" style="background:linear-gradient(135deg,rgba(10,132,255,0.1),rgba(10,132,255,0.05));border:1px solid rgba(10,132,255,0.3);">
                <div style="font-size:16px;font-weight:700;margin-bottom:12px;color:var(--blue);">🤖 Create Custom Blueprint</div>
                <p style="font-size:13px;color:var(--dim);margin-bottom:16px;line-height:1.5;">
                    Use AI to generate your personalized 15-year blueprint with 60 cycles, tasks, habits, and milestones. 
                    Takes just 5 minutes!
                </p>
                <button class="btn" style="background:var(--blue);color:var(--text);" 
                    onclick="App.tab=3;App.sub.system='custom';App.render()">
                    ✨ Generate with AI
                </button>
            </div>`;
        }
        
        return html;
    },

    // VIEW: STRATEGY
    viewStrategy() {
        if (!this.data.currentCycle) {
            return `<div class="card" style="text-align:center;padding:36px 20px;">
                <div style="font-size:14px;margin-bottom:16px;color:var(--dim);">No active cycle</div>
                ${this.data.allCycles && this.data.allCycles.length > 0 ? 
                    `<button class="btn" onclick="App.loadNextCycle()">⚡ Start First Cycle</button>` : 
                    `<p style="color:var(--dim);margin-bottom:16px;">Import blueprint first from BUILD tab</p>
                    <input type="file" id="bp-file-2" accept=".json" onchange="App.importBlueprint(event)" style="display:none;">
                    <button class="btn" onclick="document.getElementById('bp-file-2').click()">Import Blueprint</button>`}
            </div>`;
        }
        
        const c = this.data.currentCycle;
        const tasks = c.tasks || [];
        const week = this.sub._viewedWeek || this.getCurrentWeek();
        let weekTasks = tasks.filter(t => t.week === week);
        
        // Apply filters
        weekTasks = this.filterTasks(weekTasks);
        
        const weekPending = weekTasks.filter(t => !t.done);
        const weekDone = weekTasks.filter(t => t.done);
        const allDone = tasks.filter(t => t.done).length;
        const pct = tasks.length > 0 ? Math.round((allDone / tasks.length) * 100) : 0;
        
        let html = `
            <div class="card" style="background:linear-gradient(135deg,#1c1c1e,#252527);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div>
                        <div style="font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;">Current Cycle</div>
                        <div style="font-size:18px;font-weight:700;color:var(--accent);">${esc(c.title)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;">Week</div>
                        <div style="font-size:18px;font-weight:700;">${week}<span style="color:var(--dim);font-size:14px;">/13</span></div>
                    </div>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${(week/13)*100}%"></div></div>
            </div>
            
            <div class="stat-grid">
                <div class="stat-box"><div class="stat-val">${weekPending.length}</div><div class="stat-label">This Week</div></div>
                <div class="stat-box"><div class="stat-val" style="color:var(--success)">${pct}%</div><div class="stat-label">Cycle Done</div></div>
            </div>
            
            <div class="section-header">
                <span>Focus • Week ${week}</span>
                <div style="display:flex;gap:6px;">
                    <button class="btn-sec" onclick="App.changeWeek(-1)" ${week <= 1 ? 'disabled style="opacity:0.3;"' : ''}>◀</button>
                    <button class="btn-sec" onclick="App.changeWeek(1)" ${week >= 13 ? 'disabled style="opacity:0.3;"' : ''}>▶</button>
                </div>
            </div>
            
            ${this.renderTaskFilters()}
        `;
        
        if (weekPending.length === 0 && weekDone.length === 0) {
            html += `<div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <p>No tasks for week ${week}</p>
                <button class="btn-sec" onclick="App.addWeekTask(${week})" style="margin-top:12px;">+ Add Task</button>
            </div>`;
        } else {
            // PENDING TASKS
            if (weekPending.length > 0) {
                weekPending.forEach(task => {
                    html += `<div class="task-row" onclick="App.viewTaskDetail('${task.id}')">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;word-break:break-word;">${esc(task.title)}</div>
                            <div class="task-meta">
                                ${task.duration ? `⏱ ${task.duration}m` : ''}
                                <span>Week ${task.week}</span>
                            </div>
                        </div>
                        <button class="btn-sec btn-success" onclick="event.stopPropagation();App.toggleTask('${task.id}')">✓</button>
                    </div>`;
                });
            }
            
            // COMPLETED TASKS
            if (weekDone.length > 0) {
                html += `<div class="section-header" style="margin-top:18px;"><span>Completed</span></div>`;
                weekDone.forEach(task => {
                    html += `<div class="task-row done">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;color:var(--dim);">${esc(task.title)}</div>
                        </div>
                        <span style="color:var(--success);font-size:16px;">✓</span>
                    </div>`;
                });
            }
            
            html += `<button class="btn-sec" onclick="App.addWeekTask(${week})" style="width:100%;margin-top:12px;">+ Add Task to Week ${week}</button>`;
        }
        
        // DOMAIN FOCUS VISUALIZATION
        html += this.renderDomainFocus();
        
        // CYCLE ACTIONS
        html += `
            <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);">
                <div class="section-header"><span>Cycle Management</span></div>
                
                ${c.milestones && c.milestones.length > 0 ? `
                <div class="card" style="margin-bottom:12px;">
                    <div style="font-size:10px;color:var(--accent);text-transform:uppercase;margin-bottom:8px;letter-spacing:1px;">Milestones</div>
                    ${c.milestones.map(m => `<div style="padding:8px 10px;background:var(--sub);border-radius:8px;margin-top:6px;font-size:13px;border-left:3px solid var(--accent);">✓ ${esc(m)}</div>`).join('')}
                </div>` : ''}
                
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${this.data.allCycles && c.number > 1 ? `<button class="btn-sec" onclick="App.jumpToCycle(${c.number - 1})">← Prev Cycle</button>` : ''}
                    <button class="btn-sec" onclick="App.showAllCycles()">All Cycles</button>
                    ${this.data.allCycles && c.number < this.data.blueprintMeta.totalCycles ? `<button class="btn-sec" style="background:var(--accent);color:var(--void);" onclick="App.loadNextCycle()">Next Cycle →</button>` : ''}
                    <button class="btn-sec btn-danger" onclick="App.completeCycle()" style="margin-left:auto;">Complete Cycle</button>
                </div>
            </div>
        `;
        
        // CYCLE HISTORY
        if (this.data.cycleHistory && this.data.cycleHistory.length > 0) {
            html += `<div class="section-header" style="margin-top:24px;"><span>History</span></div>`;
            this.data.cycleHistory.slice(0, 3).forEach(ch => {
                const rate = ch.tasks?.length > 0 ? Math.round((ch.tasks.filter(t=>t.done).length||0)/ch.tasks.length*100) : 0;
                html += `<div class="card" style="border-left:3px solid var(--success);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:10px;color:var(--dim);">Cycle #${ch.number}</div>
                            <div style="font-size:16px;font-weight:700;">${esc(ch.title)}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:20px;font-weight:700;color:var(--success);">${rate}%</div>
                            <div style="font-size:10px;color:var(--dim);">complete</div>
                        </div>
                    </div>
                </div>`;
            });
        }
        
        return html;
    },

    // VIEW: SYSTEM
    viewSystem() {
        if (!this.data.system) this.data.system = { habits: [], reflections: { morning: [], evening: [] }, journal: [], reviews: [] };
        
        const sub = this.sub.system || 'habits';
        let html = `<div class="segment">
            <button class="segment-btn ${sub === 'habits' ? 'active' : ''}" onclick="App.sub.system='habits';App.render()">Habits</button>
            <button class="segment-btn ${sub === 'reflections' ? 'active' : ''}" onclick="App.sub.system='reflections';App.render()">Reflect</button>
            <button class="segment-btn ${sub === 'journal' ? 'active' : ''}" onclick="App.sub.system='journal';App.render()">Journal</button>
            <button class="segment-btn ${sub === 'reviews' ? 'active' : ''}" onclick="App.sub.system='reviews';App.render()">Reviews</button>
            <button class="segment-btn ${sub === 'custom' ? 'active' : ''}" onclick="App.sub.system='custom';App.render()">Custom Blueprint</button>
        </div>`;
        
        if (sub === 'habits') {
            const habits = this.data.system.habits || [];
            html += `<div class="section-header">
                <span>📋 Daily Habits</span>
                <button class="btn-sec" onclick="App.addHabit()">+ Add</button>
            </div>`;
            
            if (habits.length === 0) {
                html += `<div class="empty-state"><div class="empty-state-icon">📋</div><p>Add your keystone habits</p></div>`;
            } else {
                const today = new Date().toISOString().split('T')[0];
                habits.forEach(h => {
                    const todayDone = h.completions?.some(c => c.date === today && c.done) || false;
                    const streaks = this.calculateStreaks(h);
                    const completedSteps = h.microSteps?.filter(s => s.status === 'done').length || 0;
                    const totalSteps = h.microSteps?.length || 0;
                    
                    html += `<div class="habit-card" style="padding:12px;">
                        <div class="habit-header" style="margin-bottom:8px;">
                            <div class="habit-info">
                                <div class="habit-title" style="font-size:14px;margin-bottom:2px;">${esc(h.title)}</div>
                                <div class="habit-meta" style="font-size:10px;">
                                    ${h.timeBlock ? `<span>${h.timeBlock}</span>` : ''}
                                    ${totalSteps > 0 ? `<span style="margin-left:8px;color:var(--dim);">${completedSteps}/${totalSteps} steps</span>` : ''}
                                </div>
                            </div>
                            <div class="habit-actions">
                                <button class="habit-check-btn ${todayDone ? 'done' : ''}" onclick="App.toggleHabit('${h.id}')" style="width:28px;height:28px;">
                                    ${todayDone ? '<svg width="14" height="14" fill="none" stroke="#000" stroke-width="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>' : ''}
                                </button>
                                <button class="habit-start-btn" onclick="App.startHabitTimer('${h.id}')" style="font-size:11px;padding:6px 10px;">START</button>
                            </div>
                        </div>
                        
                        <div style="display:flex;gap:12px;align-items:center;margin:8px 0;
                             padding:8px;background:var(--sub);border-radius:6px;border:1px solid var(--border);">
                            <div style="text-align:center;flex:1;">
                                <div style="font-size:22px;font-weight:700;color:var(--success);line-height:1;">
                                    ${streaks.current}
                                </div>
                                <div style="font-size:9px;color:var(--dim);text-transform:uppercase;
                                     letter-spacing:0.5px;margin-top:2px;">
                                    Current
                                </div>
                            </div>
                            <div style="width:1px;height:30px;background:var(--border);"></div>
                            <div style="text-align:center;flex:1;">
                                <div style="font-size:22px;font-weight:700;color:var(--accent);line-height:1;">
                                    ${streaks.longest}
                                </div>
                                <div style="font-size:9px;color:var(--dim);text-transform:uppercase;
                                     letter-spacing:0.5px;margin-top:2px;">
                                    Best
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin:8px 0;">
                            ${this.renderHeatmap(h.completions || [])}
                        </div>
                        
                        <div style="display:flex;gap:4px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
                            <button class="btn-sec" style="flex:1;font-size:10px;padding:5px 4px;" onclick="App.manageMicroSteps('${h.id}')">
                                🎯
                            </button>
                            <button class="btn-sec" style="flex:1;font-size:10px;padding:5px 4px;" onclick="App.editHabit('${h.id}')">
                                ✏️
                            </button>
                            <button class="btn-sec" style="flex:1;font-size:10px;padding:5px 4px;color:var(--danger);" onclick="App.deleteHabit('${h.id}')">
                                🗑️
                            </button>
                        </div>
                    </div>`;
                });
            }
        } else if (sub === 'reflections') {
            html += this.renderReflections();
        } else if (sub === 'journal') {
            html += this.renderJournal();
        } else if (sub === 'reviews') {
            html += this.renderReviews();
        } else if (sub === 'custom') {
            const d = this.customBlueprintData || this.getEmptyCustomBlueprintData();
            
            html += `
                <div class="info-box">
                    <div style="font-weight:700;font-size:15px;margin-bottom:8px;color:var(--blue);">🤖 Custom Blueprint Generator</div>
                    <p style="font-size:12px;color:var(--dim);line-height:1.6;">
                        Fill in your personal data below, then click "Generate Custom Prompt" to create a personalized AI prompt. 
                        Copy the prompt, paste it into ChatGPT or Claude, and get your complete 60-cycle blueprint in JSON format.
                    </p>
                </div>

                <div class="card">
                    <div style="display:flex;align-items:center;margin-bottom:20px;">
                        <span class="step-number">1</span>
                        <span style="font-weight:700;font-size:16px;">Fill Your Data</span>
                    </div>

                    <label>Your Name</label>
                    <div class="helper-text">Enter your full name or preferred identifier (e.g., "SvK", "John Smith")</div>
                    <input type="text" id="custom-name" placeholder="e.g., SvK" value="${esc(d.name)}">

                    <label>15-Year Vision Statement</label>
                    <div class="helper-text">Describe your ultimate life vision - what you want to achieve in 15 years. Be specific, ambitious, and authentic.</div>
                    <textarea id="custom-vision" placeholder="I will become... In return, I will give... My legacy will be...">${esc(d.vision)}</textarea>

                    <label>Timeline (Years)</label>
                    <div class="helper-text">Number of years for your blueprint (typically 15)</div>
                    <input type="number" id="custom-years" placeholder="15" value="${esc(d.years)}" min="1" max="30">

                    <label>Domain 1 - Primary Focus Area</label>
                    <div class="helper-text">Your main life domain (e.g., "Hollywood Career", "Tech Entrepreneurship", "Financial Independence")</div>
                    <input type="text" id="custom-domain1" placeholder="e.g., Hollywood Superstar Career" value="${esc(d.domain1)}">

                    <label>Domain 2 - Secondary Focus Area</label>
                    <div class="helper-text">Second important area of life (e.g., "Wealth Building", "Health & Fitness", "Relationships")</div>
                    <input type="text" id="custom-domain2" placeholder="e.g., Subscriber Base & Net Worth" value="${esc(d.domain2)}">

                    <label>Domain 3 - Tertiary Focus Area</label>
                    <div class="helper-text">Third area of focus (e.g., "Global Impact", "Creative Projects", "Family Legacy")</div>
                    <input type="text" id="custom-domain3" placeholder="e.g., Global Education System" value="${esc(d.domain3)}">

                    <label>Key Milestone 1 (Early Phase)</label>
                    <div class="helper-text">A major milestone you'll achieve in the first 1-3 years</div>
                    <input type="text" id="custom-milestone1" placeholder="e.g., Secure professional acting representation" value="${esc(d.milestone1)}">

                    <label>Key Milestone 2 (Mid Phase)</label>
                    <div class="helper-text">A major milestone you'll achieve in years 4-8</div>
                    <input type="text" id="custom-milestone2" placeholder="e.g., Land lead role in major production" value="${esc(d.milestone2)}">

                    <label>Key Milestone 3 (Late Phase)</label>
                    <div class="helper-text">A major milestone you'll achieve in years 9-15</div>
                    <input type="text" id="custom-milestone3" placeholder="e.g., Establish global academy network" value="${esc(d.milestone3)}">

                    <label>Daily Habit 1</label>
                    <div class="helper-text">A core daily practice that supports your vision</div>
                    <input type="text" id="custom-habit1" placeholder="e.g., 2-hour acting practice daily" value="${esc(d.habit1)}">

                    <label>Daily Habit 2</label>
                    <div class="helper-text">Second essential daily habit</div>
                    <input type="text" id="custom-habit2" placeholder="e.g., Physical training 6 days/week" value="${esc(d.habit2)}">

                    <label>Daily Habit 3</label>
                    <div class="helper-text">Third daily habit for sustained success</div>
                    <input type="text" id="custom-habit3" placeholder="e.g., Meditation 30 minutes daily" value="${esc(d.habit3)}">
                </div>

                <div class="card">
                    <div style="display:flex;align-items:center;margin-bottom:16px;">
                        <span class="step-number">2</span>
                        <span style="font-weight:700;font-size:16px;">Generate AI Prompt</span>
                    </div>
                    <button class="btn" onclick="App.generateCustomPrompt()">✨ Generate Custom Prompt</button>
                </div>

                ${this.customPrompt ? `
                    <div class="card">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                            <div style="display:flex;align-items:center;">
                                <span class="step-number">3</span>
                                <span style="font-weight:700;font-size:16px;">Your Custom Prompt</span>
                            </div>
                            <button class="btn-sec" onclick="App.copyPromptToClipboard()">📋 Copy</button>
                        </div>
                        <div class="prompt-box" id="custom-prompt">${esc(this.customPrompt)}</div>
                    </div>

                    <div class="warning-box">
                        <div style="font-weight:700;margin-bottom:8px;color:var(--warn);">⚠️ Next Steps:</div>
                        <ol style="font-size:12px;color:var(--dim);line-height:1.8;padding-left:20px;">
                            <li>Copy the prompt above (click "📋 Copy" button)</li>
                            <li>Open ChatGPT (GPT-4) or Claude (Sonnet/Opus)</li>
                            <li>Paste the entire prompt</li>
                            <li>AI will generate your complete 60-cycle blueprint in JSON</li>
                            <li>Copy the JSON output</li>
                            <li>Go to BUILD → Stats → Import Blueprint</li>
                            <li>Paste JSON and start executing!</li>
                        </ol>
                    </div>
                ` : ''}

                <div class="info-box" style="margin-top:20px;">
                    <div style="font-weight:700;margin-bottom:8px;color:var(--blue);">💡 Pro Tips:</div>
                    <ul style="font-size:12px;color:var(--dim);line-height:1.8;padding-left:20px;">
                        <li>Be specific in your vision - the more detailed, the better the AI blueprint</li>
                        <li>Include concrete numbers and timelines in milestones</li>
                        <li>Choose habits that directly support your domains</li>
                        <li>Use ChatGPT-4 or Claude Opus for best results</li>
                        <li>Review the generated JSON before importing - you can edit it</li>
                        <li>Save your generated JSON as backup before importing</li>
                    </ul>
                </div>
            `;
        }
        
        return html;
    },

    // VIEW: VAULT
// ENHANCED VIEW VAULT FUNCTION
viewVault() {
    // Initialize data structures
    if (!this.data.vaultLearn) this.data.vaultLearn = { ideas: [], notes: [], books: [], skills: [] };
    if (!this.data.vaultEarn) this.data.vaultEarn = { strat: [], exec: [], leverage: [], contacts: [] };
    if (!this.data.vaultPromotions) this.data.vaultPromotions = [];
    if (!this.data.vaultSettings) this.data.vaultSettings = { viewMode: 'card', sortBy: 'recent', showAnalytics: true };
    
    const mainTab = this.sub.vaultMain || 'learn';
    const settings = this.data.vaultSettings;
    
    let html = `
        <div class="segment">
            <button class="segment-btn ${mainTab === 'learn' ? 'active' : ''}" onclick="App.sub.vaultMain='learn';App.sub.vault='ideas';App.render()">🧠 LEARN</button>
            <button class="segment-btn ${mainTab === 'earn' ? 'active' : ''}" onclick="App.sub.vaultMain='earn';App.sub.vault='strat';App.render()">💰 EARN</button>
        </div>`;
    
    // Calculate comprehensive stats
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    if (mainTab === 'learn') {
        const allItems = (this.data.vaultLearn.ideas || []).length + (this.data.vaultLearn.notes || []).length + 
                        (this.data.vaultLearn.books || []).length + (this.data.vaultLearn.skills || []).length;
        const weekItems = ['ideas', 'notes', 'books', 'skills'].reduce((sum, key) => 
            sum + (this.data.vaultLearn[key] || []).filter(i => new Date(i.created).getTime() > weekAgo).length, 0);
        const monthItems = ['ideas', 'notes', 'books', 'skills'].reduce((sum, key) => 
            sum + (this.data.vaultLearn[key] || []).filter(i => new Date(i.created).getTime() > monthAgo).length, 0);
        const promoted = (this.data.vaultPromotions || []).filter(p => new Date(p.created).getTime() > weekAgo).length;
        const starred = ['ideas', 'notes', 'books', 'skills'].reduce((sum, key) => 
            sum + (this.data.vaultLearn[key] || []).filter(i => i.starred).length, 0);
        
        // Enhanced Analytics Dashboard
        if (settings.showAnalytics) {
            html += `
                <div class="vault-analytics">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <h3 style="color:var(--accent);font-size:16px;margin:0;">📊 LEARN Analytics</h3>
                        <button class="vault-action-btn" onclick="App.toggleVaultAnalytics()" style="padding:4px 8px;font-size:10px;">
                            Hide
                        </button>
                    </div>
                    <div class="vault-stat-row">
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${allItems}</div>
                            <div class="vault-stat-mini-label">Total Items</div>
                        </div>
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${weekItems}</div>
                            <div class="vault-stat-mini-label">This Week</div>
                        </div>
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${monthItems}</div>
                            <div class="vault-stat-mini-label">This Month</div>
                        </div>
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${promoted}</div>
                            <div class="vault-stat-mini-label">Promoted</div>
                        </div>
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${starred}</div>
                            <div class="vault-stat-mini-label">Starred</div>
                        </div>
                    </div>
                </div>`;
        } else {
            html += `
                <div style="text-align:center;margin-bottom:16px;">
                    <button class="btn-sec" onclick="App.toggleVaultAnalytics()">📊 Show Analytics</button>
                </div>`;
        }
        
        html += `
            <div class="card" style="margin-bottom:14px;padding:14px;">
                <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--accent);">☀️ Morning Flow (5 min)</div>
                <div style="font-size:12px;color:var(--dim);line-height:1.7;">
                    Random thought → IDEA<br>
                    Thing you noticed → NOTE<br>
                    Book insight → BOOK<br>
                    Skill gap → SKILL
                </div>
            </div>`;
        
        const sub = this.sub.vault || 'ideas';
        html += `
            <div class="segment">
                <button class="segment-btn ${sub === 'ideas' ? 'active' : ''}" onclick="App.sub.vault='ideas';App.render()">💡 IDEA</button>
                <button class="segment-btn ${sub === 'notes' ? 'active' : ''}" onclick="App.sub.vault='notes';App.render()">📝 NOTE</button>
                <button class="segment-btn ${sub === 'books' ? 'active' : ''}" onclick="App.sub.vault='books';App.render()">📚 BOOK</button>
                <button class="segment-btn ${sub === 'skills' ? 'active' : ''}" onclick="App.sub.vault='skills';App.render()">🎯 SKILL</button>
            </div>`;
        
        html += this.renderLearnSectionEnhanced(sub);
        
    } else {
        const allItems = (this.data.vaultEarn.strat || []).length + (this.data.vaultEarn.exec || []).length + 
                        (this.data.vaultEarn.leverage || []).length + (this.data.vaultEarn.contacts || []).length;
        const weekItems = ['strat', 'exec', 'leverage', 'contacts'].reduce((sum, key) => 
            sum + (this.data.vaultEarn[key] || []).filter(i => new Date(i.created).getTime() > weekAgo).length, 0);
        const monthItems = ['strat', 'exec', 'leverage', 'contacts'].reduce((sum, key) => 
            sum + (this.data.vaultEarn[key] || []).filter(i => new Date(i.created).getTime() > monthAgo).length, 0);
        const executed = (this.data.vaultEarn.exec || []).filter(e => e.completed).length;
        const starred = ['strat', 'exec', 'leverage', 'contacts'].reduce((sum, key) => 
            sum + (this.data.vaultEarn[key] || []).filter(i => i.starred).length, 0);
        
        if (settings.showAnalytics) {
            html += `
                <div class="vault-analytics">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <h3 style="color:var(--success);font-size:16px;margin:0;">💰 EARN Analytics</h3>
                        <button class="vault-action-btn" onclick="App.toggleVaultAnalytics()" style="padding:4px 8px;font-size:10px;">
                            Hide
                        </button>
                    </div>
                    <div class="vault-stat-row">
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${allItems}</div>
                            <div class="vault-stat-mini-label">Total Items</div>
                        </div>
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${weekItems}</div>
                            <div class="vault-stat-mini-label">This Week</div>
                        </div>
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${monthItems}</div>
                            <div class="vault-stat-mini-label">This Month</div>
                        </div>
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${executed}</div>
                            <div class="vault-stat-mini-label">Executed</div>
                        </div>
                        <div class="vault-stat-mini">
                            <div class="vault-stat-mini-val">${starred}</div>
                            <div class="vault-stat-mini-label">Starred</div>
                        </div>
                    </div>
                </div>`;
        } else {
            html += `
                <div style="text-align:center;margin-bottom:16px;">
                    <button class="btn-sec" onclick="App.toggleVaultAnalytics()">📊 Show Analytics</button>
                </div>`;
        }
        
        html += `
            <div class="card" style="margin-bottom:14px;padding:14px;">
                <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--success);">🌙 Evening Flow (10 min)</div>
                <div style="font-size:12px;color:var(--dim);line-height:1.7;">
                    IDEA → STRAT playbook<br>
                    NOTE → EXEC action<br>
                    BOOK → SKILL practice<br>
                    Realization → LEVERAGE target
                </div>
            </div>`;
        
        const sub = this.sub.vault || 'strat';
        html += `
            <div class="segment">
                <button class="segment-btn ${sub === 'strat' ? 'active' : ''}" onclick="App.sub.vault='strat';App.render()">⚡ STRAT</button>
                <button class="segment-btn ${sub === 'exec' ? 'active' : ''}" onclick="App.sub.vault='exec';App.render()">✅ EXEC</button>
                <button class="segment-btn ${sub === 'leverage' ? 'active' : ''}" onclick="App.sub.vault='leverage';App.render()">🚀 LEVERAGE</button>
                <button class="segment-btn ${sub === 'contacts' ? 'active' : ''}" onclick="App.sub.vault='contacts';App.render()">👤 CONTACT</button>
            </div>`;
        
        html += this.renderEarnSectionEnhanced(sub);
    }
    
    return html;
},

// ENHANCED LEARN SECTION RENDERING
renderLearnSectionEnhanced(sub) {
    let html = '';
    let items = this.data.vaultLearn[sub] || [];
    const settings = this.data.vaultSettings;
    
    const labels = {
        ideas: { title: '💡 Ideas', desc: 'Original thinking, mental models, hypotheses', color: 'var(--accent)' },
        notes: { title: '📝 Notes', desc: 'Observations, reflections, raw insights', color: 'var(--blue)' },
        books: { title: '📚 Books', desc: 'Compressed knowledge, frameworks, actionable insights', color: 'var(--purple)' },
        skills: { title: '🎯 Skills', desc: 'Skill levels, weaknesses, practice systems', color: 'var(--success)' }
    };
    
    const label = labels[sub];
    
    // Get all unique tags for this category
    const allTags = [...new Set(items.flatMap(i => i.tags || []))];
    
    // Enhanced Toolbar with all new features
    html += `
        <div class="vault-toolbar">
            <button class="btn" onclick="App.addLearnItemEnhanced('${sub}')" style="flex-shrink:0;">+ Add ${label.title}</button>
            
            <div style="flex:1;min-width:200px;max-width:400px;position:relative;" class="vault-search-bar">
                <span class="vault-search-icon">🔍</span>
                <input type="text" class="vault-search-input" placeholder="Search ${sub}..." 
                       oninput="App.searchVault(this.value, 'learn', '${sub}')" value="${settings.searchQuery || ''}">
            </div>
            
            <select class="vault-sort-dropdown" onchange="App.sortVault(this.value, 'learn', '${sub}')">
                <option value="recent" ${settings.sortBy === 'recent' ? 'selected' : ''}>Recent First</option>
                <option value="oldest" ${settings.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                <option value="title" ${settings.sortBy === 'title' ? 'selected' : ''}>Title A-Z</option>
                <option value="importance" ${settings.sortBy === 'importance' ? 'selected' : ''}>Importance</option>
            </select>
            
            <button class="vault-action-btn" onclick="App.toggleVaultFilters()" title="Advanced Filters">
                🎛️ ${settings.showFilters ? 'Hide' : 'Show'} Filters
            </button>
            
            <button class="vault-action-btn" onclick="App.toggleVaultView()" title="Toggle View">
                ${settings.viewMode === 'card' ? '📋' : settings.viewMode === 'compact' ? '🗂️' : '📅'} 
            </button>
            
            <button class="vault-action-btn" onclick="App.toggleBatchMode('learn', '${sub}')" title="Batch Operations">
                ${settings.batchMode ? '✓' : '☐'} Batch
            </button>
            
            <button class="vault-action-btn" onclick="App.bulkImportVault('learn', '${sub}')" title="Bulk Import">
                📥 Import
            </button>
        </div>`;
    
    // Advanced Filters Panel
    if (settings.showFilters) {
        html += `
            <div class="vault-filters-panel active">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
                    <div class="vault-filter-group">
                        <label class="vault-filter-label">Tags</label>
                        <div class="vault-filter-chips">
                            ${allTags.map(tag => `
                                <div class="vault-filter-chip ${settings.selectedTags.includes(tag) ? 'active' : ''}" 
                                     onclick="App.toggleTagFilter('${esc(tag)}', 'learn', '${sub}')">
                                    #${esc(tag)}
                                </div>
                            `).join('')}
                            ${allTags.length === 0 ? '<span style="font-size:11px;color:var(--dim);">No tags yet</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="vault-filter-group">
                        <label class="vault-filter-label">Importance</label>
                        <div class="vault-filter-chips">
                            ${['high', 'medium', 'low'].map(imp => `
                                <div class="vault-filter-chip ${settings.importanceFilter.includes(imp) ? 'active' : ''}"
                                     onclick="App.toggleImportanceFilter('${imp}', 'learn', '${sub}')">
                                    ${imp === 'high' ? '🔴' : imp === 'medium' ? '🟡' : '🔵'} ${imp.toUpperCase()}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="vault-filter-group">
                        <label class="vault-filter-label">Quick Filters</label>
                        <div class="vault-filter-chips">
                            <div class="vault-filter-chip ${settings.starredOnly ? 'active' : ''}"
                                 onclick="App.toggleStarredFilter('learn', '${sub}')">
                                ⭐ Starred Only
                            </div>
                            <div class="vault-filter-chip ${settings.pinnedOnly ? 'active' : ''}"
                                 onclick="App.togglePinnedFilter('learn', '${sub}')">
                                📌 Pinned Only
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top:12px;text-align:right;">
                    <button class="btn-sec" onclick="App.clearAllFilters('learn', '${sub}')" style="font-size:11px;padding:6px 12px;">
                        Clear All Filters
                    </button>
                </div>
            </div>`;
    }
    
    // Filter items based on search
    if (settings.searchQuery) {
        const query = settings.searchQuery.toLowerCase();
        items = items.filter(i => 
            i.title.toLowerCase().includes(query) || 
            (i.content && i.content.toLowerCase().includes(query)) ||
            (i.tags && i.tags.some(t => t.toLowerCase().includes(query)))
        );
    }
    
    // Sort items
    items = this.sortVaultItems(items, settings.sortBy);
    
    // Empty state
    if (items.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-state-icon">${label.title.split(' ')[0]}</div>
                <p>${settings.searchQuery ? 'No matching items found' : label.desc}</p>
                ${settings.searchQuery ? `<button class="btn-sec" onclick="App.clearVaultSearch('learn', '${sub}')">Clear Search</button>` : ''}
            </div>`;
        return html;
    }
    
    // Render items
    items.slice().reverse().forEach((item, idx) => {
        const date = new Date(item.created).toLocaleDateString();
        const modified = item.modified ? new Date(item.modified).toLocaleDateString() : null;
        const importance = item.importance || 'low';
        const importanceClass = `vault-importance-${importance}`;
        
        html += `
            <div class="vault-item-card ${item.starred ? 'starred' : ''} ${item.pinned ? 'pinned' : ''} ${importanceClass} ${settings.batchMode ? 'selectable' : ''} ${settings.batchMode && settings.selectedItems?.includes(`vaultLearn-${sub}-${item.id}`) ? 'selected' : ''}" 
                 style="animation-delay:${idx * 0.05}s;"
                 data-item-id="${item.id}"
                 ${settings.batchMode ? `onclick="App.toggleItemSelection('vaultLearn', '${sub}', '${item.id}')"` : ''}>
                <div class="vault-item-header">
                    <div class="vault-item-title">${esc(item.title)}</div>
                </div>
                
                <div class="vault-item-meta">
                    <span>📅 ${date}</span>
                    ${modified ? `<span>✏️ ${modified}</span>` : ''}
                    ${item.source ? `<span>🔗 ${esc(item.source)}</span>` : ''}
                    ${item.importance !== 'low' ? `<span style="color:${importance === 'high' ? 'var(--danger)' : 'var(--warn)'};">⭐ ${importance.toUpperCase()}</span>` : ''}
                    ${item.pinned ? `<span style="color:var(--accent);">📌 PINNED</span>` : ''}
                </div>
                
                <div class="vault-item-content">${esc(item.content || '')}</div>
                
                ${item.tags && item.tags.length > 0 ? `
                    <div class="vault-item-tags">
                        ${item.tags.map(tag => `<span class="vault-tag">#${esc(tag)}</span>`).join('')}
                    </div>` : ''}
                
                ${item.linkedTo && item.linkedTo.length > 0 ? `
                    <div class="vault-linked-items">
                        <div style="font-size:11px;color:var(--dim);font-weight:600;margin-bottom:6px;">
                            🔗 LINKED ITEMS (${item.linkedTo.length})
                        </div>
                        ${item.linkedTo.slice(0, 3).map(linkKey => {
                            const [vType, vCat, vId] = linkKey.split('-');
                            const linkedItem = this.data[vType][vCat]?.find(i => i.id === vId);
                            return linkedItem ? `
                                <div class="vault-linked-item" onclick="App.navigateToLinkedItem('${linkKey}');event.stopPropagation();">
                                    <span>${vCat === 'ideas' ? '💡' : vCat === 'notes' ? '📝' : vCat === 'books' ? '📚' : vCat === 'skills' ? '🎯' : vCat === 'strat' ? '⚡' : vCat === 'exec' ? '✅' : vCat === 'leverage' ? '🚀' : '👤'}</span>
                                    <span>${esc(linkedItem.title)}</span>
                                </div>
                            ` : '';
                        }).join('')}
                        ${item.linkedTo.length > 3 ? `<div style="font-size:10px;color:var(--dim);margin-top:4px;">+${item.linkedTo.length - 3} more...</div>` : ''}
                    </div>` : ''}
                
                <div class="vault-item-footer">
                    <div class="vault-item-actions">
                        <button class="vault-action-btn" onclick="App.togglePin('vaultLearn', '${sub}', '${item.id}');event.stopPropagation();" title="Pin">
                            ${item.pinned ? '📌' : '📍'}
                        </button>
                        <button class="vault-action-btn" onclick="App.toggleStar('learn', '${sub}', '${item.id}');event.stopPropagation();" title="Star">
                            ${item.starred ? '⭐' : '☆'}
                        </button>
                        <button class="vault-action-btn" onclick="App.linkItems('vaultLearn', '${sub}', '${item.id}');event.stopPropagation();" title="Link">
                            🔗
                        </button>
                        <button class="vault-action-btn" onclick="App.editLearnItem('${sub}', '${item.id}');event.stopPropagation();" title="Edit">
                            ✏️
                        </button>
                        <button class="vault-action-btn" onclick="App.exportVaultItem('learn', '${sub}', '${item.id}');event.stopPropagation();" title="Export">
                            📤
                        </button>
                        <button class="vault-action-btn danger" onclick="App.deleteLearnItem('${sub}', '${item.id}');event.stopPropagation();" title="Delete">
                            🗑️
                        </button>
                    </div>
                    <button class="btn-sec btn-success" onclick="App.promoteToEarnEnhanced('${sub}', '${item.id}');event.stopPropagation();" style="font-size:11px;padding:6px 10px;">
                        → Promote to EARN
                    </button>
                </div>
            </div>`;
    });
    
    return html;
},

// ENHANCED EARN SECTION RENDERING
renderEarnSectionEnhanced(sub) {
    let html = '';
    let items = this.data.vaultEarn[sub] || [];
    const settings = this.data.vaultSettings;
    
    const labels = {
        strat: { title: '⚡ Strategy', desc: 'Playbooks, rules, checklists, systems', color: 'var(--accent)' },
        exec: { title: '✅ Execution', desc: 'Action logs, wins/losses, post-mortems', color: 'var(--success)' },
        leverage: { title: '🚀 Leverage', desc: 'Key people, gatekeepers, opportunities', color: 'var(--purple)' },
        contacts: { title: '👤 Contacts', desc: 'Network, relationships, interaction history', color: 'var(--blue)' }
    };
    
    const label = labels[sub];
    
    // Toolbar
    html += `
        <div class="vault-toolbar">
            <button class="btn" onclick="App.addEarnItemEnhanced('${sub}')" style="flex-shrink:0;">+ Add ${label.title}</button>
            <div style="flex:1;min-width:200px;max-width:400px;position:relative;" class="vault-search-bar">
                <span class="vault-search-icon">🔍</span>
                <input type="text" class="vault-search-input" placeholder="Search ${sub}..." 
                       oninput="App.searchVault(this.value, 'earn', '${sub}')" value="${settings.searchQuery || ''}">
            </div>
            <select class="vault-sort-dropdown" onchange="App.sortVault(this.value, 'earn', '${sub}')">
                <option value="recent" ${settings.sortBy === 'recent' ? 'selected' : ''}>Recent First</option>
                <option value="oldest" ${settings.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                <option value="title" ${settings.sortBy === 'title' ? 'selected' : ''}>Title A-Z</option>
                <option value="importance" ${settings.sortBy === 'importance' ? 'selected' : ''}>Importance</option>
            </select>
        </div>`;
    
    // Filter items based on search
    if (settings.searchQuery) {
        const query = settings.searchQuery.toLowerCase();
        items = items.filter(i => 
            i.title.toLowerCase().includes(query) || 
            (i.content && i.content.toLowerCase().includes(query)) ||
            (i.tags && i.tags.some(t => t.toLowerCase().includes(query)))
        );
    }
    
    // Sort items
    items = this.sortVaultItems(items, settings.sortBy);
    
    // Empty state
    if (items.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-state-icon">${label.title.split(' ')[0]}</div>
                <p>${settings.searchQuery ? 'No matching items found' : label.desc}</p>
                ${settings.searchQuery ? `<button class="btn-sec" onclick="App.clearVaultSearch('earn', '${sub}')">Clear Search</button>` : ''}
            </div>`;
        return html;
    }
    
    // Render items
    items.slice().reverse().forEach((item, idx) => {
        const date = new Date(item.created).toLocaleDateString();
        const modified = item.modified ? new Date(item.modified).toLocaleDateString() : null;
        const isExec = sub === 'exec';
        const importance = item.importance || 'low';
        const importanceClass = `vault-importance-${importance}`;
        
        html += `
            <div class="vault-item-card ${item.starred ? 'starred' : ''} ${importanceClass}" style="animation-delay:${idx * 0.05}s;">
                ${item.promotedFrom ? `
                    <div style="display:inline-block;padding:4px 10px;background:var(--accent);color:var(--void);
                         border-radius:6px;font-size:10px;font-weight:700;margin-bottom:10px;">
                        ↑ FROM ${item.promotedFrom.toUpperCase()}
                    </div>` : ''}
                
                <div class="vault-item-header">
                    <div class="vault-item-title">${esc(item.title)}</div>
                </div>
                
                <div class="vault-item-meta">
                    <span>📅 ${date}</span>
                    ${modified ? `<span>✏️ ${modified}</span>` : ''}
                    ${item.source ? `<span>🔗 ${esc(item.source)}</span>` : ''}
                    ${item.importance !== 'low' ? `<span style="color:${importance === 'high' ? 'var(--danger)' : 'var(--warn)'};">⭐ ${importance.toUpperCase()}</span>` : ''}
                    ${isExec && item.completed ? `<span style="color:var(--success);">✓ COMPLETED</span>` : ''}
                </div>
                
                <div class="vault-item-content">${esc(item.content || '')}</div>
                
                ${item.tags && item.tags.length > 0 ? `
                    <div class="vault-item-tags">
                        ${item.tags.map(tag => `<span class="vault-tag">#${esc(tag)}</span>`).join('')}
                    </div>` : ''}
                
                ${item.linkedTo && item.linkedTo.length > 0 ? `
                    <div style="margin-bottom:12px;font-size:11px;color:var(--dim);">
                        🔗 Linked: ${item.linkedTo.length} item(s)
                    </div>` : ''}
                
                <div class="vault-item-footer">
                    <div class="vault-item-actions">
                        <button class="vault-action-btn" onclick="App.toggleStar('earn', '${sub}', '${item.id}')" title="Star">
                            ${item.starred ? '⭐' : '☆'}
                        </button>
                        <button class="vault-action-btn" onclick="App.editEarnItem('${sub}', '${item.id}')" title="Edit">
                            ✏️
                        </button>
                        <button class="vault-action-btn" onclick="App.exportVaultItem('earn', '${sub}', '${item.id}')" title="Export">
                            📤
                        </button>
                        <button class="vault-action-btn danger" onclick="App.deleteEarnItem('${sub}', '${item.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                    ${isExec && !item.completed ? `
                        <button class="btn-sec btn-success" onclick="App.markExecComplete('${item.id}')" style="font-size:11px;padding:6px 10px;">
                            ✓ Complete
                        </button>` : ''}
                </div>
            </div>`;
    });
    
    return html;
},

// ENHANCED ADD LEARN ITEM WITH METADATA
addLearnItemEnhanced(type) {
    document.getElementById('modal-body').innerHTML = `
        <h3 style="margin-bottom:12px;color:var(--accent);">Add ${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
        <input id="learn-title" placeholder="Title..." style="margin-bottom:12px;">
        <textarea id="learn-content" placeholder="Content (Markdown supported)..." rows="6" style="margin-bottom:12px;"></textarea>
        
        <input id="learn-tags" placeholder="Tags (comma-separated)..." style="margin-bottom:12px;">
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <select id="learn-importance" style="margin:0;">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
            </select>
            <div style="display:flex;align-items:center;gap:8px;background:var(--sub);padding:10px;border-radius:8px;border:1px solid var(--border);">
                <input type="checkbox" id="learn-starred" style="margin:0;width:auto;">
                <label for="learn-starred" style="margin:0;font-size:13px;">⭐ Star Item</label>
            </div>
        </div>
        
        <div style="display:flex;align-items:center;gap:8px;background:var(--sub);padding:10px;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;">
            <input type="checkbox" id="learn-pinned" style="margin:0;width:auto;">
            <label for="learn-pinned" style="margin:0;font-size:13px;">📌 Pin to Top</label>
        </div>
        
        <input id="learn-source" placeholder="Source (optional)..." style="margin-bottom:12px;">
        
        <button class="btn" onclick="App.saveLearnItemEnhanced('${type}')">Save</button>`;
    document.getElementById('modal').classList.add('open');
    setTimeout(() => document.getElementById('learn-title')?.focus(), 80);
},

saveLearnItemEnhanced(type) {
    const title = document.getElementById('learn-title')?.value?.trim();
    const content = document.getElementById('learn-content')?.value?.trim();
    const tagsInput = document.getElementById('learn-tags')?.value?.trim();
    const importance = document.getElementById('learn-importance')?.value || 'low';
    const starred = document.getElementById('learn-starred')?.checked || false;
    const pinned = document.getElementById('learn-pinned')?.checked || false;
    const source = document.getElementById('learn-source')?.value?.trim();
    
    if (!title || !content) { this.toast('⚠️ Fill title and content'); return; }
    
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    
    if (!this.data.vaultLearn[type]) this.data.vaultLearn[type] = [];
    this.data.vaultLearn[type].push({
        id: this.genId(),
        title,
        content,
        tags,
        importance,
        starred,
        pinned,
        source: source || '',
        created: new Date().toISOString(),
        modified: null,
        linkedTo: []
    });
    
    this.save(); this.closeModal(); this.render();
    this.toast('✓ Added to LEARN');
},

// ENHANCED ADD EARN ITEM
addEarnItemEnhanced(type) {
    document.getElementById('modal-body').innerHTML = `
        <h3 style="margin-bottom:12px;color:var(--success);">Add ${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
        <input id="earn-title" placeholder="Title..." style="margin-bottom:12px;">
        <textarea id="earn-content" placeholder="Content..." rows="6" style="margin-bottom:12px;"></textarea>
        
        <input id="earn-tags" placeholder="Tags (comma-separated)..." style="margin-bottom:12px;">
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <select id="earn-importance" style="margin:0;">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
            </select>
            <div style="display:flex;align-items:center;gap:8px;background:var(--sub);padding:10px;border-radius:8px;border:1px solid var(--border);">
                <input type="checkbox" id="earn-starred" style="margin:0;width:auto;">
                <label for="earn-starred" style="margin:0;font-size:13px;">⭐ Star Item</label>
            </div>
        </div>
        
        <input id="earn-source" placeholder="Source (optional)..." style="margin-bottom:12px;">
        
        <button class="btn" onclick="App.saveEarnItemEnhanced('${type}')">Save</button>`;
    document.getElementById('modal').classList.add('open');
    setTimeout(() => document.getElementById('earn-title')?.focus(), 80);
},

saveEarnItemEnhanced(type) {
    const title = document.getElementById('earn-title')?.value?.trim();
    const content = document.getElementById('earn-content')?.value?.trim();
    const tagsInput = document.getElementById('earn-tags')?.value?.trim();
    const importance = document.getElementById('earn-importance')?.value || 'low';
    const starred = document.getElementById('earn-starred')?.checked || false;
    const source = document.getElementById('earn-source')?.value?.trim();
    
    if (!title || !content) { this.toast('⚠️ Fill title and content'); return; }
    
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    
    if (!this.data.vaultEarn[type]) this.data.vaultEarn[type] = [];
    this.data.vaultEarn[type].push({
        id: this.genId(),
        title,
        content,
        tags,
        importance,
        starred,
        source: source || '',
        completed: false,
        created: new Date().toISOString(),
        modified: null,
        linkedTo: []
    });
    
    this.save(); this.closeModal(); this.render();
    this.toast('✓ Added to EARN');
},

// EDIT LEARN ITEM
editLearnItem(type, itemId) {
    const item = this.data.vaultLearn[type]?.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('modal-body').innerHTML = `
        <h3 style="margin-bottom:12px;color:var(--accent);">Edit ${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
        <input id="learn-title" placeholder="Title..." value="${esc(item.title)}" style="margin-bottom:12px;">
        <textarea id="learn-content" placeholder="Content..." rows="6" style="margin-bottom:12px;">${esc(item.content || '')}</textarea>
        
        <input id="learn-tags" placeholder="Tags (comma-separated)..." value="${(item.tags || []).join(', ')}" style="margin-bottom:12px;">
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <select id="learn-importance" style="margin:0;">
                <option value="low" ${item.importance === 'low' ? 'selected' : ''}>Low Priority</option>
                <option value="medium" ${item.importance === 'medium' ? 'selected' : ''}>Medium Priority</option>
                <option value="high" ${item.importance === 'high' ? 'selected' : ''}>High Priority</option>
            </select>
            <div style="display:flex;align-items:center;gap:8px;background:var(--sub);padding:10px;border-radius:8px;border:1px solid var(--border);">
                <input type="checkbox" id="learn-starred" ${item.starred ? 'checked' : ''} style="margin:0;width:auto;">
                <label for="learn-starred" style="margin:0;font-size:13px;">⭐ Star Item</label>
            </div>
        </div>
        
        <input id="learn-source" placeholder="Source (optional)..." value="${esc(item.source || '')}" style="margin-bottom:12px;">
        
        <button class="btn" onclick="App.updateLearnItem('${type}', '${itemId}')">Update</button>`;
    document.getElementById('modal').classList.add('open');
    setTimeout(() => document.getElementById('learn-title')?.focus(), 80);
},

updateLearnItem(type, itemId) {
    const item = this.data.vaultLearn[type]?.find(i => i.id === itemId);
    if (!item) return;
    
    const title = document.getElementById('learn-title')?.value?.trim();
    const content = document.getElementById('learn-content')?.value?.trim();
    const tagsInput = document.getElementById('learn-tags')?.value?.trim();
    const importance = document.getElementById('learn-importance')?.value || 'low';
    const starred = document.getElementById('learn-starred')?.checked || false;
    const source = document.getElementById('learn-source')?.value?.trim();
    
    if (!title || !content) { this.toast('⚠️ Fill title and content'); return; }
    
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    
    item.title = title;
    item.content = content;
    item.tags = tags;
    item.importance = importance;
    item.starred = starred;
    item.source = source;
    item.modified = new Date().toISOString();
    
    this.save(); this.closeModal(); this.render();
    this.toast('✓ Item updated');
},

// EDIT EARN ITEM
editEarnItem(type, itemId) {
    const item = this.data.vaultEarn[type]?.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('modal-body').innerHTML = `
        <h3 style="margin-bottom:12px;color:var(--success);">Edit ${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
        <input id="earn-title" placeholder="Title..." value="${esc(item.title)}" style="margin-bottom:12px;">
        <textarea id="earn-content" placeholder="Content..." rows="6" style="margin-bottom:12px;">${esc(item.content || '')}</textarea>
        
        <input id="earn-tags" placeholder="Tags (comma-separated)..." value="${(item.tags || []).join(', ')}" style="margin-bottom:12px;">
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <select id="earn-importance" style="margin:0;">
                <option value="low" ${item.importance === 'low' ? 'selected' : ''}>Low Priority</option>
                <option value="medium" ${item.importance === 'medium' ? 'selected' : ''}>Medium Priority</option>
                <option value="high" ${item.importance === 'high' ? 'selected' : ''}>High Priority</option>
            </select>
            <div style="display:flex;align-items:center;gap:8px;background:var(--sub);padding:10px;border-radius:8px;border:1px solid var(--border);">
                <input type="checkbox" id="earn-starred" ${item.starred ? 'checked' : ''} style="margin:0;width:auto;">
                <label for="earn-starred" style="margin:0;font-size:13px;">⭐ Star Item</label>
            </div>
        </div>
        
        <input id="earn-source" placeholder="Source (optional)..." value="${esc(item.source || '')}" style="margin-bottom:12px;">
        
        <button class="btn" onclick="App.updateEarnItem('${type}', '${itemId}')">Update</button>`;
    document.getElementById('modal').classList.add('open');
    setTimeout(() => document.getElementById('earn-title')?.focus(), 80);
},

updateEarnItem(type, itemId) {
    const item = this.data.vaultEarn[type]?.find(i => i.id === itemId);
    if (!item) return;
    
    const title = document.getElementById('earn-title')?.value?.trim();
    const content = document.getElementById('earn-content')?.value?.trim();
    const tagsInput = document.getElementById('earn-tags')?.value?.trim();
    const importance = document.getElementById('earn-importance')?.value || 'low';
    const starred = document.getElementById('earn-starred')?.checked || false;
    const source = document.getElementById('earn-source')?.value?.trim();
    
    if (!title || !content) { this.toast('⚠️ Fill title and content'); return; }
    
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    
    item.title = title;
    item.content = content;
    item.tags = tags;
    item.importance = importance;
    item.starred = starred;
    item.source = source;
    item.modified = new Date().toISOString();
    
    this.save(); this.closeModal(); this.render();
    this.toast('✓ Item updated');
},

// DELETE FUNCTIONS
deleteLearnItem(type, itemId) {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    
    this.data.vaultLearn[type] = this.data.vaultLearn[type].filter(i => i.id !== itemId);
    this.save(); this.render();
    this.toast('✓ Item deleted');
},

deleteEarnItem(type, itemId) {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    
    this.data.vaultEarn[type] = this.data.vaultEarn[type].filter(i => i.id !== itemId);
    this.save(); this.render();
    this.toast('✓ Item deleted');
},

// TOGGLE STAR
toggleStar(section, type, itemId) {
    const item = section === 'learn' ? 
        this.data.vaultLearn[type]?.find(i => i.id === itemId) :
        this.data.vaultEarn[type]?.find(i => i.id === itemId);
    
    if (!item) return;
    
    item.starred = !item.starred;
    item.modified = new Date().toISOString();
    
    this.save(); this.render();
    this.toast(item.starred ? '⭐ Item starred' : '☆ Star removed');
},

// ENHANCED PROMOTE TO EARN
promoteToEarnEnhanced(fromType, itemId) {
    const item = this.data.vaultLearn[fromType]?.find(i => i.id === itemId);
    if (!item) return;
    
    const promotionMap = { ideas: 'strat', notes: 'exec', books: 'skills', skills: 'leverage' };
    const toType = promotionMap[fromType] || 'strat';
    
    if (!confirm(`Promote to ${toType.toUpperCase()}?`)) return;
    
    if (!this.data.vaultEarn[toType]) this.data.vaultEarn[toType] = [];
    this.data.vaultEarn[toType].push({
        ...item,
        id: this.genId(),
        promotedFrom: fromType,
        completed: false,
        created: new Date().toISOString(),
        modified: null
    });
    
    // Remove from LEARN
    this.data.vaultLearn[fromType] = this.data.vaultLearn[fromType].filter(i => i.id !== itemId);
    
    // Track promotion
    if (!this.data.vaultPromotions) this.data.vaultPromotions = [];
    this.data.vaultPromotions.push({
        from: fromType,
        to: toType,
        created: new Date().toISOString()
    });
    
    this.save(); this.render();
    this.toast(`✓ Promoted to ${toType.toUpperCase()}`);
},

// SEARCH VAULT
searchVault(query, section, type) {
    this.data.vaultSettings.searchQuery = query;
    this.render();
},

clearVaultSearch(section, type) {
    this.data.vaultSettings.searchQuery = '';
    this.render();
},

// SORT VAULT
sortVault(sortBy, section, type) {
    this.data.vaultSettings.sortBy = sortBy;
    this.save(); this.render();
},

sortVaultItems(items, sortBy) {
    const sorted = [...items];
    
    switch(sortBy) {
        case 'recent':
            return sorted.sort((a, b) => new Date(b.created) - new Date(a.created));
        case 'oldest':
            return sorted.sort((a, b) => new Date(a.created) - new Date(b.created));
        case 'title':
            return sorted.sort((a, b) => a.title.localeCompare(b.title));
        case 'importance':
            const priority = { high: 3, medium: 2, low: 1 };
            return sorted.sort((a, b) => priority[b.importance || 'low'] - priority[a.importance || 'low']);
        default:
            return sorted;
    }
},

// TOGGLE ANALYTICS
toggleVaultAnalytics() {
    this.data.vaultSettings.showAnalytics = !this.data.vaultSettings.showAnalytics;
    this.save(); this.render();
},

// EXPORT VAULT ITEM
exportVaultItem(section, type, itemId) {
    const item = section === 'learn' ?
        this.data.vaultLearn[type]?.find(i => i.id === itemId) :
        this.data.vaultEarn[type]?.find(i => i.id === itemId);
    
    if (!item) return;
    
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vault-${type}-${item.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.toast('📤 Item exported');
},

    markExecComplete(itemId) {
        const item = this.data.vaultEarn.exec?.find(i => i.id === itemId);
        if (!item) return;
        
        item.completed = true;
        item.modified = new Date().toISOString();
        
        this.save(); this.render();
        this.celebrate('🎯', 'Executed!', 'Another win logged');
    },

    
    // BLUEPRINT IMPORT
    // CUSTOM BLUEPRINT GENERATOR FUNCTIONS
    generateCustomPrompt() {
        // Collect data from inputs
        this.customBlueprintData = {
            name: document.getElementById('custom-name')?.value || '',
            vision: document.getElementById('custom-vision')?.value || '',
            years: document.getElementById('custom-years')?.value || '15',
            domain1: document.getElementById('custom-domain1')?.value || '',
            domain2: document.getElementById('custom-domain2')?.value || '',
            domain3: document.getElementById('custom-domain3')?.value || '',
            milestone1: document.getElementById('custom-milestone1')?.value || '',
            milestone2: document.getElementById('custom-milestone2')?.value || '',
            milestone3: document.getElementById('custom-milestone3')?.value || '',
            habit1: document.getElementById('custom-habit1')?.value || '',
            habit2: document.getElementById('custom-habit2')?.value || '',
            habit3: document.getElementById('custom-habit3')?.value || ''
        };

        const d = this.customBlueprintData;

        // Validate required fields
        if (!d.name || !d.vision || !d.domain1) {
            this.toast('⚠️ Please fill at least: Name, Vision, and Domain 1');
            return;
        }

        // Generate the AI prompt
        this.customPrompt = `You are a strategic life planning expert. Create a comprehensive ${d.years}-year blueprint for ${d.name} following the SVK Blueprint methodology.

**PERSON'S VISION:**
${d.vision}

**DOMAINS (Life Focus Areas):**
1. ${d.domain1}
${d.domain2 ? `2. ${d.domain2}` : ''}
${d.domain3 ? `3. ${d.domain3}` : ''}

**KEY MILESTONES:**
- Early Phase: ${d.milestone1 || 'To be determined'}
- Mid Phase: ${d.milestone2 || 'To be determined'}
- Late Phase: ${d.milestone3 || 'To be determined'}

**CORE DAILY HABITS:**
${d.habit1 ? `- ${d.habit1}` : ''}
${d.habit2 ? `- ${d.habit2}` : ''}
${d.habit3 ? `- ${d.habit3}` : ''}

---

**YOUR TASK:**
Create a complete ${d.years}-year blueprint broken into 60 cycles (90 days each). Each cycle should include:
- Cycle number and title
- Domain focus percentages (total must equal 100%)
- 3-5 specific milestones
- 5-7 daily/weekly habits
- 15-25 concrete tasks

**IMPORTANT RULES:**
1. Early cycles focus on foundation building
2. Mid cycles focus on momentum and scaling
3. Late cycles focus on mastery and legacy
4. Each cycle builds on previous cycles
5. Milestones should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
6. Tasks should be actionable and concrete
7. Habits should directly support the domains
8. Domain focus should shift naturally over time (early = heavy domain 1, later = more balanced)

**OUTPUT FORMAT (STRICT JSON):**
\`\`\`json
{
  "name": "${d.name} Life Blueprint ${new Date().getFullYear()}-${new Date().getFullYear() + parseInt(d.years)}",
  "vision": "${d.vision}",
  "years": ${d.years},
  "domains": {
    "domain1": { "name": "${d.domain1}", "color": "#0a84ff" },
    "domain2": { "name": "${d.domain2 || 'Secondary Domain'}", "color": "#ffd700" },
    "domain3": { "name": "${d.domain3 || 'Tertiary Domain'}", "color": "#30d158" }
  },
  "cycles": [
    {
      "number": 1,
      "title": "Foundation: [Specific Focus] (Q1 ${new Date().getFullYear()})",
      "goals_focus": {
        "${d.domain1}": 70,
        "${d.domain2 || 'Secondary Domain'}": 25,
        "${d.domain3 || 'Tertiary Domain'}": 5
      },
      "milestones": [
        "[Specific milestone 1]",
        "[Specific milestone 2]",
        "[Specific milestone 3]"
      ],
      "habits": [
        "${d.habit1 || 'Daily practice in domain 1'}",
        "${d.habit2 || 'Daily practice in domain 2'}",
        "${d.habit3 || 'Daily mindfulness practice'}",
        "[Additional habit]",
        "[Additional habit]"
      ],
      "tasks": [
        "[Concrete action task 1]",
        "[Concrete action task 2]",
        "[Concrete action task 3]",
        "... 15-25 total tasks"
      ]
    },
    ... [Continue for all 60 cycles, progressively building on each other]
  ]
}
\`\`\`

**CRITICAL:** 
- Output ONLY the JSON, no other text
- Ensure all 60 cycles are included
- Each cycle should have unique, progressive content
- Focus percentages in "goals_focus" must total 100%
- Use exact domain names in "goals_focus"
- Make it realistic and achievable
- Include specific numbers, dates, and metrics where possible

Generate the complete JSON now.`;

        this.save();
        this.toast('✨ Custom prompt generated! Scroll down to copy.');
        this.render();
        
        // Scroll to prompt
        setTimeout(() => {
            document.getElementById('custom-prompt')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    },

    copyPromptToClipboard() {
        if (!this.customPrompt) return;
        
        navigator.clipboard.writeText(this.customPrompt).then(() => {
            this.toast('📋 Prompt copied! Paste into ChatGPT or Claude');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.customPrompt;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.toast('📋 Prompt copied! Paste into ChatGPT or Claude');
        });
    },

    // IMPORT BLUEPRINT
    importBlueprint(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const json = JSON.parse(e.target.result);
                
                // FIX: Add comprehensive validation
                if (!json.name || !json.vision || !json.cycles || !Array.isArray(json.cycles)) {
                    throw new Error('Invalid blueprint format: missing required fields');
                }
                
                if (json.cycles.length === 0) {
                    throw new Error('Blueprint must contain at least one cycle');
                }
                
                // Validate each cycle
                json.cycles.forEach((c, idx) => {
                    if (!c.title) {
                        throw new Error(`Cycle ${idx + 1}: missing title`);
                    }
                    
                    if (!c.goals_focus || typeof c.goals_focus !== 'object') {
                        throw new Error(`Cycle ${idx + 1}: missing or invalid goals_focus`);
                    }
                    
                    // Validate goals_focus percentages sum to 100%
                    const focusValues = Object.values(c.goals_focus);
                    if (focusValues.length === 0) {
                        throw new Error(`Cycle ${idx + 1}: goals_focus cannot be empty`);
                    }
                    
                    const focusSum = focusValues.reduce((a, b) => a + b, 0);
                    if (Math.abs(focusSum - 100) > 1) {  // Allow 1% tolerance for rounding
                        throw new Error(`Cycle ${idx + 1}: goals_focus must sum to 100% (got ${focusSum}%)`);
                    }
                    
                    // Validate domain names are non-empty strings
                    Object.keys(c.goals_focus).forEach(domain => {
                        if (typeof domain !== 'string' || domain.trim() === '') {
                            throw new Error(`Cycle ${idx + 1}: invalid domain name`);
                        }
                    });
                    
                    // Ensure required arrays exist
                    if (!Array.isArray(c.milestones)) c.milestones = [];
                    if (!Array.isArray(c.habits)) c.habits = [];
                    if (!Array.isArray(c.tasks)) c.tasks = [];
                });
                
                this.data.blueprintMeta = {
                    name: json.name,
                    vision: json.vision,
                    years: json.years,
                    totalCycles: json.cycles?.length || 0,
                    domains: json.domains
                };
                
                this.data.allCycles = json.cycles.map((c, idx) => ({
                    number: c.number || (idx + 1),
                    title: c.title,
                    goals_focus: c.goals_focus,
                    milestones: c.milestones,
                    habits: c.habits,
                    rawTasks: c.tasks
                }));
                
                this.save();
                this.toast('✓ Blueprint imported successfully');
                this.render();
            } catch(err) {
                this.toast(`⚠️ Import failed: ${err.message}`);
                console.error('Blueprint import error:', err);
            }
        };
        reader.readAsText(file);
    },

    // LOAD NEXT CYCLE
    loadNextCycle() {
        if (!this.data.allCycles || this.data.allCycles.length === 0) {
            this.toast('⚠️ No cycles available');
            return;
        }
        
        const currentNum = this.data.currentCycle?.number || 0;
        const nextCycle = this.data.allCycles.find(c => c.number === currentNum + 1);
        
        if (!nextCycle) {
            this.toast('🎉 All cycles completed!');
            return;
        }
        
        if (this.data.currentCycle) {
            if (!this.data.cycleHistory) this.data.cycleHistory = [];
            this.data.cycleHistory.push({
                ...this.data.currentCycle,
                completedDate: new Date().toISOString()
            });
        }
        
        this.data.currentCycle = {
            number: nextCycle.number,
            title: nextCycle.title,
            startDate: new Date().toISOString().split('T')[0],
            goals_focus: nextCycle.goals_focus,
            milestones: nextCycle.milestones,
            habits: nextCycle.habits,
            tasks: this.convertTasks(nextCycle.rawTasks, nextCycle.number)
        };
        
        this.save();
        this.updateCycleIndicator();
        this.render();
        this.toast(`✓ Started Cycle ${nextCycle.number}`);
    },

    convertTasks(rawTasks, cycleNumber) {
        if (!Array.isArray(rawTasks)) return [];
        
        const tasksPerWeek = Math.ceil(rawTasks.length / 13);
        
        // FIX: Intelligently assign domains to imported tasks based on goals_focus
        const domains = this.getAllDomains();
        const cycle = this.data.allCycles?.find(c => c.number === cycleNumber);
        const goalsFocus = cycle?.goals_focus || {};
        
        // Create weighted domain pool based on percentages
        const domainPool = [];
        if (Object.keys(goalsFocus).length > 0) {
            Object.entries(goalsFocus).forEach(([domain, percentage]) => {
                const count = Math.round((percentage / 100) * rawTasks.length);
                for (let i = 0; i < count; i++) {
                    domainPool.push(domain);
                }
            });
        }
        
        // Fill remaining slots if pool is too small
        while (domainPool.length < rawTasks.length && domains.length > 0) {
            domainPool.push(domains[0]);
        }
        
        return rawTasks.map((task, idx) => {
            const week = Math.min(Math.floor(idx / tasksPerWeek) + 1, 13);
            const domain = domainPool[idx] || domains[0] || '';
            
            return {
                id: this.genId(),
                title: task,
                done: false,
                week: week,
                domain: domain,  // FIX: Now assigns domain intelligently
                duration: null,
                cycleNumber: cycleNumber
            };
        });
    },

    completeCycle() {
        if (!confirm('Archive this cycle?')) return;
        
        const c = { 
            ...this.data.currentCycle, 
            completedAt: new Date().toISOString(), 
            completedTasks: (this.data.currentCycle.tasks||[]).filter(t=>t.done).length, 
            totalTasks: (this.data.currentCycle.tasks||[]).length 
        };
        
        if (!this.data.cycleHistory) this.data.cycleHistory = [];
        this.data.cycleHistory.unshift(c);
        this.data.currentCycle = null;
        
        this.save();
        this.updateCycleIndicator();
        this.celebrate('🏆', 'Cycle Complete!', `${c.completedTasks}/${c.totalTasks} tasks done`);
        this.render();
    },

    getCurrentWeek() {
        if (!this.data.currentCycle || !this.data.currentCycle.startDate) return 1;
        const start = new Date(this.data.currentCycle.startDate + 'T00:00:00');
        const now = new Date();
        const diff = Math.floor((now - start) / 86400000);
        return Math.min(Math.max(Math.floor(diff / 7) + 1, 1), 13);
    },

    toggleTask(id) {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === id);
        if (!task) return;
        task.done = !task.done;
        this.save();
        this.render();
        if (task.done) this.toast('✓ Task completed');
    },

    startTask(id) {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === id);
        if (!task) {
            this.timer.show();
            return;
        }
        
        // Check if task has micro-steps
        if (!task.microSteps || task.microSteps.length === 0) {
            // Prompt to add micro-steps or start simple timer
            document.getElementById('modal-body').innerHTML = `
                <h3 style="margin-bottom:12px;color:var(--accent);">⏱️ Start "${esc(task.title)}"</h3>
                <p style="font-size:13px;color:var(--dim);margin-bottom:16px;">
                    Break this task into micro-steps for Zen Mode, or use a simple timer.
                </p>
                <textarea id="task-micro-steps" placeholder="Enter each step on a new line:
Review requirements
Create outline
Write first draft
Review and edit..." rows="6" style="margin-bottom:12px;"></textarea>
                <button class="btn" onclick="App.saveTaskMicroSteps('${id}')">Add Steps & Start Zen Mode</button>
                <button class="btn-sec" onclick="App.timer.show(); App.closeModal();" style="margin-top:8px;">
                    Use Simple Timer
                </button>
            `;
            document.getElementById('modal').classList.add('open');
            return;
        }
        
        // Task has micro-steps - prompt for Zen Mode
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">⏱️ Set Timer for "${esc(task.title)}"</h3>
            
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--dim);margin-bottom:6px;">Timer Mode</label>
                <select id="timer-mode" style="margin-bottom:0;">
                    <option value="zen">🧘 Zen Mode - One step at a time</option>
                    <option value="simple">⏱️ Simple Timer</option>
                </select>
            </div>
            
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--dim);margin-bottom:6px;">Duration (minutes)</label>
                <input type="number" id="timer-duration" value="25" min="1" max="180" style="margin-bottom:0;">
            </div>
            
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--dim);margin-bottom:6px;">Intention</label>
                <textarea id="timer-intention" placeholder="What will you accomplish?" rows="2" style="margin-bottom:0;"></textarea>
            </div>
            
            <button class="btn" onclick="App.startTaskTimer('${id}')">Start Timer</button>
        `;
        document.getElementById('modal').classList.add('open');
    },
    
    saveTaskMicroSteps(taskId) {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === taskId);
        if (!task) return;
        
        const stepsText = document.getElementById('task-micro-steps')?.value?.trim();
        if (!stepsText) {
            this.toast('⚠️ Enter at least one step');
            return;
        }
        
        const steps = stepsText.split('\n')
            .filter(s => s.trim())
            .map(s => ({
                title: s.trim(),
                status: 'pending'
            }));
        
        task.microSteps = steps;
        this.save();
        this.closeModal();
        
        // Now start the task timer
        this.startTask(taskId);
    },
    
    startTaskTimer(taskId) {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === taskId);
        if (!task) return;
        
        const mode = document.getElementById('timer-mode')?.value || 'zen';
        const duration = parseInt(document.getElementById('timer-duration')?.value) || 25;
        const intention = document.getElementById('timer-intention')?.value?.trim() || '';
        
        if (mode === 'zen' && task.microSteps && task.microSteps.length > 0) {
            // Reset all micro steps to pending
            task.microSteps.forEach(step => {
                if (step.status !== 'done') {
                    step.status = 'pending';
                }
            });
            this.save();
            
            this.zenMode = {
                active: true,
                habitId: null,
                taskId: taskId,
                intention: intention,
                currentStepIndex: 0,
                startTime: Date.now(),
                duration: 0,
                targetDuration: duration * 60,
                interval: null,
                isPaused: false,
                steps: task.microSteps
            };
            
            this.closeModal();
            this.showZenTimerForTask();
            
            // Start interval
            this.zenMode.interval = setInterval(() => {
                if (!this.zenMode.isPaused) {
                    this.zenMode.duration = Math.floor((Date.now() - this.zenMode.startTime) / 1000);
                    this.updateZenTimerForTask();
                }
            }, 1000);
            
            this.updateZenTimerForTask();
        } else {
            this.closeModal();
            this.timer.show();
        }
    },
    
    showZenTimerForTask() {
        document.getElementById('zen-timer-overlay').classList.add('active');
        this.updateZenTimerForTask();
    },
    
    updateZenTimerForTask() {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === this.zenMode.taskId);
        if (!task) return;
        
        // Calculate countdown
        const timeRemaining = Math.max(0, this.zenMode.targetDuration - this.zenMode.duration);
        const remainingMins = Math.floor(timeRemaining / 60);
        const remainingSecs = timeRemaining % 60;
        const countdownStr = `${String(remainingMins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
        
        // Get current step
        const currentStep = this.zenMode.steps[this.zenMode.currentStepIndex];
        const completedSteps = this.zenMode.steps.filter(s => s.status === 'done').length;
        const totalSteps = this.zenMode.steps.length;
        
        // Check if all steps are done
        if (this.zenMode.currentStepIndex >= totalSteps) {
            this.completeZenTaskSession();
            return;
        }
        
        const html = `
            <div class="zen-title">${esc(task.title)}</div>
            
            ${this.zenMode.intention ? `
                <div class="zen-intention">
                    <div class="zen-intention-label">Your Intention</div>
                    <div class="zen-intention-text">${esc(this.zenMode.intention)}</div>
                </div>
            ` : ''}
            
            <div class="zen-countdown ${this.zenMode.isPaused ? '' : 'zen-pulse'}">
                ${countdownStr}
            </div>
            
            <div class="zen-step-card">
                <div class="zen-step-number">${this.zenMode.currentStepIndex + 1}</div>
                <div class="zen-step-text">${esc(currentStep.title)}</div>
                <div class="zen-step-progress">${completedSteps} of ${totalSteps} completed</div>
                
                <div class="zen-buttons">
                    <button class="zen-btn zen-btn-skip" onclick="App.zenSkipTaskStep()">
                        Skip
                    </button>
                    <button class="zen-btn zen-btn-done" onclick="App.zenCompleteTaskStep()">
                        ✓ Done
                    </button>
                </div>
            </div>
            
            <div class="zen-controls">
                <button class="zen-control-btn" onclick="App.zenTogglePause()">
                    ${this.zenMode.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button class="zen-control-btn" onclick="App.zenStopTimer()">
                    ✕ Stop
                </button>
            </div>
        `;
        
        document.getElementById('zen-timer-content').innerHTML = html;
        
        // Update header badge
        const badge = document.getElementById('timer-badge');
        if (badge) {
            badge.textContent = countdownStr;
            badge.classList.add('active');
        }
    },
    
    zenCompleteTaskStep() {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === this.zenMode.taskId);
        if (!task) return;
        
        const currentIndex = this.zenMode.currentStepIndex;
        if (currentIndex < this.zenMode.steps.length) {
            this.zenMode.steps[currentIndex].status = 'done';
            task.microSteps[currentIndex].status = 'done';
            this.save();
        }
        
        this.zenMode.currentStepIndex++;
        this.updateZenTimerForTask();
        
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    },
    
    zenSkipTaskStep() {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === this.zenMode.taskId);
        if (!task) return;
        
        const currentIndex = this.zenMode.currentStepIndex;
        if (currentIndex < this.zenMode.steps.length) {
            this.zenMode.steps[currentIndex].status = 'skipped';
            task.microSteps[currentIndex].status = 'skipped';
            this.save();
        }
        
        this.zenMode.currentStepIndex++;
        this.updateZenTimerForTask();
    },
    
    completeZenTaskSession() {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === this.zenMode.taskId);
        if (!task) return;
        
        const completedSteps = this.zenMode.steps.filter(s => s.status === 'done').length;
        const totalSteps = this.zenMode.steps.length;
        const minutes = Math.floor(this.zenMode.duration / 60);
        
        this.celebrate('🎯', 'Task Complete!', `${completedSteps}/${totalSteps} steps • ${minutes} min`);
        
        // Mark task as done
        task.done = true;
        this.save();
        
        setTimeout(() => {
            this.zenStopTimerAutomatic();
        }, 2500);
    },

    updateCycleIndicator() {
        const el = document.getElementById('cycle-indicator');
        if (el) el.textContent = this.data.currentCycle ? `CYCLE ${this.data.currentCycle.number}` : 'NO CYCLE';
    },

    changeWeek(dir) {
        const current = this.sub._viewedWeek || this.getCurrentWeek();
        const next = Math.max(1, Math.min(13, current + dir));
        this.sub._viewedWeek = next;
        this.render();
    },

    addWeekTask(week) {
        // Get domains from current cycle's goals_focus
        const goalsFocus = this.data.currentCycle?.goals_focus || {};
        const domains = Object.keys(goalsFocus);
        
        let domainOptions = '';
        if (domains.length > 0) {
            domainOptions = `
                <select id="task-domain" style="margin-bottom:12px;">
                    <option value="">Select domain...</option>
                    ${domains.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}
                </select>`;
        }
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">Add Task - Week ${week}</h3>
            <input id="task-title" placeholder="Task description..." style="margin-bottom:12px;">
            ${domainOptions}
            <input id="task-duration" type="number" placeholder="Duration (minutes)" value="30" style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveWeekTask(${week})">Add Task</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('task-title')?.focus(), 80);
    },

    saveWeekTask(week) {
        const title = document.getElementById('task-title')?.value?.trim();
        const domain = document.getElementById('task-domain')?.value || null;
        const duration = parseInt(document.getElementById('task-duration')?.value) || null;
        if (!title) { this.toast('⚠️ Enter task'); return; }
        
        if (!this.data.currentCycle.tasks) this.data.currentCycle.tasks = [];
        this.data.currentCycle.tasks.push({
            id: this.genId(),
            title,
            domain,
            duration,
            week,
            done: false
        });
        
        this.save(); this.closeModal(); this.render(); this.toast('✓ Task added');
    },

    viewTaskDetail(id) {
        const task = this.data.currentCycle?.tasks?.find(t => t.id === id);
        if (!task) return;
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:16px;color:var(--accent);">${esc(task.title)}</h3>
            <div class="stat-grid" style="margin-bottom:16px;">
                <div class="stat-box"><div class="stat-val">${task.week}</div><div class="stat-label">Week</div></div>
                <div class="stat-box"><div class="stat-val">${task.duration || '—'}</div><div class="stat-label">Minutes</div></div>
            </div>
            <button class="btn" onclick="App.startTask('${id}')">⏱️ Start Timer</button>
            <div style="display:flex;gap:8px;margin-top:12px;">
                ${!task.done ? `<button class="btn-sec btn-success" style="flex:1;" onclick="App.toggleTask('${id}');App.closeModal();">✓ Mark Done</button>` : ''}
                <button class="btn-sec btn-danger" style="flex:1;" onclick="App.deleteTask('${id}');App.closeModal();">Delete</button>
            </div>`;
        document.getElementById('modal').classList.add('open');
    },

    deleteTask(id) {
        if (!confirm('Delete this task?')) return;
        this.data.currentCycle.tasks = this.data.currentCycle.tasks.filter(t => t.id !== id);
        this.save(); this.render();
    },

    showAllCycles() {
        if (!this.data.allCycles || this.data.allCycles.length === 0) {
            this.toast('No cycles available');
            return;
        }
        
        const currentNum = this.data.currentCycle?.number || 0;
        let html = `<h3 style="margin-bottom:16px;color:var(--accent);">All Cycles (${this.data.allCycles.length})</h3>`;
        
        this.data.allCycles.forEach(cycle => {
            const isCurrent = cycle.number === currentNum;
            const isPast = cycle.number < currentNum;
            
            html += `<div class="task-row" style="${isCurrent?'border-color:var(--accent);':''}" onclick="App.jumpToCycle(${cycle.number})">
                <div style="flex:1;">
                    <div style="font-weight:700;display:flex;align-items:center;gap:8px;">
                        <span style="color:var(--accent);">Cycle ${cycle.number}</span>
                        ${isCurrent ? '<span style="font-size:10px;padding:2px 6px;background:var(--accent);color:var(--void);border-radius:4px;">ACTIVE</span>' : ''}
                        ${isPast ? '<span style="font-size:10px;padding:2px 6px;background:var(--success);color:var(--void);border-radius:4px;">DONE</span>' : ''}
                    </div>
                    <div style="font-size:14px;margin-top:4px;">${esc(cycle.title)}</div>
                </div>
            </div>`;
        });
        
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('modal').classList.add('open');
    },

    jumpToCycle(cycleNumber) {
        if (!this.data.allCycles || this.data.allCycles.length === 0) {
            this.toast('⚠️ No cycles available');
            return;
        }
        
        const targetCycle = this.data.allCycles.find(c => c.number === cycleNumber);
        if (!targetCycle) {
            this.toast('⚠️ Cycle not found');
            return;
        }
        
        if (confirm(`Switch to Cycle ${cycleNumber}? Current progress will be saved.`)) {
            if (this.data.currentCycle) {
                if (!this.data.cycleHistory) this.data.cycleHistory = [];
                this.data.cycleHistory.push({
                    ...this.data.currentCycle,
                    switchedDate: new Date().toISOString()
                });
            }
            
            this.data.currentCycle = {
                number: targetCycle.number,
                title: targetCycle.title,
                startDate: new Date().toISOString().split('T')[0],
                goals_focus: targetCycle.goals_focus,
                milestones: targetCycle.milestones,
                habits: targetCycle.habits,
                tasks: this.convertTasks(targetCycle.rawTasks, targetCycle.number)
            };
            
            this.sub._viewedWeek = null;
            this.save();
            this.updateCycleIndicator();
            this.closeModal();
            this.render();
            this.toast(`✓ Switched to Cycle ${cycleNumber}`);
        }
    },

    // AFFIRMATIONS
    addAffirmation() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">✨ Add Affirmation</h3>
            <textarea id="aff-text" placeholder="I am..." rows="4" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveAffirmation()">Add Affirmation</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('aff-text')?.focus(), 80);
    },

    saveAffirmation() {
        const text = document.getElementById('aff-text')?.value?.trim();
        if (!text) { this.toast('⚠️ Enter text'); return; }
        if (!this.data.plan.affirmations) this.data.plan.affirmations = [];
        this.data.plan.affirmations.push({ id: this.genId(), text, timestamp: new Date().toISOString() });
        this.save(); this.closeModal(); this.render(); this.toast('✨ Affirmation added');
    },

    deleteAffirmation(id) {
        if (!confirm('Delete?')) return;
        this.data.plan.affirmations = this.data.plan.affirmations.filter(a => a.id !== id);
        this.save(); this.render();
    },

    // BUCKET LIST
    addBucketItem() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--blue);">🪣 Add Bucket List Item</h3>
            <input id="bucket-title" placeholder="Dream or goal..." style="margin-bottom:12px;">
            <textarea id="bucket-desc" placeholder="Description (optional)..." rows="3" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveBucketItem()">Add to Bucket List</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('bucket-title')?.focus(), 80);
    },

    saveBucketItem() {
        const title = document.getElementById('bucket-title')?.value?.trim();
        const description = document.getElementById('bucket-desc')?.value?.trim();
        if (!title) { this.toast('⚠️ Enter title'); return; }
        if (!this.data.plan.bucketList) this.data.plan.bucketList = [];
        this.data.plan.bucketList.push({ 
            id: this.genId(), 
            title, 
            description: description || '', 
            done: false,
            timestamp: new Date().toISOString() 
        });
        this.save(); this.closeModal(); this.render(); this.toast('🪣 Added to bucket list');
    },

    toggleBucketItem(id) {
        const item = this.data.plan.bucketList.find(i => i.id === id);
        if (item) {
            item.done = !item.done;
            this.save(); this.render();
            this.toast(item.done ? '✅ Dream achieved!' : '🔄 Unmarked');
        }
    },

    deleteBucketItem(id) {
        if (!confirm('Remove from bucket list?')) return;
        this.data.plan.bucketList = this.data.plan.bucketList.filter(i => i.id !== id);
        this.save(); this.render();
    },

    // EXPORT / RESET
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `svk-blueprint-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast('✓ Data exported');
    },

    resetBlueprint() {
        if (!confirm('⚠️ Reset entire blueprint? This cannot be undone.')) return;
        localStorage.removeItem(DB_KEY);
        location.reload();
    },

    // QUICK CAPTURE - Primary capture interface accessible via FAB button
    // Provides 6 capture options: Quick Task, Note, Idea, Quote, Journal Entry, Reflection
    // This is the main capture function used throughout the app
    openCapture() {
        // Quick Capture Menu - Streamlined to 10 essential capture types
        // Focused on short-lived, high-frequency items that need immediate capture
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:16px;color:var(--accent);">⚡ Quick Capture</h3>
            <div style="max-height:60vh;overflow-y:auto;padding:2px;">
                <div style="display:grid;gap:8px;grid-template-columns:repeat(2, 1fr);">
                    <button class="btn" onclick="App.addIdea()" style="background:var(--success);padding:12px;">
                        💡 Idea
                    </button>
                    <button class="btn" onclick="App.addQuickTask()" style="padding:12px;">
                        ⚡ Quick Task
                    </button>
                    <button class="btn" onclick="App.addNote()" style="padding:12px;">
                        📝 Note
                    </button>
                    <button class="btn" onclick="App.addCycleTask()" style="padding:12px;">
                        ✓ Cycle Task
                    </button>
                    <button class="btn" onclick="App.addQuote()" style="padding:12px;">
                        💬 Quote
                    </button>
                    <button class="btn" onclick="App.addTimeblock()" style="padding:12px;">
                        📅 Timeblock
                    </button>
                    <button class="btn" onclick="App.addHabit()" style="padding:12px;">
                        🔄 Habit
                    </button>
                    <button class="btn" onclick="App.addJournalEntry()" style="padding:12px;">
                        📔 Journal
                    </button>
                    <button class="btn" onclick="App.addGoal()" style="padding:12px;">
                        🎯 Goal
                    </button>
                    <button class="btn" onclick="App.addAffirmation()" style="padding:12px;">
                        ✨ Affirmation
                    </button>
                </div>
            </div>`;
        document.getElementById('modal').classList.add('open');
    },

    closeModal() {
        // Clean up Pomodoro timer if running
        if (this.timer.interval) {
            clearInterval(this.timer.interval);
            this.timer.interval = null;
            this.timer.running = false;
        }
        
        // Clean up habit timer if running
        if (this.habitTimer.interval) {
            clearInterval(this.habitTimer.interval);
            this.habitTimer.interval = null;
        }
        
        document.getElementById('modal').classList.remove('open');
    },

    genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
    },

    // Get all unique domains from blueprint and current cycle
    getAllDomains() {
        const domains = new Set();
        
        // Get from current cycle's goals_focus (primary source)
        if (this.data.currentCycle?.goals_focus) {
            Object.keys(this.data.currentCycle.goals_focus).forEach(d => domains.add(d));
        }
        
        // Get from all cycles' goals_focus (for comprehensive list)
        if (this.data.allCycles) {
            this.data.allCycles.forEach(cycle => {
                if (cycle.goals_focus) {
                    Object.keys(cycle.goals_focus).forEach(d => domains.add(d));
                }
            });
        }
        
        // Get from existing goals
        if (this.data.goals) {
            this.data.goals.forEach(g => {
                if (g.domain) domains.add(g.domain);
            });
        }
        
        // Get from existing tasks
        if (this.data.currentCycle?.tasks) {
            this.data.currentCycle.tasks.forEach(t => {
                if (t.domain) domains.add(t.domain);
            });
        }
        
        // Default domains if none found
        if (domains.size === 0) {
            return ['Career', 'Wealth', 'Health', 'Relationships', 'Learning'];
        }
        
        return Array.from(domains).sort();
    },
    
    // FIX: Add consistent color assignment based on domain name hash
    getDomainColor(domainName) {
        const colorPalette = ['#30d158', '#ffd60a', '#bf5af2', '#0a84ff', '#ff453a', '#ff9f0a', '#64d2ff', '#ff375f'];
        
        // Simple string hash function for consistent color assignment
        let hash = 0;
        for (let i = 0; i < domainName.length; i++) {
            hash = ((hash << 5) - hash) + domainName.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        const index = Math.abs(hash) % colorPalette.length;
        return colorPalette[index];
    },

    // HABITS
    addHabit() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">Add Habit</h3>
            <div style="margin-bottom:12px;">
                <input id="habit-title" placeholder="Habit name..." 
                       oninput="App.validateHabitTitle(this)"
                       style="margin-bottom:4px;">
                <div id="habit-title-error" style="font-size:11px;color:var(--danger);display:none;"></div>
            </div>
            <select id="habit-time" style="margin-bottom:12px;">
                <option value="">Time block (optional)</option>
                <option value="Morning">Morning</option>
                <option value="Work">Work</option>
                <option value="Evening">Evening</option>
            </select>
            <button class="btn" id="save-habit-btn" onclick="App.saveHabit()">Add Habit</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('habit-title')?.focus(), 80);
    },
    
    // NEW: Real-time validation for habit title
    validateHabitTitle(input) {
        const value = input.value.trim();
        const errorDiv = document.getElementById('habit-title-error');
        const saveBtn = document.getElementById('save-habit-btn');
        
        if (!value) {
            errorDiv.textContent = 'Habit name is required';
            errorDiv.style.display = 'block';
            input.style.borderColor = 'var(--danger)';
            if (saveBtn) saveBtn.disabled = true;
            return false;
        } else if (value.length < 3) {
            errorDiv.textContent = 'Habit name must be at least 3 characters';
            errorDiv.style.display = 'block';
            input.style.borderColor = 'var(--warn)';
            if (saveBtn) saveBtn.disabled = true;
            return false;
        } else if (value.length > 50) {
            errorDiv.textContent = 'Habit name must be less than 50 characters';
            errorDiv.style.display = 'block';
            input.style.borderColor = 'var(--warn)';
            if (saveBtn) saveBtn.disabled = true;
            return false;
        } else {
            errorDiv.style.display = 'none';
            input.style.borderColor = 'var(--border)';
            if (saveBtn) saveBtn.disabled = false;
            return true;
        }
    },

    saveHabit() {
        const title = document.getElementById('habit-title')?.value?.trim();
        const timeBlock = document.getElementById('habit-time')?.value;
        
        // Enhanced validation with specific messages
        if (!title) { 
            this.toast('⚠️ Habit name is required'); 
            document.getElementById('habit-title').focus();
            return; 
        }
        if (title.length < 3) {
            this.toast('⚠️ Habit name must be at least 3 characters');
            document.getElementById('habit-title').focus();
            return;
        }
        if (title.length > 50) {
            this.toast('⚠️ Habit name too long (max 50 characters)');
            document.getElementById('habit-title').focus();
            return;
        }
        
        if (!this.data.system.habits) this.data.system.habits = [];
        this.data.system.habits.push({
            id: this.genId(),
            title,
            timeBlock: timeBlock || null,
            completions: [],
            microSteps: [],
            created: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Habit added');
    },

    editHabit(id) {
        const habit = this.data.system.habits.find(h => h.id === id);
        if (!habit) return;
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">Edit Habit</h3>
            <input id="edit-habit-title" placeholder="Habit name..." value="${esc(habit.title)}" style="margin-bottom:12px;">
            <select id="edit-habit-time" style="margin-bottom:12px;">
                <option value="">Time block (optional)</option>
                <option value="Morning" ${habit.timeBlock === 'Morning' ? 'selected' : ''}>Morning</option>
                <option value="Work" ${habit.timeBlock === 'Work' ? 'selected' : ''}>Work</option>
                <option value="Evening" ${habit.timeBlock === 'Evening' ? 'selected' : ''}>Evening</option>
            </select>
            <button class="btn" onclick="App.updateHabit('${id}')">Save Changes</button>
            <button class="btn-sec" onclick="App.closeModal()" style="margin-top:8px;">Cancel</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('edit-habit-title')?.focus(), 80);
    },

    updateHabit(id) {
        const habit = this.data.system.habits.find(h => h.id === id);
        if (!habit) return;
        
        const title = document.getElementById('edit-habit-title')?.value?.trim();
        const timeBlock = document.getElementById('edit-habit-time')?.value;
        
        if (!title) { this.toast('⚠️ Enter title'); return; }
        
        habit.title = title;
        habit.timeBlock = timeBlock || null;
        
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Habit updated');
    },

    deleteHabit(id) {
        const habit = this.data.system.habits.find(h => h.id === id);
        if (!habit) return;
        
        if (!confirm(`Delete habit "${habit.title}"? This will remove all completion history and micro-steps.`)) return;
        
        // NEW: Save to undo stack before deletion
        this.saveToUndoStack(`Delete habit: ${habit.title}`, this.data);
        
        this.data.system.habits = this.data.system.habits.filter(h => h.id !== id);
        this.save(); this.render();
        
        // NEW: Show undo toast instead of regular toast
        this.showUndoToast(`Habit "${habit.title}" deleted`, true);
    },

    manageMicroSteps(habitId) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit) return;
        
        if (!habit.microSteps) habit.microSteps = [];
        
        let html = `
            <h3 style="margin-bottom:12px;color:var(--accent);">🎯 Micro-Steps: ${esc(habit.title)}</h3>
            <p style="font-size:12px;color:var(--dim);margin-bottom:16px;">
                Break down your habit into small, actionable steps
            </p>`;
        
        if (habit.microSteps.length === 0) {
            html += `<div style="text-align:center;padding:20px;color:var(--dim);font-size:13px;">
                No micro-steps yet. Add your first step below.
            </div>`;
        } else {
            html += `<div style="max-height:300px;overflow-y:auto;margin-bottom:16px;">`;
            habit.microSteps.forEach((step, index) => {
                const statusIcon = step.status === 'done' ? '✅' : step.status === 'active' ? '🔄' : '○';
                html += `
                    <div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--sub);
                         border-radius:8px;margin-bottom:8px;border:1px solid var(--border);">
                        <button onclick="App.toggleMicroStepStatus('${habitId}', ${index})" 
                                style="background:none;border:none;font-size:18px;cursor:pointer;padding:4px;">
                            ${statusIcon}
                        </button>
                        <div style="flex:1;font-size:13px;color:${step.status === 'done' ? 'var(--dim)' : 'var(--text)'};
                             text-decoration:${step.status === 'done' ? 'line-through' : 'none'};">
                            ${esc(step.title)}
                        </div>
                        <button onclick="App.deleteMicroStep('${habitId}', ${index})" 
                                style="background:none;border:none;color:var(--danger);cursor:pointer;
                                font-size:16px;padding:4px;">
                            🗑️
                        </button>
                    </div>`;
            });
            html += `</div>`;
        }
        
        html += `
            <div style="border-top:1px solid var(--border);padding-top:16px;">
                <input id="new-microstep" placeholder="Add new micro-step..." 
                       style="margin-bottom:12px;"
                       onkeypress="if(event.key==='Enter')App.addMicroStep('${habitId}')">
                <div style="display:flex;gap:8px;">
                    <button class="btn" style="flex:1;" onclick="App.addMicroStep('${habitId}')">
                        ➕ Add Step
                    </button>
                    <button class="btn-sec" onclick="App.closeModal()">
                        Done
                    </button>
                </div>
            </div>`;
        
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('new-microstep')?.focus(), 80);
    },

    addMicroStep(habitId) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit) return;
        
        const title = document.getElementById('new-microstep')?.value?.trim();
        if (!title) { this.toast('⚠️ Enter step name'); return; }
        
        if (!habit.microSteps) habit.microSteps = [];
        habit.microSteps.push({
            id: this.genId(),
            title,
            status: 'pending', // pending, active, done
            created: new Date().toISOString()
        });
        
        this.save();
        this.manageMicroSteps(habitId); // Refresh the modal
        this.toast('✓ Step added');
    },

    toggleMicroStepStatus(habitId, index) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit || !habit.microSteps || !habit.microSteps[index]) return;
        
        const step = habit.microSteps[index];
        
        // Cycle through: pending → active → done → pending
        if (step.status === 'pending') {
            step.status = 'active';
        } else if (step.status === 'active') {
            step.status = 'done';
        } else {
            step.status = 'pending';
        }
        
        this.save();
        this.manageMicroSteps(habitId); // Refresh the modal
    },

    deleteMicroStep(habitId, index) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit || !habit.microSteps) return;
        
        const step = habit.microSteps[index];
        if (!confirm(`Delete micro-step "${step.title}"?`)) return;
        
        habit.microSteps.splice(index, 1);
        this.save();
        this.manageMicroSteps(habitId); // Refresh the modal
        this.toast('✓ Step deleted');
    },

    toggleHabit(id) {
        const habit = this.data.system.habits.find(h => h.id === id);
        if (!habit) return;
        const today = new Date().toISOString().split('T')[0];
        if (!habit.completions) habit.completions = [];
        const todayLog = habit.completions.find(c => c.date === today);
        if (todayLog) {
            todayLog.done = !todayLog.done;
        } else {
            habit.completions.push({ date: today, done: true });
        }
        this.save(); this.render();
        this.toast(todayLog?.done === false || !todayLog ? '✓ Habit done' : '○ Undone');
    },

    calcStreak(completions) {
        // Legacy function - use calculateStreaks instead
        const result = this.calculateStreaks({ completions });
        return result.current;
    },

    calculateStreaks(habit) {
        if (!habit.completions || habit.completions.length === 0) {
            return { current: 0, longest: 0 };
        }
        
        // Extract dates from completions (handle both old and new format)
        const dates = habit.completions
            .filter(c => c.done !== false)
            .map(c => {
                if (typeof c === 'string') return new Date(c);
                return new Date(c.date);
            })
            .sort((a, b) => a - b);
        
        if (dates.length === 0) {
            return { current: 0, longest: 0 };
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Calculate current streak
        let currentStreak = 0;
        let checkDate = new Date(today);
        
        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const hasCompletion = habit.completions.some(c => {
                if (typeof c === 'string') {
                    return c.startsWith(dateStr);
                }
                return c.date && c.date.startsWith(dateStr) && c.done !== false;
            });
            
            if (hasCompletion) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        // Calculate longest streak
        let longestStreak = 0;
        let tempStreak = 1;
        
        for (let i = 1; i < dates.length; i++) {
            const diff = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
            
            if (diff === 1) {
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else {
                tempStreak = 1;
            }
        }
        
        longestStreak = Math.max(longestStreak, currentStreak, 1);
        
        return { current: currentStreak, longest: longestStreak };
    },

    renderHeatmap(completions) {
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const log = completions?.find(c => c.date === dateStr);
            const done = log?.done || false;
            days.push(`<div class="heatmap-day ${done ? 'done' : ''}" title="${displayDate}${done ? ' ✓' : ''}"></div>`);
        }
        return `<div class="heatmap">${days.join('')}</div>`;
    },

    // HABIT TIMER SYSTEM
    startHabitTimer(habitId) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit) return;

        // Initialize micro steps if not present
        if (!habit.microSteps || habit.microSteps.length === 0) {
            this.promptMicroSteps(habitId);
            return;
        }

        // Prompt for duration, intention, and timer mode
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">⏱️ Set Timer for "${esc(habit.title)}"</h3>
            
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--dim);margin-bottom:6px;">Timer Mode</label>
                <select id="timer-mode" style="margin-bottom:0;">
                    <option value="zen">🧘 Zen Mode - One step at a time (Recommended)</option>
                    <option value="classic">📋 Classic Mode - All steps visible</option>
                </select>
            </div>
            
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--dim);margin-bottom:6px;">Duration (minutes)</label>
                <input type="number" id="timer-duration" value="25" min="1" max="180" 
                       placeholder="e.g., 25" style="margin-bottom:0;">
            </div>
            
            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--dim);margin-bottom:6px;">Intention (What will you accomplish?)</label>
                <textarea id="timer-intention" placeholder="e.g., Complete full morning routine without distractions" 
                          rows="3" style="margin-bottom:0;"></textarea>
            </div>
            
            <button class="btn" onclick="App.startHabitTimerWithIntent('${habitId}')">Start Timer</button>
        `;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('timer-mode')?.focus(), 80);
    },

    startHabitTimerWithIntent(habitId) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit) return;

        const duration = parseInt(document.getElementById('timer-duration')?.value) || 25;
        const intention = document.getElementById('timer-intention')?.value?.trim() || '';
        const mode = document.getElementById('timer-mode')?.value || 'zen';

        // Reset all micro steps to pending at start
        habit.microSteps.forEach(step => {
            if (step.status !== 'done') {
                step.status = 'pending';
            }
        });
        this.save();

        // NEW: Route to Zen Mode or Classic Mode
        if (mode === 'zen') {
            this.startZenTimer(habitId, duration, intention);
        } else {
            this.startClassicTimer(habitId, duration, intention);
        }
    },
    
    // NEW: Zen Mode Timer - One step at a time
    startZenTimer(habitId, duration, intention) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit) return;
        
        this.zenMode = {
            active: true,
            habitId: habitId,
            taskId: null,
            intention: intention,
            currentStepIndex: 0,
            startTime: Date.now(),
            duration: 0,
            targetDuration: duration * 60,
            interval: null,
            isPaused: false,
            steps: habit.microSteps || []
        };
        
        this.closeModal();
        this.showZenTimer();
        
        // Start interval
        this.zenMode.interval = setInterval(() => {
            if (!this.zenMode.isPaused) {
                this.zenMode.duration = Math.floor((Date.now() - this.zenMode.startTime) / 1000);
                this.updateZenTimerDisplay();
            }
        }, 1000);
        
        // Initial display
        this.updateZenTimerDisplay();
    },
    
    // Classic Timer (existing functionality)
    startClassicTimer(habitId, duration, intention) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit) return;

        this.habitTimer = {
            habitId: habitId,
            startTime: Date.now(),
            duration: 0,
            targetDuration: duration * 60, // Convert to seconds
            intention: intention,
            interval: null,
            isPaused: false
        };

        this.showHabitTimerOverlay();
        
        // FIXED: Force immediate display update BEFORE starting interval
        this.updateHabitTimerDisplay();
        
        // FIXED: Start interval - timer will tick every second
        this.habitTimer.interval = setInterval(() => {
            if (!this.habitTimer.isPaused) {
                this.habitTimer.duration = Math.floor((Date.now() - this.habitTimer.startTime) / 1000);
                this.updateHabitTimerDisplay();
            }
        }, 1000);
    },

    promptMicroSteps(habitId) {
        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit) return;

        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">Break "${esc(habit.title)}" into Micro-Steps</h3>
            <p style="font-size:13px;color:var(--dim);margin-bottom:12px;">Enter each tiny step on a new line. Make them as small as possible!</p>
            <textarea id="micro-steps" placeholder="Example for 'Workout':
Lay out yoga mat
Put on workout clothes
Do 5 push-ups
Drink water
..." rows="8" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveMicroSteps('${habitId}')">Save & Start Timer</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('micro-steps')?.focus(), 80);
    },

    saveMicroSteps(habitId) {
        const stepsText = document.getElementById('micro-steps')?.value?.trim();
        if (!stepsText) {
            this.toast('⚠️ Enter at least one step');
            return;
        }

        const habit = this.data.system.habits.find(h => h.id === habitId);
        if (!habit) return;

        const steps = stepsText.split('\n')
            .filter(s => s.trim())
            .map(s => ({
                title: s.trim(),
                status: 'pending' // pending, done, skipped
            }));

        habit.microSteps = steps;
        this.save();
        this.closeModal();
        this.startHabitTimer(habitId);
    },

    showHabitTimerOverlay() {
        const habit = this.data.system.habits.find(h => h.id === this.habitTimer.habitId);
        if (!habit) return;

        document.getElementById('habit-timer-overlay').classList.add('active');
        this.updateHabitTimerDisplay();
    },

    updateHabitTimerDisplay() {
        const habit = this.data.system.habits.find(h => h.id === this.habitTimer.habitId);
        if (!habit) return;

        // Calculate time remaining (COUNTDOWN)
        const timeRemaining = Math.max(0, this.habitTimer.targetDuration - this.habitTimer.duration);
        const remainingMins = Math.floor(timeRemaining / 60);
        const remainingSecs = timeRemaining % 60;
        const countdownStr = `${String(remainingMins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;

        // Calculate elapsed time (for secondary display)
        const minutes = Math.floor(this.habitTimer.duration / 60);
        const seconds = this.habitTimer.duration % 60;
        const elapsedStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        const completedSteps = habit.microSteps?.filter(s => s.status === 'done').length || 0;
        const totalSteps = habit.microSteps?.length || 0;
        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        // Calculate time progress
        const timeProgress = this.habitTimer.targetDuration > 0 
            ? Math.min(Math.round((this.habitTimer.duration / this.habitTimer.targetDuration) * 100), 100) 
            : 0;
        const targetMinutes = Math.floor(this.habitTimer.targetDuration / 60);

        // FIXED: Use wrapper div with flex column layout for proper structure
        let html = `
            <div style="display:flex;flex-direction:column;height:100%;max-height:85vh;">
                <!-- TOP: Title, Intention & Countdown (Fixed Position) -->
                <div style="flex-shrink:0;text-align:center;padding:16px;">
                    <div class="habit-timer-title" style="margin-bottom:12px;">${esc(habit.title)}</div>
                    
                    ${this.habitTimer.intention ? `
                        <div style="background:var(--sub);padding:12px;border-radius:8px;margin-bottom:16px;
                             border-left:3px solid var(--accent);">
                            <div style="font-size:11px;color:var(--dim);text-transform:uppercase;
                                 letter-spacing:1px;margin-bottom:4px;">INTENTION</div>
                            <div style="font-size:13px;line-height:1.5;">${esc(this.habitTimer.intention)}</div>
                        </div>
                    ` : ''}
                    
                    <div class="habit-timer-clock countdown-ticking" style="margin:16px 0 8px 0;position:relative;">
                        ${countdownStr}
                        <div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);
                                    font-size:10px;color:var(--success);font-weight:600;
                                    text-transform:uppercase;letter-spacing:2px;">
                            ${this.habitTimer.isPaused ? '⏸ PAUSED' : '▶ RUNNING'}
                        </div>
                    </div>
                    <div style="font-size:11px;color:var(--dim);letter-spacing:2px;margin-top:24px;">REMAINING</div>
                    
                    ${this.habitTimer.targetDuration > 0 ? `
                        <div style="margin:16px 0 0 0;">
                            <span style="color:rgba(255,255,255,0.4);font-size:12px;">Spent: </span>
                            <span style="color:rgba(255,255,255,0.6);font-size:14px;font-weight:500;font-family:monospace;">
                                ${elapsedStr}
                            </span>
                            <span style="color:rgba(255,255,255,0.4);font-size:12px;"> / ${targetMinutes}:00</span>
                        </div>
                        <div style="margin:12px 0;">
                            <div style="height:6px;background:var(--void);border-radius:3px;overflow:hidden;
                                 border:1px solid var(--border);">
                                <div style="width:${timeProgress}%;height:100%;background:var(--accent);
                                     border-radius:3px;transition:width 1s linear;"></div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- MIDDLE: Scrollable Micro-Steps List -->
                <div style="flex:1;overflow-y:auto;padding:0 16px;margin-bottom:16px;">
                    ${habit.microSteps?.length > 0 ? `
                        <div style="margin-bottom:16px;">
                            <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;">
                                Micro-Steps Checklist
                            </div>
                            
                            ${habit.microSteps.map((step, idx) => {
                                const isCompleted = step.status === 'done';
                                const isSkipped = step.status === 'skipped';
                                
                                return `
                                    <div style="display:flex;align-items:center;justify-content:space-between;
                                                padding:12px;background:var(--sub);border-radius:8px;
                                                margin-bottom:8px;border:1px solid var(--border);
                                                ${isCompleted ? 'opacity:0.6;' : ''}">
                                        <div style="flex:1;color:${isCompleted || isSkipped ? 'var(--dim)' : 'var(--text)'};
                                                    text-decoration:${isCompleted ? 'line-through' : 'none'};
                                                    font-size:14px;">
                                            ${esc(step.title)}
                                        </div>
                                        
                                        ${!isCompleted && !isSkipped ? `
                                            <div style="display:flex;gap:6px;">
                                                <button onclick="App.skipMicroStep(${idx})" 
                                                        style="padding:6px 12px;background:var(--border);
                                                               border:none;border-radius:6px;color:var(--dim);
                                                               font-size:12px;cursor:pointer;">
                                                    Skip
                                                </button>
                                                <button onclick="App.completeMicroStep(${idx})" 
                                                        style="padding:6px 12px;background:var(--success);
                                                               border:none;border-radius:6px;color:var(--void);
                                                               font-size:12px;font-weight:600;cursor:pointer;">
                                                    Done
                                                </button>
                                            </div>
                                        ` : isCompleted ? `
                                            <div style="font-size:18px;color:var(--success);">✓</div>
                                        ` : `
                                            <div style="font-size:12px;color:var(--dim);">Skipped</div>
                                        `}
                                    </div>
                                `;
                            }).join('')}
                            
                            <div style="margin-top:16px;height:4px;background:var(--void);border-radius:2px;overflow:hidden;border:1px solid var(--border);">
                                <div style="width:${progress}%;height:100%;background:var(--success);transition:width 0.3s;"></div>
                            </div>
                            <div style="text-align:center;margin-top:8px;font-size:13px;color:var(--dim);">
                                ${completedSteps}/${totalSteps} completed (${progress}%)
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- BOTTOM: Buttons on Same Line (Fixed Position) -->
                <div style="flex-shrink:0;display:flex;gap:12px;padding:16px;border-top:1px solid var(--border);">
                    <button onclick="App.pauseHabitTimer()" 
                            style="flex:1;padding:14px;background:var(--warn);color:var(--void);
                                   border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
                        ${this.habitTimer.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                    </button>
                    <button onclick="App.completeHabitSession()" 
                            style="flex:1;padding:14px;background:var(--success);color:var(--void);
                                   border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
                        ✓ Complete
                    </button>
                    <button onclick="App.stopHabitTimer()" 
                            style="flex:1;padding:14px;background:var(--danger);color:var(--text);
                                   border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
                        ✕ Stop
                    </button>
                </div>
            </div>
        `;

        document.getElementById('habit-timer-content').innerHTML = html;

        // FIXED: Update header badge with countdown string (not undefined timeStr)
        const badge = document.getElementById('timer-badge');
        if (badge) {
            badge.textContent = countdownStr;
            badge.classList.add('active');
        }

        // Auto-complete if all steps done
        if (totalSteps > 0 && completedSteps === totalSteps) {
            setTimeout(() => this.completeHabitSession(), 1000);
        }
    },

    pauseHabitTimer() {
        this.habitTimer.isPaused = !this.habitTimer.isPaused;
        this.updateHabitTimerDisplay();
    },

    stopHabitTimer() {
        if (!confirm('Stop this habit session?')) return;
        
        if (this.habitTimer.interval) {
            clearInterval(this.habitTimer.interval);
        }

        document.getElementById('habit-timer-overlay').classList.remove('active');
        document.getElementById('timer-badge').classList.remove('active');
        
        this.habitTimer = {
            habitId: null,
            startTime: null,
            duration: 0,
            interval: null,
            isPaused: false
        };

        this.render();
    },

    completeMicroStep(stepIdx) {
        const habit = this.data.system.habits.find(h => h.id === this.habitTimer.habitId);
        if (!habit || !habit.microSteps[stepIdx]) return;

        habit.microSteps[stepIdx].status = 'done';
        this.save();
        this.updateHabitTimerDisplay();
        this.toast('✓ Step completed');
    },

    skipMicroStep(stepIdx) {
        const habit = this.data.system.habits.find(h => h.id === this.habitTimer.habitId);
        if (!habit || !habit.microSteps[stepIdx]) return;

        habit.microSteps[stepIdx].status = 'skipped';
        this.save();
        this.updateHabitTimerDisplay();
        this.toast('→ Step skipped');
    },

    completeHabitSession() {
        const habit = this.data.system.habits.find(h => h.id === this.habitTimer.habitId);
        if (!habit) return;

        const completedSteps = habit.microSteps?.filter(s => s.status === 'done').length || 0;
        const totalSteps = habit.microSteps?.length || 0;

        this.celebrate('🎉', 'Habit Session Complete!', `${completedSteps}/${totalSteps} steps completed in ${Math.floor(this.habitTimer.duration / 60)} min`);
        
        // Mark habit as done for today
        this.toggleHabit(this.habitTimer.habitId);
        
        // Stop timer
        setTimeout(() => {
            this.stopHabitTimer();
        }, 2000);
    },
    
    // ========== ZEN MODE TIMER FUNCTIONS ==========
    
    showZenTimer() {
        document.getElementById('zen-timer-overlay').classList.add('active');
        this.updateZenTimerDisplay();
    },
    
    updateZenTimerDisplay() {
        const habit = this.data.system.habits.find(h => h.id === this.zenMode.habitId);
        if (!habit) return;
        
        // Calculate countdown
        const timeRemaining = Math.max(0, this.zenMode.targetDuration - this.zenMode.duration);
        const remainingMins = Math.floor(timeRemaining / 60);
        const remainingSecs = timeRemaining % 60;
        const countdownStr = `${String(remainingMins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
        
        // Get current step
        const currentStep = this.zenMode.steps[this.zenMode.currentStepIndex];
        const completedSteps = this.zenMode.steps.filter(s => s.status === 'done').length;
        const totalSteps = this.zenMode.steps.length;
        
        // Check if all steps are done
        if (this.zenMode.currentStepIndex >= totalSteps) {
            this.completeZenSession();
            return;
        }
        
        const html = `
            <div class="zen-title">${esc(habit.title)}</div>
            
            ${this.zenMode.intention ? `
                <div class="zen-intention">
                    <div class="zen-intention-label">Your Intention</div>
                    <div class="zen-intention-text">${esc(this.zenMode.intention)}</div>
                </div>
            ` : ''}
            
            <div class="zen-countdown ${this.zenMode.isPaused ? '' : 'zen-pulse'}">
                ${countdownStr}
            </div>
            
            <div class="zen-step-card">
                <div class="zen-step-number">${this.zenMode.currentStepIndex + 1}</div>
                <div class="zen-step-text">${esc(currentStep.title)}</div>
                <div class="zen-step-progress">${completedSteps} of ${totalSteps} completed</div>
                
                <div class="zen-buttons">
                    <button class="zen-btn zen-btn-skip" onclick="App.zenSkipStep()">
                        Skip
                    </button>
                    <button class="zen-btn zen-btn-done" onclick="App.zenCompleteStep()">
                        ✓ Done
                    </button>
                </div>
            </div>
            
            <div class="zen-controls">
                <button class="zen-control-btn" onclick="App.zenTogglePause()">
                    ${this.zenMode.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button class="zen-control-btn" onclick="App.zenStopTimer()">
                    ✕ Stop
                </button>
            </div>
        `;
        
        document.getElementById('zen-timer-content').innerHTML = html;
        
        // Update header badge
        const badge = document.getElementById('timer-badge');
        if (badge) {
            badge.textContent = countdownStr;
            badge.classList.add('active');
        }
    },
    
    zenCompleteStep() {
        const habit = this.data.system.habits.find(h => h.id === this.zenMode.habitId);
        if (!habit) return;
        
        // Mark current step as done
        const currentIndex = this.zenMode.currentStepIndex;
        if (currentIndex < this.zenMode.steps.length) {
            this.zenMode.steps[currentIndex].status = 'done';
            habit.microSteps[currentIndex].status = 'done';
            this.save();
        }
        
        // Move to next step
        this.zenMode.currentStepIndex++;
        
        // Update display
        this.updateZenTimerDisplay();
        
        // Haptic feedback (if available)
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    },
    
    zenSkipStep() {
        const habit = this.data.system.habits.find(h => h.id === this.zenMode.habitId);
        if (!habit) return;
        
        // Mark current step as skipped
        const currentIndex = this.zenMode.currentStepIndex;
        if (currentIndex < this.zenMode.steps.length) {
            this.zenMode.steps[currentIndex].status = 'skipped';
            habit.microSteps[currentIndex].status = 'skipped';
            this.save();
        }
        
        // Move to next step
        this.zenMode.currentStepIndex++;
        
        // Update display
        this.updateZenTimerDisplay();
    },
    
    zenTogglePause() {
        this.zenMode.isPaused = !this.zenMode.isPaused;
        
        if (this.zenMode.isPaused) {
            // Store pause time
            this.zenMode.pausedAt = Date.now();
        } else {
            // Adjust start time to account for pause duration
            const pauseDuration = Date.now() - this.zenMode.pausedAt;
            this.zenMode.startTime += pauseDuration;
        }
        
        this.updateZenTimerDisplay();
    },
    
    zenStopTimer() {
        if (!confirm('Stop this Zen session?')) return;
        
        if (this.zenMode.interval) {
            clearInterval(this.zenMode.interval);
        }
        
        document.getElementById('zen-timer-overlay').classList.remove('active');
        document.getElementById('timer-badge').classList.remove('active');
        
        // Reset zen mode
        this.zenMode = {
            active: false,
            habitId: null,
            taskId: null,
            intention: '',
            currentStepIndex: 0,
            startTime: null,
            duration: 0,
            targetDuration: 0,
            interval: null,
            isPaused: false,
            steps: []
        };
        
        this.render();
    },
    
    completeZenSession() {
        const habit = this.data.system.habits.find(h => h.id === this.zenMode.habitId);
        if (!habit) return;
        
        const completedSteps = this.zenMode.steps.filter(s => s.status === 'done').length;
        const totalSteps = this.zenMode.steps.length;
        const minutes = Math.floor(this.zenMode.duration / 60);
        
        this.celebrate('🧘', 'Zen Session Complete!', `${completedSteps}/${totalSteps} steps • ${minutes} min`);
        
        // Mark habit as done for today (this will increment streak)
        this.toggleHabit(this.zenMode.habitId);
        
        // Stop timer after celebration - NO CONFIRM DIALOG
        setTimeout(() => {
            this.zenStopTimerAutomatic();
        }, 2500);
    },
    
    // New function: Stop timer without confirmation (for auto-completion)
    zenStopTimerAutomatic() {
        if (this.zenMode.interval) {
            clearInterval(this.zenMode.interval);
        }
        
        document.getElementById('zen-timer-overlay').classList.remove('active');
        document.getElementById('timer-badge').classList.remove('active');
        
        // Reset zen mode
        this.zenMode = {
            active: false,
            habitId: null,
            taskId: null,
            intention: '',
            currentStepIndex: 0,
            startTime: null,
            duration: 0,
            targetDuration: 0,
            interval: null,
            isPaused: false,
            steps: []
        };
        
        this.render();
    },

    // MICROHABITS

    // REFLECTIONS
    addReflection(type) {
        const title = type === 'morning' ? '🌅 Morning Reflection' : '🌙 Evening Reflection';
        const placeholder = type === 'morning' 
            ? 'What are my intentions for today?\nWhat am I grateful for?\nWhat will I focus on?'
            : 'What did I learn today?\nWhat am I grateful for?\nWhat will I do differently tomorrow?';
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">${title}</h3>
            <textarea id="ref-text" placeholder="${placeholder}" rows="8" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveReflection('${type}')">Save Reflection</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('ref-text')?.focus(), 80);
    },

    saveReflection(type) {
        const text = document.getElementById('ref-text')?.value?.trim();
        if (!text) { this.toast('⚠️ Enter text'); return; }
        if (!this.data.system.reflections[type]) this.data.system.reflections[type] = [];
        this.data.system.reflections[type].push({
            id: this.genId(),
            text,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Reflection saved');
    },

    // JOURNAL
    addJournalEntry() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">✍️ Journal Entry</h3>
            <textarea id="journal-text" placeholder="What's on your mind?" rows="10" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveJournalEntry()">Save Entry</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('journal-text')?.focus(), 80);
    },

    saveJournalEntry() {
        const text = document.getElementById('journal-text')?.value?.trim();
        if (!text) { this.toast('⚠️ Enter text'); return; }
        if (!this.data.system.journal) this.data.system.journal = [];
        this.data.system.journal.push({
            id: this.genId(),
            text,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Journal entry saved');
    },

    // REVIEWS
    addWeeklyReview() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">📊 Weekly Review</h3>
            <textarea id="review-wins" placeholder="Wins this week..." rows="4" style="margin-bottom:12px;"></textarea>
            <textarea id="review-lessons" placeholder="Lessons learned..." rows="4" style="margin-bottom:12px;"></textarea>
            <textarea id="review-next" placeholder="Focus for next week..." rows="4" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveWeeklyReview()">Save Review</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('review-wins')?.focus(), 80);
    },

    saveWeeklyReview() {
        const wins = document.getElementById('review-wins')?.value?.trim();
        const lessons = document.getElementById('review-lessons')?.value?.trim();
        const nextWeek = document.getElementById('review-next')?.value?.trim();
        if (!wins && !lessons && !nextWeek) { this.toast('⚠️ Enter at least one field'); return; }
        if (!this.data.system.reviews) this.data.system.reviews = [];
        this.data.system.reviews.push({
            id: this.genId(),
            wins,
            lessons,
            nextWeek,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Review saved');
    },

    // ============================================================================
    // SYSTEM TAB ENHANCEMENTS - v2.1
    // ============================================================================
    
    // Data Migration - Ensure IDs on all items
    ensureIds(data) {
        // Reflections
        if (data.system?.reflections) {
            ['morning', 'evening'].forEach(type => {
                if (data.system.reflections[type]) {
                    data.system.reflections[type] = data.system.reflections[type].map(r => ({
                        ...r,
                        id: r.id || this.genId(),
                        tags: r.tags || []
                    }));
                }
            });
        }
        
        // Journal
        if (data.system?.journal) {
            data.system.journal = data.system.journal.map(j => ({
                ...j,
                id: j.id || this.genId(),
                tags: j.tags || []
            }));
        }
        
        // Reviews
        if (data.system?.reviews) {
            data.system.reviews = data.system.reviews.map(r => ({
                ...r,
                id: r.id || this.genId(),
                tags: r.tags || []
            }));
        }
        
        // Notes (vault)
        if (data.vault?.learnings?.notes) {
            data.vault.learnings.notes = data.vault.learnings.notes.map(n => ({
                ...n,
                id: n.id || this.genId(),
                tags: n.tags || []
            }));
        }
    },
    
    // ========== ENHANCED REFLECTION CRUD ==========
    
    editReflection(type, id) {
        const ref = this.data.system.reflections[type]?.find(r => r.id === id);
        if (!ref) return;
        
        const title = type === 'morning' ? '🌅 Edit Morning Reflection' : '🌙 Edit Evening Reflection';
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">${title}</h3>
            <div style="font-size:11px;color:var(--dim);margin-bottom:8px;">Original: ${new Date(ref.date).toLocaleDateString()}</div>
            <textarea id="ref-text-edit" rows="8" style="margin-bottom:12px;">${esc(ref.text)}</textarea>
            <button class="btn" onclick="App.updateReflection('${type}', '${id}')">Update Reflection</button>
            <button class="btn-sec" onclick="App.closeModal()" style="margin-top:8px;">Cancel</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('ref-text-edit')?.focus(), 80);
    },
    
    updateReflection(type, id) {
        const text = document.getElementById('ref-text-edit')?.value?.trim();
        if (!text) { this.toast('⚠️ Enter text'); return; }
        
        const ref = this.data.system.reflections[type]?.find(r => r.id === id);
        if (ref) {
            ref.text = text;
            ref.modified = new Date().toISOString();
            this.save(); this.closeModal(); this.render();
            this.toast('✓ Reflection updated');
        }
    },
    
    deleteReflection(type, id) {
        if (!confirm('Delete this reflection?')) return;
        this.data.system.reflections[type] = this.data.system.reflections[type].filter(r => r.id !== id);
        this.save(); this.render();
        this.toast('✓ Reflection deleted');
    },
    
    // ========== ENHANCED JOURNAL CRUD ==========
    
    editJournalEntry(id) {
        const entry = this.data.system.journal?.find(e => e.id === id);
        if (!entry) return;
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">✍️ Edit Journal Entry</h3>
            <div style="font-size:11px;color:var(--dim);margin-bottom:8px;">Original: ${new Date(entry.date).toLocaleDateString()}</div>
            <textarea id="journal-text-edit" rows="10" style="margin-bottom:12px;">${esc(entry.text)}</textarea>
            <button class="btn" onclick="App.updateJournalEntry('${id}')">Update Entry</button>
            <button class="btn-sec" onclick="App.closeModal()" style="margin-top:8px;">Cancel</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('journal-text-edit')?.focus(), 80);
    },
    
    updateJournalEntry(id) {
        const text = document.getElementById('journal-text-edit')?.value?.trim();
        if (!text) { this.toast('⚠️ Enter text'); return; }
        
        const entry = this.data.system.journal?.find(e => e.id === id);
        if (entry) {
            entry.text = text;
            entry.modified = new Date().toISOString();
            this.save(); this.closeModal(); this.render();
            this.toast('✓ Entry updated');
        }
    },
    
    deleteJournalEntry(id) {
        if (!confirm('Delete this journal entry?')) return;
        this.data.system.journal = this.data.system.journal.filter(e => e.id !== id);
        this.save(); this.render();
        this.toast('✓ Entry deleted');
    },
    
    // ========== ENHANCED REVIEW CRUD ==========
    
    editReview(id) {
        const review = this.data.system.reviews?.find(r => r.id === id);
        if (!review) return;
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">📊 Edit Weekly Review</h3>
            <div style="font-size:11px;color:var(--dim);margin-bottom:8px;">Week of ${new Date(review.date).toLocaleDateString()}</div>
            <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block;">Wins</label>
            <textarea id="review-wins-edit" rows="4" style="margin-bottom:12px;">${esc(review.wins || '')}</textarea>
            <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block;">Lessons</label>
            <textarea id="review-lessons-edit" rows="4" style="margin-bottom:12px;">${esc(review.lessons || '')}</textarea>
            <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block;">Next Week</label>
            <textarea id="review-next-edit" rows="4" style="margin-bottom:12px;">${esc(review.nextWeek || '')}</textarea>
            <button class="btn" onclick="App.updateReview('${id}')">Update Review</button>
            <button class="btn-sec" onclick="App.closeModal()" style="margin-top:8px;">Cancel</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('review-wins-edit')?.focus(), 80);
    },
    
    updateReview(id) {
        const wins = document.getElementById('review-wins-edit')?.value?.trim();
        const lessons = document.getElementById('review-lessons-edit')?.value?.trim();
        const nextWeek = document.getElementById('review-next-edit')?.value?.trim();
        if (!wins && !lessons && !nextWeek) { this.toast('⚠️ Enter at least one field'); return; }
        
        const review = this.data.system.reviews?.find(r => r.id === id);
        if (review) {
            review.wins = wins;
            review.lessons = lessons;
            review.nextWeek = nextWeek;
            review.modified = new Date().toISOString();
            this.save(); this.closeModal(); this.render();
            this.toast('✓ Review updated');
        }
    },
    
    deleteReview(id) {
        if (!confirm('Delete this review?')) return;
        this.data.system.reviews = this.data.system.reviews.filter(r => r.id !== id);
        this.save(); this.render();
        this.toast('✓ Review deleted');
    },
    
    // ========== SORTING SYSTEM ==========
    
    setSystemSort(section, sortType) {
        this.systemSort[section] = sortType;
        this.render();
    },
    
    sortSystemItems(items, sortType) {
        const sorted = [...items];
        
        switch(sortType) {
            case 'date-desc':
                return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
            case 'date-asc':
                return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
            case 'modified-desc':
                return sorted.sort((a, b) => {
                    const aTime = new Date(a.modified || a.date).getTime();
                    const bTime = new Date(b.modified || b.date).getTime();
                    return bTime - aTime;
                });
            case 'length-desc':
                return sorted.sort((a, b) => {
                    const aLen = (a.text || a.wins || '').length;
                    const bLen = (b.text || b.wins || '').length;
                    return bLen - aLen;
                });
            case 'tags':
                return sorted.sort((a, b) => {
                    const aTags = (a.tags || []).length;
                    const bTags = (b.tags || []).length;
                    return bTags - aTags;
                });
            default:
                return sorted;
        }
    },
    
    // ========== TAG SYSTEM ==========
    
    promptAddSystemTag(section, type, id) {
        const tag = prompt('Enter tag:')?.trim();
        if (!tag) return;
        this.addSystemTag(section, type, id, tag);
    },
    
    addSystemTag(section, type, id, tag) {
        let item;
        if (section === 'reflections') {
            item = this.data.system.reflections[type]?.find(r => r.id === id);
        } else if (section === 'journal') {
            item = this.data.system.journal?.find(e => e.id === id);
        } else if (section === 'reviews') {
            item = this.data.system.reviews?.find(r => r.id === id);
        }
        
        if (item) {
            if (!item.tags) item.tags = [];
            if (!item.tags.includes(tag)) {
                item.tags.push(tag);
                this.save(); this.render();
                this.toast(`✓ Tagged: ${tag}`);
            }
        }
    },
    
    removeSystemTag(section, type, id, tag) {
        let item;
        if (section === 'reflections') {
            item = this.data.system.reflections[type]?.find(r => r.id === id);
        } else if (section === 'journal') {
            item = this.data.system.journal?.find(e => e.id === id);
        } else if (section === 'reviews') {
            item = this.data.system.reviews?.find(r => r.id === id);
        }
        
        if (item && item.tags) {
            item.tags = item.tags.filter(t => t !== tag);
            this.save(); this.render();
            this.toast('✓ Tag removed');
        }
    },
    
    // ========== BULK OPERATIONS ==========
    
    toggleSystemBulkMode(section) {
        this.bulkMode[section] = !this.bulkMode[section];
        if (!this.bulkMode[section]) {
            this.selectedItems[section].clear();
        }
        this.render();
    },
    
    toggleSystemItemSelection(section, id) {
        if (this.selectedItems[section].has(id)) {
            this.selectedItems[section].delete(id);
        } else {
            this.selectedItems[section].add(id);
        }
        this.render();
    },
    
    renderBulkToolbar(section, type) {
        const count = this.selectedItems[section].size;
        const toolbar = document.getElementById('bulk-toolbar');
        if (!toolbar) return;
        
        if (count > 0) {
            toolbar.innerHTML = `
                <div style="color:var(--text);font-size:13px;font-weight:600;">${count} selected</div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-sec" onclick="App.bulkTag('${section}', '${type}')">🏷️ Tag All</button>
                    <button class="btn-sec" onclick="App.bulkExport('${section}', '${type}')">📥 Export</button>
                    <button class="btn-sec btn-danger" onclick="App.bulkDelete('${section}', '${type}')">🗑️ Delete</button>
                    <button class="btn-sec" onclick="App.toggleSystemBulkMode('${section}')">Cancel</button>
                </div>
            `;
            toolbar.classList.add('active');
        } else {
            toolbar.classList.remove('active');
        }
    },
    
    bulkTag(section, type) {
        const tag = prompt('Enter tag for selected items:')?.trim();
        if (!tag) return;
        
        this.selectedItems[section].forEach(id => {
            this.addSystemTag(section, type, id, tag);
        });
        
        this.selectedItems[section].clear();
        this.bulkMode[section] = false;
        this.render();
    },
    
    bulkExport(section, type) {
        const items = [];
        
        this.selectedItems[section].forEach(id => {
            let item;
            if (section === 'reflections') {
                item = this.data.system.reflections[type]?.find(r => r.id === id);
            } else if (section === 'journal') {
                item = this.data.system.journal?.find(e => e.id === id);
            } else if (section === 'reviews') {
                item = this.data.system.reviews?.find(r => r.id === id);
            }
            if (item) items.push(item);
        });
        
        try {
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${section}-bulk-export-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            
            // Clean up blob URL to prevent memory leak
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.toast(`✓ Exported ${items.length} items`);
        } catch (e) {
            this.toast('⚠️ Export failed');
            console.error('Export error:', e);
        }
    },
    
    bulkDelete(section, type) {
        if (!confirm(`Delete ${this.selectedItems[section].size} items?`)) return;
        
        if (section === 'reflections') {
            this.data.system.reflections[type] = this.data.system.reflections[type].filter(
                r => !this.selectedItems[section].has(r.id)
            );
        } else if (section === 'journal') {
            this.data.system.journal = this.data.system.journal.filter(
                e => !this.selectedItems[section].has(e.id)
            );
        } else if (section === 'reviews') {
            this.data.system.reviews = this.data.system.reviews.filter(
                r => !this.selectedItems[section].has(r.id)
            );
        }
        
        this.selectedItems[section].clear();
        this.bulkMode[section] = false;
        this.save(); this.render();
        this.toast('✓ Items deleted');
    },
    
    // ========== EXPORT SYSTEM ==========
    
    exportSystemItem(section, type, id) {
        let item;
        if (section === 'reflections') {
            item = this.data.system.reflections[type]?.find(r => r.id === id);
        } else if (section === 'journal') {
            item = this.data.system.journal?.find(e => e.id === id);
        } else if (section === 'reviews') {
            item = this.data.system.reviews?.find(r => r.id === id);
        }
        
        if (!item) return;
        
        try {
            const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${section}-${id}-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            
            // Clean up blob URL to prevent memory leak
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.toast('✓ Exported');
        } catch (e) {
            this.toast('⚠️ Export failed');
            console.error('Export error:', e);
        }
    },
    
    exportAllSystemItems(section, type) {
        let items = [];
        if (section === 'reflections') {
            items = this.data.system.reflections[type] || [];
        } else if (section === 'journal') {
            items = this.data.system.journal || [];
        } else if (section === 'reviews') {
            items = this.data.system.reviews || [];
        }
        
        try {
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${section}-all-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            
            // Clean up blob URL to prevent memory leak
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.toast(`✓ Exported ${items.length} items`);
        } catch (e) {
            this.toast('⚠️ Export failed');
            console.error('Export error:', e);
        }
    },
    
    // ========== TEMPLATES SYSTEM ==========
    
    showSystemTemplates(section, type) {
        let templates = [];
        let title = '';
        
        if (section === 'reflections') {
            title = type === 'morning' ? '🌅 Morning Templates' : '🌙 Evening Templates';
            if (type === 'morning') {
                templates = [
                    { name: 'Gratitude Focus', content: 'Today I\'m grateful for:\n1. \n2. \n3. \n\nMy intentions for today:\n1. \n2. \n3. ' },
                    { name: 'Goal-Oriented', content: 'Top priority today:\n\nThree actions to move forward:\n1. \n2. \n3. \n\nPotential obstacles:\n\nHow I\'ll overcome them:' },
                    { name: 'Mindful Start', content: 'How I feel right now:\n\nWhat I need today:\n\nOne thing I\'ll do for myself:\n\nAffirmation:' }
                ];
            } else {
                templates = [
                    { name: 'Daily Review', content: 'Today\'s wins:\n1. \n2. \n3. \n\nLessons learned:\n\nTomorrow I\'ll:' },
                    { name: 'Gratitude Closure', content: 'Three things that went well:\n1. \n2. \n3. \n\nWhat I learned about myself:\n\nOne thing to improve:' },
                    { name: 'Progress Tracker', content: 'Goals I worked on:\n\nProgress made:\n\nChallenges faced:\n\nNext steps:' }
                ];
            }
        } else if (section === 'journal') {
            title = '✍️ Journal Templates';
            templates = [
                { name: 'Free Flow', content: 'Stream of consciousness - write without stopping...\n\n' },
                { name: 'Problem Solving', content: 'Current challenge:\n\nWhy it matters:\n\nPossible solutions:\n1. \n2. \n3. \n\nNext action:' },
                { name: 'Creative Ideas', content: 'Idea:\n\nWhy it excites me:\n\nFirst steps:\n\nResources needed:' },
                { name: 'Life Update', content: 'What\'s happening:\n\nHow I feel about it:\n\nWhat I\'m learning:\n\nWhat\'s next:' }
            ];
        } else if (section === 'reviews') {
            title = '📊 Review Templates';
            templates = [
                { wins: 'Win 1:\nWin 2:\nWin 3:', lessons: 'Lesson 1:\nLesson 2:', nextWeek: 'Priority 1:\nPriority 2:\nPriority 3:' },
                { wins: 'Professional wins:\n\nPersonal wins:\n\nHealth wins:', lessons: 'What worked:\n\nWhat didn\'t:\n\nInsights:', nextWeek: 'Must do:\n\nShould do:\n\nCould do:' },
                { wins: '', lessons: '', nextWeek: '' }
            ];
        }
        
        let html = `<h3 style="margin-bottom:20px;color:var(--accent);">${title}</h3>`;
        
        if (section === 'reviews') {
            html += templates.map((t, i) => `
                <button class="btn-sec" onclick="App.useSystemTemplate('${section}', '${type}', ${i})" 
                        style="width:100%;margin-bottom:8px;">
                    ${i === 0 ? 'Standard Review' : i === 1 ? 'Detailed Review' : 'Simple Review'}
                </button>
            `).join('');
        } else {
            html += templates.map((t, i) => `
                <button class="btn-sec" onclick="App.useSystemTemplate('${section}', '${type}', ${i})" 
                        style="width:100%;margin-bottom:8px;">
                    ${t.name}
                </button>
            `).join('');
        }
        
        html += `<button class="btn-sec" onclick="App.closeModal()" style="width:100%;margin-top:12px;">Cancel</button>`;
        
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('modal').classList.add('open');
    },
    
    useSystemTemplate(section, type, templateIndex) {
        this.closeModal();
        
        if (section === 'reflections') {
            const templates = type === 'morning' ? [
                'Today I\'m grateful for:\n1. \n2. \n3. \n\nMy intentions for today:\n1. \n2. \n3. ',
                'Top priority today:\n\nThree actions to move forward:\n1. \n2. \n3. \n\nPotential obstacles:\n\nHow I\'ll overcome them:',
                'How I feel right now:\n\nWhat I need today:\n\nOne thing I\'ll do for myself:\n\nAffirmation:'
            ] : [
                'Today\'s wins:\n1. \n2. \n3. \n\nLessons learned:\n\nTomorrow I\'ll:',
                'Three things that went well:\n1. \n2. \n3. \n\nWhat I learned about myself:\n\nOne thing to improve:',
                'Goals I worked on:\n\nProgress made:\n\nChallenges faced:\n\nNext steps:'
            ];
            
            this.addReflection(type);
            setTimeout(() => {
                const textarea = document.getElementById('ref-text');
                if (textarea) textarea.value = templates[templateIndex];
            }, 100);
        } else if (section === 'journal') {
            const templates = [
                'Stream of consciousness - write without stopping...\n\n',
                'Current challenge:\n\nWhy it matters:\n\nPossible solutions:\n1. \n2. \n3. \n\nNext action:',
                'Idea:\n\nWhy it excites me:\n\nFirst steps:\n\nResources needed:',
                'What\'s happening:\n\nHow I feel about it:\n\nWhat I\'m learning:\n\nWhat\'s next:'
            ];
            
            this.addJournalEntry();
            setTimeout(() => {
                const textarea = document.getElementById('journal-text');
                if (textarea) textarea.value = templates[templateIndex];
            }, 100);
        } else if (section === 'reviews') {
            const templates = [
                { wins: 'Win 1:\nWin 2:\nWin 3:', lessons: 'Lesson 1:\nLesson 2:', nextWeek: 'Priority 1:\nPriority 2:\nPriority 3:' },
                { wins: 'Professional wins:\n\nPersonal wins:\n\nHealth wins:', lessons: 'What worked:\n\nWhat didn\'t:\n\nInsights:', nextWeek: 'Must do:\n\nShould do:\n\nCould do:' },
                { wins: '', lessons: '', nextWeek: '' }
            ];
            
            this.addWeeklyReview();
            setTimeout(() => {
                const template = templates[templateIndex];
                const winsField = document.getElementById('review-wins');
                const lessonsField = document.getElementById('review-lessons');
                const nextField = document.getElementById('review-next');
                if (winsField) winsField.value = template.wins;
                if (lessonsField) lessonsField.value = template.lessons;
                if (nextField) nextField.value = template.nextWeek;
            }, 100);
        }
    },
    
    // ========== NOTES ANALYTICS (FIX) ==========
    
    showNotesAnalytics() {
        const notes = this.data.vault.learnings.notes || [];
        const stats = this.getNotesStats(notes);
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:20px;color:var(--accent);">📊 Notes Analytics</h3>
            
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--accent);">${stats.total}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Total Notes</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--success);">${stats.thisMonth}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">This Month</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:var(--blue);">${stats.avgPerWeek}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Avg/Week</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:var(--purple);">${stats.totalWords}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Total Words</div>
                </div>
            </div>
            
            ${stats.topTags.length > 0 ? `
                <div style="margin-bottom:20px;">
                    <h4 style="margin-bottom:12px;color:var(--dim);font-size:13px;font-weight:600;">TOP TAGS</h4>
                    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                        ${stats.topTags.map(([tag, count]) => `
                            <div style="padding:10px;background:var(--sub);border-radius:8px;display:flex;justify-content:space-between;">
                                <span style="color:var(--text);">🏷️ ${esc(tag)}</span>
                                <span style="color:var(--accent);font-weight:600;">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${stats.longest.length > 0 ? `
                <div style="margin-bottom:20px;">
                    <h4 style="margin-bottom:12px;color:var(--dim);font-size:13px;font-weight:600;">LONGEST NOTES</h4>
                    ${stats.longest.map(n => `
                        <div style="padding:10px;background:var(--sub);border-radius:8px;margin-bottom:6px;">
                            <div style="font-weight:600;color:var(--text);">${esc(n.title)}</div>
                            <div style="font-size:11px;color:var(--dim);margin-top:4px;">${n.words} words</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${stats.recent.length > 0 ? `
                <div style="margin-bottom:20px;">
                    <h4 style="margin-bottom:12px;color:var(--dim);font-size:13px;font-weight:600;">RECENT ACTIVITY</h4>
                    ${stats.recent.map(n => `
                        <div style="padding:10px;background:var(--sub);border-radius:8px;margin-bottom:6px;">
                            <div style="font-weight:600;color:var(--text);">${esc(n.title)}</div>
                            <div style="font-size:11px;color:var(--dim);margin-top:4px;">${new Date(n.date).toLocaleDateString()}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div style="margin-bottom:20px;">
                <h4 style="margin-bottom:12px;color:var(--dim);font-size:13px;font-weight:600;">ACTIVITY TIMELINE (Last 12 Months)</h4>
                <div id="notes-timeline" style="height:100px;background:var(--sub);border-radius:8px;padding:12px;"></div>
            </div>
            
            <button class="btn-sec" onclick="App.closeModal()" style="width:100%;">Close</button>
        `;
        
        document.getElementById('modal').classList.add('open');
        setTimeout(() => this.renderNotesTimeline(notes), 50);
    },
    
    getNotesStats(notes) {
        const now = new Date();
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const thisMonth = notes.filter(n => new Date(n.date) > monthAgo).length;
        
        const weeks = Math.ceil((now - new Date(notes[0]?.date || now)) / (1000 * 60 * 60 * 24 * 7)) || 1;
        const avgPerWeek = Math.round(notes.length / weeks);
        
        const totalWords = notes.reduce((sum, n) => sum + (n.content?.split(/\s+/).length || 0), 0);
        
        const tagCounts = {};
        notes.forEach(n => {
            (n.tags || []).forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        
        const longest = [...notes]
            .map(n => ({ ...n, words: (n.content?.split(/\s+/).length || 0) }))
            .sort((a, b) => b.words - a.words)
            .slice(0, 5);
        
        const recent = [...notes]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
        
        return {
            total: notes.length,
            thisMonth,
            avgPerWeek,
            totalWords,
            topTags,
            longest,
            recent
        };
    },
    
    renderNotesTimeline(notes) {
        const container = document.getElementById('notes-timeline');
        if (!container) return;
        
        const monthCounts = {};
        const now = new Date();
        
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[key] = 0;
        }
        
        notes.forEach(n => {
            const d = new Date(n.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (monthCounts[key] !== undefined) {
                monthCounts[key]++;
            }
        });
        
        const counts = Object.values(monthCounts);
        const max = Math.max(...counts, 1);
        
        container.innerHTML = `
            <div style="display:flex;gap:4px;height:100%;align-items:flex-end;">
                ${counts.map(count => {
                    const height = (count / max) * 100;
                    return `
                        <div style="flex:1;background:var(--accent);opacity:${count > 0 ? 0.3 + (count/max)*0.7 : 0.1};
                                    border-radius:4px 4px 0 0;height:${height}%;min-height:4px;"></div>
                    `;
                }).join('')}
            </div>
        `;
    },
    
    // ========== REFLECTION ANALYTICS ==========
    
    showReflectionAnalytics() {
        const morning = this.data.system.reflections.morning || [];
        const evening = this.data.system.reflections.evening || [];
        const total = morning.length + evening.length;
        
        const now = new Date();
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const thisMonthMorning = morning.filter(r => new Date(r.date) > monthAgo).length;
        const thisMonthEvening = evening.filter(r => new Date(r.date) > monthAgo).length;
        
        let currentStreak = 0;
        const today = new Date().toDateString();
        const allDates = [...morning, ...evening].map(r => new Date(r.date).toDateString());
        const uniqueDates = [...new Set(allDates)].sort((a, b) => new Date(b) - new Date(a));
        
        for (let i = 0; i < uniqueDates.length; i++) {
            const checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - i);
            if (uniqueDates.includes(checkDate.toDateString())) {
                currentStreak++;
            } else {
                break;
            }
        }
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:20px;color:var(--accent);">📊 Reflection Analytics</h3>
            
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--accent);">${total}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Total Reflections</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--success);">${currentStreak}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Day Streak</div>
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
                <div style="padding:16px;background:var(--sub);border-radius:12px;">
                    <div style="font-size:24px;font-weight:700;color:var(--blue);">🌅 ${morning.length}</div>
                    <div style="font-size:11px;color:var(--dim);margin-top:4px;">Morning (${thisMonthMorning} this month)</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;">
                    <div style="font-size:24px;font-weight:700;color:var(--purple);">🌙 ${evening.length}</div>
                    <div style="font-size:11px;color:var(--dim);margin-top:4px;">Evening (${thisMonthEvening} this month)</div>
                </div>
            </div>
            
            <button class="btn-sec" onclick="App.closeModal()" style="width:100%;">Close</button>
        `;
        
        document.getElementById('modal').classList.add('open');
    },
    
    // ========== JOURNAL ANALYTICS ==========
    
    showJournalAnalytics() {
        const entries = this.data.system.journal || [];
        
        const now = new Date();
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const thisMonth = entries.filter(e => new Date(e.date) > monthAgo).length;
        
        const totalWords = entries.reduce((sum, e) => sum + (e.text?.split(/\s+/).length || 0), 0);
        const avgWords = entries.length > 0 ? Math.round(totalWords / entries.length) : 0;
        
        const tagCounts = {};
        entries.forEach(e => {
            (e.tags || []).forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:20px;color:var(--accent);">📊 Journal Analytics</h3>
            
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--accent);">${entries.length}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Total Entries</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--success);">${thisMonth}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">This Month</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--blue);">${totalWords}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Total Words</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--purple);">${avgWords}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Avg Words/Entry</div>
                </div>
            </div>
            
            ${topTags.length > 0 ? `
                <div style="margin-bottom:20px;">
                    <h4 style="margin-bottom:12px;color:var(--dim);font-size:13px;font-weight:600;">TOP TAGS</h4>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;">
                        ${topTags.map(([tag, count]) => `
                            <span style="padding:6px 12px;background:var(--sub);border-radius:16px;font-size:12px;">
                                🏷️ ${esc(tag)} <span style="color:var(--dim);">(${count})</span>
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <button class="btn-sec" onclick="App.closeModal()" style="width:100%;">Close</button>
        `;
        
        document.getElementById('modal').classList.add('open');
    },
    
    // ========== REVIEW ANALYTICS ==========
    
    showReviewAnalytics() {
        const reviews = this.data.system.reviews || [];
        
        const completeReviews = reviews.filter(r => r.wins && r.lessons && r.nextWeek).length;
        const completionRate = reviews.length > 0 ? Math.round((completeReviews / reviews.length) * 100) : 0;
        
        const allText = reviews.map(r => `${r.wins} ${r.lessons} ${r.nextWeek}`).join(' ').toLowerCase();
        const words = allText.split(/\s+/).filter(w => w.length > 4);
        const wordCounts = {};
        words.forEach(w => {
            wordCounts[w] = (wordCounts[w] || 0) + 1;
        });
        const commonWords = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .filter(([word, count]) => count > 1);
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:20px;color:var(--accent);">📊 Review Analytics</h3>
            
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--accent);">${reviews.length}</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Total Reviews</div>
                </div>
                <div style="padding:16px;background:var(--sub);border-radius:12px;text-align:center;">
                    <div style="font-size:32px;font-weight:700;color:var(--success);">${completionRate}%</div>
                    <div style="font-size:12px;color:var(--dim);margin-top:4px;">Completion Rate</div>
                </div>
            </div>
            
            ${commonWords.length > 0 ? `
                <div style="margin-bottom:20px;">
                    <h4 style="margin-bottom:12px;color:var(--dim);font-size:13px;font-weight:600;">COMMON THEMES</h4>
                    <div style="padding:16px;background:var(--sub);border-radius:12px;">
                        ${commonWords.map(([word, count]) => `
                            <div style="padding:8px 0;border-bottom:1px solid var(--border);">
                                <span style="color:var(--text);">${esc(word)}</span>
                                <span style="float:right;color:var(--dim);font-size:11px;">${count}x</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <button class="btn-sec" onclick="App.closeModal()" style="width:100%;">Close</button>
        `;
        
        document.getElementById('modal').classList.add('open');
    },
    
    // ========== ENHANCED RENDER FUNCTIONS ==========
    
    renderReflections() {
        const refType = this.sub._refType || 'morning';
        let html = `
            <div class="segment">
                <button class="segment-btn ${refType === 'morning' ? 'active' : ''}" onclick="App.sub._refType='morning';App.render()">Morning</button>
                <button class="segment-btn ${refType === 'evening' ? 'active' : ''}" onclick="App.sub._refType='evening';App.render()">Evening</button>
            </div>
            
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button class="btn" style="flex:1;" onclick="App.addReflection('${refType}')">
                    ${refType === 'morning' ? '🌅 Morning' : '🌙 Evening'} Reflection
                </button>
                <button class="btn-sec" style="width:auto;padding:0 16px;" onclick="App.showSystemTemplates('reflections', '${refType}')">📋</button>
            </div>
            
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button class="btn-sec" style="flex:1;" onclick="App.showReflectionAnalytics()">📊 Analytics</button>
                <button class="btn-sec" style="flex:1;" onclick="App.toggleSystemBulkMode('reflections')">
                    ${this.bulkMode.reflections ? '✓ Bulk Mode' : '☐ Bulk Mode'}
                </button>
                <button class="btn-sec" style="flex:1;" onclick="App.exportAllSystemItems('reflections', '${refType}')">📥 Export</button>
            </div>
        `;
        
        // Search box
        html += `
            <div style="position:relative;margin-bottom:16px;">
                <input type="text" placeholder="Search reflections..." 
                       style="padding-right:40px;width:100%;padding:12px;background:var(--sub);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font);font-size:14px;"
                       value="${esc(this.reflectionSearch)}"
                       oninput="App.reflectionSearch = this.value; App.render();">
                ${this.reflectionSearch ? `
                    <button style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
                            background:none;border:none;color:var(--dim);cursor:pointer;font-size:20px;line-height:1;"
                            onclick="App.reflectionSearch = ''; App.render();">
                        ×
                    </button>
                ` : ''}
            </div>
        `;
        
        // Sort dropdown
        html += `
            <div class="sort-bar">
                <select class="sort-select" onchange="App.setSystemSort('reflections', this.value)">
                    <option value="date-desc" ${this.systemSort.reflections === 'date-desc' ? 'selected' : ''}>Date (Newest First)</option>
                    <option value="date-asc" ${this.systemSort.reflections === 'date-asc' ? 'selected' : ''}>Date (Oldest First)</option>
                    <option value="modified-desc" ${this.systemSort.reflections === 'modified-desc' ? 'selected' : ''}>Recently Modified</option>
                    <option value="length-desc" ${this.systemSort.reflections === 'length-desc' ? 'selected' : ''}>Longest First</option>
                    <option value="tags" ${this.systemSort.reflections === 'tags' ? 'selected' : ''}>Most Tagged</option>
                </select>
            </div>
        `;
        
        let refs = this.data.system.reflections[refType] || [];
        
        // Filter
        if (this.reflectionSearch) {
            const search = this.reflectionSearch.toLowerCase();
            refs = refs.filter(r => 
                r.text.toLowerCase().includes(search) ||
                new Date(r.date).toLocaleDateString().toLowerCase().includes(search) ||
                (r.tags || []).some(tag => tag.toLowerCase().includes(search))
            );
        }
        
        // Sort
        refs = this.sortSystemItems(refs, this.systemSort.reflections);
        
        // Render items
        if (refs.length === 0) {
            html += `<div class="empty-state"><div class="empty-state-icon">${refType === 'morning' ? '🌅' : '🌙'}</div><p>${this.reflectionSearch ? 'No matching reflections' : 'No reflections yet'}</p></div>`;
        } else {
            refs.forEach(r => {
                const isSelected = this.selectedItems.reflections.has(r.id);
                html += `<div class="card">
                    ${this.bulkMode.reflections ? `
                        <div class="checkbox ${isSelected ? 'checked' : ''}" 
                             onclick="App.toggleSystemItemSelection('reflections', '${r.id}')">
                        </div>
                    ` : ''}
                    <div style="font-size:11px;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">
                        📅 ${new Date(r.date).toLocaleDateString()}
                    </div>
                    <div style="white-space:pre-wrap;line-height:1.6;">${esc(r.text)}</div>
                    
                    ${(r.tags || []).length > 0 ? `
                        <div class="tags">
                            ${r.tags.map(tag => `<span class="tag">🏷️ ${esc(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${r.modified ? `
                        <div style="font-size:10px;color:var(--dim);margin-top:8px;">✏️ Edited ${new Date(r.modified).toLocaleDateString()}</div>
                    ` : ''}
                    
                    <div class="action-btns">
                        <button class="action-btn" onclick="App.editReflection('${refType}', '${r.id}')">✏️ Edit</button>
                        <button class="action-btn" onclick="App.promptAddSystemTag('reflections', '${refType}', '${r.id}')">🏷️ Tag</button>
                        <button class="action-btn" onclick="App.exportSystemItem('reflections', '${refType}', '${r.id}')">📥 Export</button>
                        <button class="action-btn danger" onclick="App.deleteReflection('${refType}', '${r.id}')">🗑️ Delete</button>
                    </div>
                </div>`;
            });
        }
        
        // Bulk toolbar
        if (this.bulkMode.reflections && this.selectedItems.reflections.size > 0) {
            this.renderBulkToolbar('reflections', refType);
        }
        
        return html;
    },
    
    renderJournal() {
        let html = `
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button class="btn" style="flex:1;" onclick="App.addJournalEntry()">✍️ New Entry</button>
                <button class="btn-sec" style="width:auto;padding:0 16px;" onclick="App.showSystemTemplates('journal', '')">📋</button>
            </div>
            
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button class="btn-sec" style="flex:1;" onclick="App.showJournalAnalytics()">📊 Analytics</button>
                <button class="btn-sec" style="flex:1;" onclick="App.toggleSystemBulkMode('journal')">
                    ${this.bulkMode.journal ? '✓ Bulk Mode' : '☐ Bulk Mode'}
                </button>
                <button class="btn-sec" style="flex:1;" onclick="App.exportAllSystemItems('journal', '')">📥 Export</button>
            </div>
        `;
        
        // Search box
        html += `
            <div style="position:relative;margin-bottom:16px;">
                <input type="text" placeholder="Search journal entries..." 
                       style="padding-right:40px;width:100%;padding:12px;background:var(--sub);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font);font-size:14px;"
                       value="${esc(this.journalSearch)}"
                       oninput="App.journalSearch = this.value; App.render();">
                ${this.journalSearch ? `
                    <button style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
                            background:none;border:none;color:var(--dim);cursor:pointer;font-size:20px;line-height:1;"
                            onclick="App.journalSearch = ''; App.render();">
                        ×
                    </button>
                ` : ''}
            </div>
        `;
        
        // Sort dropdown
        html += `
            <div class="sort-bar">
                <select class="sort-select" onchange="App.setSystemSort('journal', this.value)">
                    <option value="date-desc" ${this.systemSort.journal === 'date-desc' ? 'selected' : ''}>Date (Newest First)</option>
                    <option value="date-asc" ${this.systemSort.journal === 'date-asc' ? 'selected' : ''}>Date (Oldest First)</option>
                    <option value="modified-desc" ${this.systemSort.journal === 'modified-desc' ? 'selected' : ''}>Recently Modified</option>
                    <option value="length-desc" ${this.systemSort.journal === 'length-desc' ? 'selected' : ''}>Longest First</option>
                    <option value="tags" ${this.systemSort.journal === 'tags' ? 'selected' : ''}>Most Tagged</option>
                </select>
            </div>
        `;
        
        let entries = this.data.system.journal || [];
        
        // Filter
        if (this.journalSearch) {
            const search = this.journalSearch.toLowerCase();
            entries = entries.filter(e => 
                e.text.toLowerCase().includes(search) ||
                new Date(e.date).toLocaleDateString().toLowerCase().includes(search) ||
                (e.tags || []).some(tag => tag.toLowerCase().includes(search))
            );
        }
        
        // Sort
        entries = this.sortSystemItems(entries, this.systemSort.journal);
        
        // Render items
        if (entries.length === 0) {
            html += `<div class="empty-state"><div class="empty-state-icon">✍️</div><p>${this.journalSearch ? 'No matching entries' : 'No journal entries yet'}</p></div>`;
        } else {
            entries.forEach(e => {
                const isSelected = this.selectedItems.journal.has(e.id);
                html += `<div class="card">
                    ${this.bulkMode.journal ? `
                        <div class="checkbox ${isSelected ? 'checked' : ''}" 
                             onclick="App.toggleSystemItemSelection('journal', '${e.id}')">
                        </div>
                    ` : ''}
                    <div style="font-size:11px;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">
                        📅 ${new Date(e.date).toLocaleDateString()}
                    </div>
                    <div style="white-space:pre-wrap;line-height:1.6;">${esc(e.text)}</div>
                    
                    ${(e.tags || []).length > 0 ? `
                        <div class="tags">
                            ${e.tags.map(tag => `<span class="tag">🏷️ ${esc(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${e.modified ? `
                        <div style="font-size:10px;color:var(--dim);margin-top:8px;">✏️ Edited ${new Date(e.modified).toLocaleDateString()}</div>
                    ` : ''}
                    
                    <div class="action-btns">
                        <button class="action-btn" onclick="App.editJournalEntry('${e.id}')">✏️ Edit</button>
                        <button class="action-btn" onclick="App.promptAddSystemTag('journal', '', '${e.id}')">🏷️ Tag</button>
                        <button class="action-btn" onclick="App.exportSystemItem('journal', '', '${e.id}')">📥 Export</button>
                        <button class="action-btn danger" onclick="App.deleteJournalEntry('${e.id}')">🗑️ Delete</button>
                    </div>
                </div>`;
            });
        }
        
        // Bulk toolbar
        if (this.bulkMode.journal && this.selectedItems.journal.size > 0) {
            this.renderBulkToolbar('journal', '');
        }
        
        return html;
    },
    
    renderReviews() {
        let html = `
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button class="btn" style="flex:1;" onclick="App.addWeeklyReview()">📊 Weekly Review</button>
                <button class="btn-sec" style="width:auto;padding:0 16px;" onclick="App.showSystemTemplates('reviews', '')">📋</button>
            </div>
            
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button class="btn-sec" style="flex:1;" onclick="App.showReviewAnalytics()">📊 Analytics</button>
                <button class="btn-sec" style="flex:1;" onclick="App.toggleSystemBulkMode('reviews')">
                    ${this.bulkMode.reviews ? '✓ Bulk Mode' : '☐ Bulk Mode'}
                </button>
                <button class="btn-sec" style="flex:1;" onclick="App.exportAllSystemItems('reviews', '')">📥 Export</button>
            </div>
        `;
        
        // Sort dropdown
        html += `
            <div class="sort-bar">
                <select class="sort-select" onchange="App.setSystemSort('reviews', this.value)">
                    <option value="date-desc" ${this.systemSort.reviews === 'date-desc' ? 'selected' : ''}>Date (Newest First)</option>
                    <option value="date-asc" ${this.systemSort.reviews === 'date-asc' ? 'selected' : ''}>Date (Oldest First)</option>
                    <option value="modified-desc" ${this.systemSort.reviews === 'modified-desc' ? 'selected' : ''}>Recently Modified</option>
                    <option value="length-desc" ${this.systemSort.reviews === 'length-desc' ? 'selected' : ''}>Longest First</option>
                    <option value="tags" ${this.systemSort.reviews === 'tags' ? 'selected' : ''}>Most Tagged</option>
                </select>
            </div>
        `;
        
        let reviews = this.data.system.reviews || [];
        
        // Sort
        reviews = this.sortSystemItems(reviews, this.systemSort.reviews);
        
        // Render items
        if (reviews.length === 0) {
            html += `<div class="empty-state"><div class="empty-state-icon">📊</div><p>No reviews yet</p></div>`;
        } else {
            reviews.forEach(r => {
                const isSelected = this.selectedItems.reviews.has(r.id);
                html += `<div class="card">
                    ${this.bulkMode.reviews ? `
                        <div class="checkbox ${isSelected ? 'checked' : ''}" 
                             onclick="App.toggleSystemItemSelection('reviews', '${r.id}')">
                        </div>
                    ` : ''}
                    <div style="font-size:11px;color:var(--accent);text-transform:uppercase;margin-bottom:12px;">
                        📅 Week of ${new Date(r.date).toLocaleDateString()}
                    </div>
                    <div style="margin-bottom:10px;">
                        <div style="font-size:12px;font-weight:700;color:var(--dim);margin-bottom:4px;">Wins</div>
                        <div style="white-space:pre-wrap;line-height:1.6;">${esc(r.wins || '')}</div>
                    </div>
                    <div style="margin-bottom:10px;">
                        <div style="font-size:12px;font-weight:700;color:var(--dim);margin-bottom:4px;">Lessons</div>
                        <div style="white-space:pre-wrap;line-height:1.6;">${esc(r.lessons || '')}</div>
                    </div>
                    <div style="margin-bottom:12px;">
                        <div style="font-size:12px;font-weight:700;color:var(--dim);margin-bottom:4px;">Next Week</div>
                        <div style="white-space:pre-wrap;line-height:1.6;">${esc(r.nextWeek || '')}</div>
                    </div>
                    
                    ${(r.tags || []).length > 0 ? `
                        <div class="tags">
                            ${r.tags.map(tag => `<span class="tag">🏷️ ${esc(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${r.modified ? `
                        <div style="font-size:10px;color:var(--dim);margin-top:8px;">✏️ Edited ${new Date(r.modified).toLocaleDateString()}</div>
                    ` : ''}
                    
                    <div class="action-btns">
                        <button class="action-btn" onclick="App.editReview('${r.id}')">✏️ Edit</button>
                        <button class="action-btn" onclick="App.promptAddSystemTag('reviews', '', '${r.id}')">🏷️ Tag</button>
                        <button class="action-btn" onclick="App.exportSystemItem('reviews', '', '${r.id}')">📥 Export</button>
                        <button class="action-btn danger" onclick="App.deleteReview('${r.id}')">🗑️ Delete</button>
                    </div>
                </div>`;
            });
        }
        
        // Bulk toolbar
        if (this.bulkMode.reviews && this.selectedItems.reviews.size > 0) {
            this.renderBulkToolbar('reviews', '');
        }
        
        return html;
    },
    
    // ============================================================================
    // END OF SYSTEM TAB ENHANCEMENTS
    // ============================================================================
    
    // ============================================================================
    // VAULT ENHANCEMENTS v2.3 - ADVANCED FEATURES
    // ============================================================================
    
    // Toggle Pin Status
    togglePin(vaultType, category, itemId) {
        const item = this.data[vaultType][category]?.find(i => i.id === itemId);
        if (!item) return;
        
        item.pinned = !item.pinned;
        item.modified = new Date().toISOString();
        this.save(); this.render();
        this.toast(item.pinned ? '📌 Item pinned' : '✓ Item unpinned');
    },
    
    // Toggle Batch Mode
    toggleBatchMode() {
        const settings = this.data.vaultSettings;
        settings.batchMode = !settings.batchMode;
        if (!settings.batchMode) {
            settings.selectedItems = [];
        }
        this.save(); this.render();
    },
    
    // Toggle Item Selection in Batch Mode
    toggleItemSelection(vaultType, category, itemId) {
        const settings = this.data.vaultSettings;
        if (!settings.batchMode) return;
        
        const key = `${vaultType}-${category}-${itemId}`;
        const index = settings.selectedItems.indexOf(key);
        
        if (index > -1) {
            settings.selectedItems.splice(index, 1);
        } else {
            settings.selectedItems.push(key);
        }
        
        this.save(); this.render();
    },
    
    // Batch Delete Selected Items
    batchDelete() {
        const settings = this.data.vaultSettings;
        if (settings.selectedItems.length === 0) {
            this.toast('⚠️ No items selected');
            return;
        }
        
        if (!confirm(`Delete ${settings.selectedItems.length} item(s)?`)) return;
        
        settings.selectedItems.forEach(key => {
            const [vaultType, category, itemId] = key.split('-');
            const items = this.data[vaultType][category];
            const index = items.findIndex(i => i.id === itemId);
            if (index > -1) {
                items.splice(index, 1);
            }
        });
        
        settings.selectedItems = [];
        settings.batchMode = false;
        this.save(); this.render();
        this.toast('✓ Items deleted');
    },
    
    // Batch Tag Selected Items
    batchTag() {
        const settings = this.data.vaultSettings;
        if (settings.selectedItems.length === 0) {
            this.toast('⚠️ No items selected');
            return;
        }
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">Add Tags to ${settings.selectedItems.length} Items</h3>
            <input id="batch-tags" placeholder="Tags (comma-separated)..." style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveBatchTags()">Apply Tags</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('batch-tags')?.focus(), 80);
    },
    
    saveBatchTags() {
        const settings = this.data.vaultSettings;
        const tagsInput = document.getElementById('batch-tags')?.value?.trim();
        if (!tagsInput) { this.toast('⚠️ Enter tags'); return; }
        
        const newTags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
        
        settings.selectedItems.forEach(key => {
            const [vaultType, category, itemId] = key.split('-');
            const item = this.data[vaultType][category]?.find(i => i.id === itemId);
            if (item) {
                if (!item.tags) item.tags = [];
                newTags.forEach(tag => {
                    if (!item.tags.includes(tag)) {
                        item.tags.push(tag);
                    }
                });
                item.modified = new Date().toISOString();
            }
        });
        
        settings.selectedItems = [];
        settings.batchMode = false;
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Tags applied');
    },
    
    // Batch Export Selected Items
    batchExport() {
        const settings = this.data.vaultSettings;
        if (settings.selectedItems.length === 0) {
            this.toast('⚠️ No items selected');
            return;
        }
        
        const exportData = [];
        settings.selectedItems.forEach(key => {
            const [vaultType, category, itemId] = key.split('-');
            const item = this.data[vaultType][category]?.find(i => i.id === itemId);
            if (item) {
                exportData.push({ ...item, vaultType, category });
            }
        });
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vault-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        this.toast(`✓ ${exportData.length} items exported`);
    },
    
    // Link Items Together
    linkItems(fromVaultType, fromCategory, fromItemId) {
        const fromItem = this.data[fromVaultType][fromCategory]?.find(i => i.id === fromItemId);
        if (!fromItem) return;
        
        // Get all items from both vaults for linking
        const allItems = [];
        ['vaultLearn', 'vaultEarn'].forEach(vaultType => {
            const categories = vaultType === 'vaultLearn' ? ['ideas', 'notes', 'books', 'skills'] : ['strat', 'exec', 'leverage', 'contacts'];
            categories.forEach(cat => {
                (this.data[vaultType][cat] || []).forEach(item => {
                    if (item.id !== fromItemId) {
                        allItems.push({ ...item, vaultType, category: cat });
                    }
                });
            });
        });
        
        const itemOptions = allItems.map(item => 
            `<option value="${item.vaultType}-${item.category}-${item.id}">${esc(item.title)} (${item.category})</option>`
        ).join('');
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">🔗 Link "${esc(fromItem.title)}"</h3>
            <p style="font-size:13px;color:var(--dim);margin-bottom:12px;">Select items to link with this one:</p>
            <select id="link-item" style="margin-bottom:12px;">
                <option value="">Select an item...</option>
                ${itemOptions}
            </select>
            <button class="btn" onclick="App.saveLinkItem('${fromVaultType}', '${fromCategory}', '${fromItemId}')">Link Item</button>`;
        document.getElementById('modal').classList.add('open');
    },
    
    saveLinkItem(fromVaultType, fromCategory, fromItemId) {
        const linkKey = document.getElementById('link-item')?.value;
        if (!linkKey) { this.toast('⚠️ Select an item'); return; }
        
        const [toVaultType, toCategory, toItemId] = linkKey.split('-');
        
        const fromItem = this.data[fromVaultType][fromCategory]?.find(i => i.id === fromItemId);
        const toItem = this.data[toVaultType][toCategory]?.find(i => i.id === toItemId);
        
        if (!fromItem || !toItem) return;
        
        // Add bidirectional links
        if (!fromItem.linkedTo) fromItem.linkedTo = [];
        if (!toItem.linkedTo) toItem.linkedTo = [];
        
        const fromLink = `${toVaultType}-${toCategory}-${toItemId}`;
        const toLink = `${fromVaultType}-${fromCategory}-${fromItemId}`;
        
        if (!fromItem.linkedTo.includes(fromLink)) {
            fromItem.linkedTo.push(fromLink);
        }
        if (!toItem.linkedTo.includes(toLink)) {
            toItem.linkedTo.push(toLink);
        }
        
        fromItem.modified = new Date().toISOString();
        toItem.modified = new Date().toISOString();
        
        this.save(); this.closeModal(); this.render();
        this.toast('🔗 Items linked');
    },
    
    // Navigate to Linked Item
    navigateToLinkedItem(linkKey) {
        const [vaultType, category, itemId] = linkKey.split('-');
        
        // Navigate to correct vault tab
        this.sub.vault = category;
        this.vaultMainTab = vaultType === 'vaultLearn' ? 'learn' : 'earn';
        
        this.render();
        
        // Scroll to item
        setTimeout(() => {
            const element = document.querySelector(`[data-item-id="${itemId}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.style.animation = 'none';
                setTimeout(() => {
                    element.style.animation = 'pulse 0.5s ease';
                }, 10);
            }
        }, 200);
    },
    
    // Toggle Advanced Filters Panel
    toggleFiltersPanel() {
        const panel = document.getElementById('vault-filters-panel');
        if (panel) {
            panel.classList.toggle('active');
        }
    },
    
    // Apply Advanced Filters
    applyAdvancedFilters() {
        const settings = this.data.vaultSettings;
        
        const startDate = document.getElementById('filter-start-date')?.value;
        const endDate = document.getElementById('filter-end-date')?.value;
        const importance = Array.from(document.querySelectorAll('input[name="filter-importance"]:checked')).map(el => el.value);
        const starredOnly = document.getElementById('filter-starred')?.checked;
        const pinnedOnly = document.getElementById('filter-pinned')?.checked;
        
        settings.dateRange = { start: startDate || null, end: endDate || null };
        settings.importanceFilter = importance;
        settings.starredOnly = starredOnly || false;
        settings.pinnedOnly = pinnedOnly || false;
        
        this.save(); this.render();
        this.toast('✓ Filters applied');
    },
    
    // Clear All Filters
    clearAllFilters() {
        const settings = this.data.vaultSettings;
        settings.dateRange = { start: null, end: null };
        settings.importanceFilter = [];
        settings.starredOnly = false;
        settings.pinnedOnly = false;
        settings.selectedTags = [];
        settings.searchQuery = '';
        
        this.save(); this.render();
        this.toast('✓ Filters cleared');
    },
    
    // Toggle Tag Filter
    toggleTagFilter(tag) {
        const settings = this.data.vaultSettings;
        if (!settings.selectedTags) settings.selectedTags = [];
        
        const index = settings.selectedTags.indexOf(tag);
        if (index > -1) {
            settings.selectedTags.splice(index, 1);
        } else {
            settings.selectedTags.push(tag);
        }
        
        this.save(); this.render();
    },
    
    // Get All Unique Tags
    getAllTags(vaultType, category) {
        const items = this.data[vaultType][category] || [];
        const tags = new Set();
        items.forEach(item => {
            (item.tags || []).forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    },
    
    // Bulk Import from JSON
    bulkImportVault() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">📥 Bulk Import</h3>
            <p style="font-size:13px;color:var(--dim);margin-bottom:12px;">
                Upload a JSON file containing vault items to import.
            </p>
            <input type="file" id="import-file" accept=".json" style="margin-bottom:12px;">
            <button class="btn" onclick="App.processVaultImport()">Import Items</button>`;
        document.getElementById('modal').classList.add('open');
    },
    
    processVaultImport() {
        const fileInput = document.getElementById('import-file');
        const file = fileInput?.files[0];
        
        if (!file) {
            this.toast('⚠️ Select a file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!Array.isArray(data)) {
                    this.toast('⚠️ Invalid format');
                    return;
                }
                
                let imported = 0;
                data.forEach(item => {
                    if (item.vaultType && item.category && item.title && item.content) {
                        const newItem = {
                            id: this.genId(),
                            title: item.title,
                            content: item.content,
                            tags: item.tags || [],
                            importance: item.importance || 'low',
                            starred: item.starred || false,
                            pinned: item.pinned || false,
                            source: item.source || '',
                            created: new Date().toISOString(),
                            modified: null,
                            linkedTo: []
                        };
                        
                        if (!this.data[item.vaultType][item.category]) {
                            this.data[item.vaultType][item.category] = [];
                        }
                        
                        this.data[item.vaultType][item.category].push(newItem);
                        imported++;
                    }
                });
                
                this.save(); this.closeModal(); this.render();
                this.toast(`✓ Imported ${imported} items`);
            } catch (error) {
                this.toast('⚠️ Error parsing file');
            }
        };
        
        reader.readAsText(file);
    },
    
    // Render Markdown Content
    renderMarkdown(content) {
        if (!content) return '';
        
        // Simple markdown rendering
        let html = content;
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Blockquotes
        html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
        
        // Lists
        html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        return html;
    },
    
    // Toggle View Mode (card/compact/timeline)
    toggleViewMode(mode) {
        this.data.vaultSettings.viewMode = mode;
        this.save(); this.render();
    },
    
    // ============================================================================
    // END OF VAULT ENHANCEMENTS v2.3
    // ============================================================================

    // VAULT - LEARNINGS
    addNote() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">📝 Add Note</h3>
            <input id="note-title" placeholder="Note title..." style="margin-bottom:12px;">
            <textarea id="note-content" placeholder="Note content..." rows="8" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveNote()">Save Note</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('note-title')?.focus(), 80);
    },

    saveNote() {
        const title = document.getElementById('note-title')?.value?.trim();
        const content = document.getElementById('note-content')?.value?.trim();
        if (!title || !content) { this.toast('⚠️ Enter title and content'); return; }
        if (!this.data.vault.learnings.notes) this.data.vault.learnings.notes = [];
        this.data.vault.learnings.notes.push({
            id: this.genId(),
            title,
            content,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Note saved');
    },

    addQuote() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">💬 Add Quote</h3>
            <textarea id="quote-text" placeholder="Quote text..." rows="4" style="margin-bottom:12px;"></textarea>
            <input id="quote-author" placeholder="Author (optional)" style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveQuote()">Save Quote</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('quote-text')?.focus(), 80);
    },

    saveQuote() {
        const text = document.getElementById('quote-text')?.value?.trim();
        const author = document.getElementById('quote-author')?.value?.trim();
        if (!text) { this.toast('⚠️ Enter quote text'); return; }
        if (!this.data.vault.learnings.quotes) this.data.vault.learnings.quotes = [];
        this.data.vault.learnings.quotes.push({
            id: this.genId(),
            text,
            author: author || '',
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Quote saved');
    },

    addBookSummary() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">📖 Book Summary</h3>
            <input id="book-title" placeholder="Book title..." style="margin-bottom:12px;">
            <input id="book-author" placeholder="Author..." style="margin-bottom:12px;">
            <textarea id="book-summary" placeholder="Key insights and summary..." rows="8" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveBookSummary()">Save Summary</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('book-title')?.focus(), 80);
    },

    saveBookSummary() {
        const title = document.getElementById('book-title')?.value?.trim();
        const author = document.getElementById('book-author')?.value?.trim();
        const summary = document.getElementById('book-summary')?.value?.trim();
        if (!title || !summary) { this.toast('⚠️ Enter title and summary'); return; }
        if (!this.data.vault.learnings.bookSummaries) this.data.vault.learnings.bookSummaries = [];
        this.data.vault.learnings.bookSummaries.push({
            id: this.genId(),
            title,
            author: author || '',
            summary,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Book summary saved');
    },

    // MINDMAPS
    addMindmap() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">🧠 Create Mindmap</h3>
            <input id="mindmap-title" placeholder="Central topic..." style="margin-bottom:12px;">
            <textarea id="mindmap-nodes" placeholder="Main branches (one per line)..." rows="6" style="margin-bottom:12px;"></textarea>
            <div style="font-size:11px;color:var(--dim);margin-bottom:12px;">
                Enter the main branches of your mindmap. You can add sub-branches later.
            </div>
            <button class="btn" onclick="App.saveMindmap()">Create Mindmap</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('mindmap-title')?.focus(), 80);
    },

    saveMindmap() {
        const title = document.getElementById('mindmap-title')?.value?.trim();
        const nodesText = document.getElementById('mindmap-nodes')?.value?.trim();
        if (!title) { this.toast('⚠️ Enter central topic'); return; }
        
        const nodes = nodesText
            ? nodesText.split('\n').filter(n => n.trim()).map(n => ({
                id: this.genId(),
                text: n.trim(),
                children: []
            }))
            : [];
        
        if (!this.data.vault.learnings.mindmaps) this.data.vault.learnings.mindmaps = [];
        this.data.vault.learnings.mindmaps.push({
            id: this.genId(),
            title,
            nodes,
            created: new Date().toISOString()
        });
        
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Mindmap created');
    },

    viewMindmap(id) {
        const map = this.data.vault.learnings.mindmaps?.find(m => m.id === id);
        if (!map) return;
        
        const renderNode = (node, level = 0) => {
            const indent = level * 24;
            const hasChildren = node.children && node.children.length > 0;
            
            return `
                <div style="margin-left:${indent}px;margin-bottom:8px;">
                    <div style="padding:10px;background:var(--sub);border-radius:8px;
                         border-left:3px solid var(--accent);display:flex;justify-content:space-between;
                         align-items:center;gap:8px;">
                        <div style="flex:1;font-size:14px;">${esc(node.text)}</div>
                        <div style="display:flex;gap:4px;">
                            <button class="btn-sec" onclick="App.addChildNode('${map.id}','${node.id}')" 
                                    style="padding:4px 8px;font-size:11px;">+ Sub</button>
                            <button class="btn-sec btn-danger" onclick="App.deleteNode('${map.id}','${node.id}')" 
                                    style="padding:4px 8px;font-size:11px;">×</button>
                        </div>
                    </div>
                    ${hasChildren ? node.children.map(child => renderNode(child, level + 1)).join('') : ''}
                </div>
            `;
        };
        
        document.getElementById('modal-body').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="color:var(--accent);margin:0;">🧠 ${esc(map.title)}</h3>
                <button class="btn-sec" onclick="App.addBranchNode('${map.id}')">+ Branch</button>
            </div>
            
            <div style="max-height:60vh;overflow-y:auto;">
                ${map.nodes && map.nodes.length > 0 
                    ? map.nodes.map(node => renderNode(node)).join('') 
                    : '<div style="text-align:center;padding:40px;color:var(--dim);">No branches yet. Add your first branch!</div>'}
            </div>
            
            <button class="btn-sec" onclick="App.closeModal()" style="margin-top:16px;width:100%;">Close</button>
        `;
        
        document.getElementById('modal').classList.add('open');
    },

    addBranchNode(mapId) {
        const text = prompt('Branch text:');
        if (!text?.trim()) return;
        
        const map = this.data.vault.learnings.mindmaps?.find(m => m.id === mapId);
        if (!map) return;
        
        if (!map.nodes) map.nodes = [];
        map.nodes.push({
            id: this.genId(),
            text: text.trim(),
            children: []
        });
        
        map.modified = new Date().toISOString();
        this.save();
        this.viewMindmap(mapId);
        this.toast('✓ Branch added');
    },

    addChildNode(mapId, parentNodeId) {
        const text = prompt('Sub-branch text:');
        if (!text?.trim()) return;
        
        const map = this.data.vault.learnings.mindmaps?.find(m => m.id === mapId);
        if (!map) return;
        
        const findAndAddChild = (nodes) => {
            for (let node of nodes) {
                if (node.id === parentNodeId) {
                    if (!node.children) node.children = [];
                    node.children.push({
                        id: this.genId(),
                        text: text.trim(),
                        children: []
                    });
                    return true;
                }
                if (node.children && findAndAddChild(node.children)) {
                    return true;
                }
            }
            return false;
        };
        
        if (findAndAddChild(map.nodes)) {
            map.modified = new Date().toISOString();
            this.save();
            this.viewMindmap(mapId);
            this.toast('✓ Sub-branch added');
        }
    },

    deleteNode(mapId, nodeId) {
        if (!confirm('Delete this node and all its sub-branches?')) return;
        
        const map = this.data.vault.learnings.mindmaps?.find(m => m.id === mapId);
        if (!map) return;
        
        const removeNode = (nodes, targetId) => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === targetId) {
                    nodes.splice(i, 1);
                    return true;
                }
                if (nodes[i].children && removeNode(nodes[i].children, targetId)) {
                    return true;
                }
            }
            return false;
        };
        
        if (removeNode(map.nodes, nodeId)) {
            map.modified = new Date().toISOString();
            this.save();
            this.viewMindmap(mapId);
            this.toast('✓ Node deleted');
        }
    },

    deleteMindmap(id) {
        if (!confirm('Delete this mindmap?')) return;
        this.data.vault.learnings.mindmaps = this.data.vault.learnings.mindmaps?.filter(m => m.id !== id) || [];
        this.save();
        this.render();
        this.toast('✓ Mindmap deleted');
    },

    // VAULT - GROWTH
    addGrowthBook() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">📚 Track Book</h3>
            <input id="gb-title" placeholder="Book title..." style="margin-bottom:12px;">
            <input id="gb-author" placeholder="Author..." style="margin-bottom:12px;">
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                <input type="checkbox" id="gb-completed" style="width:auto;margin:0;">
                <span>Completed</span>
            </label>
            <button class="btn" onclick="App.saveGrowthBook()">Track Book</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('gb-title')?.focus(), 80);
    },

    saveGrowthBook() {
        const title = document.getElementById('gb-title')?.value?.trim();
        const author = document.getElementById('gb-author')?.value?.trim();
        const completed = document.getElementById('gb-completed')?.checked;
        if (!title) { this.toast('⚠️ Enter title'); return; }
        if (!this.data.vault.growth.books) this.data.vault.growth.books = [];
        this.data.vault.growth.books.push({
            id: this.genId(),
            title,
            author: author || '',
            completed,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Book tracked');
    },

    addCourse() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">🎓 Track Course</h3>
            <input id="course-title" placeholder="Course title..." style="margin-bottom:12px;">
            <input id="course-platform" placeholder="Platform (e.g., Coursera)" style="margin-bottom:12px;">
            <input id="course-progress" type="number" min="0" max="100" placeholder="Progress %" style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveCourse()">Track Course</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('course-title')?.focus(), 80);
    },

    saveCourse() {
        const title = document.getElementById('course-title')?.value?.trim();
        const platform = document.getElementById('course-platform')?.value?.trim();
        const progress = document.getElementById('course-progress')?.value;
        if (!title) { this.toast('⚠️ Enter title'); return; }
        if (!this.data.vault.growth.courses) this.data.vault.growth.courses = [];
        this.data.vault.growth.courses.push({
            id: this.genId(),
            title,
            platform: platform || '',
            progress: progress ? parseInt(progress) : 0,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Course tracked');
    },

    addSkill() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">⚡ Track Skill</h3>
            <input id="skill-name" placeholder="Skill name..." style="margin-bottom:12px;">
            <select id="skill-level" style="margin-bottom:12px;">
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
            </select>
            <input id="skill-progress" type="number" min="0" max="100" placeholder="Progress %" style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveSkill()">Track Skill</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('skill-name')?.focus(), 80);
    },

    saveSkill() {
        const name = document.getElementById('skill-name')?.value?.trim();
        const level = document.getElementById('skill-level')?.value;
        const progress = document.getElementById('skill-progress')?.value;
        if (!name) { this.toast('⚠️ Enter skill name'); return; }
        if (!this.data.vault.growth.skills) this.data.vault.growth.skills = [];
        this.data.vault.growth.skills.push({
            id: this.genId(),
            name,
            level,
            progress: progress ? parseInt(progress) : 0,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Skill tracked');
    },

    addMentor() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">🧑‍🏫 Add Mentor</h3>
            <input id="mentor-name" placeholder="Mentor name..." style="margin-bottom:12px;">
            <input id="mentor-expertise" placeholder="Expertise area..." style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveMentor()">Add Mentor</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('mentor-name')?.focus(), 80);
    },

    saveMentor() {
        const name = document.getElementById('mentor-name')?.value?.trim();
        const expertise = document.getElementById('mentor-expertise')?.value?.trim();
        if (!name) { this.toast('⚠️ Enter name'); return; }
        if (!this.data.vault.growth.mentors) this.data.vault.growth.mentors = [];
        this.data.vault.growth.mentors.push({
            id: this.genId(),
            name,
            expertise: expertise || '',
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Mentor added');
    },

    // VAULT - RESOURCES
    addIdea() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">💡 Capture Idea</h3>
            <input id="idea-title" placeholder="Idea title..." style="margin-bottom:12px;">
            <textarea id="idea-desc" placeholder="Description..." rows="6" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveIdea()">Capture Idea</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('idea-title')?.focus(), 80);
    },

    saveIdea() {
        const title = document.getElementById('idea-title')?.value?.trim();
        const description = document.getElementById('idea-desc')?.value?.trim();
        if (!title) { this.toast('⚠️ Enter title'); return; }
        if (!this.data.vault.resources.ideas) this.data.vault.resources.ideas = [];
        this.data.vault.resources.ideas.push({
            id: this.genId(),
            title,
            description: description || '',
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Idea captured');
    },

    addContact() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">👤 Add Contact</h3>
            <input id="contact-name" placeholder="Name..." style="margin-bottom:12px;">
            <input id="contact-role" placeholder="Role/Title..." style="margin-bottom:12px;">
            <textarea id="contact-notes" placeholder="Notes..." rows="4" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveContact()">Add Contact</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('contact-name')?.focus(), 80);
    },

    saveContact() {
        const name = document.getElementById('contact-name')?.value?.trim();
        const role = document.getElementById('contact-role')?.value?.trim();
        const notes = document.getElementById('contact-notes')?.value?.trim();
        if (!name) { this.toast('⚠️ Enter name'); return; }
        if (!this.data.vault.resources.contacts) this.data.vault.resources.contacts = [];
        this.data.vault.resources.contacts.push({
            id: this.genId(),
            name,
            role: role || '',
            notes: notes || '',
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Contact added');
    },

    addIncomeStream() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">💰 Track Income Stream</h3>
            <input id="income-name" placeholder="Stream name..." style="margin-bottom:12px;">
            <input id="income-amount" type="number" placeholder="Monthly amount" style="margin-bottom:12px;">
            <select id="income-status" style="margin-bottom:12px;">
                <option value="Active">Active</option>
                <option value="In Progress">In Progress</option>
                <option value="Planned">Planned</option>
            </select>
            <button class="btn" onclick="App.saveIncomeStream()">Track Stream</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('income-name')?.focus(), 80);
    },

    saveIncomeStream() {
        const name = document.getElementById('income-name')?.value?.trim();
        const amount = document.getElementById('income-amount')?.value;
        const status = document.getElementById('income-status')?.value;
        if (!name) { this.toast('⚠️ Enter name'); return; }
        if (!this.data.vault.resources.incomeStreams) this.data.vault.resources.incomeStreams = [];
        this.data.vault.resources.incomeStreams.push({
            id: this.genId(),
            name,
            amount: amount || '',
            status,
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Income stream tracked');
    },

    addAsset() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">🏆 Track Asset</h3>
            <input id="asset-name" placeholder="Asset name..." style="margin-bottom:12px;">
            <input id="asset-value" type="number" placeholder="Current value" style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveAsset()">Track Asset</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('asset-name')?.focus(), 80);
    },

    saveAsset() {
        const name = document.getElementById('asset-name')?.value?.trim();
        const value = document.getElementById('asset-value')?.value;
        if (!name) { this.toast('⚠️ Enter name'); return; }
        if (!this.data.vault.resources.assets) this.data.vault.resources.assets = [];
        this.data.vault.resources.assets.push({
            id: this.genId(),
            name,
            value: value || '',
            date: new Date().toISOString()
        });
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Asset tracked');
    },

    // GOALS
    addGoal() {
        const domains = this.getAllDomains();
        const domainOptions = domains.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">🎯 Add Goal</h3>
            <input id="goal-title" placeholder="Goal title..." style="margin-bottom:12px;">
            <input id="goal-timeline" placeholder="Timeline (e.g., 2025-2028)" style="margin-bottom:12px;">
            <input id="goal-metrics" placeholder="Success metrics..." style="margin-bottom:12px;">
            <select id="goal-domain" style="margin-bottom:12px;">
                <option value="">Domain (optional)</option>
                ${domainOptions}
            </select>
            <textarea id="goal-subgoals" placeholder="Subgoals (one per line)..." rows="6" style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveGoal()">Add Goal</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('goal-title')?.focus(), 80);
    },

    saveGoal() {
        const title = document.getElementById('goal-title')?.value?.trim();
        const timeline = document.getElementById('goal-timeline')?.value?.trim();
        const metrics = document.getElementById('goal-metrics')?.value?.trim();
        const domain = document.getElementById('goal-domain')?.value;
        const subgoalsText = document.getElementById('goal-subgoals')?.value?.trim();
        
        if (!title) { this.toast('⚠️ Enter title'); return; }
        
        const subgoals = subgoalsText 
            ? subgoalsText.split('\n').filter(s => s.trim()).map(s => ({ 
                id: this.genId(), 
                title: s.trim(), 
                done: false 
            }))
            : [];
        
        if (!this.data.goals) this.data.goals = [];
        this.data.goals.push({
            id: this.genId(),
            title,
            timeline: timeline || '',
            metrics: metrics || '',
            domain: domain || '',
            subgoals,
            created: new Date().toISOString()
        });
        
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Goal added');
    },

    editGoal(id) {
        const goal = this.data.goals?.find(g => g.id === id);
        if (!goal) return;
        
        const domains = this.getAllDomains();
        const domainOptions = domains.map(d => 
            `<option value="${esc(d)}" ${goal.domain === d ? 'selected' : ''}>${esc(d)}</option>`
        ).join('');
        
        const subgoalsText = goal.subgoals?.map(s => s.title).join('\n') || '';
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">Edit Goal</h3>
            <input id="goal-title" value="${esc(goal.title)}" placeholder="Goal title..." style="margin-bottom:12px;">
            <input id="goal-timeline" value="${esc(goal.timeline || '')}" placeholder="Timeline" style="margin-bottom:12px;">
            <input id="goal-metrics" value="${esc(goal.metrics || '')}" placeholder="Success metrics..." style="margin-bottom:12px;">
            <select id="goal-domain" style="margin-bottom:12px;">
                <option value="">Domain (optional)</option>
                ${domainOptions}
            </select>
            <textarea id="goal-subgoals" placeholder="Subgoals (one per line)..." rows="6" style="margin-bottom:12px;">${esc(subgoalsText)}</textarea>
            <button class="btn" onclick="App.updateGoal('${id}')">Update Goal</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('goal-title')?.focus(), 80);
    },

    updateGoal(id) {
        const goal = this.data.goals?.find(g => g.id === id);
        if (!goal) return;
        
        const title = document.getElementById('goal-title')?.value?.trim();
        const timeline = document.getElementById('goal-timeline')?.value?.trim();
        const metrics = document.getElementById('goal-metrics')?.value?.trim();
        const domain = document.getElementById('goal-domain')?.value;
        const subgoalsText = document.getElementById('goal-subgoals')?.value?.trim();
        
        if (!title) { this.toast('⚠️ Enter title'); return; }
        
        goal.title = title;
        goal.timeline = timeline || '';
        goal.metrics = metrics || '';
        goal.domain = domain || '';
        goal.subgoals = subgoalsText 
            ? subgoalsText.split('\n').filter(s => s.trim()).map(s => ({ 
                id: this.genId(), 
                title: s.trim(), 
                done: false 
            }))
            : [];
        
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Goal updated');
    },

    deleteGoal(id) {
        if (!confirm('Delete this goal?')) return;
        this.data.goals = this.data.goals?.filter(g => g.id !== id) || [];
        this.save(); this.render();
        this.toast('✓ Goal deleted');
    },

    toggleGoal(id) {
        const goal = this.data.goals?.find(g => g.id === id);
        if (goal) {
            goal.expanded = !goal.expanded;
            this.render();
        }
    },

    addSubgoal(goalId) {
        const title = prompt('Subgoal:');
        if (!title?.trim()) return;
        
        const goal = this.data.goals?.find(g => g.id === goalId);
        if (goal) {
            if (!goal.subgoals) goal.subgoals = [];
            goal.subgoals.push({
                id: this.genId(),
                title: title.trim(),
                done: false
            });
            this.save();
            this.render();
            this.toast('✓ Subgoal added');
        }
    },

    toggleSubgoal(goalId, subgoalId) {
        const goal = this.data.goals?.find(g => g.id === goalId);
        if (goal) {
            const subgoal = goal.subgoals?.find(s => s.id === subgoalId);
            if (subgoal) {
                subgoal.done = !subgoal.done;
                this.save();
                this.render();
            }
        }
    },

    deleteSubgoal(goalId, subgoalId) {
        if (!confirm('Delete this subgoal?')) return;
        
        const goal = this.data.goals?.find(g => g.id === goalId);
        if (goal) {
            goal.subgoals = goal.subgoals?.filter(s => s.id !== subgoalId) || [];
            this.save();
            this.render();
            this.toast('✓ Subgoal deleted');
        }
    },

    // GOAL STAGE MANAGEMENT
    toggleGoalStage(goalId, stageId) {
        const goal = this.data.goals?.find(g => g.id === goalId);
        if (!goal || !goal.stages) return;
        
        const stage = goal.stages.find(s => s.id === stageId);
        if (stage) {
            stage.completed = !stage.completed;
            if (stage.completed) {
                stage.completedAt = new Date().toISOString();
            } else {
                delete stage.completedAt;
            }
            this.save();
            this.render();
            this.toast(stage.completed ? '✓ Stage completed' : '◯ Stage reopened');
        }
    },

    deleteGoalStage(goalId, stageId) {
        if (!confirm('Delete this goal stage?')) return;
        
        const goal = this.data.goals?.find(g => g.id === goalId);
        if (goal && goal.stages) {
            goal.stages = goal.stages.filter(s => s.id !== stageId);
            this.save();
            this.render();
            this.toast('✓ Stage deleted');
        }
    },

    // TIMEBLOCK MANAGEMENT
    viewTimeblocks() {
        const timeblocks = this.data.timeblocks || [];
        const today = new Date().toISOString().split('T')[0];
        
        // Filter to show today and future timeblocks
        const upcoming = timeblocks.filter(tb => tb.date >= today).sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return (a.time || '').localeCompare(b.time || '');
        });
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:16px;color:var(--accent);">📅 Scheduled Timeblocks</h3>
            
            ${upcoming.length === 0 ? `
                <div style="text-align:center;padding:40px 20px;color:var(--dim);">
                    <div style="font-size:48px;margin-bottom:12px;">📅</div>
                    <div style="font-size:14px;">No upcoming timeblocks</div>
                    <button class="btn" onclick="App.closeModal();App.addTimeblock()" style="margin-top:20px;">
                        Schedule First Timeblock
                    </button>
                </div>
            ` : `
                <div style="max-height:60vh;overflow-y:auto;">
                    ${upcoming.map(tb => {
                        const date = new Date(tb.date + 'T00:00:00');
                        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                        const isToday = tb.date === today;
                        
                        return `
                            <div class="card" style="border-left:4px solid ${tb.completed ? 'var(--dim)' : 'var(--accent)'};">
                                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
                                    <div style="flex:1;">
                                        <div style="font-weight:700;font-size:16px;${tb.completed ? 'text-decoration:line-through;opacity:0.6;' : ''}">${esc(tb.title)}</div>
                                        <div style="font-size:12px;color:var(--dim);margin-top:4px;">
                                            ${isToday ? '🔔 ' : ''}${dateStr}
                                            ${tb.time ? ` • ${tb.time}` : ''}
                                            ${tb.duration ? ` • ${tb.duration} min` : ''}
                                        </div>
                                    </div>
                                    <div style="padding:4px 10px;background:var(--sub);border-radius:6px;font-size:11px;font-weight:600;">
                                        ${tb.type || 'Focus'}
                                    </div>
                                </div>
                                ${tb.notes ? `<div style="font-size:13px;color:var(--dim);margin-top:8px;">${esc(tb.notes)}</div>` : ''}
                                <div style="display:flex;gap:8px;margin-top:12px;">
                                    ${!tb.completed ? `
                                        <button class="btn-sec btn-success" onclick="App.toggleTimeblock('${tb.id}', true)" style="font-size:12px;">
                                            ✓ Complete
                                        </button>
                                    ` : `
                                        <button class="btn-sec" onclick="App.toggleTimeblock('${tb.id}', true)" style="font-size:12px;">
                                            ◯ Reopen
                                        </button>
                                    `}
                                    <button class="btn-sec btn-danger" onclick="App.deleteTimeblock('${tb.id}', true)" style="font-size:12px;">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <button class="btn" onclick="App.closeModal();App.addTimeblock()" style="margin-top:16px;width:100%;">
                    + Add Another Timeblock
                </button>
            `}
        `;
        
        document.getElementById('modal').classList.add('open');
    },

    toggleTimeblock(id, fromModal = false) {
        const tb = this.data.timeblocks?.find(t => t.id === id);
        if (tb) {
            tb.completed = !tb.completed;
            if (tb.completed) {
                tb.completedAt = new Date().toISOString();
            } else {
                delete tb.completedAt;
            }
            this.save();
            
            // Refresh appropriate view based on context
            if (fromModal) {
                this.viewTimeblocks();
            } else {
                this.render();
            }
            
            this.toast(tb.completed ? '✓ Timeblock completed' : '◯ Timeblock reopened');
        }
    },

    deleteTimeblock(id, fromModal = false) {
        if (!confirm('Delete this timeblock?')) return;
        this.data.timeblocks = this.data.timeblocks?.filter(t => t.id !== id) || [];
        this.save();
        
        if (fromModal) {
            this.viewTimeblocks(); // Refresh the modal view
        } else {
            this.render(); // Refresh the main view
        }
        
        this.toast('✓ Timeblock deleted');
    },

    // TASK FILTERING
    renderTaskFilters() {
        if (!this.data.currentCycle) return '';
        
        const tasks = this.data.currentCycle.tasks || [];
        const goals = [...new Set(tasks.map(t => t.goal).filter(Boolean))];
        const domains = [...new Set(tasks.map(t => t.domain).filter(Boolean))];
        
        if (!this.taskFilters) {
            this.taskFilters = { goal: 'All', domain: 'All', status: 'All' };
        }
        
        return `
            <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;">
                <select class="filter-btn" onchange="App.updateFilter('goal', this.value)">
                    <option ${this.taskFilters.goal === 'All' ? 'selected' : ''}>All Goals</option>
                    ${goals.map(g => `<option ${this.taskFilters.goal === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
                </select>
                
                <select class="filter-btn" onchange="App.updateFilter('domain', this.value)">
                    <option ${this.taskFilters.domain === 'All' ? 'selected' : ''}>All Domains</option>
                    ${domains.map(d => `<option ${this.taskFilters.domain === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
                </select>
                
                <select class="filter-btn" onchange="App.updateFilter('status', this.value)">
                    <option ${this.taskFilters.status === 'All' ? 'selected' : ''}>All</option>
                    <option ${this.taskFilters.status === 'Todo' ? 'selected' : ''}>Todo</option>
                    <option ${this.taskFilters.status === 'Done' ? 'selected' : ''}>Done</option>
                </select>
            </div>
        `;
    },

    updateFilter(type, value) {
        this.taskFilters[type] = value;
        this.render();
    },

    filterTasks(tasks) {
        if (!this.taskFilters) return tasks;
        
        return tasks.filter(task => {
            if (this.taskFilters.goal !== 'All' && this.taskFilters.goal !== 'All Goals') {
                if (task.goal !== this.taskFilters.goal) return false;
            }
            
            if (this.taskFilters.domain !== 'All' && this.taskFilters.domain !== 'All Domains') {
                if (task.domain !== this.taskFilters.domain) return false;
            }
            
            if (this.taskFilters.status === 'Todo' && task.done) return false;
            if (this.taskFilters.status === 'Done' && !task.done) return false;
            
            return true;
        });
    },

    renderDomainFocus() {
        if (!this.data.currentCycle) return '';
        
        const tasks = this.data.currentCycle.tasks || [];
        const goalsFocus = this.data.currentCycle.goals_focus || {};
        
        // Dynamic color palette for any number of domains
        const colorPalette = ['#30d158', '#ffd60a', '#bf5af2', '#0a84ff', '#ff453a', '#ff9f0a', '#64d2ff', '#ff375f'];
        
        // Initialize domain counts from goals_focus (planned domains)
        const domainCounts = {};
        Object.keys(goalsFocus).forEach(domain => {
            domainCounts[domain] = 0;
        });
        
        // Also include any domains from actual tasks (in case tasks have domains not in goals_focus)
        tasks.forEach(task => {
            if (task.domain && !domainCounts.hasOwnProperty(task.domain)) {
                domainCounts[task.domain] = 0;
            }
        });
        
        // Count tasks per domain
        tasks.forEach(task => {
            if (task.domain && domainCounts.hasOwnProperty(task.domain)) {
                domainCounts[task.domain]++;
            }
        });
        
        const total = Object.values(domainCounts).reduce((a, b) => a + b, 0);
        
        // If no tasks yet, show only planned percentages
        if (total === 0 && Object.keys(goalsFocus).length > 0) {
            return `
                <div style="margin:16px 0;padding:16px;background:var(--sub);border-radius:12px;border:1px solid var(--border);">
                    <h3 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--accent);">Domain Focus % (Planned)</h3>
                    ${Object.entries(goalsFocus).map(([domain, planned], index) => {
                        const color = this.getDomainColor(domain);  // FIX: Use consistent color hash
                        return `
                            <div style="display:flex;justify-content:space-between;align-items:center;
                                 margin-bottom:10px;gap:12px;">
                                <div style="min-width:100px;font-size:13px;font-weight:600;">${esc(domain)}</div>
                                <div style="flex:1;height:10px;background:var(--void);border-radius:5px;
                                     overflow:hidden;border:1px solid var(--border);">
                                    <div style="width:${planned}%;height:100%;background:${color};
                                         border-radius:5px;opacity:0.5;"></div>
                                </div>
                                <div style="min-width:60px;text-align:right;font-weight:700;font-size:13px;
                                     color:${color};">
                                    ${planned}%
                                </div>
                            </div>
                        `;
                    }).join('')}
                    <div style="margin-top:12px;padding:8px;background:var(--void);border-radius:8px;font-size:11px;color:var(--dim);text-align:center;">
                        Add tasks to see actual distribution
                    </div>
                </div>
            `;
        }
        
        if (total === 0) return '';
        
        // Show actual percentages with planned comparison
        return `
            <div style="margin:16px 0;padding:16px;background:var(--sub);border-radius:12px;border:1px solid var(--border);">
                <h3 style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--accent);">Domain Focus %</h3>
                ${Object.entries(domainCounts).map(([domain, count]) => {
                    const actualPct = ((count / total) * 100).toFixed(0);
                    const plannedPct = goalsFocus[domain] || null;
                    const color = this.getDomainColor(domain);  // FIX: Use consistent color hash
                    
                    // Determine alignment status
                    let alignmentIcon = '';
                    let alignmentColor = 'var(--dim)';
                    if (plannedPct !== null) {
                        const diff = Math.abs(parseFloat(actualPct) - plannedPct);
                        if (diff <= 5) {
                            alignmentIcon = '✓';
                            alignmentColor = '#30d158';
                        } else if (diff <= 15) {
                            alignmentIcon = '⚠';
                            alignmentColor = '#ffd60a';
                        } else {
                            alignmentIcon = '!';
                            alignmentColor = '#ff453a';
                        }
                    }
                    
                    return `
                        <div style="display:flex;justify-content:space-between;align-items:center;
                             margin-bottom:12px;gap:12px;">
                            <div style="min-width:100px;">
                                <div style="font-size:13px;font-weight:600;">${esc(domain)}</div>
                                ${plannedPct !== null ? `<div style="font-size:10px;color:var(--dim);">Target: ${plannedPct}%</div>` : ''}
                            </div>
                            <div style="flex:1;height:14px;background:var(--void);border-radius:7px;
                                 overflow:hidden;border:1px solid var(--border);position:relative;">
                                ${plannedPct !== null ? `
                                    <div style="position:absolute;left:${plannedPct}%;top:0;bottom:0;width:2px;
                                         background:var(--dim);opacity:0.5;z-index:1;"></div>
                                ` : ''}
                                <div style="width:${actualPct}%;height:100%;background:${color};
                                     border-radius:7px;transition:width 0.3s;position:relative;z-index:2;"></div>
                            </div>
                            <div style="min-width:80px;text-align:right;display:flex;align-items:center;justify-content:flex-end;gap:6px;">
                                <span style="font-weight:700;font-size:13px;color:${color};">
                                    ${actualPct}%
                                </span>
                                ${alignmentIcon ? `<span style="font-size:14px;color:${alignmentColor};">${alignmentIcon}</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
                ${Object.keys(goalsFocus).length > 0 ? `
                    <div style="margin-top:12px;padding:8px;background:var(--void);border-radius:8px;font-size:10px;color:var(--dim);display:flex;gap:12px;justify-content:center;">
                        <span>✓ On target (±5%)</span>
                        <span>⚠ Close (±15%)</span>
                        <span>! Off target (>15%)</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // USER MANUAL - Comprehensive guide to using SVK Blueprint
    openUserManual() {
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <div style="max-height:70vh;overflow-y:auto;">
                <h2 style="color:var(--accent);margin-bottom:20px;font-size:24px;">📖 SVK Blueprint User Manual</h2>
                
                <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:16px;margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:8px;font-size:16px;">🎯 Purpose</h3>
                    <p style="line-height:1.6;color:var(--text-secondary);">
                        SVK Blueprint transforms your 15-year vision into executable 90-day cycles. 
                        <strong style="color:var(--text);">The system decides, you execute.</strong> 
                        This creates frictionless execution—you always know what to do next, eliminating decision fatigue 
                        and ensuring inevitable progress toward your chief aim.
                    </p>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:12px;font-size:18px;">🚀 Quick Start</h3>
                    <div style="background:var(--card);border-radius:8px;padding:16px;margin-bottom:12px;">
                        <div style="font-weight:600;margin-bottom:8px;">1️⃣ Create Your Blueprint</div>
                        <p style="font-size:13px;color:var(--dim);line-height:1.5;">
                            Go to SYSTEM tab → Custom Blueprint. Answer 12 questions about your vision, copy the prompt, 
                            paste into ChatGPT/Claude, then import the generated JSON. This creates your personalized 
                            60-cycle roadmap.
                        </p>
                    </div>
                    <div style="background:var(--card);border-radius:8px;padding:16px;margin-bottom:12px;">
                        <div style="font-weight:600;margin-bottom:8px;">2️⃣ Start Your First Cycle</div>
                        <p style="font-size:13px;color:var(--dim);line-height:1.5;">
                            Navigate to STRATEGY tab → review your first cycle's goals and milestones → click "Activate This Cycle". 
                            Tasks automatically populate into your 13-week execution plan.
                        </p>
                    </div>
                    <div style="background:var(--card);border-radius:8px;padding:16px;">
                        <div style="font-weight:600;margin-bottom:8px;">3️⃣ Execute Daily</div>
                        <p style="font-size:13px;color:var(--dim);line-height:1.5;">
                            Open EXECUTE tab each morning. See your Quick Tasks (max 3), today's habits, and week's focus. 
                            Check off tasks as you complete them. Use Quick Capture (+ button) to capture ideas on the fly.
                        </p>
                    </div>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:12px;font-size:18px;">📱 The 5 Tabs Explained</h3>
                    
                    <div style="background:var(--card);border-radius:8px;padding:16px;margin-bottom:12px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <span style="font-size:20px;">⚡</span>
                            <div style="font-weight:600;font-size:15px;">EXECUTE</div>
                        </div>
                        <p style="font-size:13px;color:var(--dim);line-height:1.5;margin-bottom:8px;">
                            Your daily command center. See Quick Tasks (3 max for focus), current week number, 
                            habit tracking heatmap, and Pomodoro timer. This is where you spend most of your time.
                        </p>
                        <div style="font-size:12px;color:var(--accent);">💡 Tip: Start each day here. Complete Quick Tasks first.</div>
                    </div>

                    <div style="background:var(--card);border-radius:8px;padding:16px;margin-bottom:12px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <span style="font-size:20px;">🎯</span>
                            <div style="font-weight:600;font-size:15px;">BUILD</div>
                        </div>
                        <p style="font-size:13px;color:var(--dim);line-height:1.5;margin-bottom:8px;">
                            Set and track goals, view domain focus (life areas), manage affirmations, and access statistics. 
                            Goals connect to your current cycle's objectives.
                        </p>
                        <div style="font-size:12px;color:var(--accent);">💡 Tip: Review weekly to ensure alignment with cycle goals.</div>
                    </div>

                    <div style="background:var(--card);border-radius:8px;padding:16px;margin-bottom:12px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <span style="font-size:20px;">🗺️</span>
                            <div style="font-weight:600;font-size:15px;">STRATEGY</div>
                        </div>
                        <p style="font-size:13px;color:var(--dim);line-height:1.5;margin-bottom:8px;">
                            View your 60-cycle roadmap, activate cycles, see cycle tasks by week (13 weeks per cycle), 
                            and plan your 15-year journey. Each cycle = 90 days of focused execution.
                        </p>
                        <div style="font-size:12px;color:var(--accent);">💡 Tip: Activate one cycle at a time. Complete before moving on.</div>
                    </div>

                    <div style="background:var(--card);border-radius:8px;padding:16px;margin-bottom:12px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <span style="font-size:20px;">⚙️</span>
                            <div style="font-weight:600;font-size:15px;">SYSTEM</div>
                        </div>
                        <p style="font-size:13px;color:var(--dim);line-height:1.5;margin-bottom:8px;">
                            Daily habits, reflections (morning/evening), journal entries, and custom blueprint generator. 
                            This is your personal development workspace.
                        </p>
                        <div style="font-size:12px;color:var(--accent);">💡 Tip: Morning reflection sets intention. Evening reflection reviews progress.</div>
                    </div>

                    <div style="background:var(--card);border-radius:8px;padding:16px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <span style="font-size:20px;">📚</span>
                            <div style="font-weight:600;font-size:15px;">VAULT</div>
                        </div>
                        <p style="font-size:13px;color:var(--dim);line-height:1.5;margin-bottom:8px;">
                            Your knowledge management system. Store notes, quotes, ideas, book summaries, and contacts. 
                            Organized into LEARN (knowledge) and EARN (resources). Full search, tagging, and importance levels.
                        </p>
                        <div style="font-size:12px;color:var(--accent);">💡 Tip: Capture ideas immediately. Review vault weekly for insights.</div>
                    </div>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:12px;font-size:18px;">⚡ 10 Quick Capture Types</h3>
                    <p style="font-size:13px;color:var(--dim);margin-bottom:12px;">Click the + button (bottom-right) to capture on the fly:</p>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">💡 <strong>Idea</strong> - Fleeting insights</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">⚡ <strong>Quick Task</strong> - Do today (max 3)</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">📝 <strong>Note</strong> - Quick info</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">✓ <strong>Cycle Task</strong> - Week-specific</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">💬 <strong>Quote</strong> - Wisdom</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">📅 <strong>Timeblock</strong> - Schedule focus</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">🔄 <strong>Habit</strong> - Daily practice</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">📔 <strong>Journal</strong> - Reflections</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">🎯 <strong>Goal</strong> - Objectives</div>
                        <div style="background:var(--sub);padding:10px;border-radius:6px;">✨ <strong>Affirmation</strong> - Mindset</div>
                    </div>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:12px;font-size:18px;">🔍 Universal Search</h3>
                    <p style="font-size:13px;color:var(--dim);line-height:1.5;">
                        Click the search icon (header) to search across ALL your data: tasks, goals, notes, quotes, ideas, 
                        journal entries, habits, timeblocks, and more. Results are instant and clicking jumps to the item.
                    </p>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:12px;font-size:18px;">⏱️ Pomodoro Timer</h3>
                    <p style="font-size:13px;color:var(--dim);line-height:1.5;margin-bottom:8px;">
                        Click timer badge in header → set duration → add intention (what you'll work on) → start. 
                        Timer counts down and alerts when complete. Custom durations supported.
                    </p>
                    <div style="font-size:12px;color:var(--accent);">💡 Recommended: 25-min focus blocks with 5-min breaks.</div>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:12px;font-size:18px;">🔄 Workflow: System Decides, You Execute</h3>
                    
                    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;">
                        <div style="font-weight:600;margin-bottom:8px;color:var(--accent);">Daily Routine (5 minutes)</div>
                        <ol style="margin-left:20px;font-size:13px;color:var(--dim);line-height:1.8;">
                            <li>Open EXECUTE tab</li>
                            <li>Review your 3 Quick Tasks</li>
                            <li>Check habit for today</li>
                            <li>Start Pomodoro → Execute first task</li>
                            <li>Capture ideas with + button as they arise</li>
                        </ol>
                    </div>

                    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;">
                        <div style="font-weight:600;margin-bottom:8px;color:var(--accent);">Weekly Review (15 minutes)</div>
                        <ol style="margin-left:20px;font-size:13px;color:var(--dim);line-height:1.8;">
                            <li>STRATEGY → Review current week's cycle tasks</li>
                            <li>BUILD → Check domain focus alignment</li>
                            <li>SYSTEM → Write weekly reflection</li>
                            <li>VAULT → Process captured ideas into actionable items</li>
                            <li>BUILD → Stats → Export backup JSON</li>
                        </ol>
                    </div>

                    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;">
                        <div style="font-weight:600;margin-bottom:8px;color:var(--accent);">Cycle Transition (90 days)</div>
                        <ol style="margin-left:20px;font-size:13px;color:var(--dim);line-height:1.8;">
                            <li>Complete week 13 of current cycle</li>
                            <li>STRATEGY → Review cycle completion</li>
                            <li>STRATEGY → Activate next cycle</li>
                            <li>New tasks auto-populate for next 13 weeks</li>
                            <li>Continue daily execution rhythm</li>
                        </ol>
                    </div>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:12px;font-size:18px;">💡 Power Tips</h3>
                    <div style="font-size:13px;color:var(--dim);line-height:1.8;">
                        <div style="margin-bottom:8px;">🎯 <strong>Limit Quick Tasks to 3</strong> - Forces prioritization, maintains focus</div>
                        <div style="margin-bottom:8px;">📊 <strong>Export weekly backups</strong> - BUILD → Stats → Export Blueprint</div>
                        <div style="margin-bottom:8px;">🔍 <strong>Use Universal Search</strong> - Faster than navigating tabs</div>
                        <div style="margin-bottom:8px;">⚡ <strong>Keyboard shortcuts</strong> - ESC closes modals, Ctrl+Z undo</div>
                        <div style="margin-bottom:8px;">📱 <strong>Install as app</strong> - Add to home screen for offline access</div>
                        <div style="margin-bottom:8px;">🎨 <strong>Tag everything</strong> - Makes vault searchable and organized</div>
                        <div style="margin-bottom:8px;">⏰ <strong>Timeblock deep work</strong> - Schedule 2-3 focus blocks daily</div>
                        <div style="margin-bottom:8px;">🌅 <strong>Morning reflection</strong> - Sets intention, reviews goals</div>
                        <div>📝 <strong>Evening journal</strong> - Reviews progress, captures insights</div>
                    </div>
                </div>

                <div style="margin-bottom:24px;">
                    <h3 style="color:var(--accent);margin-bottom:12px;font-size:18px;">🎯 How It Achieves Your Chief Aim Faster</h3>
                    <div style="background:rgba(48,209,88,0.1);border:1px solid rgba(48,209,88,0.3);border-radius:8px;padding:16px;">
                        <p style="font-size:13px;color:var(--text);line-height:1.7;margin-bottom:12px;">
                            <strong>1. Eliminates Decision Fatigue:</strong> Your blueprint pre-decides all tasks for 15 years. 
                            You never wonder "what should I work on?"—the system tells you.
                        </p>
                        <p style="font-size:13px;color:var(--text);line-height:1.7;margin-bottom:12px;">
                            <strong>2. Creates Compound Progress:</strong> 90-day cycles stack. Each cycle builds on the last, 
                            creating exponential growth toward your vision.
                        </p>
                        <p style="font-size:13px;color:var(--text);line-height:1.7;margin-bottom:12px;">
                            <strong>3. Captures Everything:</strong> Ideas, insights, and knowledge never get lost. 
                            Quick Capture + Vault ensures every valuable thought is preserved and searchable.
                        </p>
                        <p style="font-size:13px;color:var(--text);line-height:1.7;margin-bottom:12px;">
                            <strong>4. Maintains Focus:</strong> 3 Quick Task limit + weekly cycle focus prevents overwhelm. 
                            You always know the most important next action.
                        </p>
                        <p style="font-size:13px;color:var(--text);line-height:1.7;">
                            <strong>5. Builds Identity:</strong> Daily habits + affirmations + reflections reshape your identity 
                            to match your vision. You become who you need to be to achieve your aim.
                        </p>
                    </div>
                </div>

                <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:16px;text-align:center;">
                    <div style="font-size:18px;font-weight:700;color:var(--accent);margin-bottom:8px;">
                        The System Decides. You Execute.
                    </div>
                    <div style="font-size:13px;color:var(--dim);">
                        Frictionless execution leads to inevitable success.
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modal').classList.add('open');
    },

    // UNIVERSAL SEARCH - Searches across all 15 data types including the 10 essential capture types
    // Accessible via header search button, provides real-time results
    // Coverage: Tasks, Quick Tasks, Goals, Timeblocks, Habits, Notes, Quotes, Ideas, Journal, 
    //           Reflections, Goal Stages, Affirmations, Books, Contacts, and more
    openUniversalSearch() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:16px;color:var(--accent);">🔍 Universal Search</h3>
            <input type="text" id="universal-search-input" placeholder="Search across all data..." 
                   style="margin-bottom:16px;" oninput="App.performUniversalSearch(this.value)">
            <div id="universal-search-results" style="max-height:400px;overflow-y:auto;"></div>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('universal-search-input')?.focus(), 80);
    },

    // Performs real-time search across all data with minimum 2 character requirement
    // Results include smart navigation to source location and HTML-escaped output for security
    performUniversalSearch(query) {
        const resultsDiv = document.getElementById('universal-search-results');
        
        if (!query || query.trim().length < 2) {
            resultsDiv.innerHTML = `<div style="text-align:center;padding:40px;color:var(--dim);font-size:13px;">
                Type at least 2 characters to search
            </div>`;
            return;
        }
        
        const q = query.toLowerCase().trim();
        const results = [];
        
        // Search Tasks
        if (this.data.currentCycle?.tasks) {
            this.data.currentCycle.tasks.forEach(task => {
                if (task.title.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Task',
                        icon: '✓',
                        title: task.title,
                        meta: `Week ${task.week}${task.done ? ' • Done' : ''}`,
                        action: () => { this.closeModal(); this.navigate(2); }
                    });
                }
            });
        }
        
        // Search Quick Tasks
        if (this.data.tasks?.quick) {
            this.data.tasks.quick.forEach(task => {
                if (task.title.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Quick Task',
                        icon: '⚡',
                        title: task.title,
                        meta: task.done ? 'Done' : 'Pending',
                        action: () => { this.closeModal(); this.navigate(0); }
                    });
                }
            });
        }
        
        // Search Goals
        if (this.data.goals) {
            this.data.goals.forEach(goal => {
                if (goal.title.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Goal',
                        icon: '🎯',
                        title: goal.title,
                        meta: goal.domain || '',
                        action: () => { this.closeModal(); this.sub.build = 'goals'; this.navigate(1); }
                    });
                }
            });
        }
        
        // Search Habits
        if (this.data.system?.habits) {
            this.data.system.habits.forEach(habit => {
                if (habit.title.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Habit',
                        icon: '📋',
                        title: habit.title,
                        meta: habit.timeBlock || '',
                        action: () => { this.closeModal(); this.sub.system = 'habits'; this.navigate(3); }
                    });
                }
            });
        }
        
        // Search Notes
        if (this.data.vault?.learnings?.notes) {
            this.data.vault.learnings.notes.forEach(note => {
                if (note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Note',
                        icon: '📝',
                        title: note.title,
                        meta: new Date(note.date).toLocaleDateString(),
                        action: () => { this.closeModal(); this.sub.vault = 'learnings'; this.sub._vaultL = 'notes'; this.navigate(4); }
                    });
                }
            });
        }
        
        // Search Quotes
        if (this.data.vault?.learnings?.quotes) {
            this.data.vault.learnings.quotes.forEach(quote => {
                if (quote.text.toLowerCase().includes(q) || (quote.author && quote.author.toLowerCase().includes(q))) {
                    results.push({
                        type: 'Quote',
                        icon: '💬',
                        title: quote.text.substring(0, 60) + (quote.text.length > 60 ? '...' : ''),
                        meta: quote.author || '',
                        action: () => { this.closeModal(); this.sub.vault = 'learnings'; this.sub._vaultL = 'quotes'; this.navigate(4); }
                    });
                }
            });
        }
        
        // Search Book Summaries
        if (this.data.vault?.learnings?.bookSummaries) {
            this.data.vault.learnings.bookSummaries.forEach(book => {
                if (book.title.toLowerCase().includes(q) || (book.author && book.author.toLowerCase().includes(q)) || book.summary.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Book Summary',
                        icon: '📖',
                        title: book.title,
                        meta: book.author || '',
                        action: () => { this.closeModal(); this.sub.vault = 'learnings'; this.sub._vaultL = 'books'; this.navigate(4); }
                    });
                }
            });
        }
        
        // Search Ideas
        if (this.data.vault?.resources?.ideas) {
            this.data.vault.resources.ideas.forEach(idea => {
                if (idea.title.toLowerCase().includes(q) || idea.description.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Idea',
                        icon: '💡',
                        title: idea.title,
                        meta: new Date(idea.date).toLocaleDateString(),
                        action: () => { this.closeModal(); this.sub.vault = 'resources'; this.sub._vaultR = 'ideas'; this.navigate(4); }
                    });
                }
            });
        }
        
        // Search Contacts
        if (this.data.vault?.resources?.contacts) {
            this.data.vault.resources.contacts.forEach(contact => {
                if (contact.name.toLowerCase().includes(q) || (contact.role && contact.role.toLowerCase().includes(q))) {
                    results.push({
                        type: 'Contact',
                        icon: '👤',
                        title: contact.name,
                        meta: contact.role || '',
                        action: () => { this.closeModal(); this.sub.vault = 'resources'; this.sub._vaultR = 'contacts'; this.navigate(4); }
                    });
                }
            });
        }
        
        // Search Journal
        if (this.data.system?.journal) {
            this.data.system.journal.forEach(entry => {
                if (entry.text.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Journal',
                        icon: '✍️',
                        title: entry.text.substring(0, 60) + (entry.text.length > 60 ? '...' : ''),
                        meta: new Date(entry.date).toLocaleDateString(),
                        action: () => { this.closeModal(); this.sub.system = 'journal'; this.navigate(3); }
                    });
                }
            });
        }
        
        // Search Reflections
        if (this.data.system?.reflections) {
            ['morning', 'evening'].forEach(type => {
                if (this.data.system.reflections[type]) {
                    this.data.system.reflections[type].forEach(ref => {
                        if (ref.text.toLowerCase().includes(q)) {
                            results.push({
                                type: type === 'morning' ? 'Morning Reflection' : 'Evening Reflection',
                                icon: type === 'morning' ? '🌅' : '🌙',
                                title: ref.text.substring(0, 60) + (ref.text.length > 60 ? '...' : ''),
                                meta: new Date(ref.date).toLocaleDateString(),
                                action: () => { this.closeModal(); this.sub.system = 'reflections'; this.sub._refType = type; this.navigate(3); }
                            });
                        }
                    });
                }
            });
        }
        
        // Search Timeblocks
        if (this.data.timeblocks) {
            this.data.timeblocks.forEach(tb => {
                if (tb.title.toLowerCase().includes(q) || (tb.notes && tb.notes.toLowerCase().includes(q))) {
                    results.push({
                        type: 'Timeblock',
                        icon: '📅',
                        title: tb.title,
                        meta: `${new Date(tb.date).toLocaleDateString()}${tb.time ? ' • ' + tb.time : ''}${tb.completed ? ' • Done' : ''}`,
                        action: () => { this.closeModal(); this.viewTimeblocks(); }
                    });
                }
            });
        }
        
        // Search Goal Stages
        if (this.data.goals) {
            this.data.goals.forEach(goal => {
                if (goal.stages && goal.stages.length > 0) {
                    goal.stages.forEach(stage => {
                        if (stage.title.toLowerCase().includes(q) || (stage.description && stage.description.toLowerCase().includes(q))) {
                            results.push({
                                type: 'Goal Stage',
                                icon: '🎯',
                                title: `${esc(goal.title)}: ${stage.title}`,
                                meta: `${stage.target ? new Date(stage.target).toLocaleDateString() : ''}${stage.completed ? ' • Done' : ''}`,
                                action: () => { 
                                    this.closeModal(); 
                                    goal.expanded = true;
                                    this.sub.build = 'goals'; 
                                    this.navigate(1); 
                                }
                            });
                        }
                    });
                }
            });
        }
        
        // Search Affirmations
        if (this.data.plan?.affirmations) {
            this.data.plan.affirmations.forEach(aff => {
                if (aff.text.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Affirmation',
                        icon: '✨',
                        title: aff.text,
                        meta: new Date(aff.date).toLocaleDateString(),
                        action: () => { this.closeModal(); this.sub.build = 'affirmations'; this.navigate(1); }
                    });
                }
            });
        }
        
        // Display results
        if (results.length === 0) {
            resultsDiv.innerHTML = `<div style="text-align:center;padding:40px;color:var(--dim);font-size:13px;">
                No results found for "${esc(query)}"
            </div>`;
        } else {
            resultsDiv.innerHTML = `
                <div style="font-size:11px;color:var(--dim);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;">
                    ${results.length} result${results.length !== 1 ? 's' : ''} found
                </div>
                ${results.map(r => `
                    <div class="card" onclick="(${r.action.toString()})()" style="cursor:pointer;margin-bottom:8px;padding:12px;">
                        <div style="display:flex;gap:12px;align-items:start;">
                            <div style="font-size:20px;">${r.icon}</div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
                                    ${r.type}
                                </div>
                                <div style="font-weight:600;font-size:14px;margin-bottom:2px;word-break:break-word;">
                                    ${esc(r.title)}
                                </div>
                                ${r.meta ? `<div style="font-size:11px;color:var(--dim);">${esc(r.meta)}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            `;
        }
    },

    addQuickTask() {
        if (!this.data.tasks) this.data.tasks = {};
        if (!this.data.tasks.quick) this.data.tasks.quick = [];
        
        const pending = this.data.tasks.quick.filter(t => !t.done);
        if (pending.length >= 3) {
            this.toast('⚠️ Max 3 quick tasks');
            return;
        }
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">⚡ Quick Task</h3>
            <input id="qt-title" placeholder="Task title..." style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveQuickTask()">Add Task</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('qt-title')?.focus(), 80);
    },

    saveQuickTask() {
        const title = document.getElementById('qt-title')?.value?.trim();
        if (!title) { this.toast('⚠️ Enter title'); return; }
        
        if (!this.data.tasks) this.data.tasks = {};
        if (!this.data.tasks.quick) this.data.tasks.quick = [];
        
        this.data.tasks.quick.push({
            id: this.genId(),
            title,
            done: false,
            created: new Date().toISOString()
        });
        
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Quick task added');
    },

    toggleQuickTask(id) {
        const task = this.data.tasks.quick?.find(t => t.id === id);
        if (task) {
            task.done = true;
            task.completedAt = new Date().toISOString();
            this.save(); this.render();
            this.celebrate('✨', 'Quick Win!', 'Task completed');
        }
    },

    deleteQuickTask(id) {
        if (!this.data.tasks.quick) return;
        this.data.tasks.quick = this.data.tasks.quick.filter(t => t.id !== id);
        this.save(); this.render();
    },

    // CYCLE TASK - Add task to current 90-day cycle
    addCycleTask() {
        if (!this.data.currentCycle) {
            this.toast('⚠️ No active cycle. Import a blueprint first.');
            return;
        }
        
        const domains = this.getAllDomains();
        const domainOptions = domains.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">✓ Add Cycle Task</h3>
            <input id="ct-title" placeholder="Task title..." style="margin-bottom:12px;">
            <select id="ct-week" style="margin-bottom:12px;">
                <option value="">Select Week (optional)</option>
                ${Array.from({length: 13}, (_, i) => i + 1).map(w => 
                    `<option value="${w}">Week ${w}</option>`
                ).join('')}
            </select>
            <select id="ct-domain" style="margin-bottom:12px;">
                <option value="">Domain (optional)</option>
                ${domainOptions}
            </select>
            <input id="ct-goal" placeholder="Related goal (optional)..." style="margin-bottom:12px;">
            <button class="btn" onclick="App.saveCycleTask()">Add to Cycle</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('ct-title')?.focus(), 80);
    },

    saveCycleTask() {
        const title = document.getElementById('ct-title')?.value?.trim();
        const week = document.getElementById('ct-week')?.value;
        const domain = document.getElementById('ct-domain')?.value;
        const goal = document.getElementById('ct-goal')?.value?.trim();
        
        if (!title) { this.toast('⚠️ Enter task title'); return; }
        
        // FIX: Use first available domain if none selected, don't hardcode 'Personal'
        let taskDomain = domain;
        if (!taskDomain) {
            const domains = this.getAllDomains();
            taskDomain = domains.length > 0 ? domains[0] : '';
        }
        
        // FIX: Validate week number is between 1-13
        let taskWeek = week ? parseInt(week) : 1;
        taskWeek = Math.max(1, Math.min(13, taskWeek));
        
        if (!this.data.currentCycle.tasks) this.data.currentCycle.tasks = [];
        this.data.currentCycle.tasks.push({
            id: this.genId(),
            title,
            week: taskWeek,
            domain: taskDomain,
            goal: goal || '',
            done: false,
            created: new Date().toISOString()
        });
        
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Task added to cycle');
    },

    // TIMEBLOCK - Schedule focused time blocks
    addTimeblock() {
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">📅 Schedule Timeblock</h3>
            <input id="tb-title" placeholder="What will you work on?" style="margin-bottom:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                <input type="date" id="tb-date" style="margin:0;">
                <input type="time" id="tb-time" style="margin:0;">
            </div>
            <input type="number" id="tb-duration" placeholder="Duration (minutes)" min="15" max="480" 
                   value="60" style="margin-bottom:12px;">
            <select id="tb-type" style="margin-bottom:12px;">
                <option value="Focus">🎯 Deep Focus</option>
                <option value="Meeting">👥 Meeting</option>
                <option value="Learning">📚 Learning</option>
                <option value="Creative">🎨 Creative Work</option>
                <option value="Admin">📋 Admin</option>
            </select>
            <textarea id="tb-notes" placeholder="Notes or preparation needed..." rows="3" 
                      style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveTimeblock()">Schedule Block</button>`;
        document.getElementById('modal').classList.add('open');
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        setTimeout(() => {
            document.getElementById('tb-date').value = today;
            document.getElementById('tb-title')?.focus();
        }, 80);
    },

    saveTimeblock() {
        const title = document.getElementById('tb-title')?.value?.trim();
        const date = document.getElementById('tb-date')?.value;
        const time = document.getElementById('tb-time')?.value;
        const duration = document.getElementById('tb-duration')?.value;
        const type = document.getElementById('tb-type')?.value;
        const notes = document.getElementById('tb-notes')?.value?.trim();
        
        if (!title) { this.toast('⚠️ Enter title'); return; }
        if (!date) { this.toast('⚠️ Select date'); return; }
        
        if (!this.data.timeblocks) this.data.timeblocks = [];
        this.data.timeblocks.push({
            id: this.genId(),
            title,
            date,
            time: time || '',
            duration: duration ? parseInt(duration) : 60,
            type: type || 'Focus',
            notes: notes || '',
            completed: false,
            created: new Date().toISOString()
        });
        
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Timeblock scheduled');
    },

    // GOAL STAGE - Add milestone/stage to a goal
    addGoalStage() {
        if (!this.data.goals || this.data.goals.length === 0) {
            this.toast('⚠️ Create a goal first');
            return;
        }
        
        document.getElementById('modal-body').innerHTML = `
            <h3 style="margin-bottom:12px;color:var(--accent);">🎯 Add Goal Stage</h3>
            <select id="gs-goal" style="margin-bottom:12px;">
                <option value="">Select Goal</option>
                ${this.data.goals.map(g => `<option value="${g.id}">${esc(g.title)}</option>`).join('')}
            </select>
            <input id="gs-title" placeholder="Stage/milestone name..." style="margin-bottom:12px;">
            <input id="gs-target" type="date" placeholder="Target date" style="margin-bottom:12px;">
            <textarea id="gs-desc" placeholder="What needs to happen in this stage?" rows="4" 
                      style="margin-bottom:12px;"></textarea>
            <button class="btn" onclick="App.saveGoalStage()">Add Stage</button>`;
        document.getElementById('modal').classList.add('open');
        setTimeout(() => document.getElementById('gs-goal')?.focus(), 80);
    },

    saveGoalStage() {
        const goalId = document.getElementById('gs-goal')?.value;
        const title = document.getElementById('gs-title')?.value?.trim();
        const target = document.getElementById('gs-target')?.value;
        const description = document.getElementById('gs-desc')?.value?.trim();
        
        if (!goalId) { this.toast('⚠️ Select a goal'); return; }
        if (!title) { this.toast('⚠️ Enter stage name'); return; }
        
        const goal = this.data.goals.find(g => g.id === goalId);
        if (!goal) return;
        
        if (!goal.stages) goal.stages = [];
        goal.stages.push({
            id: this.genId(),
            title,
            target: target || '',
            description: description || '',
            completed: false,
            created: new Date().toISOString()
        });
        
        this.save(); this.closeModal(); this.render();
        this.toast('✓ Goal stage added');
    },

    // ========== WELCOME MODAL HANDLERS ==========
    
    chooseCreateCustom() {
        // Mark welcome as seen
        localStorage.setItem('svkWelcomeSeen', 'true');
        
        // Hide welcome modal
        document.getElementById('welcome-overlay').style.display = 'none';
        
        // Navigate to Custom Blueprint tab
        this.sub.system = 'custom';
        this.navigate(3); // Navigate to SYSTEM tab (index 3)
        
        this.toast('✨ Let\'s create your custom blueprint!');
    },

    chooseImport() {
        // Mark welcome as seen
        localStorage.setItem('svkWelcomeSeen', 'true');
        
        // Hide welcome modal
        document.getElementById('welcome-overlay').style.display = 'none';
        
        // Navigate to BUILD > Stats tab for import
        this.sub.build = 'stats';
        this.navigate(1); // Navigate to BUILD tab (index 1)
        
        // Scroll to import section after render
        setTimeout(() => {
            this.toast('📥 Click "Import Blueprint" to upload your JSON file');
        }, 300);
    },

    // ============================================================================
    // VAULT ENHANCEMENTS - ALL 10 NEW FEATURES
    // ============================================================================

    // 1. TOGGLE ADVANCED FILTERS PANEL
    toggleVaultFilters() {
        this.data.vaultSettings.showFilters = !this.data.vaultSettings.showFilters;
        this.save();
        this.render();
    },

    // 2. TAG FILTER
    toggleTagFilter(tag, type, sub) {
        if (!this.data.vaultSettings.selectedTags) this.data.vaultSettings.selectedTags = [];
        const idx = this.data.vaultSettings.selectedTags.indexOf(tag);
        if (idx >= 0) {
            this.data.vaultSettings.selectedTags.splice(idx, 1);
        } else {
            this.data.vaultSettings.selectedTags.push(tag);
        }
        this.save();
        this.render();
    },

    // 3. IMPORTANCE FILTER
    toggleImportanceFilter(importance, type, sub) {
        if (!this.data.vaultSettings.importanceFilter) this.data.vaultSettings.importanceFilter = [];
        const idx = this.data.vaultSettings.importanceFilter.indexOf(importance);
        if (idx >= 0) {
            this.data.vaultSettings.importanceFilter.splice(idx, 1);
        } else {
            this.data.vaultSettings.importanceFilter.push(importance);
        }
        this.save();
        this.render();
    },

    // 4. STARRED ONLY FILTER
    toggleStarredFilter(type, sub) {
        this.data.vaultSettings.starredOnly = !this.data.vaultSettings.starredOnly;
        this.save();
        this.render();
    },

    // 5. PINNED ONLY FILTER
    togglePinnedFilter(type, sub) {
        this.data.vaultSettings.pinnedOnly = !this.data.vaultSettings.pinnedOnly;
        this.save();
        this.render();
    },

    // 6. CLEAR ALL FILTERS
    clearAllFilters(type, sub) {
        this.data.vaultSettings.searchQuery = '';
        this.data.vaultSettings.selectedTags = [];
        this.data.vaultSettings.importanceFilter = [];
        this.data.vaultSettings.starredOnly = false;
        this.data.vaultSettings.pinnedOnly = false;
        this.data.vaultSettings.dateRange = { start: null, end: null };
        this.save();
        this.render();
    },

    // 7. TOGGLE VIEW MODE (card/compact/timeline)
    toggleVaultView() {
        const modes = ['card', 'compact', 'timeline'];
        const current = this.data.vaultSettings.viewMode || 'card';
        const currentIdx = modes.indexOf(current);
        const nextIdx = (currentIdx + 1) % modes.length;
        this.data.vaultSettings.viewMode = modes[nextIdx];
        this.save();
        this.render();
        this.toast(`View: ${modes[nextIdx].toUpperCase()}`);
    },

    // 8. PIN/UNPIN ITEM
    togglePin(type, sub, itemId, event) {
        if (event) event.stopPropagation();
        const items = type === 'learn' ? this.data.vaultLearn[sub] : this.data.vaultEarn[sub];
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        
        item.pinned = !item.pinned;
        item.modified = new Date().toISOString();
        this.save();
        this.render();
        this.toast(item.pinned ? '📌 Pinned' : '📍 Unpinned');
    },

    // 9. BATCH MODE TOGGLE
    toggleBatchMode(type, sub) {
        this.data.vaultSettings.batchMode = !this.data.vaultSettings.batchMode;
        if (!this.data.vaultSettings.batchMode) {
            this.data.vaultSettings.selectedItems = [];
        }
        this.save();
        this.render();
    },

    // 10. TOGGLE ITEM SELECTION (for batch operations)
    toggleItemSelection(itemId, event) {
        if (event) event.stopPropagation();
        if (!this.data.vaultSettings.batchMode) return;
        if (!this.data.vaultSettings.selectedItems) this.data.vaultSettings.selectedItems = [];
        
        const idx = this.data.vaultSettings.selectedItems.indexOf(itemId);
        if (idx >= 0) {
            this.data.vaultSettings.selectedItems.splice(idx, 1);
        } else {
            this.data.vaultSettings.selectedItems.push(itemId);
        }
        this.save();
        this.render();
    },

    // 11. CLEAR BATCH SELECTION
    clearBatchSelection() {
        this.data.vaultSettings.selectedItems = [];
        this.save();
        this.render();
    },

    // 12. BATCH EXPORT
    batchExportVault(type, sub) {
        const items = type === 'learn' ? this.data.vaultLearn[sub] : this.data.vaultEarn[sub];
        const selectedItems = items.filter(i => this.data.vaultSettings.selectedItems.includes(i.id));
        
        if (selectedItems.length === 0) {
            this.toast('⚠️ No items selected');
            return;
        }
        
        const blob = new Blob([JSON.stringify(selectedItems, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vault-${sub}-batch-export-${Date.now()}.json`;
        a.click();
        this.toast(`✓ Exported ${selectedItems.length} items`);
    },

    // 13. BATCH TAG
    batchTagVault(type, sub) {
        const tags = prompt('Enter tags (comma-separated):');
        if (!tags) return;
        
        const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (tagArray.length === 0) return;
        
        const items = type === 'learn' ? this.data.vaultLearn[sub] : this.data.vaultEarn[sub];
        let count = 0;
        
        items.forEach(item => {
            if (this.data.vaultSettings.selectedItems.includes(item.id)) {
                if (!item.tags) item.tags = [];
                tagArray.forEach(tag => {
                    if (!item.tags.includes(tag)) {
                        item.tags.push(tag);
                    }
                });
                item.modified = new Date().toISOString();
                count++;
            }
        });
        
        this.save();
        this.render();
        this.toast(`✓ Tagged ${count} items`);
    },

    // 14. BATCH DELETE
    batchDeleteVault(type, sub) {
        const count = this.data.vaultSettings.selectedItems.length;
        if (!confirm(`Delete ${count} items?`)) return;
        
        if (type === 'learn') {
            this.data.vaultLearn[sub] = this.data.vaultLearn[sub].filter(i => 
                !this.data.vaultSettings.selectedItems.includes(i.id)
            );
        } else {
            this.data.vaultEarn[sub] = this.data.vaultEarn[sub].filter(i => 
                !this.data.vaultSettings.selectedItems.includes(i.id)
            );
        }
        
        this.data.vaultSettings.selectedItems = [];
        this.save();
        this.render();
        this.toast(`✓ Deleted ${count} items`);
    },

    // 15. LINK VAULT ITEM
    linkVaultItem(type, sub, itemId, event) {
        if (event) event.stopPropagation();
        
        const item = this.findVaultItemById(itemId);
        if (!item) return;
        
        // Get all vault items for linking
        const allItems = [];
        ['ideas', 'notes', 'books', 'skills'].forEach(s => {
            (this.data.vaultLearn[s] || []).forEach(i => {
                if (i.id !== itemId) allItems.push({ ...i, category: `LEARN:${s}` });
            });
        });
        ['strat', 'exec', 'leverage', 'contacts'].forEach(s => {
            (this.data.vaultEarn[s] || []).forEach(i => {
                if (i.id !== itemId) allItems.push({ ...i, category: `EARN:${s}` });
            });
        });
        
        if (allItems.length === 0) {
            this.toast('⚠️ No other items to link');
            return;
        }
        
        const options = allItems.map((i, idx) => 
            `${idx}. [${i.category}] ${i.title}`
        ).join('\n');
        
        const selection = prompt(`Link to (enter number):\n\n${options}`);
        if (selection === null) return;
        
        const selectedIdx = parseInt(selection);
        if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= allItems.length) {
            this.toast('⚠️ Invalid selection');
            return;
        }
        
        const linkedItem = allItems[selectedIdx];
        if (!item.linkedTo) item.linkedTo = [];
        
        if (!item.linkedTo.includes(linkedItem.id)) {
            item.linkedTo.push(linkedItem.id);
            item.modified = new Date().toISOString();
            this.save();
            this.render();
            this.toast(`✓ Linked to: ${linkedItem.title}`);
        } else {
            this.toast('⚠️ Already linked');
        }
    },

    // 16. FIND VAULT ITEM BY ID (helper)
    findVaultItemById(itemId) {
        for (const sub of ['ideas', 'notes', 'books', 'skills']) {
            const item = (this.data.vaultLearn[sub] || []).find(i => i.id === itemId);
            if (item) return { ...item, type: 'learn', sub };
        }
        for (const sub of ['strat', 'exec', 'leverage', 'contacts']) {
            const item = (this.data.vaultEarn[sub] || []).find(i => i.id === itemId);
            if (item) return { ...item, type: 'earn', sub };
        }
        return null;
    },

    // 17. NAVIGATE TO LINKED ITEM
    navigateToVaultItem(itemId, event) {
        if (event) event.stopPropagation();
        const itemInfo = this.findVaultItemById(itemId);
        if (!itemInfo) return;
        
        this.vaultMainTab = itemInfo.type === 'learn' ? 'learn' : 'earn';
        this.sub.vault = itemInfo.sub;
        this.render();
        this.toast(`Jumped to: ${itemInfo.title}`);
    },

    // 18. BULK IMPORT
    bulkImportVault(type, sub) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let items = [];
                    
                    if (file.name.endsWith('.json')) {
                        items = JSON.parse(event.target.result);
                    } else if (file.name.endsWith('.csv')) {
                        // Simple CSV parser
                        const lines = event.target.result.split('\n');
                        const headers = lines[0].split(',').map(h => h.trim());
                        
                        for (let i = 1; i < lines.length; i++) {
                            if (!lines[i].trim()) continue;
                            const values = lines[i].split(',').map(v => v.trim());
                            const item = {
                                id: this.genId(),
                                title: values[headers.indexOf('title')] || values[0] || 'Untitled',
                                content: values[headers.indexOf('content')] || values[1] || '',
                                tags: values[headers.indexOf('tags')] ? values[headers.indexOf('tags')].split(';') : [],
                                importance: values[headers.indexOf('importance')] || 'low',
                                starred: false,
                                source: file.name,
                                created: new Date().toISOString(),
                                modified: null,
                                linkedTo: []
                            };
                            items.push(item);
                        }
                    }
                    
                    if (!Array.isArray(items)) items = [items];
                    
                    // Ensure each item has required fields
                    items = items.map(item => ({
                        id: item.id || this.genId(),
                        title: item.title || 'Untitled',
                        content: item.content || '',
                        tags: item.tags || [],
                        importance: item.importance || 'low',
                        starred: item.starred || false,
                        source: item.source || file.name,
                        created: item.created || new Date().toISOString(),
                        modified: null,
                        linkedTo: item.linkedTo || [],
                        pinned: false
                    }));
                    
                    // Add to vault
                    if (type === 'learn') {
                        if (!this.data.vaultLearn[sub]) this.data.vaultLearn[sub] = [];
                        this.data.vaultLearn[sub].push(...items);
                    } else {
                        if (!this.data.vaultEarn[sub]) this.data.vaultEarn[sub] = [];
                        this.data.vaultEarn[sub].push(...items);
                    }
                    
                    this.save();
                    this.render();
                    this.toast(`✓ Imported ${items.length} items`);
                } catch (err) {
                    this.toast('⚠️ Import failed: ' + err.message);
                    console.error('Import error:', err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    // 19. RENDER MARKDOWN (Simple Implementation)
    renderMarkdown(text) {
        if (!text) return '';
        
        // Escape HTML first
        let html = text.replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;');
        
        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // Code
        html = html.replace(/`(.+?)`/g, '<code>$1</code>');
        
        // Lists (simple)
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        const listItems = html.match(/<li>.*?<\/li>/g);
        if (listItems) {
            html = html.replace(/(<li>.*?<\/li>\s*)+/g, '<ul>$&</ul>');
        }
        
        // Blockquotes
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        
        return html;
    }
};

// ============================================================================
// PRODUCTION ERROR HANDLERS & SAFETY FEATURES
// ============================================================================

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    
    // Log error details
    const errorLog = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString()
    };
    
    // Store error log
    try {
        const errors = JSON.parse(localStorage.getItem('svk_error_log') || '[]');
        errors.push(errorLog);
        // Keep only last 10 errors
        if (errors.length > 10) errors.shift();
        localStorage.setItem('svk_error_log', JSON.stringify(errors));
    } catch (e) {
        console.error('Failed to log error:', e);
    }
    
    // Prevent default error handling for graceful degradation
    event.preventDefault();
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    try {
        const errors = JSON.parse(localStorage.getItem('svk_error_log') || '[]');
        errors.push({
            type: 'unhandledRejection',
            reason: event.reason?.toString(),
            timestamp: new Date().toISOString()
        });
        if (errors.length > 10) errors.shift();
        localStorage.setItem('svk_error_log', JSON.stringify(errors));
    } catch (e) {
        console.error('Failed to log rejection:', e);
    }
    
    event.preventDefault();
});

// Visibility change handler - save on tab close
document.addEventListener('visibilitychange', () => {
    if (document.hidden && App.data) {
        try {
            App.save();
        } catch (e) {
            console.error('Failed to save on visibility change:', e);
        }
    }
});

// Before unload - save data
window.addEventListener('beforeunload', (event) => {
    try {
        if (App.data) {
            App.save();
        }
    } catch (e) {
        console.error('Failed to save before unload:', e);
    }
});

// Page show - reload if from cache
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // Page was loaded from cache, reload to ensure fresh data
        console.log('Page loaded from cache, refreshing...');
        window.location.reload();
    }
});

// Online/offline handlers
window.addEventListener('online', () => {
    console.log('App is online');
    if (App.toast) {
        App.toast('✓ Back online');
    }
});

window.addEventListener('offline', () => {
    console.log('App is offline');
    if (App.toast) {
        App.toast('⚠️ You are offline - changes saved locally');
    }
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        App.init();
        console.log('SVK Blueprint initialized successfully');
    } catch (initError) {
        console.error('Failed to initialize app:', initError);
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                        background:#0a0a0a;color:#ffd700;text-align:center;padding:20px;">
                <div>
                    <h1 style="font-size:48px;margin-bottom:20px;">⚠️</h1>
                    <h2 style="margin-bottom:10px;">SVK Blueprint Failed to Start</h2>
                    <p style="color:#888;margin-bottom:20px;">An error occurred during initialization.</p>
                    <button onclick="location.reload()" 
                            style="background:#ffd700;color:#000;border:none;padding:12px 24px;
                                   border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
                        Reload App
                    </button>
                    <button onclick="localStorage.clear();location.reload()" 
                            style="background:#dc3545;color:#fff;border:none;padding:12px 24px;
                                   border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
                                   margin-left:10px;">
                        Clear Data & Restart
                    </button>
                </div>
            </div>
        `;
    }
});

