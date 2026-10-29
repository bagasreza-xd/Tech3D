/**
 * TECH3D - Main Application Logic & SPA Router
 * Handles state transitions, real-time search, interactive modals,
 * 3D viewers, and UI micro-interactions.
 */

// Global State
const appState = {
  currentView: 'landing', // 'landing' | 'app'
  currentTab: 'parts3d',  // 'parts3d' | 'jobsheets' | 'features'
  selectedFeatureCategory: 'all',
  searchQuery: '',
  selectedPartId: 'part-01',
  selectedLkmId: 'lkm-01',
  theme: localStorage.getItem('tech3d_theme') || 'dark',
  audioMuted: false
};

// Simple Web Audio API sound synthesizer for high-tech UI feedback
class SoundFX {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playBeep(freq = 800, type = 'sine', duration = 0.04) {
    if (appState.audioMuted) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }
  click() { this.playBeep(980, 'triangle', 0.03); }
  switch() { this.playBeep(640, 'sine', 0.05); }
  success() {
    this.playBeep(523, 'sine', 0.06);
    setTimeout(() => this.playBeep(784, 'sine', 0.09), 60);
  }
}

const sfx = new SoundFX();

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSPA();
  initHeroViewer();
  renderFeatures();
  renderJobsheets();
  renderParts3DList();
  setupEventListeners();

  // Refresh Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/**
 * ==========================================================================
 * THEME CONTROLLER
 * ==========================================================================
 */
function initTheme() {
  document.documentElement.setAttribute('data-theme', appState.theme);
  updateThemeIcon();
}

function toggleTheme() {
  appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tech3d_theme', appState.theme);
  document.documentElement.setAttribute('data-theme', appState.theme);
  updateThemeIcon();
  sfx.click();
}

function updateThemeIcon() {
  const icons = document.querySelectorAll('.theme-toggle-btn i, .theme-toggle-btn [data-lucide]');
  icons.forEach(el => {
    el.setAttribute('data-lucide', appState.theme === 'dark' ? 'sun' : 'moon');
  });
  if (window.lucide) window.lucide.createIcons();
}

/**
 * ==========================================================================
 * SPA ROUTER & NAVIGATION
 * ==========================================================================
 */
function initSPA() {
  // Check hash or default to landing
  const hash = window.location.hash.replace('#', '');
  if (hash === 'features' || hash === 'jobsheets' || hash === 'parts3d') {
    switchView('app', hash);
  } else {
    switchView('landing');
  }
}

