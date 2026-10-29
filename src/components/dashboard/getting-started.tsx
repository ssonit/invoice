import Link from "next/link"

import { UploadInvoiceButton } from "@/app/dashboard/upload-invoice-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardDictionary } from "@/lib/dashboard/i18n"

export function GettingStarted({ t, emailEnabled }: { t: DashboardDictionary; emailEnabled: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>{t.gettingStarted.title}</h2></CardTitle>
        <CardDescription>{t.gettingStarted.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-5 md:grid-cols-3">
          <li className="flex flex-col gap-2">
            <h3 className="font-medium">1. {t.gettingStarted.uploadTitle}</h3>
            <p className="text-sm text-muted-foreground">{t.gettingStarted.uploadHelp}</p>
            <div><UploadInvoiceButton /></div>
          </li>
          <li className="flex flex-col gap-2">
            <h3 className="font-medium">2. {t.gettingStarted.reviewTitle}</h3>
            <p className="text-sm text-muted-foreground">{t.gettingStarted.reviewHelp}</p>
            <div>
              <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/inbox" />}>
                {t.gettingStarted.reviewAction}
              </Button>
            </div>
          </li>
          <li className="flex flex-col gap-2">
            <h3 className="font-medium">3. {t.gettingStarted.exportTitle}</h3>
            <p className="text-sm text-muted-foreground">{t.gettingStarted.exportHelp}</p>
            <div>
              <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/exports" />}>
                {t.gettingStarted.exportAction}
              </Button>
            </div>
          </li>
        </ol>
      </CardContent>
      {emailEnabled ? (
        <CardFooter>
          <Link className="text-sm underline underline-offset-4" href="/dashboard/automation">
            {t.gettingStarted.emailAction}
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  )
}
