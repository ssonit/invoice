export type LegalLocale = "en" | "vi"

export type LegalSection = {
  heading: string
  body: string
}

export type LegalPage = {
  title: string
  updated: string
  banner: string
  sections: LegalSection[]
}

export type LegalPages = {
  terms: LegalPage
  privacy: LegalPage
}

export const legalCopy: Record<LegalLocale, LegalPages> = {
  en: {
    terms: {
      title: "Terms of Service",
      updated: "2026-07-30",
      banner:
        "Draft — not legal advice. Replace with lawyer-reviewed copy before charging for this product.",
      sections: [
        {
          heading: "1. What Invoice Reader does",
          body: "Invoice Reader is an AI-powered invoice inbox. You forward invoice emails (or have your AI agent forward them) to a dedicated inbox. Our platform extracts totals, tax, vendor names, and due dates from those emails and their attachments, then displays them in a dashboard for you to review, filter, and export.",
        },
        {
          heading: "2. How email ingestion works",
          body: "Invoice Reader uses AgentMail to receive forwarded emails. We do not access your personal email account, and we never log into Gmail, Outlook, or any other mailbox on your behalf. The only emails we see are the ones you or your AI agent explicitly forward to your Invoice Reader inbox.",
        },
        {
          heading: "3. AI extraction & third-party services",
          body: "We use large language models (LLMs) — including those from Anthropic, Google, and DeepSeek — to extract structured invoice data from forwarded emails and attachments. Forwarded content is transmitted to these providers solely for the purpose of extraction. We do not use your invoice data to train or fine-tune any model. You should not forward emails containing data covered by your own confidentiality obligations unless you have confirmed the relevant provider's terms permit it.",
        },
        {
          heading: "4. Payments & billing",
          body: "Payments for paid plans are processed by Lemon Squeezy, which acts as our Merchant of Record. By subscribing to a paid plan you agree to Lemon Squeezy's terms of service as well. Subscription pricing, cancellation, and refund policies are as described on our pricing page at the time of purchase.",
        },
        {
          heading: "5. Acceptable use",
          body: "You agree not to use Invoice Reader for anything unlawful. Do not forward emails you do not have the right to share. We reserve the right to suspend accounts that violate these terms or that abuse the service (for example, by forwarding spam or non-invoice content at volumes that degrade the service for others).",
        },
        {
          heading: "6. Account deletion",
          body: "You may request account deletion at any time by contacting us at the email below. Deleting your account will soft-delete your data (flag it as deleted in our database) rather than physically destroy it immediately, to comply with legal retention obligations and to allow a grace period in case of accidental deletion. If you need physical deletion, contact us separately and we will confirm before proceeding.",
        },
        {
          heading: "7. Disclaimers",
          body: "Invoice Reader is provided \"as is\" without warranties of any kind. AI extraction is probabilistic — we do not guarantee 100% accuracy of extracted fields, and you should review extracted data before relying on it for financial or legal decisions. We are not responsible for any errors, omissions, or decisions made based on the extracted data.",
        },
        {
          heading: "8. Changes to these terms",
          body: "We may update these terms from time to time. We will notify you of material changes via the email address associated with your account. Continued use of the service after changes take effect constitutes acceptance of the updated terms.",
        },
        {
          heading: "9. Contact",
          body: "For questions about these terms, contact us at legal@invoicereader.app (placeholder — replace before production).",
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      updated: "2026-07-30",
      banner:
        "Draft — not legal advice. Replace with lawyer-reviewed copy before charging for this product.",
      sections: [
        {
          heading: "1. Data we collect",
          body: "When you use Invoice Reader, we collect: (a) account information you provide (email address, hashed password); (b) forwarded invoice emails and their attachments (PDFs, images); (c) extracted invoice data (totals, tax, vendor names, due dates); and (d) usage metadata (timestamps, feature interactions). We do NOT access your personal email account or any mailbox you have not explicitly forwarded to us.",
        },
        {
          heading: "2. How we use your data",
          body: "We use your data to: extract structured invoice information and display it in your dashboard; provide, maintain, and improve the service; communicate with you about your account (billing, feature updates, support); and comply with legal obligations. We do NOT sell your data to third parties.",
        },
        {
          heading: "3. Data sharing with third parties",
          body: "We share forwarded invoice content with LLM providers (currently Anthropic, Google, and DeepSeek) solely for extraction purposes. These providers process data per their respective data-processing terms and do not use it for model training. Payments are processed by Lemon Squeezy, which receives billing information per its own privacy policy. We use Supabase for database hosting and authentication. We do not share your data with any other third parties except as required by law.",
        },
        {
          heading: "4. Data retention",
          body: "We retain your account data and extracted invoices for as long as your account is active. When you request account deletion, we soft-delete your data (flag it as deleted). Data may remain in encrypted backups for up to 90 days after soft deletion. If you need physical deletion, contact us directly.",
        },
        {
          heading: "5. Data security",
          body: "We use industry-standard encryption in transit (TLS) and at rest. Authentication is handled by Supabase Auth. However, no online service is 100% secure — you share data at your own risk.",
        },
        {
          heading: "6. Your rights",
          body: "Depending on your jurisdiction, you may have rights to access, correct, delete, or port your data, or to object to or restrict its processing. To exercise any of these rights, contact us at the email below. We will respond within the timeframe required by applicable law.",
        },
        {
          heading: "7. Cookies & tracking",
          body: "Invoice Reader uses essential cookies for authentication and locale/theme preferences. We do not use third-party tracking cookies or ad networks. We do not currently respond to browser \"Do Not Track\" signals.",
        },
        {
          heading: "8. International transfers",
          body: "Your data may be processed in the United States, where our infrastructure providers (Supabase, AgentMail) and LLM providers operate. By using Invoice Reader, you consent to this transfer and processing.",
        },
        {
          heading: "9. Children's privacy",
          body: "Invoice Reader is not directed at children under 16, and we do not knowingly collect data from them. If you believe a child has provided us with personal data, contact us and we will delete it.",
        },
        {
          heading: "10. Changes to this policy",
          body: "We may update this privacy policy from time to time. Material changes will be communicated via the email on your account. Continued use after changes take effect constitutes acceptance.",
        },
        {
          heading: "11. Contact",
          body: "For privacy-related questions, contact us at privacy@invoicereader.app (placeholder — replace before production).",
        },
      ],
    },
  },
  vi: {
    terms: {
      title: "Điều khoản dịch vụ",
      updated: "2026-07-30",
      banner:
        "Bản nháp — không phải tư vấn pháp lý. Hãy thay bằng bản đã được luật sư xem xét trước khi thu phí sản phẩm này.",
      sections: [
        {
          heading: "1. Invoice Reader làm gì",
          body: "Invoice Reader là hộp thư hóa đơn dùng AI. Bạn chuyển tiếp email hóa đơn (hoặc để AI agent của bạn chuyển tiếp) tới một hộp thư riêng. Nền tảng của chúng tôi trích xuất tổng tiền, thuế, tên nhà cung cấp và hạn thanh toán từ các email đó cùng tệp đính kèm, rồi hiển thị trong dashboard để bạn xem, lọc và xuất dữ liệu.",
        },
        {
          heading: "2. Cách nhận email hoạt động",
          body: "Invoice Reader sử dụng AgentMail để nhận email chuyển tiếp. Chúng tôi không truy cập tài khoản email cá nhân của bạn, và không bao giờ đăng nhập vào Gmail, Outlook hay bất kỳ hộp thư nào khác thay bạn. Email duy nhất chúng tôi thấy là những email bạn hoặc AI agent của bạn chủ động chuyển tiếp tới hộp thư Invoice Reader.",
        },
        {
          heading: "3. Trích xuất AI & dịch vụ bên thứ ba",
          body: "Chúng tôi sử dụng mô hình ngôn ngữ lớn (LLM) — bao gồm từ Anthropic, Google và DeepSeek — để trích xuất dữ liệu hóa đơn có cấu trúc từ email chuyển tiếp và tệp đính kèm. Nội dung chuyển tiếp được gửi tới các nhà cung cấp này chỉ nhằm mục đích trích xuất. Chúng tôi không dùng dữ liệu hóa đơn của bạn để huấn luyện hay tinh chỉnh bất kỳ mô hình nào. Bạn không nên chuyển tiếp email chứa dữ liệu thuộc nghĩa vụ bảo mật của riêng bạn trừ khi bạn đã xác nhận điều khoản của nhà cung cấp liên quan cho phép.",
        },
        {
          heading: "4. Thanh toán & hóa đơn",
          body: "Thanh toán cho gói trả phí được xử lý bởi Lemon Squeezy, đơn vị đóng vai trò Merchant of Record của chúng tôi. Khi đăng ký gói trả phí, bạn đồng ý với điều khoản dịch vụ của Lemon Squeezy. Giá gói, chính sách hủy và hoàn tiền theo mô tả trên trang bảng giá của chúng tôi tại thời điểm mua.",
        },
        {
          heading: "5. Sử dụng được phép",
          body: "Bạn đồng ý không sử dụng Invoice Reader cho bất kỳ mục đích bất hợp pháp nào. Không chuyển tiếp email bạn không có quyền chia sẻ. Chúng tôi có quyền tạm ngưng tài khoản vi phạm các điều khoản này hoặc lạm dụng dịch vụ (ví dụ: chuyển tiếp thư rác hoặc nội dung không phải hóa đơn với khối lượng làm giảm chất lượng dịch vụ cho người khác).",
        },
        {
          heading: "6. Xóa tài khoản",
          body: "Bạn có thể yêu cầu xóa tài khoản bất kỳ lúc nào bằng cách liên hệ với chúng tôi qua email bên dưới. Việc xóa tài khoản sẽ đánh dấu xóa mềm dữ liệu của bạn (gắn cờ đã xóa trong cơ sở dữ liệu) thay vì hủy vật lý ngay lập tức, để tuân thủ nghĩa vụ lưu trữ pháp lý và cho phép thời gian gia hạn phòng trường hợp xóa nhầm. Nếu bạn cần xóa vật lý, hãy liên hệ riêng với chúng tôi và chúng tôi sẽ xác nhận trước khi thực hiện.",
        },
        {
          heading: "7. Tuyên bố miễn trừ trách nhiệm",
          body: "Invoice Reader được cung cấp \"như hiện tại\" không kèm bảo đảm dưới bất kỳ hình thức nào. Trích xuất AI mang tính xác suất — chúng tôi không đảm bảo độ chính xác 100% của các trường được trích xuất, và bạn nên kiểm tra dữ liệu trước khi dựa vào đó cho các quyết định tài chính hoặc pháp lý. Chúng tôi không chịu trách nhiệm về bất kỳ sai sót, thiếu sót hoặc quyết định nào được đưa ra dựa trên dữ liệu trích xuất.",
        },
        {
          heading: "8. Thay đổi điều khoản",
          body: "Chúng tôi có thể cập nhật các điều khoản này theo thời gian. Chúng tôi sẽ thông báo cho bạn về những thay đổi quan trọng qua địa chỉ email liên kết với tài khoản của bạn. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi có hiệu lực đồng nghĩa với việc chấp nhận điều khoản đã cập nhật.",
        },
        {
          heading: "9. Liên hệ",
          body: "Nếu có câu hỏi về các điều khoản này, hãy liên hệ với chúng tôi qua legal@invoicereader.app (placeholder — thay trước khi ra production).",
        },
      ],
    },
    privacy: {
      title: "Chính sách quyền riêng tư",
      updated: "2026-07-30",
      banner:
        "Bản nháp — không phải tư vấn pháp lý. Hãy thay bằng bản đã được luật sư xem xét trước khi thu phí sản phẩm này.",
      sections: [
        {
          heading: "1. Dữ liệu chúng tôi thu thập",
          body: "Khi bạn sử dụng Invoice Reader, chúng tôi thu thập: (a) thông tin tài khoản bạn cung cấp (địa chỉ email, mật khẩu đã băm); (b) email hóa đơn được chuyển tiếp và tệp đính kèm (PDF, ảnh); (c) dữ liệu hóa đơn đã trích xuất (tổng tiền, thuế, tên NCC, hạn thanh toán); và (d) metadata sử dụng (dấu thời gian, tương tác tính năng). Chúng tôi KHÔNG truy cập tài khoản email cá nhân của bạn hay bất kỳ hộp thư nào bạn không chủ động chuyển tiếp cho chúng tôi.",
        },
        {
          heading: "2. Cách chúng tôi dùng dữ liệu",
          body: "Chúng tôi dùng dữ liệu của bạn để: trích xuất thông tin hóa đơn có cấu trúc và hiển thị trong dashboard của bạn; cung cấp, duy trì và cải thiện dịch vụ; liên lạc với bạn về tài khoản (thanh toán, cập nhật tính năng, hỗ trợ); và tuân thủ nghĩa vụ pháp lý. Chúng tôi KHÔNG bán dữ liệu của bạn cho bên thứ ba.",
        },
        {
          heading: "3. Chia sẻ dữ liệu với bên thứ ba",
          body: "Chúng tôi chia sẻ nội dung hóa đơn chuyển tiếp với các nhà cung cấp LLM (hiện tại là Anthropic, Google và DeepSeek) chỉ nhằm mục đích trích xuất. Các nhà cung cấp này xử lý dữ liệu theo điều khoản xử lý dữ liệu riêng của họ và không dùng để huấn luyện mô hình. Thanh toán được xử lý bởi Lemon Squeezy, đơn vị nhận thông tin thanh toán theo chính sách quyền riêng tư của họ. Chúng tôi dùng Supabase để lưu trữ cơ sở dữ liệu và xác thực. Chúng tôi không chia sẻ dữ liệu của bạn với bất kỳ bên thứ ba nào khác trừ khi pháp luật yêu cầu.",
        },
        {
          heading: "4. Lưu trữ dữ liệu",
          body: "Chúng tôi lưu trữ dữ liệu tài khoản và hóa đơn đã trích xuất của bạn trong thời gian tài khoản còn hoạt động. Khi bạn yêu cầu xóa tài khoản, chúng tôi đánh dấu xóa mềm dữ liệu của bạn (gắn cờ đã xóa). Dữ liệu có thể còn trong bản sao lưu mã hóa tối đa 90 ngày sau khi xóa mềm. Nếu bạn cần xóa vật lý, hãy liên hệ trực tiếp với chúng tôi.",
        },
        {
          heading: "5. Bảo mật dữ liệu",
          body: "Chúng tôi dùng mã hóa tiêu chuẩn ngành khi truyền tải (TLS) và khi lưu trữ. Xác thực do Supabase Auth đảm nhiệm. Tuy nhiên, không có dịch vụ trực tuyến nào an toàn 100% — bạn chia sẻ dữ liệu với rủi ro của riêng mình.",
        },
        {
          heading: "6. Quyền của bạn",
          body: "Tùy theo khu vực pháp lý của bạn, bạn có thể có quyền truy cập, chỉnh sửa, xóa hoặc chuyển dữ liệu của mình, hoặc phản đối hay hạn chế việc xử lý dữ liệu. Để thực hiện bất kỳ quyền nào trong số này, hãy liên hệ với chúng tôi qua email bên dưới. Chúng tôi sẽ phản hồi trong khung thời gian luật hiện hành yêu cầu.",
        },
        {
          heading: "7. Cookie & theo dõi",
          body: "Invoice Reader sử dụng cookie thiết yếu cho xác thực và tùy chọn ngôn ngữ/giao diện. Chúng tôi không dùng cookie theo dõi bên thứ ba hay mạng quảng cáo. Hiện tại chúng tôi không phản hồi tín hiệu \"Do Not Track\" của trình duyệt.",
        },
        {
          heading: "8. Chuyển dữ liệu quốc tế",
          body: "Dữ liệu của bạn có thể được xử lý tại Hoa Kỳ, nơi các nhà cung cấp hạ tầng của chúng tôi (Supabase, AgentMail) và nhà cung cấp LLM hoạt động. Bằng cách sử dụng Invoice Reader, bạn đồng ý với việc chuyển và xử lý dữ liệu này.",
        },
        {
          heading: "9. Quyền riêng tư của trẻ em",
          body: "Invoice Reader không hướng tới trẻ em dưới 16 tuổi và chúng tôi không cố ý thu thập dữ liệu từ trẻ em. Nếu bạn tin rằng một trẻ em đã cung cấp dữ liệu cá nhân cho chúng tôi, hãy liên hệ và chúng tôi sẽ xóa dữ liệu đó.",
        },
        {
          heading: "10. Thay đổi chính sách",
          body: "Chúng tôi có thể cập nhật chính sách quyền riêng tư này theo thời gian. Những thay đổi quan trọng sẽ được thông báo qua email tài khoản của bạn. Việc tiếp tục sử dụng sau khi thay đổi có hiệu lực đồng nghĩa với chấp nhận.",
        },
        {
          heading: "11. Liên hệ",
          body: "Nếu có câu hỏi về quyền riêng tư, hãy liên hệ với chúng tôi qua privacy@invoicereader.app (placeholder — thay trước khi ra production).",
        },
      ],
    },
  },
}

export function getLegalCopy(locale: LegalLocale): LegalPages {
  return legalCopy[locale]
}
