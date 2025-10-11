// State
let allActivities = [];
let translations = {};
let currentPhaseFilter = 'all';
let currentSearchTerm = '';
let kingdomSkills = [];

// Settings keys for localStorage
const SETTINGS_KEYS = {
    CONTROL_DC: 'kingmaker_control_dc',
    LEADER_PROFICIENCY: 'kingmaker_leader_proficiency',
    KINGDOM_PROFICIENCY: 'kingmaker_kingdom_proficiency'
};

// Proficiency levels
const PROFICIENCY_LEVELS = [
    { value: 0, label: 'Untrained' },
    { value: 1, label: 'Trained' },
    { value: 2, label: 'Expert' },
    { value: 3, label: 'Master' },
    { value: 4, label: 'Legendary' }
];

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
        
        // Extract unique kingdom skills from activities
        const skillsSet = new Set();
        allActivities.forEach(activity => {
            if (activity.skills) {
                Object.keys(activity.skills).forEach(skill => skillsSet.add(skill));
            }
        });
        kingdomSkills = Array.from(skillsSet).sort();
        
        // Sort activities by order (if available) and then by title
        allActivities.sort((a, b) => {
            if (a.order && b.order) return a.order - b.order;
            if (a.order) return -1;
            if (b.order) return 1;
            return getTranslation(a.title).localeCompare(getTranslation(b.title));
        });
        
        renderActivities();
        setupEventListeners();
        initializeSettings();
        
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
    if (true || !actions) return '';
    
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

