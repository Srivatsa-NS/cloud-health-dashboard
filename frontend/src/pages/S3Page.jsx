import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

    if (loading) return <div className="text-muted-foreground p-8">Loading S3 buckets...</div>

    const publicCount = buckets.filter((b) => b.is_public).length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">S3 Buckets</h1>
                    <p className="text-muted-foreground mt-1">
                        {buckets.length} total —
                        <span className="text-red-400"> {publicCount} public</span>
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchBuckets} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {buckets.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No S3 buckets found.</p>
                ) : (
                    buckets.map((bucket) => (
                        <Card key={bucket.name}>
                            <CardHeader>
                                <CardTitle>{bucket.name}</CardTitle>
                                <CardDescription>Created: {bucket.created}</CardDescription>
                                <CardAction>
                                    <Badge variant={bucket.is_public ? "destructive" : "default"}>
                                        {bucket.is_public ? "Public" : "Private"}
                                    </Badge>
                                </CardAction>
                            </CardHeader>
                        </Card>
                    ))
                )}
            </div>

            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">CloudPulse AI Insights</h2>
                    <Button size="sm" onClick={fetchInsights} disabled={insightsLoading || buckets.length === 0}>
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </Button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-muted-foreground">Click "Analyze with AI" to get insights about your S3 buckets.</p>
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