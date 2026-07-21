import { ComingSoon } from "@/components/dashboard/coming-soon"
import { Inbox } from "lucide-react"

export default function InboxPage() {
  return (
    <ComingSoon
      title="Inbox"
      description="Xem email hóa đơn tới AgentMail, trạng thái parse, và retry extraction ngay trong dashboard."
      icon={Inbox}
      status="soon"
    />
  )
}