// Parse and convert special @ strings to human-readable text
function parseSpecialStrings(text) {
    if (!text) return '';
    
    // Handle @Check patterns like @Check[dc:11|type:flat]
    text = text.replace(/@Check\[([^\]]+)\]/g, (match, params) => {
        const parts = params.split('|');
        const dc = parts.find(p => p.startsWith('dc:'))?.split(':')[1] || '?';
        const type = parts.find(p => p.startsWith('type:'))?.split(':')[1] || 'check';
        return `a DC ${dc} ${type} check`;
    });
    
    // Handle @UUID patterns (just remove them for now)
    text = text.replace(/@UUID\[[^\]]+\]/g, '');
    
    // Handle resource button patterns like @gain1Unrest, @lose4ResourcePoints, @gain1d4Crime, etc.
    const resourcePattern = /@(gain|lose)(Multiple)?([0-9rd+]+)([a-zA-Z]+)(NextTurn)?/g;
    text = text.replace(resourcePattern, (match, mode, multiple, value, resource, turn) => {
        // Parse the resource type
        const resourceName = resource
            .replace(/Event$/, '')  // Remove 'Event' suffix for event types
            .replace(/([A-Z])/g, ' $1')  // Add space before capital letters
            .trim()
            .toLowerCase();
        
        // Handle special resource types
        let displayResource = resourceName;
        if (resource === 'ResourcePoints') {
            displayResource = 'Resource Points';
        } else if (resource === 'ResourceDice') {
            displayResource = 'Resource Dice';
        } else if (resource === 'RolledResourceDice') {
            displayResource = 'RP (roll ' + value.replace('rd', '') + ' Resource Dice)';
        } else if (resource.endsWith('Event')) {
            // Handle event types
            const eventType = resource.replace(/Event$/, '').replace(/([A-Z])/g, ' $1').trim();
            return mode === 'gain' ? `experience a ${eventType} event` : `resolve a ${eventType} event`;
        } else {
            // Capitalize first letter for display
            displayResource = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);
        }
        
        // Build the human-readable text
        let result = mode === 'gain' ? 'gain' : 'lose';
        if (multiple) result += ' multiple';
        
        // Handle dice expressions
        if (value.includes('d')) {
            result += ' ' + value + ' ' + displayResource;
        } else {
            result += ' ' + value + ' ' + displayResource;
        }
        
        if (turn === 'NextTurn') {
            result += ' next turn';
        }
        
        return result;
    });
    
    return text;
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
    
    // Add special subheading for Region and Civic phases
    let subheading = '';
    if (phase === 'region') {
        subheading = '<span class="text-sm font-normal italic text-gray-600 ml-2">once per Hex</span>';
    } else if (phase === 'civic') {
        subheading = '<span class="text-sm font-normal italic text-gray-600 ml-2">once per Settlement</span>';
    }
    
    let html = `
        <div class="phase-section">
            <h2 class="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2 flex-wrap">
                <span class="phase-${phase} px-3 py-1 rounded-full text-white text-sm">${phaseTitle}</span>
                <span class="text-sm font-normal text-gray-500">(${activities.length})</span>
                ${subheading}
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
    const description = parseSpecialStrings(getTranslation(activity.description));
    const requirement = activity.requirement ? parseSpecialStrings(getTranslation(activity.requirement)) : null;
    const special = activity.special ? parseSpecialStrings(getTranslation(activity.special)) : null;
    const automationNotes = activity.automationNotes ? parseSpecialStrings(getTranslation(activity.automationNotes)) : null;
    
    const criticalSuccess = activity.criticalSuccess ? parseSpecialStrings(getTranslation(activity.criticalSuccess.msg)) : null;
    const success = activity.success ? parseSpecialStrings(getTranslation(activity.success.msg)) : null;
    const failure = activity.failure ? parseSpecialStrings(getTranslation(activity.failure.msg)) : null;
    const criticalFailure = activity.criticalFailure ? parseSpecialStrings(getTranslation(activity.criticalFailure.msg)) : null;
    
    const actionGlyphs = activity.actions ? createActionGlyphs(activity.actions) : '';
    const fortuneIndicator = activity.fortune ? '<span class="fortune-indicator">🍀</span>' : '';
    const oncePerRound = activity.oncePerRound ? '<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Once per round</span>' : '';
    
    // Get skill names with proficiency ranks
    const skills = [];
    const skillsWithLabels = [];
    if (activity.skills) {
        for (const [skill, rank] of Object.entries(activity.skills)) {
            const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
            skills.push(skillName);
            
            // Add proficiency label for ranks > 0
            let proficiencyLabel = '';
            let proficiencyColor = '';
            if (rank === 1) {
                proficiencyLabel = 'T';
                proficiencyColor = 'bg-blue-500 text-white';
            } else if (rank === 2) {
                proficiencyLabel = 'E';
                proficiencyColor = 'bg-green-500 text-white';
            } else if (rank === 3) {
                proficiencyLabel = 'M';
                proficiencyColor = 'bg-purple-500 text-white';
            } else if (rank === 4) {
                proficiencyLabel = 'L';
                proficiencyColor = 'bg-orange-500 text-white';
            }
            
            if (proficiencyLabel) {
                skillsWithLabels.push(`<span class="inline-flex items-center gap-0.5"><span class="text-xs font-bold px-1 py-0 rounded ${proficiencyColor}">${proficiencyLabel}</span>${skillName}</span>`);
            } else {
                skillsWithLabels.push(skillName);
            }
        }
    }
    const skillsText = skillsWithLabels.length > 0 ? `<span class="text-sm text-gray-600">Skills: ${skillsWithLabels.join(', ')}</span>` : '';
    
    // Get DC type (not rendered, but kept for potential future use)
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
                <summary class="p-3 hover:bg-gray-50 transition-colors">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            ${actionGlyphs}
                            <h3 class="font-semibold text-gray-900 text-sm truncate flex items-center gap-1">
                                ${title}
                                <span class="text-gray-400 text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
                            </h3>
                            ${fortuneIndicator}
                            ${oncePerRound}
                        </div>
                        <div class="flex items-center gap-2 text-xs text-gray-500 shrink-0">
                            ${skillsText ? `<span class="hidden sm:inline">${skillsWithLabels.join(', ')}</span>` : ''}
                        </div>
                    </div>
                </summary>
                
                <div class="px-3 pb-3 pt-2 border-t border-gray-100">
                    <div class="prose prose-sm max-w-none text-sm">
                        <div class="mb-3">
                            <div class="text-gray-700 leading-snug">${description}</div>
                        </div>
                        
                        ${requirement ? `
                            <div class="mb-2">
                                <span class="text-xs font-semibold text-gray-600 uppercase">Requirement:</span>
                                <span class="text-gray-700 text-xs">${requirement}</span>
                            </div>
                        ` : ''}
                        
                        ${special ? `
                            <div class="mb-2">
                                <span class="text-xs font-semibold text-gray-600 uppercase">Special:</span>
                                <span class="text-gray-700 text-xs">${special}</span>
                            </div>
                        ` : ''}
                        
                        ${criticalSuccess || success || failure || criticalFailure ? `
                            <div class="mt-3 space-y-1.5">
                                ${criticalSuccess ? `
                                    <div class="border-l-2 border-green-500 pl-2 py-0.5">
                                        <div class="text-xs font-semibold text-green-700">Critical Success</div>
                                        <div class="text-gray-700 text-xs leading-snug">${criticalSuccess}</div>
                                    </div>
                                ` : ''}
                                ${success ? `
                                    <div class="border-l-2 border-blue-500 pl-2 py-0.5">
                                        <div class="text-xs font-semibold text-blue-700">Success</div>
                                        <div class="text-gray-700 text-xs leading-snug">${success}</div>
                                    </div>
                                ` : ''}
                                ${failure ? `
                                    <div class="border-l-2 border-orange-500 pl-2 py-0.5">
                                        <div class="text-xs font-semibold text-orange-700">Failure</div>
                                        <div class="text-gray-700 text-xs leading-snug">${failure}</div>
                                    </div>
                                ` : ''}
                                ${criticalFailure ? `
                                    <div class="border-l-2 border-red-500 pl-2 py-0.5">
                                        <div class="text-xs font-semibold text-red-700">Critical Failure</div>
                                        <div class="text-gray-700 text-xs leading-snug">${criticalFailure}</div>
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
    
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            switchTab(targetTab);
        });
    });
    
    // Save settings button
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
}

// Switch between tabs
function switchTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-button').forEach(button => {
        if (button.dataset.tab === tabName) {
            button.classList.add('active', 'border-blue-600', 'text-blue-600');
            button.classList.remove('border-transparent', 'text-gray-500');
        } else {
            button.classList.remove('active', 'border-blue-600', 'text-blue-600');
            button.classList.add('border-transparent', 'text-gray-500');
        }
    });
    
    // Update tab content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === `${tabName}Tab`) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
}

// Initialize settings UI
function initializeSettings() {
    renderSettingsUI();
    loadSettings();
}

// Render settings UI
function renderSettingsUI() {
    const leaderContainer = document.getElementById('leaderProficiencyContainer');
    const kingdomContainer = document.getElementById('kingdomProficiencyContainer');
    
    // Render leader proficiency selects
    leaderContainer.innerHTML = kingdomSkills.map(skill => {
        const skillLabel = skill.charAt(0).toUpperCase() + skill.slice(1);
        return `
            <div>
                <label for="leader_${skill}" class="block text-sm font-medium text-gray-700 mb-1">
                    ${skillLabel}
                </label>
                <select id="leader_${skill}" class="leader-proficiency w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" data-skill="${skill}">
                    ${PROFICIENCY_LEVELS.map(level => 
                        `<option value="${level.value}">${level.label}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }).join('');
    
    // Render kingdom proficiency selects
    kingdomContainer.innerHTML = kingdomSkills.map(skill => {
        const skillLabel = skill.charAt(0).toUpperCase() + skill.slice(1);
        return `
            <div>
                <label for="kingdom_${skill}" class="block text-sm font-medium text-gray-700 mb-1">
                    ${skillLabel}
                </label>
                <select id="kingdom_${skill}" class="kingdom-proficiency w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" data-skill="${skill}">
                    ${PROFICIENCY_LEVELS.map(level => 
                        `<option value="${level.value}">${level.label}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }).join('');
}

// Load settings from localStorage
function loadSettings() {
    // Load Control DC
    const controlDC = localStorage.getItem(SETTINGS_KEYS.CONTROL_DC);
    if (controlDC !== null) {
        document.getElementById('controlDC').value = controlDC;
    }
    
    // Load Leader Proficiency
    const leaderProficiency = localStorage.getItem(SETTINGS_KEYS.LEADER_PROFICIENCY);
    if (leaderProficiency) {
        const settings = JSON.parse(leaderProficiency);
        Object.entries(settings).forEach(([skill, value]) => {
            const element = document.getElementById(`leader_${skill}`);
            if (element) {
                element.value = value;
            }
        });
    }
    
    // Load Kingdom Proficiency
    const kingdomProficiency = localStorage.getItem(SETTINGS_KEYS.KINGDOM_PROFICIENCY);
    if (kingdomProficiency) {
        const settings = JSON.parse(kingdomProficiency);
        Object.entries(settings).forEach(([skill, value]) => {
            const element = document.getElementById(`kingdom_${skill}`);
            if (element) {
                element.value = value;
            }
        });
    }
}

// Save settings to localStorage
function saveSettings() {
    // Save Control DC
    const controlDC = document.getElementById('controlDC').value;
    localStorage.setItem(SETTINGS_KEYS.CONTROL_DC, controlDC);
    
    // Save Leader Proficiency
    const leaderProficiency = {};
    document.querySelectorAll('.leader-proficiency').forEach(select => {
        leaderProficiency[select.dataset.skill] = parseInt(select.value);
    });
    localStorage.setItem(SETTINGS_KEYS.LEADER_PROFICIENCY, JSON.stringify(leaderProficiency));
    
    // Save Kingdom Proficiency
    const kingdomProficiency = {};
    document.querySelectorAll('.kingdom-proficiency').forEach(select => {
        kingdomProficiency[select.dataset.skill] = parseInt(select.value);
    });
    localStorage.setItem(SETTINGS_KEYS.KINGDOM_PROFICIENCY, JSON.stringify(kingdomProficiency));
    
    // Show confirmation
    const button = document.getElementById('saveSettings');
    const originalText = button.textContent;
    button.textContent = 'Saved!';
    button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    button.classList.add('bg-green-600', 'hover:bg-green-700');
    
    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('bg-green-600', 'hover:bg-green-700');
        button.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }, 2000);
}

// Get settings (for use in other tabs)
function getSettings() {
    return {
        controlDC: parseInt(localStorage.getItem(SETTINGS_KEYS.CONTROL_DC)) || 0,
        leaderProficiency: JSON.parse(localStorage.getItem(SETTINGS_KEYS.LEADER_PROFICIENCY) || '{}'),
        kingdomProficiency: JSON.parse(localStorage.getItem(SETTINGS_KEYS.KINGDOM_PROFICIENCY) || '{}')
    };
}

// Initialize
document.addEventListener('DOMContentLoaded', loadData);
