"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  status: 'pending' | 'approved' | 'rejected';
  role: 'user' | 'admin';
  avatarConfig: {
    image?: string;
    color: string;
  };
}

interface AuthContextType {
  user: User | null;
  login: (emailOrId: string, password?: string, isAdmin?: boolean) => Promise<boolean>;
  requestLoginCode: (email: string) => Promise<boolean>;
  verifyLoginCode: (email: string, code: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  requestLoginCode: async () => false,
  verifyLoginCode: async () => false,
  logout: () => {},
  isLoading: true,
});

const SESSION_KEY = "callu_session";
const USER_KEY = "callu_user";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem(SESSION_KEY);
      if (storedSession) {
        const parsed = JSON.parse(storedSession) as { token: string; expiresAt: string };
        if (parsed?.token && parsed?.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now()) {
          try {
            const res = await fetch("/api/auth/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: parsed.token }),
            });
            if (res.ok) {
              const data = await res.json();
              setUser(data.user);
              localStorage.setItem(USER_KEY, JSON.stringify(data.user));
              setIsLoading(false);
              return;
            }
          } catch {}
        }
      }

      const storedUser = localStorage.getItem(USER_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setIsLoading(false);
    };

    void init();
  }, []);

  const login = async (emailOrId: string, password?: string, isAdmin?: boolean) => {
    try {
      const body = isAdmin 
        ? { adminId: emailOrId, password }
        : { email: emailOrId };

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return true;
      } else {
        const error = await res.json();
        toast.error(error.message);
        return false;
      }
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const requestLoginCode = async (email: string) => {
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || "Failed to send code");
        return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Failed to send code");
      return false;
    }
  };

  const verifyLoginCode = async (email: string, code: string) => {
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || "Verification failed");
        return false;
      }

      const data = await res.json();
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      if (data.sessionToken && data.expiresAt) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ token: data.sessionToken, expiresAt: data.expiresAt })
        );
      }
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Verification failed");
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, login, requestLoginCode, verifyLoginCode, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
