import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as authApi from "../api/authApi";
import { invalidateCache } from "../api/axiosClient";
import { createSessionCheck, interpretSessionError } from "../utils/sessionCheck";

const AuthContext = createContext(null);

// The single source of truth for the initial (and manually refreshed) session
// check. It is created once per provider, so every caller shares one in-flight
// `/api/auth/me` request instead of starting its own.
function useSessionChecker(fetchCurrentUser) {
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = createSessionCheck(fetchCurrentUser);
  }
  return ref.current;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const userRef = useRef(null);
  const aliveRef = useRef(true);
  const sessionCheck = useSessionChecker(authApi.fetchCurrentUser);

  useEffect(
    function () {
      userRef.current = user;
    },
    [user]
  );

  // Track mount state so a late response after unmount cannot set state.
  useEffect(function () {
    aliveRef.current = true;
    return function () {
      aliveRef.current = false;
    };
  }, []);

  const loadUser = useCallback(function () {
    setLoading(true);
    setSessionError(null);
    return sessionCheck
      .check()
      .then(function (data) {
        if (!aliveRef.current) return;
        setUser(data);
        setSessionError(null);
      })
      .catch(function (err) {
        if (!aliveRef.current) return;
        const outcome = interpretSessionError(err, !!userRef.current);
        if (outcome.action === "logout") {
          setUser(null);
          setSessionError(null);
          return;
        }
        if (outcome.action === "error") {
          setSessionError(outcome.message);
        }
        // outcome.action === "keep": the result is unknown or non-fatal, so
        // preserve the existing session rather than reporting the wrong state.
      })
      .finally(function () {
        if (aliveRef.current) setLoading(false);
      });
  }, [sessionCheck]);

  useEffect(
    function () {
      loadUser();
    },
    [loadUser]
  );

  // Central 401/session-expiry handling. The axios interceptor dispatches this
  // event whenever any protected endpoint returns 401, so an expired session
  // clears the cached user (and the user-scoped axios cache) immediately.
  // ProtectedRoute then redirects to /login instead of showing an error page
  // or raw backend JSON.
  useEffect(function () {
    function handleUnauthorized() {
      setUser(null);
      invalidateCache();
    }
    window.addEventListener("studykarle:unauthorized", handleUnauthorized);
    return function () {
      window.removeEventListener("studykarle:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(function (payload) {
    return authApi.login(payload).then(function (data) {
      setUser(data);
      return data;
    });
  }, []);

  // Legacy direct signup (kept for backward compatibility)
  const signup = useCallback(function (payload) {
    return authApi.signup(payload).then(function (data) {
      setUser(data);
      return data;
    });
  }, []);

  // NEW: OTP-based signup methods
  const requestOtp = useCallback(function (payload) {
    return authApi.requestOtp(payload);
  }, []);

  const verifyOtp = useCallback(function (payload) {
    return authApi.verifyOtp(payload).then(function (data) {
      setUser(data);
      return data;
    });
  }, []);

  const resendOtp = useCallback(function (payload) {
    return authApi.resendOtp(payload);
  }, []);

  const logout = useCallback(function () {
    return authApi.logout().then(function () {
      setUser(null);
    });
  }, []);

  const value = useMemo(
    function () {
      return {
        user: user,
        loading: loading,
        sessionError: sessionError,
        isAuthenticated: !!user,
        isAdmin: !!user && user.role === "admin",
        login: login,
        signup: signup,
        requestOtp: requestOtp,
        verifyOtp: verifyOtp,
        resendOtp: resendOtp,
        logout: logout,
        refreshUser: loadUser,
        setUser: setUser,
      };
    },
    [
      user,
      loading,
      sessionError,
      login,
      signup,
      requestOtp,
      verifyOtp,
      resendOtp,
      logout,
      loadUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
