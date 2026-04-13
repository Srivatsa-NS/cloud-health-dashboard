import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"
import { useInsights } from "@/context/InsightsContext"

const healthConfig = {
    healthy: { variant: "default", label: "Healthy" },
    warning: { variant: "secondary", label: "Warning" },
    critical: { variant: "destructive", label: "Critical" },
}

export default function CloudWatchPage() {
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const { registerPage } = useInsights()
    const navigate = useNavigate()

    const fetchGroups = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/logs")
            setGroups(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => { fetchGroups() }, [])
    useEffect(() => { registerPage("cloudwatch", groups, fetchGroups) }, [groups])

    if (loading) return <div className="text-muted-foreground p-8">Loading log groups...</div>

    const sorted = [...groups].sort((a, b) =>
        b.error_count !== a.error_count
            ? b.error_count - a.error_count
            : b.warning_count - a.warning_count
    )

    const criticalCount = sorted.filter((g) => g.health === "critical").length
    const warningCount = sorted.filter((g) => g.health === "warning").length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">CloudWatch Logs</h1>
                    <p className="text-muted-foreground mt-1">
                        {sorted.length} log group(s)
                        {criticalCount > 0 && <span className="text-red-500 ml-2">· {criticalCount} critical</span>}
                        {warningCount > 0 && <span className="text-yellow-500 ml-2">· {warningCount} warning</span>}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchGroups} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <PageGrid className="mb-8">
                {sorted.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No log groups found.</p>
                ) : (
                    sorted.map((group) => {
                        const cfg = healthConfig[group.health] || healthConfig.healthy
                        return (
                            <Card
                                key={group.name}
                                className="h-full flex flex-col cursor-pointer select-none hover:border-primary/50 hover:shadow-md transition-all duration-150"
                                onClick={() => navigate(`/logs/${encodeURIComponent(group.name)}`)}
                            >
                                <CardHeader>
                                    <CardTitle className="truncate text-sm leading-snug">{group.name}</CardTitle>
                                    <CardDescription>Created {group.created}</CardDescription>
                                    <CardAction>
                                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="mt-auto flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                        <span className="text-sm font-semibold">{group.error_count}</span>
                                        <span className="text-xs text-muted-foreground">errors</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
                                        <span className="text-sm font-semibold">{group.warning_count}</span>
                                        <span className="text-xs text-muted-foreground">warnings</span>
                                    </div>
                                    <div className="ml-auto flex flex-col items-end gap-0.5">
                                        <span className="text-xs text-muted-foreground">{group.stored_str}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Retention: {group.retention_days === "Never" ? "Never expires" : `${group.retention_days}d`}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </PageGrid>
        </div>
    )
}
