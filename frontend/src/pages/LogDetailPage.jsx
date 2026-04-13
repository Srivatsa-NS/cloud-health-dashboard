import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { useInsights } from "@/context/InsightsContext"

const levelConfig = {
    ERROR:   { textClass: "text-red-500",    rowClass: "bg-red-500/10",    labelClass: "text-red-500 font-semibold" },
    WARN:    { textClass: "text-yellow-500", rowClass: "bg-yellow-500/10", labelClass: "text-yellow-500 font-semibold" },
    INFO:    { textClass: "text-foreground", rowClass: "",                 labelClass: "text-muted-foreground" },
}

const HOURS_OPTIONS = [1, 3, 6, 24]

export default function LogDetailPage() {
    const { groupName: encoded } = useParams()
    const groupName = decodeURIComponent(encoded)
    const navigate = useNavigate()
    const { registerPage } = useInsights()

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [filter, setFilter] = useState("all")
    const [hours, setHours] = useState(1)

    const fetchEvents = async (h = hours) => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/logs/events", {
                params: { group: groupName, hours: h },
            })
            setData(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => { fetchEvents() }, [groupName])

    useEffect(() => {
        if (data?.events) {
            registerPage("cloudwatch", data.events.slice(0, 50), () => fetchEvents())
        }
    }, [data])

    const handleHoursChange = (h) => {
        setHours(h)
        fetchEvents(h)
    }

    if (loading) return <div className="text-muted-foreground p-8">Loading logs for {groupName}...</div>
    if (!data || data.error) return <div className="text-red-500 p-8">Failed to load logs: {data?.error}</div>

    const { events = [], total, error_count, warning_count, info_count } = data
    const filtered = filter === "issues" ? events.filter((e) => e.level !== "INFO") : events

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-6 gap-4">
                <div className="flex items-start gap-2 min-w-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/logs")}
                        className="shrink-0 px-2 mt-0.5"
                    >
                        ← Back
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold break-all">{groupName}</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Last {hours}h · {total} event{total !== 1 ? "s" : ""} collected
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchEvents()}
                    disabled={refreshing}
                    className="shrink-0"
                >
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap gap-3 mb-5">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card">
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                    <span className="text-sm font-semibold">{total}</span>
                    <span className="text-xs text-muted-foreground">total</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-sm font-semibold text-red-500">{error_count}</span>
                    <span className="text-xs text-muted-foreground">errors</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span className="text-sm font-semibold text-yellow-500">{warning_count}</span>
                    <span className="text-xs text-muted-foreground">warnings</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    <span className="text-sm font-semibold">{info_count}</span>
                    <span className="text-xs text-muted-foreground">info</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Filter toggle */}
                <div className="flex rounded-md border overflow-hidden text-sm">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-3 py-1.5 transition-colors ${
                            filter === "all"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted"
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter("issues")}
                        className={`px-3 py-1.5 transition-colors border-l border-border ${
                            filter === "issues"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted"
                        }`}
                    >
                        Errors & Warnings
                        {(error_count + warning_count) > 0 && (
                            <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">
                                {error_count + warning_count}
                            </span>
                        )}
                    </button>
                </div>

                {/* Time range */}
                <div className="flex rounded-md border overflow-hidden text-sm ml-auto">
                    {HOURS_OPTIONS.map((h) => (
                        <button
                            key={h}
                            onClick={() => handleHoursChange(h)}
                            className={`px-3 py-1.5 transition-colors border-l first:border-l-0 border-border ${
                                hours === h
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {h}h
                        </button>
                    ))}
                </div>
            </div>

            {/* Log events list */}
            <div className="rounded-lg border overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground">
                        {filter === "issues"
                            ? "No errors or warnings found in this time range."
                            : "No log events found in this time range."}
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filtered.map((event, i) => {
                            const cfg = levelConfig[event.level] || levelConfig.INFO
                            return (
                                <div
                                    key={i}
                                    className={`px-4 py-2.5 flex gap-3 items-start text-xs font-mono ${cfg.rowClass}`}
                                >
                                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                                        {event.timestamp}
                                    </span>
                                    <span className={`shrink-0 w-10 uppercase ${cfg.labelClass}`}>
                                        {event.level}
                                    </span>
                                    <span className={`break-all flex-1 ${cfg.textClass}`}>
                                        {event.message}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {filtered.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3 text-center">
                    Showing {filtered.length} of {total} events · Increase time range to see more
                </p>
            )}
        </div>
    )
}
