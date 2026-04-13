import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import InsightCard from "@/components/InsightCard"

const stateVariant = {
    running: "default",
    stopped: "destructive",
    terminated: "secondary",
    pending: "secondary",
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

    if (loading) return <div className="text-muted-foreground p-8">Loading EC2 instances...</div>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">EC2 Instances</h1>
                    <p className="text-muted-foreground mt-1">{instances.length} instance(s) found</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchInstances} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {instances.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No EC2 instances found in this region.</p>
                ) : (
                    instances.map((instance) => (
                        <Card key={instance.instance_id}>
                            <CardHeader>
                                <CardTitle>{instance.name || instance.instance_id}</CardTitle>
                                <CardDescription>{instance.instance_id}</CardDescription>
                                <CardAction>
                                    <Badge variant={stateVariant[instance.state] || "secondary"}>
                                        {instance.state}
                                    </Badge>
                                </CardAction>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Type</p>
                                        <p className="text-sm font-medium">{instance.instance_type}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Availability Zone</p>
                                        <p className="text-sm font-medium">{instance.availability_zone}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">CPU Utilization</p>
                                    <p className={`text-2xl font-bold ${instance.cpu_utilization > 80 ? "text-red-400" : instance.cpu_utilization > 60 ? "text-yellow-400" : "text-green-400"}`}>
                                        {instance.cpu_utilization}%
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <div>
                                        <p className="text-muted-foreground text-xs mb-1">System</p>
                                        <Badge variant={instance.system_status === "ok" ? "default" : "destructive"}>
                                            {instance.system_status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs mb-1">Instance</p>
                                        <Badge variant={instance.instance_status === "ok" ? "default" : "destructive"}>
                                            {instance.instance_status}
                                        </Badge>
                                    </div>
                                </div>
                                {instance.security_groups.length > 0 && (
                                    <div>
                                        <p className="text-muted-foreground text-xs mb-1">Security Groups</p>
                                        <p className="text-xs text-muted-foreground">{instance.security_groups.join(", ")}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">CloudPulse AI Insights</h2>
                    <Button size="sm" onClick={fetchInsights} disabled={insightsLoading || instances.length === 0}>
                        {insightsLoading ? "Analyzing..." : "Analyze with AI"}
                    </Button>
                </div>
                {insights.length === 0 && !insightsLoading && (
                    <p className="text-muted-foreground">Click "Analyze with AI" to get insights about your EC2 instances.</p>
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