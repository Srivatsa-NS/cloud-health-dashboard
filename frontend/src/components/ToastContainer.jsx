import { useEffect } from "react"
import { useAlerts } from "@/context/AlertsContext"

function AlertIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    )
}

function CloseIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
    )
}

function Toast({ toast }) {
    const { dismissToast } = useAlerts()
    const hasCritical = toast.criticalCount > 0
    const hasWarning  = toast.warningCount > 0
    const infoOnly    = !hasCritical && !hasWarning && toast.infoCount > 0
    const borderClass = hasCritical ? "border-red-500/60" : hasWarning ? "border-yellow-500/60" : "border-blue-500/60"
    const iconClass   = hasCritical ? "text-red-500 mt-0.5 shrink-0" : hasWarning ? "text-yellow-500 mt-0.5 shrink-0" : "text-blue-500 mt-0.5 shrink-0"

    // Auto-dismiss after 10 seconds
    useEffect(() => {
        const t = setTimeout(() => dismissToast(toast.id), 10_000)
        return () => clearTimeout(t)
    }, [toast.id])

    return (
        <div className={`flex items-start gap-3 w-80 rounded-lg border px-4 py-3 shadow-lg bg-background ${borderClass}`}>
            <span className={iconClass}>
                <AlertIcon />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                    Monitor Alert: {toast.group.split("/").pop()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {toast.criticalCount > 0 && <span className="text-red-500">{toast.criticalCount} critical </span>}
                    {toast.warningCount > 0 && <span className="text-yellow-500">{toast.warningCount} warning </span>}
                    {infoOnly
                        ? <span className="text-blue-500">activity summary</span>
                        : <>issue{(toast.criticalCount + toast.warningCount) !== 1 ? "s" : ""} detected</>}
                </p>
            </div>
            <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-0.5"
            >
                <CloseIcon />
            </button>
        </div>
    )
}

export default function ToastContainer() {
    const { toasts } = useAlerts()

    if (toasts.length === 0) return null

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} />
            ))}
        </div>
    )
}