function switchView(viewName, tabName = 'parts3d') {
  appState.currentView = viewName;
  const landingSection = document.getElementById('view-landing');
  const appSection = document.getElementById('view-app');

  if (viewName === 'landing') {
    if (landingSection) landingSection.classList.remove('hidden');
    if (appSection) appSection.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.heroViewer) {
      setTimeout(() => window.heroViewer.onWindowResize(), 100);
    }
  } else {
    if (landingSection) landingSection.classList.add('hidden');
    if (appSection) appSection.classList.remove('hidden');
    switchTab(tabName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  try { sfx.switch(); } catch(e) {}
  if (window.lucide) window.lucide.createIcons();
}

function switchTab(tabId) {
  appState.currentTab = tabId;

  // Update tab navigation buttons
  document.querySelectorAll('.app-nav-tab').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Switch tab contents
  document.querySelectorAll('.app-tab-pane').forEach(pane => {
    pane.classList.add('hidden');
  });
  const activePane = document.getElementById(`tab-pane-${tabId}`);
  if (activePane) {
    activePane.classList.remove('hidden');
    activePane.classList.add('animate-fade-in');
  }

  // Update breadcrumb
  const breadcrumbCurrent = document.getElementById('breadcrumb-current');
  if (breadcrumbCurrent) {
    if (tabId === 'features') breadcrumbCurrent.textContent = 'Pengenalan Fitur Inventor';
    else if (tabId === 'jobsheets') breadcrumbCurrent.textContent = 'Jobsheet / LKM Manufaktur';
    else if (tabId === 'parts3d') breadcrumbCurrent.textContent = 'Bentuk Part 3D Interaktif';
  }

  // If switched to 3D Part tab, initialize or resize Part Viewer
  if (tabId === 'parts3d') {
    setTimeout(() => {
      initApp3DViewer();
      loadSelectedPart3D(appState.selectedPartId);
    }, 50);
  }

  sfx.click();
  if (window.lucide) window.lucide.createIcons();
}

/**
 * ==========================================================================
 * HERO SECTION 3D VIEWER (LANDING PAGE)
 * ==========================================================================
 */
function initHeroViewer() {
  const container = document.getElementById('hero-cad-canvas');
  if (!container) return;

  window.heroViewer = new CADViewer('hero-cad-canvas', {
    initialModel: 'part-1-1',
    initialMaterial: 'alloy',
    enableGrid: true,
    enableAxes: true
  });

  // Material selector chips in hero
  const matChips = document.querySelectorAll('#hero-material-chips .mat-chip');
  matChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      matChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const matKey = chip.dataset.mat;
      window.heroViewer.setMaterial(matKey);
      sfx.click();
    });
  });

  // Section Axis switchers (X: Red, Y: Green, Z: Blue) in Hero
  const heroAxisBtns = document.querySelectorAll('#hero-axis-controls .axis-btn');
  function updateHeroAxisStyles(activeAxis) {
    heroAxisBtns.forEach(btn => {
      const axis = btn.dataset.axis;
      btn.classList.remove(
        'active',
        'bg-[#ff5252]', 'text-white', 'shadow-[0_0_10px_rgba(255,82,82,0.6)]', 'border-[#ff5252]',
        'bg-[#00e676]', 'text-black', 'shadow-[0_0_10px_rgba(0,230,118,0.6)]', 'border-[#00e676]',
        'bg-[#2979ff]', 'text-white', 'shadow-[0_0_10px_rgba(41,121,255,0.6)]', 'border-[#2979ff]'
      );
      if (axis === activeAxis) {
        btn.classList.add('active');
        if (axis === 'x') btn.classList.add('bg-[#ff5252]', 'text-white', 'shadow-[0_0_10px_rgba(255,82,82,0.6)]', 'border-[#ff5252]');
        else if (axis === 'y') btn.classList.add('bg-[#00e676]', 'text-black', 'shadow-[0_0_10px_rgba(0,230,118,0.6)]', 'border-[#00e676]');
        else if (axis === 'z') btn.classList.add('bg-[#2979ff]', 'text-white', 'shadow-[0_0_10px_rgba(41,121,255,0.6)]', 'border-[#2979ff]');
      }
    });
  }

  heroAxisBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const axis = btn.dataset.axis;
      const isAlreadyActive = btn.classList.contains('active');
      
      if (!isAlreadyActive) {
        updateHeroAxisStyles(axis);
        window.heroViewer.setSectionAxis(axis);
        window.heroViewer.toggleSection(true);
      } else {
        updateHeroAxisStyles(null);
        window.heroViewer.toggleSection(false);
      }
      sfx.switch();
    });
  });

  // View Cube buttons
  const cubeBtns = document.querySelectorAll('#hero-viewcube .cube-btn');
  cubeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      cubeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.heroViewer.setViewOrientation(view);
      sfx.click();
    });
  });

  // Fullscreen button
  const fsBtn = document.getElementById('hero-btn-fullscreen');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      window.heroViewer.toggleFullscreen();
      sfx.click();
    });
  }

  // Wireframe toggle button
  const wireBtn = document.getElementById('hero-btn-wireframe');
  if (wireBtn) {
    wireBtn.addEventListener('click', () => {
      const active = window.heroViewer.toggleWireframe();
      wireBtn.classList.toggle('text-neon', active);
      sfx.click();
    });
  }

  // Explode toggle button
  const explodeBtn = document.getElementById('hero-btn-explode');
  if (explodeBtn) {
    explodeBtn.addEventListener('click', () => {
      const active = window.heroViewer.toggleExplode();
      explodeBtn.classList.toggle('bg-neon', active);
      explodeBtn.classList.toggle('text-dark', active);
      sfx.click();
    });
  }
}

/**
 * ==========================================================================
 * MENU 1: PENGENALAN FITUR AUTODESK INVENTOR
 * ==========================================================================
 */
