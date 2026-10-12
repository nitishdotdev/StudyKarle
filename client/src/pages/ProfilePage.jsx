import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import { formatDate } from "../utils/formatDate";
import useAuth from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import { fetchProfile, updateProfile, changePassword } from "../api/userApi";

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ name: "", course: "", currentYear: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(function () {
    setLoading(true);
    fetchProfile()
      .then(function (data) {
        setProfileData(data);
        setForm({
          name: data.user.name || "",
          course: data.user.course || "",
          currentYear: data.user.current_year || "",
        });
      })
      .catch(function (err) {
        setError(err.message);
      })
      .finally(function () {
        setLoading(false);
      });
  }, []);

  function handleProfileChange(e) {
    const { name, value } = e.target;
    setForm(function (prev) {
      return Object.assign({}, prev, { [name]: value });
    });
  }

  function handleProfileSubmit(e) {
    e.preventDefault();
    setSavingProfile(true);
    updateProfile(form)
      .then(function () {
        toast.success("Profile updated successfully");
        return refreshUser();
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setSavingProfile(false);
      });
  }

  function handlePwChange(e) {
    const { name, value } = e.target;
    setPwForm(function (prev) {
      return Object.assign({}, prev, { [name]: value });
    });
  }

  function validatePassword() {
    const next = {};
    if (!pwForm.currentPassword) {
      next.currentPassword = "Current password is required";
    }
    if (!pwForm.newPassword || pwForm.newPassword.length < 8) {
      next.newPassword = "New password must be at least 8 characters";
    } else if (!/\d/.test(pwForm.newPassword)) {
      next.newPassword = "New password must contain at least one number";
    }
    setPwErrors(next);
    return Object.keys(next).length === 0;
  }

  function handlePasswordSubmit(e) {
    e.preventDefault();
    if (!validatePassword()) {
      return;
    }
    setSavingPassword(true);
    changePassword(pwForm)
      .then(function () {
        toast.success("Password changed successfully");
        setPwForm({ currentPassword: "", newPassword: "" });
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setSavingPassword(false);
      });
  }

  function handleLogout() {
    setLoggingOut(true);
    logout()
      .then(function () {
        toast.success("Logged out successfully");
        navigate("/login", { replace: true });
      })
      .catch(function () {
        toast.error("Failed to log out. Please try again.");
      })
      .finally(function () {
        setLoggingOut(false);
      });
  }

  return (
    <AppShell>
      <div className="mb-stack-lg">
        <h1 className="font-headline-xl text-headline-xl text-text-primary mb-1">
          My Profile
        </h1>
        <p className="text-body-md text-text-secondary">
          Manage your account settings and academic preferences.
        </p>
      </div>

      {loading ? (
        <Skeleton type="row" count={3} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <React.Fragment>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
            <div className="md:col-span-4 space-y-gutter">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-border-subtle flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center text-white text-3xl font-bold mb-4">
                  {user ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <h3 className="font-headline-lg text-headline-lg text-text-primary">
                  {profileData.user.name}
                </h3>
                <p className="text-body-sm text-text-muted mb-4">
                  {profileData.user.email}
                </p>
                <div className="inline-flex items-center px-3 py-1 bg-status-success/10 text-status-success rounded-full text-label-sm">
                  <span className="w-1.5 h-1.5 bg-status-success rounded-full mr-2" />
                  Active{" "}
                  {profileData.user.role === "admin" ? "Admin" : "Student"}
                </div>
                <div className="w-full mt-8 grid grid-cols-2 gap-4 text-left border-t border-border-subtle pt-6">
                  <div>
                    <p className="text-text-muted text-[11px] uppercase tracking-wider font-bold mb-1">
                      Joined
                    </p>
                    <p className="text-text-primary text-body-sm">
                      {formatDate(profileData.user.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted text-[11px] uppercase tracking-wider font-bold mb-1">
                      Saved Notes
                    </p>
                    <p className="text-text-primary text-body-sm">
                      {profileData.savedCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-8 space-y-gutter">
              <div className="bg-white rounded-xl shadow-sm border border-border-subtle p-8">
                <h3 className="font-headline-md text-headline-md text-text-primary mb-6">
                  Account Details
                </h3>
                <form
                  className="space-y-stack-md"
                  onSubmit={handleProfileSubmit}
                >
                  <Input
                    id="name"
                    name="name"
                    label="Full Name"
                    value={form.name}
                    onChange={handleProfileChange}
                    required
                  />
                  <Input
                    id="course"
                    name="course"
                    label="Course / Stream"
                    placeholder="B.Tech - Computer Science"
                    value={form.course}
                    onChange={handleProfileChange}
                  />
                  <Input
                    id="currentYear"
                    name="currentYear"
                    label="Current Year"
                    placeholder="2nd Year"
                    value={form.currentYear}
                    onChange={handleProfileChange}
                  />
                  <Button type="submit" loading={savingProfile}>
                    Save Changes
                  </Button>
                </form>
              </div>

              {profileData.user.has_password !== false ? (
              <div className="bg-white rounded-xl shadow-sm border border-border-subtle p-8">
                <h3 className="font-headline-md text-headline-md text-text-primary mb-6">
                  Change Password
                </h3>
                <form
                  className="space-y-stack-md"
                  onSubmit={handlePasswordSubmit}
                  noValidate
                >
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    label="Current Password"
                    value={pwForm.currentPassword}
                    onChange={handlePwChange}
                    error={pwErrors.currentPassword}
                    autoComplete="current-password"
                  />
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    label="New Password"
                    value={pwForm.newPassword}
                    onChange={handlePwChange}
                    error={pwErrors.newPassword}
                    autoComplete="new-password"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={savingPassword}
                  >
                    Update Password
                  </Button>
                </form>
              </div>
              ) : (
              <div className="bg-white rounded-xl shadow-sm border border-border-subtle p-8">
                <h3 className="font-headline-md text-headline-md text-text-primary mb-2">
                  Password
                </h3>
                <p className="text-body-sm text-text-secondary">
                  This account uses Google sign-in. Password recovery is not
                  available for Google-only accounts.
                </p>
              </div>
              )}
            </div>
          </div>

          <div className="mt-gutter bg-white rounded-xl shadow-sm border border-border-subtle p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-headline-md text-headline-md text-text-primary mb-1">
                Log Out
              </h3>
              <p className="text-body-sm text-text-secondary">
                End your current session on this device.
              </p>
            </div>
            <Button
              variant="danger"
              icon="logout"
              size="md"
              loading={loggingOut}
              onClick={handleLogout}
              className="w-full sm:w-auto justify-center shrink-0"
            >
              Logout
            </Button>
          </div>
        </React.Fragment>
      )}
    </AppShell>
  );
}
