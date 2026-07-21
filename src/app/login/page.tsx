import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm rounded-[14px] shadow-none">
        <CardHeader>
          <CardTitle>Đăng nhập</CardTitle>
          <CardDescription>Truy cập dashboard invoice của bạn</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </Field>
              {error && (
                <Field data-invalid>
                  <p className="text-sm text-destructive">{error}</p>
                </Field>
              )}
              <Field>
                <Button type="submit">Đăng nhập</Button>
                <FieldDescription>
                  Chưa có tài khoản? <Link href="/signup">Đăng ký</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