function selectFeatureCategory(category) {
  appState.selectedFeatureCategory = category;
  
  // Sync filter chips UI
  const filterChips = document.querySelectorAll('#feature-filter-chips .cad-chip-interactive');
  filterChips.forEach(chip => {
    chip.classList.toggle('active', chip.dataset.category === category);
  });

  renderFeatures();

  // Scroll smoothly to search/table section
  const targetSection = document.getElementById('feature-search-input') || document.querySelector('.cad-table-container');
  if (targetSection) {
    targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderFeatures() {
  const container = document.getElementById('features-table-body');
  const countEl = document.getElementById('features-count-label');
  const emptyEl = document.getElementById('features-empty-state');
  if (!container) return;

  const query = appState.searchQuery.toLowerCase().trim();
  const category = appState.selectedFeatureCategory;

  const filtered = INVENTOR_DATA.features.filter(item => {
    const matchCat = category === 'all' || item.category === category;
    const matchSearch = !query || 
      item.name.toLowerCase().includes(query) ||
      item.function.toLowerCase().includes(query) ||
      (item.shortcut && item.shortcut.toLowerCase().includes(query)) ||
      (item.categoryLabel && item.categoryLabel.toLowerCase().includes(query)) ||
      (item.subCategoryLabel && item.subCategoryLabel.toLowerCase().includes(query)) ||
      (item.technicalNote && item.technicalNote.toLowerCase().includes(query));
    return matchCat && matchSearch;
  });

  if (countEl) {
    countEl.textContent = `Menampilkan ${filtered.length} dari ${INVENTOR_DATA.features.length} menu`;
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  let html = '';
  let lastSubCategory = null;

  const groupIcons = {
    sketch: 'pen-tool',
    constraint: 'sliders',
    '3d_create': 'box',
    '3d_hole_thread': 'target',
    '3d_modify': 'shield',
    '3d_pattern': 'grid',
    '3d_boolean': 'cpu',
    '3d_surface': 'sparkles',
    '3d_reference': 'compass',
    '3d_inspection': 'ruler',
    assembly_features: 'layers',
    drawing_features: 'layout',
    drawing_bom: 'list'
  };

  filtered.forEach(item => {
    // Show section subheader if subCategory exists and changes
    if (item.subCategoryLabel && item.subCategoryLabel !== lastSubCategory) {
      lastSubCategory = item.subCategoryLabel;
      const headerIcon = groupIcons[item.subCategory] || 'layers';
      const subItemsCount = filtered.filter(f => f.subCategory === item.subCategory).length;
      
      html += `
        <tr class="bg-[#0e1d17] border-y-2 border-[#00e676]/40">
          <td colspan="3" class="px-5 py-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5 font-heading font-extrabold text-[#00e676] text-sm uppercase tracking-wider">
                <div class="w-7 h-7 rounded-lg bg-[#00e676]/15 border border-[#00e676]/40 flex items-center justify-center text-[#00e676] shadow-[0_0_10px_rgba(0,230,118,0.2)]">
                  <i data-lucide="${headerIcon}" class="w-4 h-4"></i>
                </div>
                <span>${item.subCategoryLabel}</span>
              </div>
              <span class="text-xs font-mono px-3 py-1 rounded-full bg-[#16261f] text-[#00e676] font-bold border border-[#00e676]/30">
                ${subItemsCount} Fitur
              </span>
            </div>
          </td>
        </tr>
      `;
    }

    const highlightedName = highlightMatch(item.name, query);
    const highlightedFunc = highlightMatch(item.function, query);
    const highlightedNote = item.technicalNote ? highlightMatch(item.technicalNote, query) : '';

    html += `
      <tr class="hover:bg-emerald-950/20 transition-colors border-b border-[#1f3a2e]/50 group">
        <td class="px-5 py-4 align-top w-64">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-lg bg-[#16261f] border border-[#1f3a2e] flex items-center justify-center text-[#00e676] group-hover:border-[#00e676] group-hover:shadow-[0_0_12px_rgba(0,230,118,0.3)] transition-all shrink-0">
              <i data-lucide="${item.icon || 'box'}" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="font-bold text-white text-sm group-hover:text-[#00e676] transition-colors">${highlightedName}</div>
              <div class="text-[0.72rem] text-[#627b70] font-mono mt-0.5">${item.inventorPath}</div>
              <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span class="inline-flex px-2 py-0.5 rounded text-[0.68rem] font-medium bg-[#12201a] border border-[#1f3a2e] text-[#a3b8ad]">${item.categoryLabel}</span>
                ${item.shortcut ? `<span class="inline-flex px-1.5 py-0.5 rounded text-[0.65rem] font-mono font-bold bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/30">Key: ${item.shortcut}</span>` : ''}
              </div>
            </div>
          </div>
        </td>
        <td class="px-5 py-4 align-top text-sm text-[#a3b8ad] leading-relaxed">
          <p class="text-[#e2e8f0] font-medium">${highlightedFunc}</p>
          ${item.technicalNote ? `
            <div class="mt-2 text-xs text-[#8fa89b] bg-[#0d1a14] p-2.5 rounded-lg border border-[#1f3a2e]/60 flex items-start gap-2">
              <i data-lucide="info" class="w-3.5 h-3.5 text-[#00e676] shrink-0 mt-0.5"></i>
              <span><strong>Tips Manufaktur:</strong> ${highlightedNote}</span>
            </div>
          ` : ''}
        </td>
        <td class="px-4 py-4 align-middle text-right w-36">
          <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-[#12201a] border border-[#00e676]/30 text-[#00e676] shadow-sm">
            ${item.badge}
          </span>
        </td>
      </tr>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
}

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ==========================================================================
 * MENU 2: JOBSHEET / LKM
 * ==========================================================================
 */
function renderJobsheets() {
  const container = document.getElementById('jobsheets-grid');
  if (!container) return;

  container.innerHTML = INVENTOR_DATA.jobsheets.map(lkm => {
    return `
      <div class="cad-card group">
        <!-- PDF Page Embedded Preview -->
        <div class="cad-card-thumb relative cursor-pointer" onclick="openLKMModal('${lkm.id}')">
          <!-- Fallback CAD Drawing Pattern -->
          <div class="absolute inset-0 bg-[#07110d] flex items-center justify-center p-4">
            <svg class="w-full h-full text-[#1f3a2e]/50" viewBox="0 0 200 120" fill="none" stroke="currentColor">
              <line x1="20" y1="20" x2="180" y2="20" stroke-width="0.75" stroke-dasharray="2 2" />
              <line x1="20" y1="100" x2="180" y2="100" stroke-width="0.75" stroke-dasharray="2 2" />
              <line x1="100" y1="10" x2="100" y2="110" stroke-width="0.75" stroke-dasharray="4 2" />
              <circle cx="100" cy="60" r="32" stroke-width="1" />
              <circle cx="100" cy="60" r="16" stroke-width="0.8" />
            </svg>
          </div>

          <!-- Google Drive PDF Page Embedded Preview IFrame -->
          <iframe 
            src="${lkm.previewUrl}" 
            class="pdf-preview-frame w-full h-full border-0 pointer-events-none relative z-0" 
            loading="lazy" 
            title="Preview ${lkm.number} - ${lkm.filename}">
          </iframe>

          <!-- Gradient Ambient Overlay to preserve badge contrast -->
          <div class="pdf-preview-overlay z-10"></div>

          <!-- Top Left: Part Number Badge -->
          <div class="absolute top-3 left-3 z-20 bg-[#0d1a14]/90 backdrop-blur border border-[#00e676]/50 px-2.5 py-1 rounded-md text-xs font-mono font-bold text-[#00e676] shadow-[0_0_10px_rgba(0,230,118,0.25)]">
            ${lkm.number}
          </div>

          <!-- Top Right: Filename Badge -->
          <div class="absolute top-3 right-3 z-20 bg-[#12201a]/90 backdrop-blur border border-[#1f3a2e] px-2.5 py-0.5 rounded text-[0.68rem] font-mono text-[#00e5ff] flex items-center gap-1 shadow-md">
            <i data-lucide="file-text" class="w-3 h-3 text-[#00e5ff]"></i>
            <span>${lkm.filename}</span>
          </div>



          <!-- Bottom Right: ISO Standard -->
          <div class="absolute bottom-3 right-3 z-20 bg-[#12201a]/90 backdrop-blur border border-[#1f3a2e] px-2 py-0.5 rounded text-[0.7rem] font-mono text-[#a3b8ad]">
            ${lkm.standard}
          </div>
        </div>

        <div class="p-3.5 bg-[#0a1410] border-t border-[#1f3a2e]/60 flex items-center">
          <a href="${lkm.driveUrl || 'https://drive.google.com/drive/folders/10oOazck9kgFaRwQ5-H0f26NzTOsFPWrO?usp=drive_link'}" target="_blank" rel="noopener noreferrer" class="btn-secondary text-xs px-3 py-2 flex-1 flex items-center justify-center gap-1.5 text-[#a3b8ad] hover:text-white hover:border-[#00e676] transition-all" title="Buka File di Google Drive">
            <i data-lucide="external-link" class="w-3.5 h-3.5 text-[#00e676]"></i>
            <span>Buka File di Google Drive</span>
          </a>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

/**
 * ==========================================================================
 * MENU 3: BENTUK PART 3D GALLERY & VIEWER
 * ==========================================================================
 */
function renderParts3DList() {
  const container = document.getElementById('parts3d-sidebar-list');
  if (container) {
    container.innerHTML = INVENTOR_DATA.parts3d.map((part, idx) => {
      const isSelected = part.id === appState.selectedPartId;
      return `
        <div onclick="selectPart3D('${part.id}')" class="part-item-card p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${isSelected ? 'bg-[#00e676]/10 border-[#00e676] shadow-[0_0_15px_rgba(0,230,118,0.25)]' : 'bg-[#12201a] border-[#1f3a2e] hover:border-[#00e676]/50 hover:bg-[#16261f]'}">
          <div class="w-10 h-10 rounded-lg bg-[#0d1a14] border border-[#1f3a2e] flex items-center justify-center text-[#00e676] shrink-0 font-mono font-bold text-xs">
            0${idx + 1}
          </div>
          <div class="overflow-hidden flex-1">
            <div class="font-bold text-sm text-white truncate ${isSelected ? 'text-[#00e676]' : ''}">${part.name}</div>
            <div class="text-[0.72rem] text-[#8fa89b] font-mono truncate">${part.technicalName}</div>
          </div>
          <i data-lucide="chevron-right" class="w-4 h-4 text-[#627b70] shrink-0"></i>
        </div>
      `;
    }).join('');
  }

  // Render Horizontal Quick Pills untuk HP / Tablet
  const pillBar = document.getElementById('parts3d-mobile-pill-bar');
  if (pillBar) {
    pillBar.innerHTML = INVENTOR_DATA.parts3d.map((part, idx) => {
      const isSelected = part.id === appState.selectedPartId;
      return `
        <button onclick="selectPart3D('${part.id}')" class="part-pill-btn shrink-0 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 ${isSelected ? 'bg-[#00e676]/20 text-[#00e676] border-[#00e676] shadow-[0_0_12px_rgba(0,230,118,0.35)] font-bold' : 'bg-[#12201a] text-[#8fa89b] border-[#1f3a2e] hover:border-[#00e676]/40 hover:text-white'}">
          <span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#00e676] shadow-[0_0_6px_#00e676]' : 'bg-[#3d5a4d]'}"></span>
          <span>Part 1-${idx + 1}</span>
        </button>
      `;
    }).join('');

    const activePill = pillBar.querySelector('.border-\\[\\#00e676\\]');
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  const mobileLabel = document.getElementById('mobile-part-current-label');
  if (mobileLabel) {
    const curr = INVENTOR_DATA.parts3d.find(p => p.id === appState.selectedPartId);
    if (curr) mobileLabel.textContent = curr.name;
  }

  if (window.lucide) window.lucide.createIcons();
}

function selectPart3D(partId) {
  appState.selectedPartId = partId;
  renderParts3DList();
  loadSelectedPart3D(partId);
  sfx.click();
}

function initApp3DViewer() {
  if (window.appViewer) {
    window.appViewer.onWindowResize();
    return;
  }

  const container = document.getElementById('app-cad-canvas');
  if (!container) return;

  window.appViewer = new CADViewer('app-cad-canvas', {
    initialModel: 'part-1-1',
    initialMaterial: 'alloy',
    enableGrid: true,
    enableAxes: true
  });

  // Material chips in App 3D Viewer
  const matChips = document.querySelectorAll('#app-material-chips .mat-chip');
  matChips.forEach(chip => {
    chip.addEventListener('click', () => {
      matChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const matKey = chip.dataset.mat;
      window.appViewer.setMaterial(matKey);
      sfx.click();
    });
  });

  // ViewCube buttons in App 3D Viewer
  const cubeBtns = document.querySelectorAll('#app-viewcube .cube-btn');
  cubeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      cubeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.appViewer.setViewOrientation(view);
      sfx.click();
    });
  });

  // Section toggle & plane switches (X: Red, Y: Green, Z: Blue)
  const sectionBtn = document.getElementById('app-btn-section');
  const sectionAxes = document.getElementById('app-section-axes');
  const sectionSliderRow = document.getElementById('app-section-slider-row');
  const axisX = document.getElementById('app-sec-axis-x');
  const axisY = document.getElementById('app-sec-axis-y');
  const axisZ = document.getElementById('app-sec-axis-z');
  const secSlider = document.getElementById('app-section-slider');
  const secOffsetVal = document.getElementById('app-section-offset-val');
  const axisBtns = [axisX, axisY, axisZ].filter(Boolean);

  function updateAppSectionAxisStyles(axisKey) {
    const targetAxis = (axisKey || 'x').toLowerCase();
    axisBtns.forEach(btn => {
      const a = btn.dataset.axis;
      btn.classList.remove(
        'active',
        'bg-[#ff5252]', 'text-white', 'shadow-[0_0_12px_rgba(255,82,82,0.6)]', 'border-[#ff5252]',
        'bg-[#00e676]', 'text-[#06110c]', 'shadow-[0_0_12px_rgba(0,230,118,0.6)]', 'border-[#00e676]',
        'bg-[#2979ff]', 'text-white', 'shadow-[0_0_12px_rgba(41,121,255,0.6)]', 'border-[#2979ff]'
      );
      if (a === targetAxis) {
        btn.classList.add('active');
        if (a === 'x') btn.classList.add('bg-[#ff5252]', 'text-white', 'shadow-[0_0_12px_rgba(255,82,82,0.6)]', 'border-[#ff5252]');
        else if (a === 'y') btn.classList.add('bg-[#00e676]', 'text-[#06110c]', 'shadow-[0_0_12px_rgba(0,230,118,0.6)]', 'border-[#00e676]');
        else if (a === 'z') btn.classList.add('bg-[#2979ff]', 'text-white', 'shadow-[0_0_12px_rgba(41,121,255,0.6)]', 'border-[#2979ff]');
      }
    });

    if (secSlider) {
      secSlider.classList.remove('accent-[#ff5252]', 'accent-[#00e676]', 'accent-[#2979ff]');
      if (targetAxis === 'x') secSlider.classList.add('accent-[#ff5252]');
      else if (targetAxis === 'y') secSlider.classList.add('accent-[#00e676]');
      else if (targetAxis === 'z') secSlider.classList.add('accent-[#2979ff]');
    }

    if (secOffsetVal) {
      if (targetAxis === 'x') secOffsetVal.style.color = '#ff5252';
      else if (targetAxis === 'y') secOffsetVal.style.color = '#00e676';
      else if (targetAxis === 'z') secOffsetVal.style.color = '#2979ff';
    }
  }

  // Set default active axis to X (Red)
  updateAppSectionAxisStyles('x');

  if (sectionBtn) {
    sectionBtn.addEventListener('click', () => {
      const active = window.appViewer.toggleSection();
      sectionBtn.classList.toggle('bg-[#00e676]', active);
      sectionBtn.classList.toggle('text-[#06110c]', active);
      if (sectionAxes) {
        sectionAxes.classList.toggle('hidden', !active);
      }
      if (sectionSliderRow) {
        sectionSliderRow.classList.toggle('hidden', !active);
      }
      if (active) {
        updateAppSectionAxisStyles(window.appViewer.sectionAxis || 'x');
      }
      sfx.switch();
    });
  }

  axisBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const axis = btn.dataset.axis;
      updateAppSectionAxisStyles(axis);
      window.appViewer.setSectionAxis(axis);
      sfx.click();
    });
  });

  if (secSlider) {
    secSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      window.appViewer.setSectionOffset(val);
      if (secOffsetVal) {
        secOffsetVal.textContent = (val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1));
      }
    });
  }

  // Wireframe button
  const wireBtn = document.getElementById('app-btn-wireframe');
  if (wireBtn) {
    wireBtn.addEventListener('click', () => {
      const active = window.appViewer.toggleWireframe();
      wireBtn.classList.toggle('text-[#00e676]', active);
      wireBtn.classList.toggle('border-[#00e676]', active);
      sfx.click();
    });
  }

  // Fullscreen button
  const fsBtn = document.getElementById('app-btn-fullscreen');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      window.appViewer.toggleFullscreen();
      sfx.click();
    });
  }
}

