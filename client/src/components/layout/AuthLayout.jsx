import { Outlet } from "react-router-dom";
import OfflineBanner from "../common/OfflineBanner";

export default function AuthLayout() {
  return (
    <>
      <OfflineBanner />
      <Outlet />
    </>
  );
}
