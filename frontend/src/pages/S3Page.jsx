import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"
import FlipCard from "@/components/FlipCard"
import { useInsights } from "@/context/InsightsContext"

export default function S3Page() {
    const [buckets, setBuckets] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const { registerPage } = useInsights()

    const fetchBuckets = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/s3")
            setBuckets(res.data)
            setRefreshKey((k) => k + 1)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => { fetchBuckets() }, [])
    useEffect(() => { registerPage("s3", buckets, fetchBuckets) }, [buckets])

    if (loading) return <div className="text-muted-foreground p-8">Loading S3 buckets...</div>

    const publicCount = buckets.filter((b) => b.is_public).length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">S3 Buckets</h1>
                    <p className="text-muted-foreground mt-1">
                        {buckets.length} total —
                        <span className="text-red-400"> {publicCount} public</span>
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchBuckets} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            <PageGrid className="mb-8">
                {buckets.length === 0 ? (
                    <p className="text-muted-foreground col-span-3">No S3 buckets found.</p>
                ) : (
                    buckets.map((bucket) => (
                        <FlipCard
                            key={`${bucket.name}-${refreshKey}`}
                            front={
                                <Card className="h-full cursor-pointer select-none flex flex-col">
                                    <CardHeader>
                                        <CardTitle>{bucket.name}</CardTitle>
                                        <CardDescription>Created: {bucket.created}</CardDescription>
                                        <CardAction>
                                            <Badge variant={bucket.is_public ? "destructive" : "default"}>
                                                {bucket.is_public ? "Public" : "Private"}
                                            </Badge>
                                        </CardAction>
                                    </CardHeader>
                                    <CardContent className="mt-auto">
                                        <p className="text-muted-foreground text-xs">Click to see access details</p>
                                    </CardContent>
                                </Card>
                            }
                            back={
                                <Card className="h-full cursor-pointer select-none flex flex-col overflow-hidden">
                                    <CardHeader>
                                        <CardTitle className="text-sm">{bucket.name}</CardTitle>
                                        <CardDescription>Access Details</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Public Access</p>
                                            <Badge variant={bucket.is_public ? "destructive" : "default"} className="mt-1">
                                                {bucket.is_public ? "Public — anyone can access this bucket" : "Private — access restricted"}
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Created</p>
                                            <p className="text-sm">{bucket.created}</p>
                                        </div>
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