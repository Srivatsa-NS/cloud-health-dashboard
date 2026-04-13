import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

    if (loading) return <div className="text-muted-foreground p-8">Loading security groups...</div>

    const riskyCount = groups.filter((g) => g.risky_rules.length > 0).length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Security Groups</h1>
                    <p className="text-muted-foreground mt-1">
                        {groups.length} total —
                        <span className="text-red-400"> {riskyCount} with risky rules</span>
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchGroups} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {groups.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No security groups found.</p>
                ) : (
                    groups.map((sg) => (
                        <Card key={sg.group_id}>
                            <CardHeader>
                                <CardTitle>{sg.name}</CardTitle>
                                <CardDescription>{sg.group_id} — {sg.description}</CardDescription>
                                <CardAction>
                                    {sg.risky_rules.length > 0 ? (
                                        <Badge variant="destructive">{sg.risky_rules.length} Risk(s)</Badge>
                                    ) : (
                                        <Badge variant="default">Clean</Badge>
                                    )}
                                </CardAction>
                            </CardHeader>
                            {sg.risky_rules.length > 0 && (
                                <CardContent className="flex flex-col gap-2">
                                    <p className="text-muted-foreground text-xs">Risky Rules</p>
                                    <div className="flex flex-col gap-2">
                                        {sg.risky_rules.map((rule, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-border bg-muted/50">
                                                <span>Port {rule.port} ({rule.protocol}) → {rule.cidr}</span>
                                                <Badge variant={rule.risk === "critical" ? "destructive" : "secondary"}>
                                                    {rule.risk}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    ))
                )}
            </div>

            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">CloudPulse AI Insights</h2>
                    <Button size="sm" onClick={fetchInsights} disabled={insightsLoading || groups.length === 0}>
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </Button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-muted-foreground">Click "Analyze with AI" to get security insights.</p>
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