import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"

export default function S3Page() {
    const [buckets, setBuckets] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const navigate = useNavigate()

    const fetchBuckets = async () => {
        setRefreshing(true)
        try {
            const res = await axios.get("/api/s3")
            setBuckets(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => { fetchBuckets() }, [])

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
                        <Card
                            key={bucket.name}
                            className="h-full flex flex-col cursor-pointer select-none hover:border-primary/50 hover:shadow-md transition-all duration-150"
                            onClick={() => navigate(`/s3/${encodeURIComponent(bucket.name)}`)}
                        >
                            <CardHeader>
                                <CardTitle className="truncate text-sm leading-snug">{bucket.name}</CardTitle>
                                <CardDescription>Created: {bucket.created}</CardDescription>
                                <CardAction>
                                    <Badge variant={bucket.is_public ? "destructive" : "default"}>
                                        {bucket.is_public ? "Public" : "Private"}
                                    </Badge>
                                </CardAction>
                            </CardHeader>
                            <CardContent className="mt-auto">
                                <p className="text-muted-foreground text-xs">
                                    {bucket.is_public
                                        ? "Publicly accessible — click to view details and risks"
                                        : "Private — click to view details"}
                                </p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </PageGrid>
        </div>
    )
}