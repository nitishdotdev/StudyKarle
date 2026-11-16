import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import OfflineBanner from "../common/OfflineBanner";
import Seo from "../seo/Seo";

export default function AuthLayout() {
  const location = useLocation();

  return (
    <>
      <Seo path={location.pathname} noindex />
      <OfflineBanner />
      <Outlet />
    </>
  );
}
