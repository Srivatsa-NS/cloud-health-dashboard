import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"
import { useAlerts } from "@/context/AlertsContext"

const INTERVAL_PRESETS = [
    { label: "30 min", value: 30 },
    { label: "1 hr",   value: 60 },
    { label: "2 hr",   value: 120 },
    { label: "6 hr",   value: 360 },
]

function MonitorModal({ groupName, onClose, onSaved }) {
    const [cfg, setCfg] = useState(null)
    const [email, setEmail] = useState("")
    const [intervalValue, setIntervalValue] = useState(60)
    const [isCustom, setIsCustom] = useState(false)
    const [customMinutes, setCustomMinutes] = useState("")
    const [saving, setSaving] = useState(false)
    const [running, setRunning] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const { fetchAlerts } = useAlerts()

    useEffect(() => {
        axios.get("/api/monitor/config", { params: { group: groupName } })
            .then((res) => {
                const data = res.data
                setCfg(data)
                setEmail(data.email || "")
                const preset = INTERVAL_PRESETS.find((p) => p.value === data.interval_minutes)
                if (preset) {
                    setIntervalValue(data.interval_minutes)
                    setIsCustom(false)
                } else {
                    setIsCustom(true)
                    setCustomMinutes(String(data.interval_minutes))
                }
            })
            .catch(() => setCfg({
                enabled: false, interval_minutes: 60, email: "",
                last_run: null, next_run: null, running: false, last_error: null,
            }))
    }, [groupName])

    const effectiveInterval = isCustom ? (parseInt(customMinutes, 10) || 60) : intervalValue

    const save = async (extra = {}) => {
        setSaving(true)
        try {
            const res = await axios.post("/api/monitor/config", {
                group: groupName,
                enabled: cfg.enabled,
                interval_minutes: effectiveInterval,
                email,
                ...extra,
            })
            setCfg(res.data)
            onSaved(groupName, res.data.enabled)
        } finally {
            setSaving(false)
        }
    }

    const resendVerification = async () => {
        try {
            const res = await axios.post("/api/monitor/config", {
                group: groupName,
                enabled: cfg.enabled,
                interval_minutes: effectiveInterval,
                email,
                force_verify: true,
            })
            setCfg(res.data)
        } catch { /* ignore */ }
    }

    const runNow = async () => {
        setRunning(true)
        try {
            await axios.post("/api/monitor/run", { group: groupName })
            setTimeout(async () => {
                const res = await axios.get("/api/monitor/config", { params: { group: groupName } })
                setCfg(res.data)
                await fetchAlerts()
                setRunning(false)
            }, 3500)
        } catch {
            setRunning(false)
        }
    }

    const deleteMonitor = async () => {
        setDeleting(true)
        try {
            await axios.delete("/api/monitor/config", { params: { group: groupName } })
            onSaved(groupName, false)
            onClose()
        } catch {
            setDeleting(false)
        }
    }

    const lastRun = cfg?.last_run
        ? new Date(cfg.last_run * 1000).toLocaleTimeString()
        : "Never"

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 m-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="font-semibold text-base">Log Monitor</h2>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-72">{groupName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none mt-0.5 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {cfg === null ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* Enable toggle */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Enable monitoring</span>
                            <button
                                onClick={() => setCfg((prev) => ({ ...prev, enabled: !prev.enabled }))}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
                                    ${cfg.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                                    ${cfg.enabled ? "translate-x-4" : "translate-x-1"}`} />
                            </button>
                        </div>

                        {/* Interval */}
                        <div className="flex flex-col gap-2">
                            <span className="text-sm">Check every</span>
                            <div className="flex flex-wrap gap-1.5">
                                {INTERVAL_PRESETS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { setIntervalValue(opt.value); setIsCustom(false) }}
                                        className={`px-3 py-1.5 rounded-md text-xs border transition-colors cursor-pointer
                                            ${!isCustom && intervalValue === opt.value
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "border-border text-muted-foreground hover:bg-muted"}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setIsCustom(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors cursor-pointer
                                        ${isCustom
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "border-border text-muted-foreground hover:bg-muted"}`}
                                >
                                    Custom
                                </button>
                            </div>
                            {isCustom && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        value={customMinutes}
                                        onChange={(e) => setCustomMinutes(e.target.value)}
                                        placeholder="e.g. 45"
                                        className="w-24 text-xs px-3 py-1.5 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <span className="text-xs text-muted-foreground">minutes</span>
                                </div>
                            )}
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm">Alert email</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com (optional)"
                                className="text-xs px-3 py-1.5 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {/* Verification status — only shown when there's a saved email */}
                            {cfg.email && email === cfg.email && (
                                <div className="flex items-center justify-between">
                                    {cfg.email_verified === "verified" && (
                                        <span className="text-xs text-green-500">✓ Email verified</span>
                                    )}
                                    {cfg.email_verified === "pending" && (
                                        <>
                                            <span className="text-xs text-yellow-500">⏳ Verification pending — check your inbox</span>
                                            <button
                                                onClick={resendVerification}
                                                className="text-xs text-primary underline cursor-pointer hover:opacity-80"
                                            >
                                                Resend
                                            </button>
                                        </>
                                    )}
                                    {(cfg.email_verified === "unverified" || cfg.email_verified === "unknown") && (
                                        <span className="text-xs text-muted-foreground">Not verified — Save to send verification email</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Status */}
                        <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>Last run: <span className="text-foreground">{lastRun}</span></div>
                            {cfg.last_error && <div className="text-red-500">{cfg.last_error}</div>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                            <Button className="flex-1" onClick={() => save()} disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                            </Button>
                            <Button variant="outline" onClick={runNow} disabled={running || cfg.running}>
                                {running || cfg.running ? "Running..." : "Run Now"}
                            </Button>
                        </div>

                        {/* Danger zone */}
                        <div className="pt-1 border-t border-border">
                            <button
                                onClick={deleteMonitor}
                                disabled={deleting}
                                className="text-xs text-red-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {deleting ? "Removing..." : "Remove monitor for this group"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

const healthConfig = {
    healthy: { variant: "default", label: "Healthy" },
    warning: { variant: "secondary", label: "Warning" },
    critical: { variant: "destructive", label: "Critical" },
}

export default function CloudWatchPage() {
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [modalGroup, setModalGroup] = useState(null)
    const [monitorActive, setMonitorActive] = useState({})
    const navigate = useNavigate()

    const fetchGroups = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/logs")
            setGroups(res.data)
            // Batch-check monitor status for all groups
            const results = await Promise.allSettled(
                res.data.map((g) => axios.get("/api/monitor/config", { params: { group: g.name } }))
            )
            const active = {}
            res.data.forEach((g, i) => {
                if (results[i].status === "fulfilled") {
                    active[g.name] = results[i].value.data.enabled === true
                }
            })
            setMonitorActive(active)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => { fetchGroups() }, [])

    const handleSaved = (groupName, enabled) => {
        setMonitorActive((prev) => ({ ...prev, [groupName]: enabled }))
    }

    if (loading) return <div className="text-muted-foreground p-8">Loading log groups...</div>

    const sorted = [...groups].sort((a, b) =>
        b.error_count !== a.error_count
            ? b.error_count - a.error_count
            : b.warning_count - a.warning_count
    )

    const criticalCount = sorted.filter((g) => g.health === "critical").length
    const warningCount = sorted.filter((g) => g.health === "warning").length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">CloudWatch Logs</h1>
                    <p className="text-muted-foreground mt-1">
                        {sorted.length} log group(s)
                        {criticalCount > 0 && <span className="text-red-500 ml-2">· {criticalCount} critical</span>}
                        {warningCount > 0 && <span className="text-yellow-500 ml-2">· {warningCount} warning</span>}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchGroups} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <PageGrid className="mb-8">
                {sorted.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No log groups found.</p>
                ) : (
                    sorted.map((group) => {
                        const cfg = healthConfig[group.health] || healthConfig.healthy
                        const isMonitored = monitorActive[group.name] === true
                        return (
                            <Card
                                key={group.name}
                                className="h-full flex flex-col cursor-pointer select-none hover:border-primary/50 hover:shadow-md transition-all duration-150"
                                onClick={() => navigate(`/logs/${encodeURIComponent(group.name)}`)}
                            >
                                <CardHeader>
                                    <CardTitle className="truncate text-sm leading-snug flex items-center gap-1.5">
                                        {isMonitored && (
                                            <span className="relative flex h-2 w-2 shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                            </span>
                                        )}
                                        {group.name}
                                    </CardTitle>
                                    <CardDescription>Created {group.created}</CardDescription>
                                    <CardAction>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                                title="Monitor settings"
                                                onClick={(e) => { e.stopPropagation(); setModalGroup(group.name) }}
                                            >
                                                ⚙
                                            </button>
                                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                                        </div>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="mt-auto flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                        <span className="text-sm font-semibold">{group.error_count}</span>
                                        <span className="text-xs text-muted-foreground">errors</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
                                        <span className="text-sm font-semibold">{group.warning_count}</span>
                                        <span className="text-xs text-muted-foreground">warnings</span>
                                    </div>
                                    <div className="ml-auto flex flex-col items-end gap-0.5">
                                        <span className="text-xs text-muted-foreground">{group.stored_str}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Retention: {group.retention_days === "Never" ? "Never expires" : `${group.retention_days}d`}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </PageGrid>

            {modalGroup && (
                <MonitorModal
                    groupName={modalGroup}
                    onClose={() => setModalGroup(null)}
                    onSaved={handleSaved}
                />
            )}
        </div>
    )
}
