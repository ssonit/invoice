import { ComingSoon } from "@/components/dashboard/coming-soon"
import { Users } from "lucide-react"

export default function VendorsPage() {
  return (
    <ComingSoon
      title="Vendors"
      description="Danh sách nhà cung cấp nhận diện từ hóa đơn, gộp trùng tên, và lịch sử chi tiêu theo vendor."
      icon={Users}
      status="soon"
    />
  )
}
