import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";

type LoadingProgressDialogProps = {
  title: string;
  message?: string | null;
  onClose: () => void;
};

export function LoadingProgressDialog({
  title,
  message = null,
  onClose,
}: LoadingProgressDialogProps) {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="loading-progress-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="loading-progress-modal-backdrop" />
      <div className="loading-progress-modal-card">
        <header className="loading-progress-modal-header">
          <div className="loading-progress-modal-copy">
            <div className="loading-progress-modal-spinner-wrap" aria-hidden>
              <LoaderCircle className="loading-progress-modal-spinner" size={18} />
            </div>
            <div className="loading-progress-modal-text">
              <h3>{title}</h3>
              {message ? (
                <p aria-live="polite">{message}</p>
              ) : null}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="ghost loading-progress-modal-close"
            onClick={onClose}
            aria-label={t("workspace.loadingProgressRunInBackground")}
            title={t("workspace.loadingProgressRunInBackground")}
          >
            {t("workspace.loadingProgressRunInBackground")}
          </button>
        </header>
      </div>
    </div>
  );
}
