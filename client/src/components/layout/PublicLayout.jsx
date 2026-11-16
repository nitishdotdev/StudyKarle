import React from "react";
import { Outlet } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";
import Seo from "../seo/Seo";
import { useLocation } from "react-router-dom";

export default function PublicLayout() {
  const location = useLocation();

  return (
    <>
      <Seo path={location.pathname} />
      <PublicHeader />
      <Outlet />
      <Footer />
    </>
  );
}
