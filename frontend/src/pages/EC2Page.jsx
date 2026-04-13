import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import InsightCard from "@/components/InsightCard"

const stateColor = {
    running: "bg-green-500/20 text-green-400 border-green-500/30",
    stopped: "bg-red-500/20 text-red-400 border-red-500/30",
    terminated: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
}

export default function EC2Page() {
    const [instances, setInstances] = useState([])
    const [insights, setInsights] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [insightsLoading, setInsightsLoading] = useState(false)

    const fetchInstances = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/ec2")
            setInstances(res.data)
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
                service: "ec2",
                data: instances
            })
            setInsights(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    useEffect(() => { fetchInstances() }, [])

    if (loading) return <div className="text-white">Loading EC2 instances...</div>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">EC2 Instances</h1>
                    <p className="text-gray-400 mt-1">{instances.length} instance(s) found</p>
                </div>
                <button
                    onClick={fetchInstances}
                    disabled={refreshing}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 text-white text-sm rounded-md"
                >
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {/* Instances Table */}
            <div className="grid grid-cols-1 gap-4 mb-8">
                {instances.length === 0 ? (
                    <p className="text-gray-400">No EC2 instances found in this region.</p>
                ) : (
                    instances.map((instance) => (
                        <Card key={instance.instance_id} className="bg-gray-900 border-gray-700">
                            <CardContent className="pt-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-gray-400 text-xs mb-1">Instance</p>
                                        <p className="text-white font-medium">{instance.name}</p>
                                        <p className="text-gray-500 text-xs">{instance.instance_id}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs mb-1">State</p>
                                        <span className={`text-xs px-2 py-1 rounded border ${stateColor[instance.state] || stateColor.stopped}`}>
                                            {instance.state}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs mb-1">Type / AZ</p>
                                        <p className="text-white text-sm">{instance.instance_type}</p>
                                        <p className="text-gray-500 text-xs">{instance.availability_zone}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs mb-1">CPU</p>
                                        <p className={`text-lg font-bold ${instance.cpu_utilization > 80 ? "text-red-400" : instance.cpu_utilization > 60 ? "text-yellow-400" : "text-green-400"}`}>
                                            {instance.cpu_utilization}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs mb-1">System Status</p>
                                        <Badge variant={instance.system_status === "ok" ? "default" : "destructive"}>
                                            {instance.system_status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs mb-1">Instance Status</p>
                                        <Badge variant={instance.instance_status === "ok" ? "default" : "destructive"}>
                                            {instance.instance_status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs mb-1">Security Groups</p>
                                        <p className="text-gray-300 text-xs">{instance.security_groups.join(", ")}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* AI Insights Section */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">CloudPulse AI Insights</h2>
                    <button
                        onClick={fetchInsights}
                        disabled={insightsLoading || instances.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-md"
                    >
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-gray-500">Click "Analyze with AI" to get insights about your EC2 instances.</p>
                )}
                <div className="flex flex-col gap-3">
                    {insights.map((insight, index) => (
                        <InsightCard key={index} insight={insight} onActionComplete={fetchInstances} />
                    ))}
                </div>
            </div>
        </div>
    )
}