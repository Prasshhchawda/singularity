import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Settings, X } from "lucide-react";
import { useState } from "react";
import { usePwaUpdate } from "./pwa-update-context";

export function AppSettings() {
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const {
    updateAvailable,
    serviceWorkerReady,
    serviceWorkerSupported,
    checking,
    updating,
    checkError,
    updateError,
    checkForUpdates,
    updateNow,
  } = usePwaUpdate();

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="workspace-settings-trigger"
            aria-label={updateAvailable ? "Settings, update available" : "Settings"}
            title="Settings"
          >
            <Settings size={16} strokeWidth={1.7} />
            {updateAvailable && <span className="workspace-settings-badge" aria-hidden="true" />}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="agent-picker-menu workspace-settings-menu"
            align="end"
            sideOffset={8}
          >
            <DropdownMenu.Item className="agent-picker-item" onSelect={() => setUpdatesOpen(true)}>
              Updates
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root open={updatesOpen} onOpenChange={setUpdatesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="updates-dialog-overlay" />
          <Dialog.Content className="updates-dialog">
            <div className="updates-dialog-heading">
              <div>
                <p className="agent-section-kicker">APP SETTINGS</p>
                <Dialog.Title className="updates-dialog-title">Updates</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="updates-dialog-close" aria-label="Close updates">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="updates-dialog-description">
              Keep Singularity up to date.
            </Dialog.Description>

            <div className="updates-status" aria-live="polite">
              <span
                className={`updates-status-indicator${updateAvailable ? " is-available" : ""}`}
                aria-hidden="true"
              />
              <strong>{updateAvailable ? "Update available" : "No latest update"}</strong>
            </div>

            <dl className="updates-build-info">
              <div>
                <dt>Version</dt>
                <dd>{__APP_VERSION__}</dd>
              </div>
              <div>
                <dt>Build date</dt>
                <dd>{__BUILD_DATE__.slice(0, 10)}</dd>
              </div>
            </dl>

            {!serviceWorkerSupported && (
              <p className="updates-error">
                Service worker updates are not supported in this browser.
              </p>
            )}
            {serviceWorkerSupported && !serviceWorkerReady && (
              <p className="updates-hint">The update service is starting.</p>
            )}
            {checkError && <p className="updates-error">{checkError}</p>}
            {updateError && <p className="updates-error">{updateError}</p>}

            <div className="updates-actions">
              <button
                type="button"
                className="updates-secondary-button"
                disabled={checking || updating || !serviceWorkerSupported || !serviceWorkerReady}
                onClick={() => void checkForUpdates()}
              >
                {checking ? "Checking..." : "Check for updates"}
              </button>
              {updateAvailable && (
                <button
                  type="button"
                  className="updates-primary-button"
                  disabled={updating}
                  onClick={() => void updateNow()}
                >
                  {updating ? "Installing..." : "Update now"}
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
