"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    // Check for error in URL (common in OAuth failures)
    const hash = window.location.hash;
    if (hash && hash.includes("error_description")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const errorMsg = params.get("error_description");
      if (errorMsg) setError(errorMsg.replace(/\+/g, " "));
    }

    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setError("Check your email for a confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#E4DDD3]">
      {/* 3D-inspired Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#00A19B]/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#C99B4A]/10 rounded-full blur-[100px] animate-bounce-slow" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-[#D56B68]/10 rounded-full blur-[80px] animate-float" />
        
        {/* Animated 3D Mesh (CSS grid) */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ backgroundImage: "radial-gradient(#17211F 1px, transparent 1px)", backgroundSize: "40px 40px", transform: "perspective(1000px) rotateX(60deg) translateY(-100px)" }} />
      </div>

      <main className="relative z-10 w-full max-w-md p-8 mx-4">
        <div className="bg-white/70 backdrop-blur-2xl border border-[#17211F]/10 rounded-[32px] p-8 shadow-[0_32px_80px_rgba(23,33,31,0.12)]">
          <header className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00A19B] rounded-2xl shadow-[0_12px_24px_rgba(0,161,155,0.3)] mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="white" viewBox="0 0 16 16">
                <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/>
                <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-[#17211F]">Welcome</h1>
            <p className="mt-2 text-[#17211F]/60 font-medium">
              {isSignUp ? "Create your calendar account" : "Sign in to manage your events"}
            </p>
          </header>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Email Address</label>
              <input
                required
                type="email"
                placeholder="name@example.com"
                className="w-full bg-white/50 border border-[#17211F]/10 rounded-2xl px-5 py-3 text-sm font-medium focus:outline-none focus:border-[#00A19B] focus:ring-4 focus:ring-[#00A19B]/10 transition-all text-[#17211F]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Password</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full bg-white/50 border border-[#17211F]/10 rounded-2xl px-5 py-3 text-sm font-medium focus:outline-none focus:border-[#00A19B] focus:ring-4 focus:ring-[#00A19B]/10 transition-all text-[#17211F]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#17211F]/40 hover:text-[#00A19B] transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.047-2.047a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z"/>
                      <path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className={`text-xs font-bold text-center p-3 rounded-xl ${error.includes("confirmation") ? "bg-[#00A19B]/10 text-[#00A19B]" : "bg-red-50 text-[#D56B68]"}`}>
                {error === "Invalid login credentials" ? "Incorrect email or password. Please try again." : error}
              </p>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-[#00A19B] text-white font-bold py-4 rounded-2xl shadow-[0_12px_24px_rgba(0,161,155,0.2)] hover:translate-y-[-2px] transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#17211F]/10"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-[#17211F]/40 font-bold">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-[#17211F]/10 text-[#17211F] font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#f7f2ea] transition-all shadow-sm active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>

          <footer className="mt-8 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-bold text-[#00A19B] hover:underline"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </footer>
        </div>
      </main>

      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, 40px); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -20px) rotate(5deg); }
          66% { transform: translate(-10px, 30px) rotate(-3deg); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 15s ease-in-out infinite;
        }
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
