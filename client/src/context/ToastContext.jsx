import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback(function (id) {
    setToasts(function (prev) {
      return prev.filter(function (t) {
        return t.id !== id;
      });
    });
  }, []);

  const showToast = useCallback(
    function (message, type) {
      const id = ++idCounter;
      setToasts(function (prev) {
        return prev.concat([{ id: id, message: message, type: type || "info" }]);
      });
      setTimeout(function () {
        removeToast(id);
      }, 6000);
    },
    [removeToast]
  );

  const value = useMemo(
    function () {
      return {
        success: function (msg) {
          showToast(msg, "success");
        },
        error: function (msg) {
          showToast(msg, "error");
        },
        info: function (msg) {
          showToast(msg, "info");
        },
      };
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map(function (toast) {
          const styles =
            toast.type === "success"
              ? "bg-status-success text-white"
              : toast.type === "error"
              ? "bg-error text-white"
              : "bg-text-primary text-white";
          const icon =
            toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info";
          return (
            <div
              key={toast.id}
              role="status"
              className={
                "flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-body-sm font-medium " +
                styles
              }
            >
              <span className="material-symbols-outlined text-[18px] mt-0.5" aria-hidden="true">
                {icon}
              </span>
              <p className="flex-1">{toast.message}</p>
              <button
                type="button"
                className="shrink-0 text-white/90 hover:text-white min-w-[44px] min-h-[44px] -mr-2 -mt-2"
                onClick={function () {
                  removeToast(toast.id);
                }}
                aria-label="Dismiss notification"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
