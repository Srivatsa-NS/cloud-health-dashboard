import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import InsightCard from "@/components/InsightCard"
import axios from "axios"

function SparkleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        </svg>
    )
}

export default function ECSDetailPage() {
    const { clusterName: encodedName } = useParams()
    const clusterName = decodeURIComponent(encodedName)
    const navigate = useNavigate()
    const [cluster, setCluster] = useState(null)
    const [loading, setLoading] = useState(true)
    const [insights, setInsights] = useState([])
    const [insightsLoading, setInsightsLoading] = useState(false)
    const [insightsFetched, setInsightsFetched] = useState(false)

    useEffect(() => {
        axios.get("/api/ecs")
            .then((res) => {
                const found = res.data.find((c) => c.cluster === clusterName)
                setCluster(found || null)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [clusterName])

    const fetchInsights = async () => {
        if (!cluster) return
        setInsightsLoading(true)
        setInsights([])
        try {
            const res = await axios.post("/api/insights", { service: "ecs", data: [cluster] })
            setInsights(res.data.filter((i) => i.severity !== "info"))
            setInsightsFetched(true)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    if (loading) return <div className="text-muted-foreground p-8">Loading...</div>
    if (!cluster) return <div className="text-red-500 p-8">Cluster not found.</div>

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-2 mb-6">
                <Button variant="ghost" size="sm" onClick={() => navigate("/ecs")} className="shrink-0 px-2 mt-0.5">
                    ← Back
                </Button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold break-all">{cluster.cluster}</h1>
                        <Badge variant={cluster.running_tasks > 0 ? "default" : "secondary"}>
                            {cluster.running_tasks > 0 ? "Active" : "Idle"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">ECS Cluster</p>
                </div>
            </div>

            {/* Summary */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-base">Cluster Overview</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">Running Tasks</span>
                        <span className="text-3xl font-bold">{cluster.running_tasks}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">Registered Tasks</span>
                        <span className="text-3xl font-bold">{cluster.task_arns.length}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Task ARNs */}
            {cluster.task_arns.length > 0 && (
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="text-base">Running Tasks</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {cluster.task_arns.map((arn) => (
                            <div key={arn} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40">
                                <span className="text-xs font-mono text-muted-foreground break-all">
                                    {arn.split("/").pop()}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {cluster.running_tasks === 0 && (
                <Card className="mb-8 border-l-4 border-l-yellow-500">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary">WARNING</Badge>
                            <span className="font-semibold text-sm">No tasks running</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            This ECS cluster currently has zero running tasks. If this cluster is supposed to
                            be serving an application, this means your application is down and not handling
                            any requests. Check the ECS service and task definitions to see why tasks may
                            have stopped or failed to start.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* AI Insights */}
            <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">AI Insights</h2>
                    <Button size="sm" onClick={fetchInsights} disabled={insightsLoading} className="flex items-center gap-1.5">
                        <SparkleIcon />
                        {insightsLoading ? "Analyzing..." : insightsFetched ? "Re-analyze" : "Analyze with AI"}
                    </Button>
                </div>
                {insightsLoading && (
                    <div className="flex flex-col gap-3">
                        {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
                    </div>
                )}
                {!insightsLoading && insightsFetched && insights.length === 0 && (
                    <p className="text-muted-foreground text-sm">No issues found. This cluster looks healthy.</p>
                )}
                {!insightsLoading && insights.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {insights.map((insight, i) => (
                            <InsightCard key={i} insight={insight} onActionComplete={() => {}} resourceData={cluster} />
                        ))}
                    </div>
                )}
                {!insightsFetched && !insightsLoading && (
                    <p className="text-muted-foreground text-sm">Click "Analyze with AI" to get AI-powered recommendations for this cluster.</p>
                )}
            </div>
        </div>
    )
}
