import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import InsightCard from "@/components/InsightCard"

export default function SecurityPage() {
    const [groups, setGroups] = useState([])
    const [insights, setInsights] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [insightsLoading, setInsightsLoading] = useState(false)

    const fetchGroups = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/security")
            setGroups(res.data)
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
            const res = await axios.post("/api/insights", { service: "security", data: groups })
            setInsights(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    useEffect(() => { fetchGroups() }, [])

    if (loading) return <div className="text-white">Loading security groups...</div>

    const riskyCount = groups.filter((g) => g.risky_rules.length > 0).length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Security Groups</h1>
                    <p className="text-gray-400 mt-1">
                        {groups.length} total —
                        <span className="text-red-400"> {riskyCount} with risky rules</span>
                    </p>
                </div>
                <button onClick={fetchGroups} disabled={refreshing} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 text-white text-sm rounded-md">
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <div className="flex flex-col gap-4 mb-8">
                {groups.map((sg) => (
                    <Card key={sg.group_id} className="bg-gray-900 border-gray-700">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white text-base">{sg.name}</CardTitle>
                                {sg.risky_rules.length > 0 ? (
                                    <Badge variant="destructive">{sg.risky_rules.length} Risk(s)</Badge>
                                ) : (
                                    <Badge variant="default">Clean</Badge>
                                )}
                            </div>
                            <p className="text-gray-500 text-xs">{sg.group_id} — {sg.description}</p>
                        </CardHeader>
                        {sg.risky_rules.length > 0 && (
                            <CardContent>
                                <p className="text-gray-400 text-xs mb-2">Risky Rules:</p>
                                <div className="flex flex-col gap-2">
                                    {sg.risky_rules.map((rule, i) => (
                                        <div key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded border ${rule.risk === "critical" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"}`}>
                                            <span>Port {rule.port} ({rule.protocol}) open to {rule.cidr}</span>
                                            <Badge variant={rule.risk === "critical" ? "destructive" : "secondary"}>
                                                {rule.risk}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>

            {/* AI Insights */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">CloudPulse AI Insights</h2>
                    <button
                        onClick={fetchInsights}
                        disabled={insightsLoading || groups.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-md"
                    >
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-gray-500">Click "Analyze with AI" to get security insights.</p>
                )}
                <div className="flex flex-col gap-3">
                    {insights.map((insight, index) => (
                        <InsightCard key={index} insight={insight} onActionComplete={fetchGroups} />
                    ))}
                </div>
            </div>
        </div>
    )
}