function loadSelectedPart3D(partId) {
  const part = INVENTOR_DATA.parts3d.find(p => p.id === partId) || INVENTOR_DATA.parts3d[0];
  if (!part) return;

  if (window.appViewer) {
    window.appViewer.loadModel(part.modelType, part.glbPath);
  }

  // Update Titlebar (Hanya Part 1-1 s.d. Part 1-10)
  const titleEl = document.getElementById('app-viewer-filename');
  if (titleEl) {
    titleEl.textContent = part.name;
  }

  const mobileLabel = document.getElementById('mobile-part-current-label');
  if (mobileLabel) {
    mobileLabel.textContent = part.name;
  }
}

/**
 * ==========================================================================
 * MODAL HANDLERS (LKM PDF VIEWER & QR SCANNER)
 * ==========================================================================
 */
function openLKMModal(lkmId) {
  const lkm = INVENTOR_DATA.jobsheets.find(j => j.id === lkmId) || INVENTOR_DATA.jobsheets[0];
  appState.selectedLkmId = lkm.id;

  const modal = document.getElementById('modal-lkm-viewer');
  if (!modal) return;

  document.getElementById('modal-lkm-title').textContent = `${lkm.number} (${lkm.filename}): ${lkm.title}`;
  document.getElementById('modal-lkm-subtitle').textContent = lkm.subtitle;
  document.getElementById('modal-lkm-standard').textContent = `Standar: ${lkm.standard}`;
  document.getElementById('modal-lkm-material').textContent = lkm.sheetSpecs.material || 'Mild Steel';
  document.getElementById('modal-lkm-tolerance').textContent = lkm.sheetSpecs.tolerance || 'ISO 2768-m';

  const driveBtn = document.getElementById('modal-lkm-drive-btn');
  if (driveBtn) {
    driveBtn.href = lkm.driveUrl || 'https://drive.google.com/drive/folders/10oOazck9kgFaRwQ5-H0f26NzTOsFPWrO?usp=drive_link';
  }

  // Render PDF and Blueprint Viewer
  const drawingCanvas = document.getElementById('modal-blueprint-area');
  if (drawingCanvas) {
    drawingCanvas.innerHTML = `
      <div class="w-full h-full min-h-[380px] relative bg-[#07110d] border border-[#1f3a2e] rounded-xl overflow-hidden flex flex-col shadow-inner">
        <!-- PDF Viewer Toolbar -->
        <div class="bg-[#0a1410] px-3.5 py-2 border-b border-[#1f3a2e] flex items-center justify-between text-xs font-mono">
          <div class="flex items-center gap-2 text-[#00e676]">
            <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
            <span class="font-bold">${lkm.filename}</span>
            <span class="text-[0.65rem] px-2 py-0.5 rounded bg-[#00e676]/10 border border-[#00e676]/30 text-[#00e676]">Live PDF Preview</span>
          </div>
          <a href="${lkm.driveUrl}" target="_blank" rel="noopener noreferrer" class="text-[0.72rem] text-[#00e5ff] hover:text-[#00e676] flex items-center gap-1 transition-colors">
            <span>Buka Tab Baru</span>
            <i data-lucide="external-link" class="w-3 h-3"></i>
          </a>
        </div>
        
        <!-- Live Google Drive PDF Viewer Frame -->
        <iframe 
          src="${lkm.previewUrl}" 
          class="w-full flex-1 border-0 min-h-[340px] bg-[#07110d]" 
          allow="autoplay"
          loading="eager"
          title="PDF Viewer - ${lkm.title}">
        </iframe>
      </div>
    `;
  }

  // Render Steps Checklist
  const stepsList = document.getElementById('modal-lkm-steps');
  if (stepsList && lkm.steps) {
    stepsList.innerHTML = lkm.steps.map((st, i) => `
      <label class="flex items-start gap-3 p-2.5 rounded-lg bg-[#0d1a14] border border-[#1f3a2e] hover:border-[#00e676]/40 cursor-pointer transition-all">
        <input type="checkbox" onchange="checkStepProgress()" class="mt-1 w-4 h-4 rounded accent-[#00e676] bg-[#12201a] border-[#1f3a2e] cursor-pointer">
        <span class="text-xs text-[#a3b8ad] leading-relaxed">${st}</span>
      </label>
    `).join('');
  }

  modal.classList.add('active');
  sfx.switch();
}

