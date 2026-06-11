import { Button } from "@/components/ui/Button";

/**
 * Sign-out via a POST form to the route handler — no client JS required, works
 * even inside Server Components.
 */
export function SignOutButton({
  variant = "ghost",
  className,
  children = "Sign out",
}: {
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant={variant} size="sm" className={className}>
        {children}
      </Button>
    </form>
  );
}
