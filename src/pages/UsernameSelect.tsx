import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Loader2, User, ArrowRight, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function generateSuggestion(name: string): string {
  if (name && name.length > 0) {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_]+/g, "")
      .slice(0, 20) || "user";
    return base;
  }
  return "user";
}

export default function UsernameSelect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const provider = searchParams.get("provider") ?? "";
  const providerId = searchParams.get("providerId") ?? "";
  const email = searchParams.get("email") ?? "";
  const name = searchParams.get("name") ?? "";
  const avatar = searchParams.get("avatar") ?? "";
  const initialError = searchParams.get("error") ?? "";

  const initialUsername = generateSuggestion(name);
  const [username, setUsername] = useState(initialUsername);
  const [serverError, setServerError] = useState(initialError);

  const checkUsername = trpc.auth.checkUsername.useQuery(
    { username },
    { enabled: false },
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateUsername = async (newUsername: string) => {
    setUsername(newUsername);
    if (newUsername.length > 0) {
      const res = await checkUsername.refetch();
      if (!res.data?.available) {
        setServerError("Username already exists");
      } else {
        setServerError("");
      }
    } else {
      setServerError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!username.trim()) {
      setServerError("Please choose a username");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/oauth/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          providerId,
          username,
          name,
          email,
          avatar,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to set username");
      }
      toast.success("Account created!");
      navigate("/");
      window.location.reload();
    } catch (err: any) {
      setServerError(err.message ?? "Failed to set username");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[hsl(224_45%_6%)]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 h-[600px] w-[600px] animate-pulse rounded-full bg-[hsl(var(--tsg-blue)/0.12)] blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/2 h-[500px] w-[500px] animate-pulse rounded-full bg-[hsl(var(--tsg-red)/0.1)] blur-[100px]" style={{ animationDelay: "1s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,hsl(224_45%_6%)_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass-strong rounded-2xl border border-border p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-black tracking-wider text-white sm:text-3xl">
              CHOOSE USERNAME
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              You need a unique username to complete your {provider} account setup.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  className="h-11 pl-9"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => updateUsername(e.target.value)}
                  required
                />
              </div>
              {serverError && (
                <p className="flex items-center gap-1 text-xs text-[hsl(var(--tsg-red))]">
                  <AlertCircle className="h-3 w-3" />
                  {serverError}
                </p>
              )}
            </div>

            <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
