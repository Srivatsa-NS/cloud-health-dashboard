import { useAlerts } from "@/context/AlertsContext"

function timeAgo(ts) {
    const diff = Math.floor(Date.now() / 1000 - ts)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

const SEVERITY_STYLES = {
    critical: {
        badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        border: "border-l-red-500",
        dot: "bg-red-500",
        label: "Critical",
    },
    warning: {
        badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        border: "border-l-yellow-500",
        dot: "bg-yellow-500",
        label: "Warning",
    },
    info: {
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        border: "border-l-blue-500",
        dot: "bg-blue-400",
        label: "Info",
    },
}

function AlertCard({ alert }) {
    const criticals = alert.issues.filter((i) => i.severity === "critical")
    const warnings  = alert.issues.filter((i) => i.severity === "warning")
    const infos     = alert.issues.filter((i) => i.severity === "info")

    const dominantSeverity = criticals.length > 0 ? "critical"
        : warnings.length > 0 ? "warning"
        : "info"

    const style = SEVERITY_STYLES[dominantSeverity]

    return (
        <div className={`relative rounded-lg border border-border border-l-4 ${style.border} bg-card p-4 ${!alert.read ? "shadow-sm" : "opacity-75"}`}>
            {/* Unread dot */}
            {!alert.read && (
                <span className={`absolute top-4 right-4 h-2 w-2 rounded-full ${style.dot}`} />
            )}

            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.group}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {timeAgo(alert.timestamp)} &middot; {alert.raw_event_count} events &middot; last {alert.window_minutes} min
                    </p>
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                    {criticals.length > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES.critical.badge}`}>
                            {criticals.length} Critical
                        </span>
                    )}
                    {warnings.length > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES.warning.badge}`}>
                            {warnings.length} Warning
                        </span>
                    )}
                    {infos.length > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES.info.badge}`}>
                            {infos.length} Info
                        </span>
                    )}
                </div>
            </div>

            {/* Issues */}
            <div className="flex flex-col gap-2">
                {[...criticals, ...warnings, ...infos].map((issue, idx) => {
                    const s = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.info
                    return (
                        <div key={idx} className="rounded-md bg-muted/40 p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${s.badge}`}>
                                    {s.label}
                                </span>
                                <span className="text-sm font-medium">{issue.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
                            {issue.severity !== "info" && issue.action && (
                                <p className="text-xs text-foreground/70 mt-1.5">
                                    <span className="font-medium">Action: </span>{issue.action}
                                </p>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function NotificationsPage() {
    const { alerts, unreadCount, markAllRead } = useAlerts()

    return (
        <div className="max-w-3xl mx-auto">
            {/* Page header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold">Notifications</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        AI-analysed log monitor alerts
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllRead}
                        className="text-sm text-primary hover:underline cursor-pointer"
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            {alerts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                    <p className="text-muted-foreground text-sm">No notifications yet.</p>
                    <p className="text-muted-foreground text-xs mt-1">
                        Enable log monitoring on the CloudWatch page to start receiving alerts.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {alerts.map((alert) => (
                        <AlertCard key={alert.id} alert={alert} />
                    ))}
                </div>
            )}
        </div>
    )
}
