const isElectron = /electron/i.test(navigator.userAgent) || window.location.protocol === 'file:';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded fired');

  await App.init();

  setupNetworkIndicator();
  setupInstallExperience();

  // Connect socket after app is ready
  Store.connectSocket();

  if (navigator.onLine) {
    try {
      await Store.processQueue();
      if (typeof App.updateSyncQueueBadge === 'function') {
        App.updateSyncQueueBadge();
      }
    } catch (error) {
      console.error('Initial queue sync failed:', error);
    }
  }

if (!isElectron && 'serviceWorker' in navigator) {

  if (isElectron && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
  if (window.caches?.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}
    console.log('Service worker supported');

    try {
      console.log('Trying to register service worker...');
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './'
      });

      console.log('✅ Service Worker registered successfully:', registration);
      console.log('Scope:', registration.scope);

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('🔄 New version available, activating...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            } else {
              console.log('✅ First service worker installed');
            }
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('🔄 New service worker active, reloading page...');
        window.location.reload();
      });

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  } else {
    console.log('Service worker not supported');
  }
});

window.addEventListener('hashchange', () => {
  if (typeof App.handleRouteChange === 'function') {
    App.handleRouteChange();
  }
});

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const page = Store._state.currentPage;

    if (page === 'home' && typeof PublicHome !== 'undefined') PublicHome.render();
    if (page === 'dashboard' && typeof Dashboard !== 'undefined') Dashboard.render();
    if (page === 'analytics' && typeof Analytics !== 'undefined') Analytics.render();
    if (page === 'sync' && typeof SyncCenter !== 'undefined') SyncCenter.render();
    if (page === 'staff' && typeof StaffPage !== 'undefined') StaffPage.render();
    if (page === 'kitchen' && typeof Kitchen !== 'undefined') Kitchen.render();
    if (page === 'billing' && typeof Billing !== 'undefined') Billing.render();
    if (page === 'floor' && typeof FloorMap !== 'undefined') FloorMap.render();
    if (page === 'pos' && typeof POS !== 'undefined') POS.render();
  }, 300);
});

let deferredPrompt = null;

// -------------------------
// Platform helpers
// -------------------------
function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isWindows() {
  return /windows/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function hasWindowsExe() {
  return !!(window.APP_CONFIG && window.APP_CONFIG.WINDOWS_EXE_URL);
}

// -------------------------
// Install experience
// -------------------------
function setupInstallExperience() {
  const installBtn = document.getElementById('installPwaBtn');
  const iosBtn = document.getElementById('iosInstallHintBtn');

  if (isInStandaloneMode()) {
    if (installBtn) installBtn.style.display = 'none';
    if (iosBtn) iosBtn.style.display = 'none';
    return;
  }

  // iOS hint button
  if (isIos()) {
    if (iosBtn) iosBtn.style.display = 'inline-flex';
    if (installBtn) installBtn.style.display = 'none';
    return;
  }

  // ✅ Windows desktop: show EXE download button immediately
  if (isWindows() && hasWindowsExe()) {
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
      // Change label to match EXE download behavior
      installBtn.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Download Windows App (.exe)
      `;
    }
    if (iosBtn) iosBtn.style.display = 'none';
    return;
  }

  // Other platforms: keep hidden until beforeinstallprompt fires
}

// PWA prompt capture
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const installBtn = document.getElementById('installPwaBtn');

  // ✅ Do not override Windows EXE button UI
  if (isWindows() && hasWindowsExe()) return;

  if (installBtn && !isIos() && !isInStandaloneMode()) {
    installBtn.style.display = 'inline-flex';
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;

  const installBtn = document.getElementById('installPwaBtn');
  const iosBtn = document.getElementById('iosInstallHintBtn');

  if (installBtn) installBtn.style.display = 'none';
  if (iosBtn) iosBtn.style.display = 'none';

  if (typeof App !== 'undefined') {
    App.toast('RestaurantOS installed successfully!', 'success');
  }
});

// This is the button handler in your HTML: onclick="installPWA()"
window.installPWA = async function () {
  // ✅ Windows: download EXE
  if (isWindows() && hasWindowsExe()) {
    const url = window.APP_CONFIG.WINDOWS_EXE_URL;

    // Force download navigation
    window.location.href = url;
    return;
  }

  // Normal PWA install flow
  if (!deferredPrompt) {
    if (typeof App !== 'undefined') {
      App.toast('Install option is not available right now.', 'warning');
    }
    return;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('Install prompt outcome:', outcome);

  const installBtn = document.getElementById('installPwaBtn');
  if (installBtn) installBtn.style.display = 'none';

  deferredPrompt = null;
};

window.showIosInstallInstructions = function () {
  if (typeof App === 'undefined') return;

  App.openModal(
    'Install on iPhone / iPad',
    `
      <div style="display:flex;flex-direction:column;gap:14px;font-size:0.9rem;color:var(--text-secondary)">
        <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius)">
          <strong style="color:var(--text-primary)">Step 1:</strong> Open this app in <strong>Safari</strong>
        </div>
        <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius)">
          <strong style="color:var(--text-primary)">Step 2:</strong> Tap the <strong>Share</strong> button
        </div>
        <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius)">
          <strong style="color:var(--text-primary)">Step 3:</strong> Tap <strong>Add to Home Screen</strong>
        </div>
        <div style="padding:12px;background:var(--accent-bg);border-radius:var(--radius);color:var(--accent)">
          After adding, RestaurantOS will open like a native app from your Home Screen.
        </div>
      </div>
    `,
    `<button class="btn btn-primary" onclick="App.closeModal()">Got it</button>`
  );
};

function setupNetworkIndicator() {
  const indicator = document.getElementById('networkIndicator');
  const text = document.getElementById('networkText');

  const updateNetworkStatus = () => {
    if (!indicator || !text) return;

    if (navigator.onLine) {
      indicator.classList.remove('offline');
      indicator.classList.add('online');
      text.textContent = 'Online';
    } else {
      indicator.classList.remove('online');
      indicator.classList.add('offline');
      text.textContent = 'Offline';
    }
  };

  updateNetworkStatus();

  window.addEventListener('online', async () => {
    updateNetworkStatus();

    if (typeof App !== 'undefined') {
      App.toast('Back online. Syncing queued requests...', 'success');
    }

    try {
      await Store.processQueue();

      if (typeof App.updateSyncQueueBadge === 'function') {
        App.updateSyncQueueBadge();
      }

      if (Store._state.currentPage === 'sync' && typeof SyncCenter !== 'undefined') {
        SyncCenter.render();
      }
    } catch (error) {
      console.error('Queue sync failed:', error);

      if (typeof App !== 'undefined') {
        App.toast('Some queued changes could not be synced', 'warning');
      }
    }
  });

  window.addEventListener('offline', () => {
    updateNetworkStatus();

    if (typeof App !== 'undefined') {
      App.toast('You are offline', 'warning');
    }
  });
}