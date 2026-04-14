import { createContext, useContext, useEffect, useRef, useState } from "react"
import axios from "axios"

const AlertsContext = createContext(null)

const POLL_INTERVAL = 30_000 // 30 seconds

export function AlertsProvider({ children }) {
    const [alerts, setAlerts] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [toasts, setToasts] = useState([])
    const seenIds = useRef(new Set())

    const fetchAlerts = async () => {
        try {
            const res = await axios.get("/api/monitor/alerts")
            const incoming = res.data
            setAlerts(incoming)

            // Find truly new alerts (ids not seen before)
            const newAlerts = incoming.filter((a) => !seenIds.current.has(a.id))
            newAlerts.forEach((a) => seenIds.current.add(a.id))

            if (newAlerts.length > 0) {
                // Add a toast for each new alert
                const newToasts = newAlerts.map((a) => {
                    const infoIssue = a.issues.find((i) => i.severity === "info")
                    return {
                        id: a.id,
                        group: a.group,
                        criticalCount: a.issues.filter((i) => i.severity === "critical").length,
                        warningCount: a.issues.filter((i) => i.severity === "warning").length,
                        infoCount: a.issues.filter((i) => i.severity === "info").length,
                        infoMessage: infoIssue ? infoIssue.description : null,
                        timestamp: a.timestamp,
                    }
                })
                setToasts((prev) => [...prev, ...newToasts])
            }

            setUnreadCount(incoming.filter((a) => !a.read).length)
        } catch {
            // Silently fail — monitor may not be enabled
        }
    }

    const dismissToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }

    const markAllRead = async () => {
        try {
            await axios.post("/api/monitor/alerts/read")
            setUnreadCount(0)
            setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
        } catch { /* ignore */ }
    }

    // Initial fetch then poll
    useEffect(() => {
        fetchAlerts()
        const interval = setInterval(fetchAlerts, POLL_INTERVAL)
        return () => clearInterval(interval)
    }, [])

    return (
        <AlertsContext.Provider value={{ alerts, unreadCount, toasts, dismissToast, markAllRead, fetchAlerts }}>
            {children}
        </AlertsContext.Provider>
    )
}

export const useAlerts = () => useContext(AlertsContext)
