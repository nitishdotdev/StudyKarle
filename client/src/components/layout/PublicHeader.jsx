import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-4 w-full sticky top-0 z-50 bg-white shadow-sm">
      <Link to="/" className="flex items-center gap-2">
        <span className="font-headline-md text-headline-md font-bold text-primary">
          StudyKarle
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
        <Link to="/courses">Courses</Link>
        <Link to="/features">Features</Link>
        <Link to="/how-it-works">How It Works</Link>
        <Link to="/about">About</Link>

        <a
          href="/contact"
          className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors"
        >
          Contact
        </a>
        {/* <a
          className="text-body-md text-text-secondary hover:text-primary transition-colors"
          href="#how-it-works"
        >
          Contact
        </a> */}
      </nav>

      <div className="flex items-center gap-3">
        <Link
          to="/login"
          className="hidden sm:inline-flex bg-primary hover:bg-primary-container text-white px-6 py-2.5 rounded-lg font-label-md text-label-md transition-all active:scale-95 shadow-sm"
        >
          Login / Signup
        </Link>
        <button
          type="button"
          className="md:hidden p-2 text-text-primary"
          onClick={function () {
            setMenuOpen(!menuOpen);
          }}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className="material-symbols-outlined">
            {menuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {menuOpen ? (
        <div className="absolute top-full left-0 w-full bg-white border-t border-border-subtle shadow-lg md:hidden flex flex-col p-4 gap-1">
          <Link
            to="/"
            onClick={function () {
              setMenuOpen(false);
            }}
            className="px-3 py-3 rounded-lg font-label-md text-label-md text-text-primary hover:bg-surface-low transition-colors"
          >
            Home
          </Link>
          <Link
            to="/courses"
            onClick={function () {
              setMenuOpen(false);
            }}
            className="px-3 py-3 rounded-lg font-label-md text-label-md text-text-primary hover:bg-surface-low transition-colors"
          >
            Courses
          </Link>
          <Link
            to="/features"
            onClick={function () {
              setMenuOpen(false);
            }}
            className="px-3 py-3 rounded-lg font-label-md text-label-md text-text-primary hover:bg-surface-low transition-colors"
          >
            Features
          </Link>
          <Link
            to="/how-it-works"
            onClick={function () {
              setMenuOpen(false);
            }}
            className="px-3 py-3 rounded-lg font-label-md text-label-md text-text-primary hover:bg-surface-low transition-colors"
          >
            How It Works
          </Link>
          <Link
            to="/about"
            onClick={function () {
              setMenuOpen(false);
            }}
            className="px-3 py-3 rounded-lg font-label-md text-label-md text-text-primary hover:bg-surface-low transition-colors"
          >
            About
          </Link>
          <Link
            to="/contact"
            onClick={function () {
              setMenuOpen(false);
            }}
            className="px-3 py-3 rounded-lg font-label-md text-label-md text-text-primary hover:bg-surface-low transition-colors"
          >
            Contact
          </Link>

          <Link
            to="/login"
            onClick={function () {
              setMenuOpen(false);
            }}
            className="mt-2 text-center bg-primary text-white px-6 py-3 rounded-lg font-label-md text-label-md"
          >
            Login / Signup
          </Link>
        </div>
      ) : null}
    </header>
  );
}
