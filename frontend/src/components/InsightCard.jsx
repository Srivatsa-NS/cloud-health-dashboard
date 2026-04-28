import { useState } from "react"
import { Card, CardContent, CardHeader, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import axios from "axios"

const severityBadge = {
    critical: "destructive",
    warning: "secondary",
    info: "default",
}

// Fallback descriptions for the AI-suggested fix (shown before the user asks AI to interpret)
const ACTION_DESCRIPTIONS = {
    reboot_instance: "Reboot the EC2 instance. It will shut down and start back up automatically. This usually takes 1–2 minutes and may briefly interrupt any running services.",
    stop_instance: "Stop the EC2 instance. It will be powered off and you will no longer be charged for compute time. The instance and its data are preserved and can be restarted later.",
    start_instance: "Start the EC2 instance. It will be powered on and will resume normal operation.",
    revoke_sg_rule: "Remove the specific inbound rule from the security group. This will immediately block the exposed port from the internet.",
    block_s3_public_access: "Enable 'Block all public access' on this S3 bucket. Anyone currently accessing the bucket publicly will immediately lose access.",
}

function ConfirmModal({ title, whatWillHappen, onConfirm, onCancel }) {
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
                    <p className="text-xs text-muted-foreground">{title}</p>
                </div>
                <div className="rounded-lg bg-muted/60 border border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground font-medium mb-1 uppercase tracking-wide">What will happen</p>
                    <p className="text-sm text-foreground leading-relaxed">{whatWillHappen}</p>
                </div>
                <div className="flex items-center gap-2 justify-end pt-1">
                    <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
                    <Button size="sm" onClick={onConfirm}>Yes, apply fix</Button>
                </div>
            </div>
        </div>
    )
}

export default function InsightCard({ insight, onActionComplete, resourceData }) {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [pendingAction, setPendingAction] = useState(null)

    // Custom fix state
    const [showCustom, setShowCustom] = useState(false)
    const [customInstruction, setCustomInstruction] = useState("")
    const [customLoading, setCustomLoading] = useState(false)
    const [customAction, setCustomAction] = useState(null)
    const [customError, setCustomError] = useState(null)

    const executeAction = async (action) => {
        setPendingAction(null)
        setLoading(true)
        try {
            const response = await axios.post("/api/action", {
                action_type: action.action_type,
                action_params: action.action_params,
            })
            setResult({ success: true, message: response.data.message })
            if (onActionComplete) onActionComplete()
        } catch (err) {
            setResult({ success: false, message: err.response?.data?.message || "Action failed" })
        } finally {
            setLoading(false)
        }
    }

    const handleFixIt = () => {
        setPendingAction({
            action_type: insight.action_type,
            action_params: insight.action_params,
            what_will_happen: ACTION_DESCRIPTIONS[insight.action_type] || insight.action,
        })
    }

    const handleAskAI = async () => {
        if (!customInstruction.trim()) return
        setCustomLoading(true)
        setCustomAction(null)
        setCustomError(null)
        try {
            const res = await axios.post("/api/chat-action", {
                instruction: customInstruction,
                resource_data: resourceData || {},
            })
            setCustomAction(res.data)
        } catch (err) {
            setCustomError(err.response?.data?.error || "The AI could not interpret that instruction.")
        } finally {
            setCustomLoading(false)
        }
    }

    const hasFixableAction = insight.action_type !== "none"
    const aiSuggestedDescription = ACTION_DESCRIPTIONS[insight.action_type]

    return (
        <>
            {pendingAction && (
                <ConfirmModal
                    title={insight.title}
                    whatWillHappen={pendingAction.what_will_happen}
                    onConfirm={() => executeAction(pendingAction)}
                    onCancel={() => setPendingAction(null)}
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
                    {hasFixableAction && (
                        <CardAction>
                            <Button
                                size="sm"
                                onClick={handleFixIt}
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

                    {hasFixableAction && aiSuggestedDescription && !result && (
                        <div className="rounded-md bg-muted/50 border border-border px-3 py-2 mt-1">
                            <p className="text-xs text-muted-foreground font-medium mb-0.5">What "Fix It" will do</p>
                            <p className="text-xs text-foreground leading-relaxed">{aiSuggestedDescription}</p>
                        </div>
                    )}

                    {result && (
                        <p className={`text-sm mt-1 ${result.success ? "text-green-500" : "text-destructive"}`}>
                            {result.message}
                        </p>
                    )}

                    {/* Custom fix section — only shown when resource data is available */}
                    {!result && resourceData && (
                        <div className="border-t border-border mt-2 pt-2">
                            <button
                                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                                onClick={() => { setShowCustom(!showCustom); setCustomAction(null); setCustomError(null) }}
                            >
                                {showCustom ? "Hide custom fix" : "Or describe your own fix →"}
                            </button>

                            {showCustom && (
                                <div className="mt-2 flex flex-col gap-2">
                                    <textarea
                                        className="w-full text-xs rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                                        rows={2}
                                        placeholder='e.g. "Restrict SSH to 10.0.0.1 only" or "Stop this instance"'
                                        value={customInstruction}
                                        onChange={(e) => setCustomInstruction(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAskAI() } }}
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleAskAI}
                                        disabled={customLoading || !customInstruction.trim()}
                                    >
                                        {customLoading ? "Thinking..." : "Ask AI"}
                                    </Button>

                                    {customError && (
                                        <p className="text-xs text-destructive">{customError}</p>
                                    )}

                                    {customAction && (
                                        <div className="rounded-md bg-muted/50 border border-border px-3 py-2">
                                            <p className="text-xs text-muted-foreground font-medium mb-1">AI interpreted your request as:</p>
                                            <p className="text-xs text-foreground leading-relaxed">{customAction.what_will_happen}</p>
                                            <Button
                                                size="sm"
                                                className="mt-2"
                                                onClick={() => setPendingAction({
                                                    action_type: customAction.action_type,
                                                    action_params: customAction.action_params,
                                                    what_will_happen: customAction.what_will_happen,
                                                })}
                                            >
                                                Apply this fix
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    )
}
