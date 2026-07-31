"use client"

import { useFormStatus } from "react-dom"
import { Button } from "./button"
import { Spinner } from "./spinner"

/**
 * Submit button that automatically shows a loading spinner and disables
 * itself while its parent Server Action form is pending.
 *
 * Usage: drop-in replacement for <Button type="submit"> inside a
 * `<form action={serverAction}>`. All Button props are forwarded.
 */
function SubmitButton({
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus()

  return (
    <Button disabled={disabled ?? pending} {...props}>
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {children}
    </Button>
  )
}

export { SubmitButton }
