const PUSH_DEVICE_STORAGE_KEY = 'quorumflow.push.device-id';

function createDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPushDeviceId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const existingDeviceId = window.localStorage.getItem(PUSH_DEVICE_STORAGE_KEY);
    if (existingDeviceId) {
      return existingDeviceId;
    }

    const nextDeviceId = createDeviceId();
    window.localStorage.setItem(PUSH_DEVICE_STORAGE_KEY, nextDeviceId);
    return nextDeviceId;
  } catch (error) {
    console.error('Error reading push device ID:', error);
    return null;
  }
}

export function getPushSubscriptionDocId(userId: string, deviceId: string): string {
  return `${userId}_${deviceId}`;
}
