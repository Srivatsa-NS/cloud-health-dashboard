import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import InsightCard from "@/components/InsightCard"
import axios from "axios"

const stateVariant = {
    running: "default",
    stopped: "destructive",
    terminated: "secondary",
    pending: "secondary",
}

function SparkleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        </svg>
    )
}

function InfoRow({ label, value, valueClass = "" }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
        </div>
    )
}

export default function EC2DetailPage() {
    const { instanceId } = useParams()
    const navigate = useNavigate()
    const [instance, setInstance] = useState(null)
    const [loading, setLoading] = useState(true)
    const [insights, setInsights] = useState([])
    const [insightsLoading, setInsightsLoading] = useState(false)
    const [insightsFetched, setInsightsFetched] = useState(false)

    useEffect(() => {
        axios.get("/api/ec2")
            .then((res) => {
                const found = res.data.find((i) => i.instance_id === instanceId)
                setInstance(found || null)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [instanceId])

    const fetchInsights = async () => {
        if (!instance) return
        setInsightsLoading(true)
        setInsights([])
        try {
            const res = await axios.post("/api/insights", { service: "ec2", data: [instance] })
            setInsights(res.data.filter((i) => i.severity !== "info"))
            setInsightsFetched(true)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    if (loading) return <div className="text-muted-foreground p-8">Loading...</div>
    if (!instance) return <div className="text-red-500 p-8">Instance not found.</div>

    const cpuColor = instance.cpu_utilization > 80
        ? "text-red-400"
        : instance.cpu_utilization > 60
        ? "text-yellow-400"
        : "text-green-400"

    const statusOk = instance.system_status === "ok" && instance.instance_status === "ok"

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-2 mb-6">
                <Button variant="ghost" size="sm" onClick={() => navigate("/ec2")} className="shrink-0 px-2 mt-0.5">
                    ← Back
                </Button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold break-all">{instance.name || instance.instance_id}</h1>
                        <Badge variant={stateVariant[instance.state] || "secondary"}>{instance.state}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">{instance.instance_id}</p>
                </div>
            </div>

            {/* Details */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-base">Instance Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <InfoRow label="Instance Type" value={instance.instance_type} />
                    <InfoRow label="Availability Zone" value={instance.availability_zone} />
                    <InfoRow
                        label="CPU Utilization"
                        value={`${instance.cpu_utilization}%`}
                        valueClass={cpuColor}
                    />
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">System Status</span>
                        <Badge variant={instance.system_status === "ok" ? "default" : "destructive"} className="w-fit">
                            {instance.system_status}
                        </Badge>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">Instance Status</span>
                        <Badge variant={instance.instance_status === "ok" ? "default" : "destructive"} className="w-fit">
                            {instance.instance_status}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Security groups */}
            {instance.security_groups.length > 0 && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-base">Attached Security Groups</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1.5">
                        {instance.security_groups.map((sg) => (
                            <div key={sg} className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{sg}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-auto py-1 px-2"
                                    onClick={() => navigate(`/security/${sg}`)}
                                >
                                    View →
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Status issue explanation */}
            {!statusOk && (
                <Card className="mb-8 border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="destructive">ISSUE</Badge>
                            <span className="font-semibold text-sm">Status check failing</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            One or more status checks are failing on this instance. AWS runs two types of
                            checks: a <strong>system status check</strong> (which tests the underlying hardware
                            and network that AWS manages) and an <strong>instance status check</strong> (which
                            tests your operating system and software). A failing check usually means the
                            instance needs to be rebooted, or there is an underlying infrastructure issue
                            that AWS needs to resolve.
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
                    <p className="text-muted-foreground text-sm">No issues found. This instance looks healthy.</p>
                )}
                {!insightsLoading && insights.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {insights.map((insight, i) => (
                            <InsightCard key={i} insight={insight} onActionComplete={() => {}} />
                        ))}
                    </div>
                )}
                {!insightsFetched && !insightsLoading && (
                    <p className="text-muted-foreground text-sm">Click "Analyze with AI" to get AI-powered recommendations for this instance.</p>
                )}
            </div>
        </div>
    )
}
