import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import InsightCard from "@/components/InsightCard"

export default function S3Page() {
    const [buckets, setBuckets] = useState([])
    const [insights, setInsights] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [insightsLoading, setInsightsLoading] = useState(false)

    const fetchBuckets = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/s3")
            setBuckets(res.data)
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
            const res = await axios.post("/api/insights", { service: "s3", data: buckets })
            setInsights(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    useEffect(() => { fetchBuckets() }, [])

    if (loading) return <div className="text-white">Loading S3 buckets...</div>

    const publicCount = buckets.filter((b) => b.is_public).length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">S3 Buckets</h1>
                    <p className="text-gray-400 mt-1">
                        {buckets.length} total —
                        <span className="text-red-400"> {publicCount} public</span>
                    </p>
                </div>
                <button onClick={fetchBuckets} disabled={refreshing} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 text-white text-sm rounded-md">
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <div className="flex flex-col gap-3 mb-8">
                {buckets.length === 0 ? (
                    <p className="text-gray-400">No S3 buckets found.</p>
                ) : (
                    buckets.map((bucket) => (
                        <Card key={bucket.name} className={`border ${bucket.is_public ? "bg-red-500/5 border-red-500/30" : "bg-gray-900 border-gray-700"}`}>
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">{bucket.name}</p>
                                        <p className="text-gray-500 text-xs">Created: {bucket.created}</p>
                                    </div>
                                    <Badge variant={bucket.is_public ? "destructive" : "default"}>
                                        {bucket.is_public ? "Public" : "Private"}
                                    </Badge>
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
                        disabled={insightsLoading || buckets.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-md"
                    >
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-gray-500">Click "Analyze with AI" to get insights about your S3 buckets.</p>
                )}
                <div className="flex flex-col gap-3">
                    {insights.map((insight, index) => (
                        <InsightCard key={index} insight={insight} onActionComplete={fetchBuckets} />
                    ))}
                </div>
            </div>
        </div>
    )
}