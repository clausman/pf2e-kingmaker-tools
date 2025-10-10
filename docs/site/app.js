// State
let allActivities = [];
let translations = {};
let currentPhaseFilter = 'all';
let currentSearchTerm = '';

// Load data
async function loadData() {
    try {
        // Load both JSON files
        const [activitiesResponse, translationsResponse] = await Promise.all([
            fetch('data/kingdom-activities.json'),
            fetch('data/en.json')
        ]);

        const activitiesData = await activitiesResponse.json();
        const translationsData = await translationsResponse.json();
        
        allActivities = activitiesData.filter(activity => activity.enabled !== false);
        translations = translationsData['pf2e-kingmaker-tools'];
        
        // Sort activities by order (if available) and then by title
        allActivities.sort((a, b) => {
            if (a.order && b.order) return a.order - b.order;
            if (a.order) return -1;
            if (b.order) return 1;
            return getTranslation(a.title).localeCompare(getTranslation(b.title));
        });
        
        renderActivities();
        setupEventListeners();
        
        // Hide loading, show content
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('activitiesList').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loadingState').innerHTML = `
            <div class="text-center text-red-600">
                <p class="text-lg font-semibold">Error loading data</p>
                <p class="mt-2">${error.message}</p>
            </div>
        `;
    }
}

// Get translation for a key
function getTranslation(key) {
    if (!key) return '';
    
    // Navigate through the translation object using the key path
    const parts = key.split('.');
    let value = translations;
    
    for (const part of parts) {
        if (value && typeof value === 'object') {
            value = value[part];
        } else {
            return key; // Return the key if translation not found
        }
    }
    
    return typeof value === 'string' ? value : key;
}

// Create action glyph HTML
function createActionGlyphs(actions) {
    if (!actions) return '';
    
    const glyphs = [];
    for (let i = 0; i < actions; i++) {
        glyphs.push(`<span class="action-glyph">${actions}</span>`);
    }
    return glyphs.join('');
}

// Strip HTML tags for search
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// Render activities
function renderActivities() {
    const container = document.getElementById('activitiesList');
    const filteredActivities = filterActivities();
    
    if (filteredActivities.length === 0) {
        container.classList.add('hidden');
        document.getElementById('noResults').classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    document.getElementById('noResults').classList.add('hidden');
    
    // Group activities by phase
    const grouped = {};
    filteredActivities.forEach(activity => {
        const phase = activity.phase || 'other';
        if (!grouped[phase]) {
            grouped[phase] = [];
        }
        grouped[phase].push(activity);
    });
    
    // Order of phases
    const phaseOrder = ['commerce', 'leadership', 'region', 'civic', 'army', 'upkeep'];
    
    let html = '';
    
    phaseOrder.forEach(phase => {
        if (grouped[phase]) {
            html += renderPhaseSection(phase, grouped[phase]);
        }
    });
    
    container.innerHTML = html;
}

// Render a phase section
function renderPhaseSection(phase, activities) {
    const phaseTitle = phase.charAt(0).toUpperCase() + phase.slice(1);
    
    let html = `
        <div class="phase-section">
            <h2 class="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span class="phase-${phase} px-3 py-1 rounded-full text-white text-sm">${phaseTitle}</span>
                <span class="text-sm font-normal text-gray-500">(${activities.length})</span>
            </h2>
            <div class="space-y-2">
    `;
    
    activities.forEach(activity => {
        html += renderActivity(activity);
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

// Render a single activity
function renderActivity(activity) {
    const title = getTranslation(activity.title);
    const description = getTranslation(activity.description);
    const requirement = activity.requirement ? getTranslation(activity.requirement) : null;
    const special = activity.special ? getTranslation(activity.special) : null;
    const automationNotes = activity.automationNotes ? getTranslation(activity.automationNotes) : null;
    
    const criticalSuccess = activity.criticalSuccess ? getTranslation(activity.criticalSuccess.msg) : null;
    const success = activity.success ? getTranslation(activity.success.msg) : null;
    const failure = activity.failure ? getTranslation(activity.failure.msg) : null;
    const criticalFailure = activity.criticalFailure ? getTranslation(activity.criticalFailure.msg) : null;
    
    const actionGlyphs = activity.actions ? createActionGlyphs(activity.actions) : '';
    const fortuneIndicator = activity.fortune ? '<span class="fortune-indicator">🍀</span>' : '';
    const oncePerRound = activity.oncePerRound ? '<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Once per round</span>' : '';
    
    // Get skill names
    const skills = [];
    if (activity.skills) {
        for (const [skill, rank] of Object.entries(activity.skills)) {
            if (rank > 0 || Object.keys(activity.skills).length === 1) {
                skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
            }
        }
    }
    const skillsText = skills.length > 0 ? `<span class="text-sm text-gray-600">Skills: ${skills.join(', ')}</span>` : '';
    
    // Get DC type
    let dcType = '';
    if (activity.dc) {
        if (typeof activity.dc === 'string') {
            dcType = activity.dc.charAt(0).toUpperCase() + activity.dc.slice(1) + ' DC';
        } else {
            dcType = 'Custom DC';
        }
    }
    
    return `
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden activity-card" data-phase="${activity.phase}" data-id="${activity.id}">
            <details class="group">
                <summary class="p-4 hover:bg-gray-50 transition-colors">
                    <div class="flex items-start gap-2">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                ${actionGlyphs}
                                <h3 class="font-semibold text-gray-900">${title}</h3>
                                ${fortuneIndicator}
                                ${oncePerRound}
                            </div>
                            ${skillsText ? `<div class="mt-1">${skillsText}</div>` : ''}
                            ${dcType ? `<div class="text-sm text-gray-600 mt-1">${dcType}</div>` : ''}
                        </div>
                    </div>
                </summary>
                
                <div class="p-4 pt-0 border-t border-gray-100">
                    <div class="prose prose-sm max-w-none">
                        <div class="mb-4">
                            <h4 class="text-sm font-semibold text-gray-700 mb-1">Description</h4>
                            <div class="text-gray-600">${description}</div>
                        </div>
                        
                        ${requirement ? `
                            <div class="mb-4">
                                <h4 class="text-sm font-semibold text-gray-700 mb-1">Requirement</h4>
                                <div class="text-gray-600">${requirement}</div>
                            </div>
                        ` : ''}
                        
                        ${special ? `
                            <div class="mb-4">
                                <h4 class="text-sm font-semibold text-gray-700 mb-1">Special</h4>
                                <div class="text-gray-600">${special}</div>
                            </div>
                        ` : ''}
                        
                        ${automationNotes ? `
                            <div class="mb-4">
                                <h4 class="text-sm font-semibold text-gray-700 mb-1">Automation Notes</h4>
                                <div class="text-gray-600 text-xs italic">${automationNotes}</div>
                            </div>
                        ` : ''}
                        
                        ${criticalSuccess || success || failure || criticalFailure ? `
                            <div class="mt-4 space-y-2">
                                <h4 class="text-sm font-semibold text-gray-700">Outcomes</h4>
                                ${criticalSuccess ? `
                                    <div class="border-l-4 border-green-500 pl-3 py-1">
                                        <div class="text-xs font-semibold text-green-700 uppercase">Critical Success</div>
                                        <div class="text-gray-600 text-sm">${criticalSuccess}</div>
                                    </div>
                                ` : ''}
                                ${success ? `
                                    <div class="border-l-4 border-blue-500 pl-3 py-1">
                                        <div class="text-xs font-semibold text-blue-700 uppercase">Success</div>
                                        <div class="text-gray-600 text-sm">${success}</div>
                                    </div>
                                ` : ''}
                                ${failure ? `
                                    <div class="border-l-4 border-orange-500 pl-3 py-1">
                                        <div class="text-xs font-semibold text-orange-700 uppercase">Failure</div>
                                        <div class="text-gray-600 text-sm">${failure}</div>
                                    </div>
                                ` : ''}
                                ${criticalFailure ? `
                                    <div class="border-l-4 border-red-500 pl-3 py-1">
                                        <div class="text-xs font-semibold text-red-700 uppercase">Critical Failure</div>
                                        <div class="text-gray-600 text-sm">${criticalFailure}</div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </details>
        </div>
    `;
}

// Filter activities
function filterActivities() {
    return allActivities.filter(activity => {
        // Phase filter
        if (currentPhaseFilter !== 'all' && activity.phase !== currentPhaseFilter) {
            return false;
        }
        
        // Search filter
        if (currentSearchTerm) {
            const title = getTranslation(activity.title).toLowerCase();
            const description = stripHtml(getTranslation(activity.description)).toLowerCase();
            const searchLower = currentSearchTerm.toLowerCase();
            
            return title.includes(searchLower) || description.includes(searchLower);
        }
        
        return true;
    });
}

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value;
        renderActivities();
    });
    
    // Phase filters
    document.querySelectorAll('.phase-filter').forEach(button => {
        button.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.phase-filter').forEach(btn => {
                btn.classList.remove('active', 'ring-2', 'ring-offset-2', 'ring-blue-500');
            });
            e.target.classList.add('active', 'ring-2', 'ring-offset-2', 'ring-blue-500');
            
            // Update filter
            currentPhaseFilter = e.target.dataset.phase;
            renderActivities();
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', loadData);
