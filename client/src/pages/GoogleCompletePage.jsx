import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import * as authApi from "../api/authApi";
import PageLoader from "../components/common/PageLoader";

export default function GoogleCompletePage() {
  const { isAuthenticated, loading, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(
    function () {
      if (loading) {
        return;
      }
      const ticket = searchParams.get("ticket");
      const redirect = searchParams.get("redirect") || "/dashboard";
      if (!ticket) {
        toast.error("Google sign-in failed. Please try again.");
        setFailed(true);
        navigate("/login", { replace: true });
        return;
      }
      authApi
        .completeGoogleLogin({ ticket: ticket })
        .then(function (user) {
          setUser(user);
          toast.success("Welcome back!");
          const target =
            redirect.charAt(0) === "/" && redirect.indexOf("//") !== 0
              ? redirect
              : "/dashboard";
          navigate(target, { replace: true });
        })
        .catch(function (err) {
          toast.error(err.message || "Google sign-in failed. Please try again.");
          setFailed(true);
          navigate("/login", { replace: true });
        });
    },
    [loading]
  );

  if (failed) {
    return <Navigate to="/login" replace />;
  }
  if (!loading && isAuthenticated && !searchParams.get("ticket")) {
    return <Navigate to="/dashboard" replace />;
  }
  return <PageLoader />;
}
