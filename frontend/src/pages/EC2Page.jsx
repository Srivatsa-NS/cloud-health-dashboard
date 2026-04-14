import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"

const stateVariant = {
    running: "default",
    stopped: "destructive",
    terminated: "secondary",
    pending: "secondary",
}

export default function EC2Page() {
    const [instances, setInstances] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const navigate = useNavigate()

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

            <PageGrid className="mb-8">
                {instances.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No EC2 instances found in this region.</p>
                ) : (
                    instances.map((instance) => (
                        <Card
                            key={instance.instance_id}
                            className="h-full flex flex-col cursor-pointer select-none hover:border-primary/50 hover:shadow-md transition-all duration-150"
                            onClick={() => navigate(`/ec2/${instance.instance_id}`)}
                        >
                            <CardHeader>
                                <CardTitle className="truncate text-sm leading-snug">{instance.name || instance.instance_id}</CardTitle>
                                <CardDescription>{instance.instance_id}</CardDescription>
                                <CardAction>
                                    <Badge variant={stateVariant[instance.state] || "secondary"}>
                                        {instance.state}
                                    </Badge>
                                </CardAction>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3 mt-auto">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Type</p>
                                        <p className="text-sm font-medium">{instance.instance_type}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">AZ</p>
                                        <p className="text-sm font-medium">{instance.availability_zone}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">CPU Utilization</p>
                                    <p className={`text-2xl font-bold ${
                                        instance.cpu_utilization > 80 ? "text-red-400"
                                        : instance.cpu_utilization > 60 ? "text-yellow-400"
                                        : "text-green-400"}`}>
                                        {instance.cpu_utilization}%
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </PageGrid>
        </div>
    )
}