function closeLKMModal() {
  const modal = document.getElementById('modal-lkm-viewer');
  if (modal) modal.classList.remove('active');
  sfx.click();
}

function checkStepProgress() {
  const checkboxes = document.querySelectorAll('#modal-lkm-steps input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(c => c.checked);
  if (allChecked && checkboxes.length > 0) {
    sfx.success();
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00e676', '#00e5ff', '#ffffff']
      });
    }
  } else {
    sfx.click();
  }
}

function downloadLKMDoc() {
  const lkm = INVENTOR_DATA.jobsheets.find(j => j.id === appState.selectedLkmId) || INVENTOR_DATA.jobsheets[0];
  try { sfx.success(); } catch(e) {}
  window.open(lkm.driveUrl || 'https://drive.google.com/drive/folders/10oOazck9kgFaRwQ5-H0f26NzTOsFPWrO?usp=drive_link', '_blank');
}

// QR Code Scanner Modal
function openQRModal() {
  const modal = document.getElementById('modal-qr-scanner');
  if (modal) {
    modal.classList.add('active');
    sfx.switch();
  }
}

function closeQRModal() {
  const modal = document.getElementById('modal-qr-scanner');
  if (modal) {
    modal.classList.remove('active');
    sfx.click();
  }
}

function simulateScanQR(target) {
  closeQRModal();
  sfx.success();
  if (target.startsWith('lkm-')) {
    switchView('app', 'jobsheets');
    setTimeout(() => openLKMModal(target), 200);
  } else if (target.startsWith('part-')) {
    switchView('app', 'parts3d');
    setTimeout(() => selectPart3D(target), 200);
  }
}

