// Global Version Configuration and Enforcement Utilities

declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIMESTAMP__: string | undefined;
declare const __BUILD_NUMBER__: string | undefined;
declare const __BUILD_ID__: string | undefined;

export const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v3.3.0';
export const DEFAULT_ALLOWED_VERSION = CURRENT_APP_VERSION;
export const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : new Date().toISOString();
export const BUILD_NUMBER = typeof __BUILD_NUMBER__ !== 'undefined' ? __BUILD_NUMBER__ : '2026.08.24.02';
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : `build-${Date.now().toString(36)}`;

export const COMMON_VERSION_PRESETS = [
  'v3.3.0',
  'v3.2.0',
  'v3.1.0',
  'v3.0.0',
  'v2.5.0',
  'v2.4.0',
  'v2.0.0',
  'v1.8.0',
  'v1.0.0'
];

export interface AppVersionInfo {
  version: string;
  buildNumber: string;
  buildTimestamp: string;
  buildId: string;
  isSimulated?: boolean;
}

export const getAppVersionInfo = (): AppVersionInfo => {
  const simulated = localStorage.getItem('simulated_client_version');
  return {
    version: (simulated && simulated.trim()) ? simulated.trim() : CURRENT_APP_VERSION,
    buildNumber: BUILD_NUMBER,
    buildTimestamp: BUILD_TIMESTAMP,
    buildId: BUILD_ID,
    isSimulated: !!(simulated && simulated.trim())
  };
};

/**
 * Get active client version (supports simulation mode for admin testing)
 */
export const getActiveClientVersion = (): string => {
  const simulated = localStorage.getItem('simulated_client_version');
  if (simulated && simulated.trim()) {
    return simulated.trim();
  }
  return CURRENT_APP_VERSION;
};

/**
 * Set or clear simulated client version for testing
 */
export const setSimulatedClientVersion = (version: string | null) => {
  if (version && version.trim() && version !== CURRENT_APP_VERSION) {
    localStorage.setItem('simulated_client_version', version.trim());
  } else {
    localStorage.removeItem('simulated_client_version');
  }
};

/**
 * Checks if the account's allowed version matches the active client version.
 * If user has no specific allowedVersion, falls back to default allowed version.
 */
export const checkVersionCompatibility = (
  userAllowedVersion?: string | null,
  clientVersion?: string
): { isAllowed: boolean; requiredVersion: string; currentVersion: string } => {
  const activeClient = clientVersion || getActiveClientVersion();
  const required = (userAllowedVersion && userAllowedVersion.trim()) 
    ? userAllowedVersion.trim() 
    : DEFAULT_ALLOWED_VERSION;

  // Allow match if same string or default compatibility
  const isAllowed = 
    activeClient.toLowerCase() === required.toLowerCase() ||
    required === 'v3.0.0' || // Backward compatibility for legacy default
    required === CURRENT_APP_VERSION;

  return {
    isAllowed,
    requiredVersion: required,
    currentVersion: activeClient
  };
};

/**
 * Server-side verification request
 */
export const verifyAccountVersionWithServer = async (
  userId: string,
  userEmail?: string,
  userAllowedVersion?: string
): Promise<{
  allowed: boolean;
  requiredVersion: string;
  installedVersion: string;
  currentServerVersion?: string;
  message?: string;
}> => {
  const currentClient = getActiveClientVersion();
  try {
    const res = await fetch('/api/version/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-version': currentClient,
        'x-user-id': userId,
        'x-user-email': userEmail || '',
        'x-user-allowed-version': userAllowedVersion || ''
      },
      body: JSON.stringify({
        userId,
        email: userEmail,
        allowedVersion: userAllowedVersion,
        clientVersion: currentClient
      })
    });

    const data = await res.json();
    return {
      allowed: data.allowed ?? true,
      requiredVersion: data.requiredVersion || userAllowedVersion || DEFAULT_ALLOWED_VERSION,
      installedVersion: data.installedVersion || currentClient,
      currentServerVersion: data.currentServerVersion || CURRENT_APP_VERSION,
      message: data.message
    };
  } catch (error) {
    // Local fallback check if network error
    const localCheck = checkVersionCompatibility(userAllowedVersion, currentClient);
    return {
      allowed: localCheck.isAllowed,
      requiredVersion: localCheck.requiredVersion,
      installedVersion: localCheck.currentVersion
    };
  }
};

/**
 * Check if a new server update/build has been deployed
 */
export const checkForServerUpdate = async (): Promise<{
  hasUpdate: boolean;
  serverVersion?: string;
  serverBuildId?: string;
  serverBuildTime?: string;
}> => {
  try {
    const cacheBuster = `t=${Date.now()}`;
    const res = await fetch(`/api/version?${cacheBuster}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (!res.ok) return { hasUpdate: false };
    const data = await res.json();
    
    const serverVersion = (data.version || '').trim();
    const clientVersion = (CURRENT_APP_VERSION || '').trim();
    const lastApplied = (localStorage.getItem('applied_app_version') || '').trim();

    // If client version matches server version or user already applied this server version, no update needed
    if (!serverVersion || serverVersion === clientVersion || serverVersion === lastApplied) {
      return {
        hasUpdate: false,
        serverVersion,
        serverBuildId: data.buildId,
        serverBuildTime: data.buildTime
      };
    }

    // New version detected on server
    const isNewVersion = serverVersion !== clientVersion;

    return {
      hasUpdate: Boolean(isNewVersion),
      serverVersion: data.version,
      serverBuildId: data.buildId,
      serverBuildTime: data.buildTime
    };
  } catch (err) {
    return { hasUpdate: false };
  }
};

/**
 * Hard reload and cache-busting to immediately apply latest updates
 */
export const forceAppUpdateAndClearCache = () => {
  try {
    // Clear known transient caches in sessionStorage
    sessionStorage.clear();

    // If Service Workers exist, unregister them
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }

    // Clear caches API
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
  } catch (e) {
    console.warn("Error clearing cache:", e);
  }

  // Force hard reload with timestamp query param
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.href = url.toString();
};

