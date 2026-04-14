import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"

export default function ECSPage() {
    const [clusters, setClusters] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const navigate = useNavigate()

    const fetchClusters = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/ecs")
            setClusters(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => { fetchClusters() }, [])

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
                        <Card
                            key={cluster.cluster}
                            className="h-full flex flex-col cursor-pointer select-none hover:border-primary/50 hover:shadow-md transition-all duration-150"
                            onClick={() => navigate(`/ecs/${encodeURIComponent(cluster.cluster)}`)}
                        >
                            <CardHeader>
                                <CardTitle className="truncate text-sm leading-snug">{cluster.cluster}</CardTitle>
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
                            </CardContent>
                        </Card>
                    ))
                )}
            </PageGrid>
        </div>
    )
}