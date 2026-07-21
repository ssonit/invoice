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
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>;
}) {
  const { error, check_email } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm rounded-[14px] shadow-none">
        <CardHeader>
          <CardTitle>Tạo tài khoản</CardTitle>
          <CardDescription>
            Chúng tôi sẽ tạo cho bạn một địa chỉ email riêng để forward invoice tới
          </CardDescription>
        </CardHeader>
        <CardContent>
          {check_email ? (
            <p className="text-sm text-muted-foreground">
              Đã gửi email xác nhận. Vui lòng kiểm tra hộp thư và bấm vào link để kích hoạt tài
              khoản.
            </p>
          ) : (
            <form action={signup}>
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
                    minLength={6}
                    autoComplete="new-password"
                  />
                </Field>
                {error && (
                  <Field data-invalid>
                    <p className="text-sm text-destructive">{error}</p>
                  </Field>
                )}
                <Field>
                  <Button type="submit">Đăng ký</Button>
                  <FieldDescription>
                    Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
