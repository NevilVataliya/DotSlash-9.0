export default function InstallAppButton({ canInstall, onInstall }) {
  if (!canInstall) return null;

  return (
    <button className="install-app-btn" onClick={onInstall} title="Install EcoRoute app">
      ⬇️ Install App
    </button>
  );
}
