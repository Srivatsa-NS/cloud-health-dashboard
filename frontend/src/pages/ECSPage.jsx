import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"
import FlipCard from "@/components/FlipCard"
import { useInsights } from "@/context/InsightsContext"

export default function ECSPage() {
    const [clusters, setClusters] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const { registerPage } = useInsights()

    const fetchClusters = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/ecs")
            setClusters(res.data)
            setRefreshKey((k) => k + 1)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => { fetchClusters() }, [])
    useEffect(() => { registerPage("ecs", clusters, fetchClusters) }, [clusters])

    if (loading) return <div className="text-muted-foreground p-8">Loading ECS clusters...</div>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">ECS Clusters</h1>
                    <p className="text-muted-foreground mt-1">{clusters.length} cluster(s) found</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchClusters} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <PageGrid className="mb-8">
                {clusters.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No ECS clusters found.</p>
                ) : (
                    clusters.map((cluster) => (
                        <FlipCard
                            key={`${cluster.cluster}-${refreshKey}`}
                            front={
                                <Card className="h-full cursor-pointer select-none flex flex-col">
                                    <CardHeader>
                                        <CardTitle>{cluster.cluster}</CardTitle>
                                        <CardDescription>{cluster.task_arns.length} task(s) registered</CardDescription>
                                        <CardAction>
                                            <Badge variant={cluster.running_tasks > 0 ? "default" : "secondary"}>
                                                {cluster.running_tasks > 0 ? "Active" : "Idle"}
                                            </Badge>
                                        </CardAction>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-2 mt-auto">
                                        <div>
                                            <p className="text-muted-foreground text-xs mb-1">Running Tasks</p>
                                            <p className="text-3xl font-bold">{cluster.running_tasks}</p>
                                        </div>
                                        <p className="text-muted-foreground text-xs">Click to see task ARNs</p>
                                    </CardContent>
                                </Card>
                            }
                            back={
                                <Card className="h-full cursor-pointer select-none flex flex-col overflow-hidden">
                                    <CardHeader>
                                        <CardTitle className="text-sm">{cluster.cluster}</CardTitle>
                                        <CardDescription>Task ARNs</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1">
                                        {cluster.task_arns.length > 0 ? (
                                            cluster.task_arns.map((arn) => (
                                                <p key={arn} className="text-xs text-muted-foreground break-all">{arn.split("/").pop()}</p>
                                            ))
                                        ) : (
                                            <p className="text-xs text-muted-foreground">No tasks running</p>
                                        )}
                                        <p className="text-muted-foreground text-xs mt-auto pt-2 shrink-0">Click to go back</p>
                                    </CardContent>
                                </Card>
                            }
                        />
                    ))
                )}
            </PageGrid>

        </div>
    )
}