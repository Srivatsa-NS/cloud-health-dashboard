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

export default function SecurityDetailPage() {
    const { groupId } = useParams()
    const navigate = useNavigate()
    const [sg, setSg] = useState(null)
    const [loading, setLoading] = useState(true)
    const [insights, setInsights] = useState([])
    const [insightsLoading, setInsightsLoading] = useState(false)
    const [insightsFetched, setInsightsFetched] = useState(false)

    useEffect(() => {
        axios.get("/api/security")
            .then((res) => {
                const found = res.data.find((g) => g.group_id === groupId)
                setSg(found || null)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [groupId])

    const fetchInsights = async () => {
        if (!sg) return
        setInsightsLoading(true)
        setInsights([])
        try {
            const res = await axios.post("/api/insights", { service: "security", data: [sg] })
            setInsights(res.data.filter((i) => i.severity !== "info"))
            setInsightsFetched(true)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    if (loading) return <div className="text-muted-foreground p-8">Loading...</div>
    if (!sg) return <div className="text-red-500 p-8">Security group not found.</div>

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-2 mb-6">
                <Button variant="ghost" size="sm" onClick={() => navigate("/security")} className="shrink-0 px-2 mt-0.5">
                    ← Back
                </Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold break-all">{sg.name}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{sg.group_id} · {sg.description}</p>
                </div>
            </div>

            {/* Summary badge */}
            <div className="mb-6">
                {sg.risky_rules.length > 0 ? (
                    <Badge variant="destructive">{sg.risky_rules.length} risky rule{sg.risky_rules.length !== 1 ? "s" : ""} detected</Badge>
                ) : (
                    <Badge variant="default">No risky rules — this group looks clean</Badge>
                )}
            </div>

            {/* Risky rules */}
            {sg.risky_rules.length > 0 && (
                <div className="flex flex-col gap-4 mb-8">
                    <h2 className="text-lg font-semibold">Risky Rules</h2>
                    {sg.risky_rules.map((rule, i) => (
                        <Card key={i} className={`border-l-4 ${rule.risk === "critical" ? "border-l-red-500" : "border-l-yellow-500"}`}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant={rule.risk === "critical" ? "destructive" : "secondary"}>
                                                {rule.risk.toUpperCase()}
                                            </Badge>
                                            <span className="font-semibold text-sm">{rule.label}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono">
                                            Port {rule.port} ({rule.protocol}) → {rule.cidr}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground leading-relaxed">{rule.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* AI Insights section */}
            <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">AI Insights</h2>
                    <Button
                        size="sm"
                        onClick={fetchInsights}
                        disabled={insightsLoading}
                        className="flex items-center gap-1.5"
                    >
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
                    <p className="text-muted-foreground text-sm">No risks or warnings found. This security group looks fine.</p>
                )}

                {!insightsLoading && insights.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {insights.map((insight, i) => (
                            <InsightCard key={i} insight={insight} onActionComplete={() => {}} />
                        ))}
                    </div>
                )}

                {!insightsFetched && !insightsLoading && (
                    <p className="text-muted-foreground text-sm">Click "Analyze with AI" to get AI-powered recommendations for this security group.</p>
                )}
            </div>
        </div>
    )
}
