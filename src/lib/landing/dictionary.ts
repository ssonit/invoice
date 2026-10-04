export type LandingLocale = "en" | "vi"

export type LandingDictionary = {
  nav: {
    login: string
    signup: string
    how: string
    features: string
    agents: string
    langEn: string
    langVi: string
  }
  hero: {
    badge: string
    headline: string
    headlineAccent: string
    subtext: string
    cta: string
  }
  trust: {
    label: string
  }
  how: {
    title: string
    subtitle: string
    steps: {
      title: string
      body: string
      points: string[]
      preview: string
    }[]
  }
  features: {
    title: string
    items: { title: string; body: string }[]
  }
  agents: {
    eyebrow: string
    title: string
    body: string
    cta: string
  }
  testimonial: {
    quote: string
    name: string
    role: string
  }
  cta: {
    title: string
    body: string
    button: string
  }
  footer: {
    product: string
    rights: string
    tagline: string
    productLabel: string
    accountLabel: string
    legalLabel: string
    links: {
      login: string
      signup: string
      dashboard: string
      how: string
      agents: string
      terms: string
      privacy: string
    }
    legal: string
  }
}

export const dictionaries: Record<LandingLocale, LandingDictionary> = {
  en: {
    nav: {
      login: "Log in",
      signup: "Sign up",
      how: "How it works",
      features: "Features",
      agents: "Agents",
      langEn: "EN",
      langVi: "VI",
    },
    hero: {
      badge: "Introducing Invoice Reader",
      headline: "Your AI already reads",
      headlineAccent: "your inbox.",
      subtext:
        "Tell it to forward invoices too. No Gmail OAuth, no mailbox access — just the bills that matter, landing in one dashboard.",
      cta: "Get started",
    },
    trust: {
      label: "Trusted by teams that live in email",
    },
    how: {
      title: "From attachment to ledger",
      subtitle: "Three steps. No spreadsheet gymnastics.",
      steps: [
        {
          title: "Set up your AI agent once",
          body: "Paste one prompt into Claude, ChatGPT, or Gemini. From then on, it forwards invoices for you — you never touch this again.",
          points: [
            "Works with Claude, ChatGPT, Gemini, and more",
            "One prompt, forwards forever",
            "Your AI decides what's an invoice",
          ],
          preview: "Claude → invoice@inbox",
        },
        {
          title: "AI extracts the fields",
          body: "Totals, tax, vendor, and due dates land in structured rows you can trust.",
          points: [
            "Vendor, total, tax, due date",
            "Confidence you can review",
            "Consistent field mapping",
          ],
          preview: "Total · Vendor · Due date",
        },
        {
          title: "Review in the dashboard",
          body: "Filter, chart trends, and export what finance already needs.",
          points: [
            "Filter by vendor or status",
            "Spend trends over time",
            "Export-ready rows",
          ],
          preview: "Dashboard · Charts · Export",
        },
      ],
    },
    features: {
      title: "What stays out of your spreadsheet",
      items: [
        {
          title: "Attachment-first parsing",
          body: "Reads PDFs and scans without a manual upload ritual.",
        },
        {
          title: "Vendor memory",
          body: "Recognizes repeat senders so naming stays consistent.",
        },
        {
          title: "Due-date radar",
          body: "Surface what is due this week before it becomes a chase.",
        },
        {
          title: "Trend charts",
          body: "See spend move over time without rebuilding pivots.",
        },
      ],
    },
    agents: {
      eyebrow: "AI Agents",
      title: "Works with your AI agent",
      body: "One prompt. Any agent. Your invoices, forwarded.",
      cta: "Set up in the app",
    },
    testimonial: {
      quote:
        "We stopped copy-pasting invoice PDFs into sheets. The inbox catches what accounting used to chase.",
      name: "Mai Tran",
      role: "Ops lead, Northline Retail",
    },
    cta: {
      title: "Stop chasing invoice PDFs.",
      body: "Log in and let the next attachment parse itself.",
      button: "Get started",
    },
    footer: {
      product: "Invoice Reader",
      rights: "All rights reserved.",
      tagline: "AI inbox for finance.",
      productLabel: "Product",
      accountLabel: "Account",
      legalLabel: "Legal",
      links: {
        login: "Log in",
        signup: "Sign up",
        dashboard: "Dashboard",
        how: "How it works",
        agents: "Agents",
        terms: "Terms",
        privacy: "Privacy",
      },
      legal: "Built for teams that live in email.",
    },
  },
  vi: {
    nav: {
      login: "Đăng nhập",
      signup: "Đăng ký",
      how: "Cách hoạt động",
      features: "Tính năng",
      agents: "AI agents",
      langEn: "EN",
      langVi: "VI",
    },
    hero: {
      badge: "Ra mắt Invoice Reader",
      headline: "AI của bạn đã đọc",
      headlineAccent: "hộp thư rồi.",
      subtext:
        "Hãy để nó chuyển tiếp cả hóa đơn. Không cần cấp quyền Gmail, không đụng tới hộp thư — chỉ hóa đơn thật sự cần, gom vào một dashboard.",
      cta: "Bắt đầu",
    },
    trust: {
      label: "Được tin dùng bởi team sống trong email",
    },
    how: {
      title: "Từ tệp đính kèm tới sổ sách",
      subtitle: "Ba bước. Không cần nhảy spreadsheet.",
      steps: [
        {
          title: "Cấu hình AI agent một lần",
          body: "Dán một prompt vào Claude, ChatGPT hoặc Gemini. Từ đó AI tự chuyển tiếp hóa đơn cho bạn — không cần làm lại nữa.",
          points: [
            "Dùng được với Claude, ChatGPT, Gemini và nhiều AI khác",
            "Một prompt, chuyển tiếp mãi mãi",
            "AI của bạn tự quyết định đâu là hóa đơn",
          ],
          preview: "Claude → invoice@inbox",
        },
        {
          title: "AI trích xuất trường",
          body: "Tổng tiền, thuế, NCC và hạn thanh toán thành hàng dữ liệu rõ ràng.",
          points: [
            "NCC, tổng tiền, thuế, hạn TT",
            "Có thể review trước khi dùng",
            "Mapping trường nhất quán",
          ],
          preview: "Tổng · NCC · Hạn TT",
        },
        {
          title: "Xem trên dashboard",
          body: "Lọc, xem biểu đồ và xuất những gì kế toán cần.",
          points: [
            "Lọc theo NCC hoặc trạng thái",
            "Xu hướng chi tiêu theo thời gian",
            "Xuất dữ liệu sẵn sàng",
          ],
          preview: "Dashboard · Biểu đồ · Export",
        },
      ],
    },
    features: {
      title: "Những gì không còn dán vào spreadsheet",
      items: [
        {
          title: "Ưu tiên tệp đính kèm",
          body: "Đọc PDF và bản scan, không cần upload thủ công mỗi lần.",
        },
        {
          title: "Nhớ nhà cung cấp",
          body: "Nhận diện người gửi quen để tên NCC nhất quán.",
        },
        {
          title: "Radar hạn thanh toán",
          body: "Thấy hóa đơn đến hạn tuần này trước khi bị trễ.",
        },
        {
          title: "Biểu đồ xu hướng",
          body: "Theo dõi chi tiêu theo thời gian, không dựng pivot lại.",
        },
      ],
    },
    agents: {
      eyebrow: "AI Agents",
      title: "Hoạt động với AI agent của bạn",
      body: "Một prompt. Mọi agent. Hóa đơn của bạn, tự động chuyển tiếp.",
      cta: "Thiết lập trong app",
    },
    testimonial: {
      quote:
        "Chúng tôi không còn copy PDF hóa đơn vào sheet. Hộp thư bắt được những gì kế toán từng phải đuổi theo.",
      name: "Mai Trần",
      role: "Ops lead, Northline Retail",
    },
    cta: {
      title: "Ngừng đuổi theo PDF hóa đơn.",
      body: "Đăng nhập và để tệp đính kèm tiếp theo tự được đọc.",
      button: "Bắt đầu",
    },
    footer: {
      product: "Invoice Reader",
      rights: "Đã đăng ký bản quyền.",
      tagline: "Hộp thư AI cho tài chính.",
      productLabel: "Sản phẩm",
      accountLabel: "Tài khoản",
      legalLabel: "Pháp lý",
      links: {
        login: "Đăng nhập",
        signup: "Đăng ký",
        dashboard: "Dashboard",
        how: "Cách hoạt động",
        agents: "AI agents",
        terms: "Điều khoản",
        privacy: "Riêng tư",
      },
      legal: "Dành cho team sống trong email.",
    },
  },
}
