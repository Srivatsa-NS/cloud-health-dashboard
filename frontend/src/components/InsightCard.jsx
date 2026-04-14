import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import axios from "axios"

const severityBadge = {
    critical: "destructive",
    warning: "secondary",
    info: "default",
}

// Human-readable explanation of what each action_type does
const ACTION_DESCRIPTIONS = {
    reboot_instance:          "Reboot the EC2 instance. It will shut down and start back up automatically. This usually takes 1–2 minutes and may briefly interrupt any running services.",
    stop_instance:            "Stop the EC2 instance. It will be powered off and you will no longer be charged for compute time. The instance and its data are preserved and can be restarted later.",
    start_instance:           "Start the EC2 instance. It will be powered on and will resume normal operation.",
    revoke_sg_rule:           "Remove the specific inbound rule from the security group. This will immediately block the exposed port from the internet. Make sure you don't need this access before confirming.",
    block_s3_public_access:   "Enable 'Block all public access' on this S3 bucket. Anyone currently accessing the bucket publicly will immediately lose access. This is the recommended setting for buckets that don't need to be public.",
}

function ConfirmModal({ insight, onConfirm, onCancel }) {
    const description = ACTION_DESCRIPTIONS[insight.action_type] || "This action will make changes to your AWS infrastructure."

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 m-4 flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div>
                    <h2 className="font-semibold text-base mb-1">Confirm Fix</h2>
                    <p className="text-xs text-muted-foreground">{insight.title}</p>
                </div>

                <div className="rounded-lg bg-muted/60 border border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground font-medium mb-1 uppercase tracking-wide">What will happen</p>
                    <p className="text-sm text-foreground leading-relaxed">{description}</p>
                </div>

                <div className="flex items-center gap-2 justify-end pt-1">
                    <Button variant="outline" size="sm" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={onConfirm}>
                        Yes, apply fix
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default function InsightCard({ insight, onActionComplete }) {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [showConfirm, setShowConfirm] = useState(false)

    const executefix = async () => {
        setShowConfirm(false)
        setLoading(true)
        try {
            const response = await axios.post("/api/action", {
                action_type: insight.action_type,
                action_params: insight.action_params,
            })
            setResult({ success: true, message: response.data.message })
            if (onActionComplete) onActionComplete()
        } catch (err) {
            setResult({ success: false, message: err.response?.data?.message || "Action failed" })
        } finally {
            setLoading(false)
        }
    }

    const actionDescription = ACTION_DESCRIPTIONS[insight.action_type]

    return (
        <>
            {showConfirm && (
                <ConfirmModal
                    insight={insight}
                    onConfirm={executefix}
                    onCancel={() => setShowConfirm(false)}
                />
            )}

            <Card className="overflow-visible">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Badge variant={severityBadge[insight.severity]}>
                            {insight.severity.toUpperCase()}
                        </Badge>
                        <span className="font-semibold text-sm">{insight.title}</span>
                    </div>
                    {insight.action_type !== "none" && (
                        <CardAction>
                            <Button
                                size="sm"
                                onClick={() => setShowConfirm(true)}
                                disabled={loading || result?.success}
                                variant={result?.success ? "secondary" : "default"}
                            >
                                {loading ? "Running..." : result?.success ? "Done ✓" : "Fix It"}
                            </Button>
                        </CardAction>
                    )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    <p className="text-sm text-muted-foreground italic">Suggested: {insight.action}</p>
                    {insight.action_type !== "none" && actionDescription && !result && (
                        <div className="rounded-md bg-muted/50 border border-border px-3 py-2 mt-1">
                            <p className="text-xs text-muted-foreground font-medium mb-0.5">What "Fix It" will do</p>
                            <p className="text-xs text-foreground leading-relaxed">{actionDescription}</p>
                        </div>
                    )}
                    {result && (
                        <p className={`text-sm mt-1 ${result.success ? "text-green-500" : "text-destructive"}`}>
                            {result.message}
                        </p>
                    )}
                </CardContent>
            </Card>
        </>
    )
}
