import { useEffect, useMemo, useState } from 'react';

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone) {
      setInstalled(true);
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const canInstall = useMemo(() => Boolean(deferredPrompt) && !installed, [deferredPrompt, installed]);

  async function promptInstall() {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const outcome = await deferredPrompt.userChoice;

    if (outcome.outcome === 'accepted') {
      setInstalled(true);
      setDeferredPrompt(null);
      return true;
    }

    return false;
  }

  return {
    canInstall,
    installed,
    promptInstall,
  };
}
