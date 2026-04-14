import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"

const stateVariant = {
    ALARM: "destructive",
    OK: "default",
    INSUFFICIENT_DATA: "secondary",
}

export default function AlarmsPage() {
    const [alarms, setAlarms] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [expanded, setExpanded] = useState(null)

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
                    alarms.map((alarm) => {
                        const isOpen = expanded === alarm.name
                        return (
                            <Card
                                key={alarm.name}
                                className="h-full flex flex-col cursor-pointer select-none hover:border-primary/50 hover:shadow-md transition-all duration-150"
                                onClick={() => setExpanded(isOpen ? null : alarm.name)}
                            >
                                <CardHeader>
                                    <CardTitle className="truncate text-sm leading-snug">{alarm.name}</CardTitle>
                                    <CardDescription className="truncate">{alarm.description || "No description"}</CardDescription>
                                    <CardAction>
                                        <Badge variant={stateVariant[alarm.state] || "secondary"}>
                                            {alarm.state}
                                        </Badge>
                                    </CardAction>
                                </CardHeader>
                                {isOpen ? (
                                    <CardContent className="flex flex-col gap-3 border-t border-border pt-3 mt-1">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Namespace / Metric</p>
                                            <p className="text-sm font-medium">{alarm.namespace} / {alarm.metric}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Threshold</p>
                                            <p className="text-sm font-medium">{alarm.threshold}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Comparison</p>
                                            <p className="text-sm font-medium">{alarm.comparison?.replace(/_/g, " ")}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Last Updated</p>
                                            <p className="text-xs text-muted-foreground">{alarm.updated}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Click to collapse</p>
                                    </CardContent>
                                ) : (
                                    <CardContent className="mt-auto">
                                        <p className="text-muted-foreground text-xs">Click to see metric details</p>
                                    </CardContent>
                                )}
                            </Card>
                        )
                    })
                )}
            </PageGrid>
        </div>
    )
}