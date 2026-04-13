import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import InsightCard from "@/components/InsightCard"

export default function ECSPage() {
    const [clusters, setClusters] = useState([])
    const [insights, setInsights] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [insightsLoading, setInsightsLoading] = useState(false)

    const fetchClusters = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/ecs")
            setClusters(res.data)
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
            const res = await axios.post("/api/insights", {
                service: "ecs",
                data: clusters
            })
            setInsights(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    useEffect(() => { fetchClusters() }, [])

    if (loading) return <div className="text-white">Loading ECS clusters...</div>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">ECS Clusters</h1>
                    <p className="text-gray-400 mt-1">{clusters.length} cluster(s) found</p>
                </div>
                <button
                    onClick={fetchClusters}
                    disabled={refreshing}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 text-white text-sm rounded-md"
                >
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {clusters.map((cluster) => (
                    <Card key={cluster.cluster} className="bg-gray-900 border-gray-700">
                        <CardHeader>
                            <CardTitle className="text-white">{cluster.cluster}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm">Running Tasks</p>
                                    <p className="text-3xl font-bold text-white">{cluster.running_tasks}</p>
                                </div>
                                <Badge variant={cluster.running_tasks > 0 ? "default" : "secondary"}>
                                    {cluster.running_tasks > 0 ? "Active" : "Idle"}
                                </Badge>
                            </div>
                            {cluster.task_arns.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-gray-400 text-xs mb-2">Task ARNs</p>
                                    {cluster.task_arns.map((arn) => (
                                        <p key={arn} className="text-gray-500 text-xs truncate">{arn}</p>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* AI Insights */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">CloudPulse AI Insights</h2>
                    <button
                        onClick={fetchInsights}
                        disabled={insightsLoading || clusters.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-md"
                    >
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-gray-500">Click "Analyze with AI" to get insights about your ECS clusters.</p>
                )}
                <div className="flex flex-col gap-3">
                    {insights.map((insight, index) => (
                        <InsightCard key={index} insight={insight} onActionComplete={fetchClusters} />
                    ))}
                </div>
            </div>
        </div>
    )
}