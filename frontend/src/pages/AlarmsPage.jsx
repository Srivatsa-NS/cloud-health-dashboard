import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import InsightCard from "@/components/InsightCard"

const stateColors = {
    ALARM: "text-red-400 bg-red-500/10 border-red-500/30",
    OK: "text-green-400 bg-green-500/10 border-green-500/30",
    INSUFFICIENT_DATA: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
}

export default function AlarmsPage() {
    const [alarms, setAlarms] = useState([])
    const [insights, setInsights] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [insightsLoading, setInsightsLoading] = useState(false)

    const fetchAlarms = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/alarms")
            setAlarms(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const fetchInsights = async () => {
        setInsightsLoading(true)
        try {
            const res = await axios.post("/api/insights", { service: "alarms", data: alarms })
            setInsights(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    useEffect(() => { fetchAlarms() }, [])

    if (loading) return <div className="text-white">Loading alarms...</div>

    const alarmCount = alarms.filter((a) => a.state === "ALARM").length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">CloudWatch Alarms</h1>
                    <p className="text-gray-400 mt-1">
                        {alarms.length} total —
                        <span className="text-red-400"> {alarmCount} in ALARM state</span>
                    </p>
                </div>
                <button onClick={fetchAlarms} disabled={refreshing} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 text-white text-sm rounded-md">
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <div className="flex flex-col gap-3 mb-8">
                {alarms.length === 0 ? (
                    <p className="text-gray-400">No CloudWatch alarms found.</p>
                ) : (
                    alarms.map((alarm) => (
                        <Card key={alarm.name} className="bg-gray-900 border-gray-700">
                            <CardContent className="pt-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="text-white font-medium">{alarm.name}</p>
                                        <p className="text-gray-400 text-sm">{alarm.description}</p>
                                        <p className="text-gray-500 text-xs mt-1">
                                            {alarm.namespace} / {alarm.metric} — Threshold: {alarm.threshold}
                                        </p>
                                        <p className="text-gray-600 text-xs">Updated: {alarm.updated}</p>
                                    </div>
                                    <span className={`text-xs px-3 py-1 rounded border font-medium ${stateColors[alarm.state]}`}>
                                        {alarm.state}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* AI Insights */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">CloudPulse AI Insights</h2>
                    <button
                        onClick={fetchInsights}
                        disabled={insightsLoading || alarms.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-md"
                    >
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-gray-500">Click "Analyze with AI" to get insights about your alarms.</p>
                )}
                <div className="flex flex-col gap-3">
                    {insights.map((insight, index) => (
                        <InsightCard key={index} insight={insight} onActionComplete={fetchAlarms} />
                    ))}
                </div>
            </div>
        </div>
    )
}