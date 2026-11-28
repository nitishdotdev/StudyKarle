import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Seo, { SITE_URL } from "../components/seo/Seo";
import Spinner from "../components/common/Spinner";
import { authReturnQuery } from "../utils/sessionReturn";
import { courseMaterialPath, paymentAccessPath } from "../utils/paymentRedirect";
import useAuth from "../hooks/useAuth";
import { fetchPublicCourse, trackCourseEvent } from "../api/publicCourseApi";

const CATEGORY_LABELS = {
  pyq_solution: "PYQ + Solution",
  pyqs: "PYQ",
  solutions: "Solution",
  notes: "Notes",
};

export default function CourseDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(
    function () {
      let active = true;
      setLoading(true);
      setNotFound(false);
      setRequestFailed(false);
      setCourse(null);
      setActiveTab("all");
      fetchPublicCourse(slug)
        .then(function (data) {
          if (!active) return;
          if (!data) {
            setNotFound(true);
            return;
          }
          setCourse(data);
          trackCourseEvent(data.slug, "course_visit");
        })
        .catch(function (err) {
          if (!active) return;
          if (err.status === 404) setNotFound(true);
          else setRequestFailed(true);
        })
        .finally(function () {
          if (active) setLoading(false);
        });
      return function () {
        active = false;
      };
    },
    [slug]
  );

  const filteredItems = useMemo(
    function () {
      if (!course || !Array.isArray(course.items)) return [];
      if (activeTab === "all") return course.items;
      if (activeTab === "pyqs") {
        return course.items.filter(function (item) {
          return item.category === "pyqs" || item.category === "pyq_solution";
        });
      }
      if (activeTab === "solutions") {
        return course.items.filter(function (item) {
          return item.category === "solutions" || item.category === "pyq_solution";
        });
      }
      return course.items.filter(function (item) {
        return item.category === "notes";
      });
    },
    [course, activeTab]
  );

  const extraGraph = useMemo(
    function () {
      if (!course) return null;
      const canonical = course.seo.canonicalUrl;
      return [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
            { "@type": "ListItem", position: 2, name: "Courses", item: SITE_URL + "/courses" },
            { "@type": "ListItem", position: 3, name: course.title, item: canonical },
          ],
        },
        {
          "@type": "Course",
          "@id": canonical + "#course",
          name: course.title,
          description: course.seo.description,
          url: canonical,
          provider: { "@id": SITE_URL + "/#organization" },
          offers: course.locked ? {
            "@type": "Offer",
            price: String(course.priceRupees),
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
            url:
              SITE_URL +
              "/signup?returnTo=" +
              encodeURIComponent("/access?course=" + course.slug),
          } : undefined,
        },
        {
          "@type": "ItemList",
          name: course.title + " Study Materials",
          numberOfItems: course.items.length,
          itemListElement: course.items.slice(0, 50).map(function (item, idx) {
            return {
              "@type": "ListItem",
              position: idx + 1,
              name: item.title,
            };
          }),
        },
      ];
    },
    [course]
  );

  function openDestination(target) {
    navigate(user ? target : "/signup" + authReturnQuery(target));
  }

  function handleUnlockClick() {
    trackCourseEvent(course.slug, "unlock_cta_click");
    openDestination(paymentAccessPath(null, { courseSlug: course.slug }));
  }

  function handleItemClick(item) {
    if (item.locked) trackCourseEvent(course.slug, "unlock_cta_click");
    openDestination(courseMaterialPath(course.slug, item.itemKey));
  }

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-20 flex justify-center">
        <Spinner />
      </main>
    );
  }

  if (requestFailed) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-text-primary">Course temporarily unavailable</h1>
        <p className="mt-2 text-text-secondary">Reload the page to try again.</p>
      </main>
    );
  }

  if (notFound || !course) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Seo
          path={"/courses/" + (slug || "")}
          title="Course Not Found | StudyKarle"
          description="The requested StudyKarle course page could not be found."
          noindex
        />
        <h1 className="text-2xl font-bold text-slate-900">Course not found</h1>
        <p className="mt-2 text-slate-600">
          This course page does not exist or has not been synced yet.
        </p>
        <Link
          to="/courses"
          className="mt-6 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Browse all courses
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Seo
        path={"/courses/" + course.slug}
        title={course.seo.title}
        description={course.seo.description}
        extraGraph={extraGraph}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-slate-500 flex items-center gap-2">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link to="/courses" className="hover:text-primary">Courses</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{course.title}</span>
      </nav>

      <section className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {course.yearLabel}
          </span>
          {course.locked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              Full Semester Pass &middot; {course.priceFormatted}
            </span>
          ) : null}
        </div>

        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
          {course.title}
        </h1>
      </section>

      <section className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">
            Materials
          </h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Material categories">
            {[
              { id: "all", label: "All (" + course.counts.total + ")" },
              { id: "pyqs", label: "PYQs (" + course.counts.pyqs + ")" },
              { id: "solutions", label: "Solutions (" + course.counts.solutions + ")" },
              { id: "notes", label: "Notes (" + course.counts.notes + ")" },
            ].map(function (tab) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  onClick={function () {
                    setActiveTab(tab.id);
                  }}
                  className={
                    "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors " +
                    (activeTab === tab.id
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredItems.length ? <ul className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {filteredItems.map(function (item) {
            return (
              <li
                key={item.itemKey}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">
                      {item.title}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                      {CATEGORY_LABELS[item.category] || "Notes"}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                      {item.fileType}
                    </span>
                  </div>
                  {item.unitLabel ? (
                    <p className="mt-1 text-xs text-slate-500">{item.unitLabel}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={function () { handleItemClick(item); }}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  {item.locked ? <span aria-hidden="true" className="material-symbols-outlined text-[15px]">lock</span> : null}
                  {user ? "Open material" : item.locked ? "Sign up to unlock" : "Sign up to view"}
                </button>
              </li>
            );
          })}
        </ul> : <p className="mt-4 text-body-sm text-text-secondary">
          {course.items.length ? "No materials in this category." : "No previews have been published for this course."}
        </p>}
      </section>

      {course.locked ? (
        <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-5">
          <div>
            <h2 className="font-semibold text-text-primary">Semester access</h2>
            <p className="mt-1 text-body-sm text-text-secondary">
              One-time {course.priceFormatted} UPI payment for protected Year 1 and Year 2 materials. Access starts after approval.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUnlockClick}
            className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-container"
          >
            {user ? "Get semester access" : "Sign up for semester access"}
          </button>
        </section>
      ) : null}
    </main>
  );
}