/**
 * ==========================================================================
 * EVENT LISTENERS SETUP
 * ==========================================================================
 */
function setupEventListeners() {
  // Navigation links
  document.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const route = el.dataset.route;
      const tab = el.dataset.tab || 'features';
      switchView(route, tab);
    });
  });

  // App Tabs
  document.querySelectorAll('.app-nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Feature Search Input
  const searchInput = document.getElementById('feature-search-input');
  const clearBtn = document.getElementById('feature-search-clear');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value;
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !e.target.value);
      }
      renderFeatures();
    });
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      appState.searchQuery = '';
      clearBtn.classList.add('hidden');
      renderFeatures();
      sfx.click();
    });
  }

  // Feature Category Filter Chips
  const filterChips = document.querySelectorAll('#feature-filter-chips .cad-chip-interactive');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      appState.selectedFeatureCategory = chip.dataset.category;
      renderFeatures();
      sfx.click();
    });
  });

  // Theme toggle buttons
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // QR Modal triggers
  document.querySelectorAll('.qr-trigger-btn').forEach(btn => {
    btn.addEventListener('click', openQRModal);
  });

  // Close modals on overlay click
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLKMModal();
      closeQRModal();
    }
  });
}

// Export functions to window for inline onclick handlers
window.switchView = switchView;
window.switchTab = switchTab;
window.toggleTheme = toggleTheme;
window.openLKMModal = openLKMModal;
window.closeLKMModal = closeLKMModal;
window.openQRModal = openQRModal;
window.closeQRModal = closeQRModal;
window.simulateScanQR = simulateScanQR;
window.selectPart3D = selectPart3D;
window.selectFeatureCategory = selectFeatureCategory;
window.renderFeatures = renderFeatures;
