import React from "react";
import ContinueStudyingCard from "./ContinueStudyingCard";
import useAuth from "../../hooks/useAuth";
import useFetch from "../../hooks/useFetch";
import { fetchContinueStudying } from "../../api/userApi";
import { shouldShowContinueStudying } from "../../utils/continueStudying";

function ContinueStudyingPanel({ user }) {
  const userId = user && user.id;
  const { data } = useFetch(fetchContinueStudying, []);
  const items = data && Array.isArray(data.items) ? data.items.slice(0, 2) : [];
  if (!data || items.length === 0) return null;

  return (
    <section className="mt-10 rounded-[1.75rem] border border-border-subtle bg-white p-6 sm:p-8">
      <div className="mb-5">
        <h2 className="font-headline-lg text-headline-lg text-text-primary">Continue Studying</h2>
        <p className="mt-1 text-body-md text-text-secondary">Pick up right where you left off.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map(function (item) {
          return (
            <ContinueStudyingCard
              key={item.resourceType + ":" + item.resourceId}
              item={item}
              userId={userId}
            />
          );
        })}
      </div>
    </section>
  );
}

export default function ContinueStudyingSection() {
  const { user } = useAuth();
  if (!shouldShowContinueStudying(user)) {
    return null;
  }
  return <ContinueStudyingPanel user={user} />;
}
