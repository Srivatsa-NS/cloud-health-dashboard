import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import InsightCard from "@/components/InsightCard"
import axios from "axios"

function SparkleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        </svg>
    )
}

function InfoRow({ label, value }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    )
}

export default function S3DetailPage() {
    const { bucketName } = useParams()
    const navigate = useNavigate()
    const [bucket, setBucket] = useState(null)
    const [loading, setLoading] = useState(true)
    const [insights, setInsights] = useState([])
    const [insightsLoading, setInsightsLoading] = useState(false)
    const [insightsFetched, setInsightsFetched] = useState(false)

    useEffect(() => {
        axios.get("/api/s3")
            .then((res) => {
                const found = res.data.find((b) => b.name === bucketName)
                setBucket(found || null)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [bucketName])

    const fetchInsights = async () => {
        if (!bucket) return
        setInsightsLoading(true)
        setInsights([])
        try {
            const res = await axios.post("/api/insights", { service: "s3", data: [bucket] })
            setInsights(res.data.filter((i) => i.severity !== "info"))
            setInsightsFetched(true)
        } catch (err) {
            console.error(err)
        } finally {
            setInsightsLoading(false)
        }
    }

    if (loading) return <div className="text-muted-foreground p-8">Loading...</div>
    if (!bucket) return <div className="text-red-500 p-8">Bucket not found.</div>

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-2 mb-6">
                <Button variant="ghost" size="sm" onClick={() => navigate("/s3")} className="shrink-0 px-2 mt-0.5">
                    ← Back
                </Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold break-all">{bucket.name}</h1>
                    <p className="text-muted-foreground text-sm mt-1">S3 Bucket</p>
                </div>
            </div>

            {/* Details card */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-base">Bucket Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <InfoRow label="Created" value={bucket.created} />
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">Public Access</span>
                        <Badge variant={bucket.is_public ? "destructive" : "default"} className="w-fit">
                            {bucket.is_public ? "Public" : "Private"}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Risk explanation */}
            {bucket.is_public && (
                <Card className="mb-8 border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="destructive">CRITICAL</Badge>
                            <span className="font-semibold text-sm">Bucket is publicly accessible</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            This S3 bucket can be accessed by anyone on the internet. If the bucket contains
                            sensitive files — such as user data, backups, configuration files, or private documents —
                            they are exposed to the public right now. This is one of the most common causes of
                            large-scale data breaches. You should enable "Block all public access" on this bucket
                            immediately unless you intentionally need it to be publicly accessible (e.g. hosting a
                            static website).
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* AI Insights */}
            <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">AI Insights</h2>
                    <Button size="sm" onClick={fetchInsights} disabled={insightsLoading} className="flex items-center gap-1.5">
                        <SparkleIcon />
                        {insightsLoading ? "Analyzing..." : insightsFetched ? "Re-analyze" : "Analyze with AI"}
                    </Button>
                </div>

                {insightsLoading && (
                    <div className="flex flex-col gap-3">
                        {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
                    </div>
                )}
                {!insightsLoading && insightsFetched && insights.length === 0 && (
                    <p className="text-muted-foreground text-sm">No risks found. This bucket looks properly configured.</p>
                )}
                {!insightsLoading && insights.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {insights.map((insight, i) => (
                            <InsightCard key={i} insight={insight} onActionComplete={() => {}} />
                        ))}
                    </div>
                )}
                {!insightsFetched && !insightsLoading && (
                    <p className="text-muted-foreground text-sm">Click "Analyze with AI" to get AI-powered recommendations for this bucket.</p>
                )}
            </div>
        </div>
    )
}
