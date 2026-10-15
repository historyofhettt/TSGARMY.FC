import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, ArrowRight, ChevronLeft, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type View = "login" | "register" | "register-username" | "forgot" | "otp" | "reset" | "success";

interface OAuthStatePayload {
  redirect?: string;
  username?: string;
  nonce: string;
}

function encodeState(payload: OAuthStatePayload): string {
  const json = JSON.stringify(payload);
  return btoa(json);
}

function generateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getGoogleOAuthUrl(username?: string) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google OAuth is not configured. Missing VITE_GOOGLE_CLIENT_ID.");
  }
  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("Google OAuth is not configured. Missing VITE_GOOGLE_REDIRECT_URI.");
  }
  const nonce = generateNonce();
  const payload: OAuthStatePayload = { nonce, ...(username ? { username } : {}) };
  const state = encodeState(payload);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  document.cookie = `oauth_state=${state}; path=/; SameSite=Lax; Secure`;
  document.cookie = `oauth_nonce=${nonce}; path=/; SameSite=Lax; Secure`;
  return url.toString();
}

function getDiscordOAuthUrl(username?: string) {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error("Discord OAuth is not configured. Missing VITE_DISCORD_CLIENT_ID.");
  }
    const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("Discord OAuth is not configured. Missing VITE_DISCORD_REDIRECT_URI.");
  }
  const nonce = generateNonce();
  const payload: OAuthStatePayload = { nonce, ...(username ? { username } : {}) };
  const state = encodeState(payload);
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("state", state);
  document.cookie = `oauth_state=${state}; path=/; SameSite=Lax; Secure`;
  document.cookie = `oauth_nonce=${nonce}; path=/; SameSite=Lax; Secure`;
  return url.toString();
}

