import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"

export default function SecurityPage() {
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const navigate = useNavigate()

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

            <PageGrid className="mb-8">
                {groups.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No security groups found.</p>
                ) : (
                    groups.map((sg) => (
                        <Card
                            key={sg.group_id}
                            className="h-full flex flex-col cursor-pointer select-none hover:border-primary/50 hover:shadow-md transition-all duration-150"
                            onClick={() => navigate(`/security/${sg.group_id}`)}
                        >
                            <CardHeader>
                                <CardTitle className="truncate text-sm leading-snug">{sg.name}</CardTitle>
                                <CardDescription className="truncate">{sg.group_id} — {sg.description}</CardDescription>
                                <CardAction>
                                    {sg.risky_rules.length > 0 ? (
                                        <Badge variant="destructive">{sg.risky_rules.length} Risk{sg.risky_rules.length !== 1 ? "s" : ""}</Badge>
                                    ) : (
                                        <Badge variant="default">Clean</Badge>
                                    )}
                                </CardAction>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <p className="text-muted-foreground text-xs">
                                    {sg.risky_rules.length > 0
                                        ? `${sg.risky_rules.length} risky rule(s) detected — click to view details`
                                        : "No risky rules detected"}
                                </p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </PageGrid>
        </div>
    )
}