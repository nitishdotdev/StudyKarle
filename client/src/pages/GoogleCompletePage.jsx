import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import * as authApi from "../api/authApi";
import PageLoader from "../components/common/PageLoader";
import { consumeOAuthHash } from "../utils/oauthTicket";

export default function GoogleCompletePage() {
  const { isAuthenticated, loading, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [ticketPresent, setTicketPresent] = useState(true);
  const completionStarted = useRef(false);

  useEffect(
    function () {
      if (loading || completionStarted.current) {
        return;
      }
      completionStarted.current = true;
      const captured = consumeOAuthHash();
      const ticket = captured.ticket;
      const redirect = captured.redirect || "/dashboard";
      if (!ticket) {
        setTicketPresent(false);
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
  if (!loading && isAuthenticated && !ticketPresent) {
    return <Navigate to="/dashboard" replace />;
  }
  return <PageLoader />;
}