export default function Login() {
  const [view, setView] = useState<View>("login");
  const [oauthUsername, setOauthUsername] = useState("");
  const navigate = useNavigate();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Welcome back!");
      navigate("/");
    },
    onError: (e) => toast.error(e.message ?? "Login failed"),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("Account created!");
      navigate("/");
    },
    onError: (e) => toast.error(e.message ?? "Registration failed"),
  });

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setView("otp");
      toast.success("If an account exists, an OTP has been sent.");
    },
    onError: (e) => toast.error(e.message ?? "Failed to send OTP"),
  });

  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation({
    onSuccess: () => {
      setView("reset");
      toast.success("OTP verified");
    },
    onError: (e) => toast.error(e.message ?? "Invalid OTP"),
  });

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setView("success");
      toast.success("Password reset successful");
    },
    onError: (e) => toast.error(e.message ?? "Failed to reset password"),
  });

  const checkUsernameQuery = trpc.auth.checkUsername.useQuery(
    { username: oauthUsername },
    { enabled: oauthUsername.length > 0 },
  );

  const handleOAuth = (provider: "google" | "discord") => {
    let url: string;
    try {
      if (view === "register-username") {
        if (!oauthUsername.trim()) {
          toast.error("Please enter a username");
          return;
        }
        if (!checkUsernameQuery.isFetching && checkUsernameQuery.data && !checkUsernameQuery.data.available) {
          toast.error("Username already exists");
          return;
        }
        if (checkUsernameQuery.isFetching) {
          return;
        }
        url = provider === "google" ? getGoogleOAuthUrl(oauthUsername) : getDiscordOAuthUrl(oauthUsername);
      } else {
        url = provider === "google" ? getGoogleOAuthUrl() : getDiscordOAuthUrl();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "OAuth is not configured for this provider";
      toast.error(msg);
      return;
    }
    window.location.href = url;
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
              {view === "login" && "WELCOME BACK"}
              {view === "register" && "JOIN TSG"}
              {view === "forgot" && "RESET PASSWORD"}
              {view === "otp" && "VERIFY OTP"}
              {view === "reset" && "NEW PASSWORD"}
              {view === "success" && "SUCCESS"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {view === "login" && "Sign in to your account"}
              {view === "register" && "Create your local account"}
              {view === "forgot" && "Enter your registered email"}
               {view === "otp" && "Check your email for the 6-digit code"}
               {view === "reset" && "New password"}
               {view === "register-username" && "Choose a Username"}
               {view === "success" && "Your password has been updated"}
             </p>
           </div>

          <div className="space-y-4">
             {view === "login" && (
               <LoginForm
                 onLogin={(vals) => loginMutation.mutate(vals)}
                 onForgot={() => setView("forgot")}
                 onRegister={() => setView("register")}
                 onGoogle={() => handleOAuth("google")}
                 onDiscord={() => handleOAuth("discord")}
                 loading={loginMutation.isPending}
               />
             )}

             {view === "register" && (
               <RegisterForm
                 onRegister={(vals) => registerMutation.mutate(vals)}
                 onLogin={() => setView("login")}
                 onGoogle={() => setView("register-username")}
                 onDiscord={() => setView("register-username")}
                 loading={registerMutation.isPending}
                />
              )}

             {view === "register-username" && (
               <OAuthUsernameForm
                 username={oauthUsername}
                 onUsernameChange={setOauthUsername}
                 onGoogle={() => handleOAuth("google")}
                 onDiscord={() => handleOAuth("discord")}
                 onBack={() => setView("register")}
                 usernameError={checkUsernameQuery.data && !checkUsernameQuery.data.available ? "Username already exists" : undefined}
               />
             )}

             {view === "forgot" && (
              <ForgotForm
                onForgot={(vals) => forgotMutation.mutate(vals)}
                onBack={() => setView("login")}
                loading={forgotMutation.isPending}
              />
            )}

            {view === "otp" && (
              <OtpForm
                onVerify={(vals) => verifyOtpMutation.mutate(vals)}
                onBack={() => setView("forgot")}
                loading={verifyOtpMutation.isPending}
              />
            )}

            {view === "reset" && (
              <ResetForm
                onReset={(vals) => resetMutation.mutate(vals)}
                onBack={() => setView("otp")}
                loading={resetMutation.isPending}
              />
            )}

            {view === "success" && (
              <SuccessView onLogin={() => setView("login")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  onLogin,
  onForgot,
  onRegister,
  onGoogle,
  onDiscord,
  loading,
}: {
  onLogin: (vals: { identifier: string; password: string }) => void;
  onForgot: () => void;
  onRegister: () => void;
  onGoogle: () => void;
  onDiscord: () => void;
  loading: boolean;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ identifier, password });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="identifier">Username or Email</Label>
        <div className="relative">
          <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="identifier"
            className="h-11 pl-9"
            placeholder="Enter username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            className="h-11 pl-9"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 rounded border-border accent-[hsl(var(--tsg-blue))]" />
          Remember me
        </label>
        <button type="button" onClick={onForgot} className="text-sm text-[hsl(var(--tsg-blue))] hover:underline">
          Forgot Password?
        </button>
      </div>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign In
      </Button>
      <div className="relative flex items-center py-2">
        <div className="flex-1 border-t border-border" />
        <span className="mx-3 text-xs text-muted-foreground">OR</span>
        <div className="flex-1 border-t border-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-10" onClick={onGoogle}>
          <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={onDiscord}>
          <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.2 18.2 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.7 19.7 0 0 0 4.18 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          Discord
        </Button>
       </div>
       <p className="text-center text-sm text-muted-foreground">
         Don&apos;t have an account?{" "}
         <button type="button" onClick={onRegister} className="font-semibold text-[hsl(var(--tsg-blue))] hover:underline">
           Create Account
         </button>
       </p>
     </form>
   );
}

function RegisterForm({
  onRegister,
  onLogin,
  onGoogle,
  onDiscord,
  loading,
}: {
  onRegister: (vals: { username: string; email: string; password: string; confirmPassword: string }) => void;
  onLogin: () => void;
  onGoogle: () => void;
  onDiscord: () => void;
  loading: boolean;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegister({ username, email, password, confirmPassword });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="username" className="h-11 pl-9" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="email" type="email" className="h-11 pl-9" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="password" type="password" className="h-11 pl-9" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="confirmPassword" type="password" className="h-11 pl-9" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-[hsl(var(--tsg-blue))] hover:underline">
          Sign In
        </button>
      </p>
      <div className="relative flex items-center py-2">
        <div className="flex-1 border-t border-border" />
        <span className="mx-3 text-xs text-muted-foreground">OR</span>
        <div className="flex-1 border-t border-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-10" onClick={onGoogle}>
          <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={onDiscord}>
          <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.2 18.2 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.7 19.7 0 0 0 4.18 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          Discord
        </Button>
      </div>
    </form>
  );
}

function OAuthUsernameForm({
  username,
  onUsernameChange,
  onGoogle,
  onDiscord,
  onBack,
  usernameError,
}: {
  username: string;
  onUsernameChange: (val: string) => void;
  onGoogle: () => void;
  onDiscord: () => void;
  onBack: () => void;
  usernameError?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGoogle();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="username"
            className="h-11 pl-9"
            placeholder="Choose a unique username"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            required
          />
        </div>
        {usernameError && (
          <p className="flex items-center gap-1 text-xs text-[hsl(var(--tsg-red))]">
            <AlertCircle className="h-3 w-3" />
            {usernameError}
          </p>
        )}
      </div>

      <Button type="submit" className="h-11 w-full">
        Continue with Google
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-10 w-full"
        onClick={onDiscord}
      >
        Continue with Discord
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Register
      </button>
    </form>
  );
}

function ForgotForm({
  onForgot,
  onBack,
  loading,
}: {
  onForgot: (vals: { email: string }) => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onForgot({ email });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="email" type="email" className="h-11 pl-9" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send OTP
      </Button>
      <button type="button" onClick={onBack} className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-white">
        <ChevronLeft className="h-4 w-4" /> Back to Login
      </button>
    </form>
  );
}

function OtpForm({
  onVerify,
  onBack,
  loading,
}: {
  onVerify: (vals: { email: string; otp: string }) => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify({ email, otp });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="otp">OTP Code</Label>
        <Input id="otp" type="text" inputMode="numeric" maxLength={6} className="h-11 text-center text-2xl tracking-[0.5em]" placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Verify OTP
      </Button>
      <button type="button" onClick={onBack} className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-white">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
    </form>
  );
}

function ResetForm({
  onReset,
  onBack,
  loading,
}: {
  onReset: (vals: { email: string; otp: string; newPassword: string; confirmPassword: string }) => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onReset({ email, otp, newPassword, confirmPassword });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="otp">OTP Code</Label>
        <Input id="otp" type="text" inputMode="numeric" maxLength={6} className="h-11 text-center text-2xl tracking-[0.5em]" placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="newPassword" type="password" className="h-11 pl-9" placeholder="Min. 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input id="confirmPassword" type="password" className="h-11 pl-9" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Change Password
      </Button>
      <button type="button" onClick={onBack} className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-white">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
    </form>
  );
}

function SuccessView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
        <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-center text-sm text-muted-foreground">Your password has been updated successfully.</p>
      <Button className="h-11 w-full" onClick={onLogin}>
        Return to Login <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}