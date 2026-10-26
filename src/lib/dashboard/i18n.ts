// Dashboard UI strings (EN/VI). Pure data + helpers so it can be unit-tested and
// read from both Server Components (via the cookie) and Client Components
// (via DashboardI18nProvider). Covers the shell, Settings and the Invoices list;
// extend `en` and `vi` together when translating more screens.

export const DASHBOARD_LOCALES = ["en", "vi"] as const;
export type DashboardLocale = (typeof DASHBOARD_LOCALES)[number];

export const DEFAULT_DASHBOARD_LOCALE: DashboardLocale = "en";
export const DASHBOARD_LOCALE_COOKIE = "dashboard-locale";
export const DASHBOARD_LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseDashboardLocale(value: string | null | undefined): DashboardLocale {
  return DASHBOARD_LOCALES.find((locale) => locale === value) ?? DEFAULT_DASHBOARD_LOCALE;
}

const en = {
  nav: {
    groups: {
      Workspace: "Workspace",
      Insights: "Insights",
      Account: "Account",
    } as Record<string, string>,
    items: {
      "/dashboard": "Overview",
      "/dashboard/invoices": "Invoices",
      "/dashboard/inbox": "Inbox",
      "/dashboard/automation": "Automation",
      "/dashboard/vendors": "Vendors",
      "/dashboard/analytics": "Analytics",
      "/dashboard/exports": "Exports",
      "/dashboard/settings": "Settings",
    } as Record<string, string>,
    status: { beta: "Beta", soon: "Soon" } as Record<string, string>,
  },
  header: {
    notifications: "Notifications",
    noNotifications: "No notifications yet",
    settings: "Settings",
    accountMenu: "Account menu",
    signedIn: "Signed in",
    signOut: "Sign out",
    language: "Language",
  },
  settings: {
    title: "Settings",
    descriptionWithEmail: "Manage your profile, forwarding and account security.",
    descriptionNoEmail: "Manage your profile and account security.",
    profileTitle: "Profile",
    profileDescription: "The name shown in the account menu.",
    nameLabel: "Display name",
    saveName: "Save name",
    savingName: "Saving...",
    nameSaved: "Name updated.",
    forwardingTitle: "Forwarding address",
    active: "Active",
    forwardingHelp:
      "Forward invoice emails to this address, or set up an auto-forward rule in Gmail/Outlook. Anything that arrives is parsed and added to your invoices.",
    forwardingPermanent:
      "This is your permanent forwarding address — you only get one per account.",
    passwordTitle: "Password",
    passwordDescription: "Update the password you use to sign in.",
    newPassword: "New password",
    updatePassword: "Update password",
    updatingPassword: "Updating...",
    passwordUpdated: "Password updated.",
    dangerZone: "Danger zone",
  },
  invoices: {
    title: "Invoices",
    descriptionWithEmail: "Every invoice extracted from your forwarded email and manual uploads.",
    descriptionNoEmail: "Every invoice extracted from your uploads.",
    searchPlaceholder: "Search vendor or invoice #...",
    searchLabel: "Search invoices",
    statusAll: "All",
    statusReview: "Needs review",
    statusOk: "OK",
    clear: "Clear",
    resultCount: "invoice(s)",
  },
}

export type DashboardDictionary = typeof en

const vi: DashboardDictionary = {
  nav: {
    groups: {
      Workspace: "Không gian làm việc",
      Insights: "Thống kê",
      Account: "Tài khoản",
    },
    items: {
      "/dashboard": "Tổng quan",
      "/dashboard/invoices": "Hóa đơn",
      "/dashboard/inbox": "Hộp thư",
      "/dashboard/automation": "Tự động hóa",
      "/dashboard/vendors": "Nhà cung cấp",
      "/dashboard/analytics": "Phân tích",
      "/dashboard/exports": "Xuất dữ liệu",
      "/dashboard/settings": "Cài đặt",
    },
    status: { beta: "Beta", soon: "Sắp ra mắt" },
  },
  header: {
    notifications: "Thông báo",
    noNotifications: "Chưa có thông báo",
    settings: "Cài đặt",
    accountMenu: "Menu tài khoản",
    signedIn: "Đã đăng nhập",
    signOut: "Đăng xuất",
    language: "Ngôn ngữ",
  },
  settings: {
    title: "Cài đặt",
    descriptionWithEmail: "Quản lý hồ sơ, chuyển tiếp email và bảo mật tài khoản.",
    descriptionNoEmail: "Quản lý hồ sơ và bảo mật tài khoản.",
    profileTitle: "Hồ sơ",
    profileDescription: "Tên hiển thị trong menu tài khoản.",
    nameLabel: "Tên hiển thị",
    saveName: "Lưu tên",
    savingName: "Đang lưu...",
    nameSaved: "Đã cập nhật tên.",
    forwardingTitle: "Địa chỉ chuyển tiếp",
    active: "Đang hoạt động",
    forwardingHelp:
      "Chuyển tiếp email hóa đơn đến địa chỉ này, hoặc đặt quy tắc tự động chuyển tiếp trong Gmail/Outlook. Mọi thư gửi đến sẽ được đọc và thêm vào hóa đơn của bạn.",
    forwardingPermanent:
      "Đây là địa chỉ chuyển tiếp cố định — mỗi tài khoản chỉ có một địa chỉ.",
    passwordTitle: "Mật khẩu",
    passwordDescription: "Đổi mật khẩu bạn dùng để đăng nhập.",
    newPassword: "Mật khẩu mới",
    updatePassword: "Cập nhật mật khẩu",
    updatingPassword: "Đang cập nhật...",
    passwordUpdated: "Đã cập nhật mật khẩu.",
    dangerZone: "Vùng nguy hiểm",
  },
  invoices: {
    title: "Hóa đơn",
    descriptionWithEmail:
      "Mọi hóa đơn được trích xuất từ email chuyển tiếp và các lần tải lên thủ công.",
    descriptionNoEmail: "Mọi hóa đơn được trích xuất từ các lần tải lên của bạn.",
    searchPlaceholder: "Tìm theo nhà cung cấp hoặc số hóa đơn...",
    searchLabel: "Tìm hóa đơn",
    statusAll: "Tất cả",
    statusReview: "Cần xem lại",
    statusOk: "OK",
    clear: "Xóa lọc",
    resultCount: "hóa đơn",
  },
}

export const dashboardDictionaries: Record<DashboardLocale, DashboardDictionary> = { en, vi }
