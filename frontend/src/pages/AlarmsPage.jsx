import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import InsightCard from "@/components/InsightCard"
import PageGrid from "@/components/PageGrid"
import FlipCard from "@/components/FlipCard"

const stateVariant = {
    ALARM: "destructive",
    OK: "default",
    INSUFFICIENT_DATA: "secondary",
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

    if (loading) return <div className="text-muted-foreground p-8">Loading alarms...</div>

    const alarmCount = alarms.filter((a) => a.state === "ALARM").length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">CloudWatch Alarms</h1>
                    <p className="text-muted-foreground mt-1">
                        {alarms.length} total —
                        <span className="text-red-400"> {alarmCount} in ALARM state</span>
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAlarms} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <PageGrid className="mb-8">
                {alarms.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No CloudWatch alarms found.</p>
                ) : (
                    alarms.map((alarm) => (
                        <FlipCard
                            key={alarm.name}
                            front={
                                <Card className="h-full cursor-pointer select-none flex flex-col">
                                    <CardHeader>
                                        <CardTitle>{alarm.name}</CardTitle>
                                        <CardDescription>{alarm.description || "No description"}</CardDescription>
                                        <CardAction>
                                            <Badge variant={stateVariant[alarm.state] || "secondary"}>
                                                {alarm.state}
                                            </Badge>
                                        </CardAction>
                                    </CardHeader>
                                    <CardContent className="mt-auto">
                                        <p className="text-muted-foreground text-xs">Click to see metric details</p>
                                    </CardContent>
                                </Card>
                            }
                            back={
                                <Card className="h-full cursor-pointer select-none flex flex-col overflow-hidden">
                                    <CardHeader>
                                        <CardTitle className="text-sm">{alarm.name}</CardTitle>
                                        <CardDescription>Metric Details</CardDescription>
                                        <CardAction>
                                            <Badge variant={stateVariant[alarm.state] || "secondary"}>
                                                {alarm.state}
                                            </Badge>
                                        </CardAction>
                                    </CardHeader>
                                    <CardContent className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Namespace / Metric</p>
                                            <p className="text-sm font-medium">{alarm.namespace} / {alarm.metric}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Threshold</p>
                                            <p className="text-sm font-medium">{alarm.threshold}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Last Updated</p>
                                            <p className="text-xs text-muted-foreground">{alarm.updated}</p>
                                        </div>
                                        <p className="text-muted-foreground text-xs mt-auto pt-2 shrink-0">Click to go back</p>
                                    </CardContent>
                                </Card>
                            }
                        />
                    ))
                )}
            </PageGrid>

            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">CloudPulse AI Insights</h2>
                    <Button size="sm" onClick={fetchInsights} disabled={insightsLoading || alarms.length === 0}>
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </Button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-muted-foreground">Click "Analyze with AI" to get insights about your alarms.</p>
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