import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserRole = 'admin' | 'athlete' | null;

interface AuthContextValue {
  session: Session | null;
  role: UserRole;
  initialized: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  role: null,
  initialized: false,
});

async function fetchRole(email: string): Promise<UserRole> {
  const { data } = await supabase
    .from('user_invites')
    .select('role')
    .eq('email', email.toLowerCase())
    .single();
  return (data?.role as UserRole) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSession(s);
      setInitialized(true);
      if (s?.user.email) {
        fetchRole(s.user.email).then(setRole);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user.email) {
        fetchRole(s.user.email).then(setRole);
      } else {
        setRole(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, role, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
